import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, switchCuratedCase, STORAGE_KEY } from "../src/data.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4314);
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
let server, browser;

async function geometry(visual, label) {
  const result = await visual.evaluate((el) => {
    const rect = (node) => {
      const { x, y, width, height, right, bottom } =
        node.getBoundingClientRect();
      return { x, y, width, height, right, bottom };
    };
    const swap = el.querySelector(".scene-swap-button");
    const group = el.querySelector(".outfit-components--compact");
    return {
      visual: rect(el),
      swap: rect(swap),
      group: rect(group),
      directOverlay: group.parentElement === el,
      buttons: [...group.querySelectorAll("button")].map((button) => ({
        ...rect(button),
        image: rect(button.querySelector("img")),
        sku: button.dataset.outfitProduct,
        owned: button.dataset.outfitOwned === "true",
        label: button.getAttribute("aria-label"),
        badge: Boolean(button.querySelector(".outfit-owned-mark")),
        nested: Boolean(button.parentElement.closest("button,a")),
        centerTarget: document
          .elementFromPoint(
            button.getBoundingClientRect().x + 22,
            button.getBoundingClientRect().y + 22,
          )
          ?.closest("button")?.dataset.outfitProduct,
      })),
    };
  });
  assert.ok(result.directOverlay, `${label}: outfit must overlay image`);
  assert.ok(result.buttons.length > 0, `${label}: no outfit controls`);
  assert.ok(
    result.group.y >= result.swap.bottom + 5,
    `${label}: inset collision`,
  );
  for (const button of result.buttons) {
    assert.ok(
      button.width >= 44 && button.height >= 44,
      `${label}: touch target`,
    );
    assert.ok(
      button.image.width < result.swap.width,
      `${label}: thumbnail width`,
    );
    assert.ok(
      button.image.height < result.swap.height,
      `${label}: thumbnail height`,
    );
    assert.ok(
      button.x >= result.visual.x && button.right <= result.visual.right,
      `${label}: x overflow`,
    );
    assert.ok(button.bottom <= result.visual.bottom, `${label}: y overflow`);
    assert.equal(button.nested, false, `${label}: nested interactive controls`);
    assert.equal(
      button.centerTarget,
      button.sku,
      `${label}: intercepted thumbnail`,
    );
    assert.match(button.label, /^View outfit piece:/);
    assert.equal(button.badge, button.owned, `${label}: owned indication`);
    if (button.owned) assert.match(button.label, /Owned, available to reuse/);
  }
  return result;
}

async function assertSwapKeyboard(page, visual) {
  const scene = visual.locator(".personalized-scene");
  const swap = visual.locator(".scene-swap-button");
  assert.equal(await scene.getAttribute("data-scene-main"), "personalized");
  await swap.focus();
  await page.keyboard.press("Enter");
  assert.equal(await scene.getAttribute("data-scene-main"), "original");
  await page.keyboard.press("Space");
  assert.equal(await scene.getAttribute("data-scene-main"), "personalized");
  await page.keyboard.press("Tab");
  assert.equal(
    await visual
      .locator("[data-outfit-product]")
      .first()
      .evaluate((el) => el === document.activeElement),
    true,
    "swap must tab directly to the first outfit piece",
  );
}

try {
  await mkdir(`${root}/artifacts`, { recursive: true });
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        `${port}`,
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
  }
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (attempt > 100) throw Error("Vite did not start");
    await sleep(100);
  }
  for (const width of process.env.E2E_WIDTH
    ? [Number(process.env.E2E_WIDTH)]
    : [1440, 1024, 390, 320]) {
    browser = await chromium.launch({
      executablePath:
        process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const context = await browser.newContext({
      viewport: { width, height: width > 600 ? 1000 : 844 },
      reducedMotion: "reduce",
    });
    for (const [caseId, sku, ownedSku] of [
      ["warm-everyday", "ME-001", "ME-003"],
      ["quiet-city", "ME-012", "ME-011"],
    ]) {
      const page = await context.newPage();
      const errors = [],
        providerCalls = [];
      page.setDefaultTimeout(12000);
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (/\/api\/(guide|analyze)$/.test(request.url()))
          providerCalls.push(request.url());
      });
      await page.addInitScript(
        ({ key, state }) => {
          localStorage.setItem(key, JSON.stringify(state));
          localStorage.setItem("maison-edit-swap-help-v1", "seen");
          for (const id of ["warm-everyday", "quiet-city"])
            sessionStorage.setItem(`maison-edit-guided-case:${id}`, "exited");
        },
        {
          key: STORAGE_KEY,
          state: {
            ...switchCuratedCase(initialState(), caseId),
            language: "en",
          },
        },
      );
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".demo-setup-compose").click();
      await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
      await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
      await page
        .getByRole("textbox", {
          name: "Search products or styles",
          exact: true,
        })
        .fill(sku);
      const product = page
        .locator(`.product-card[data-concierge-product="${sku}"]`)
        .first();
      await product.scrollIntoViewIfNeeded();
      const feedVisual = product.locator(".product-visual");
      await feedVisual.locator(".personalized-scene.is-ready").waitFor();
      await feedVisual.scrollIntoViewIfNeeded();
      const feed = await geometry(feedVisual, `${width}/${caseId}/feed`);
      assert.ok(
        feed.buttons.some((button) => button.sku === ownedSku && button.owned),
        "known owned component is indicated",
      );
      await assertSwapKeyboard(page, feedVisual);
      assert.equal(
        await page.locator(".modal[data-concierge-current-product]").count(),
        0,
        "swap must not open product",
      );
      await page.screenshot({
        path: `${root}/artifacts/compact-outfit-${width}-${caseId}-feed.png`,
      });
      const linkedSku = feed.buttons[0].sku;
      await page.keyboard.press("Enter");
      const modal = page.locator(
        `.modal[data-concierge-current-product="${linkedSku}"]`,
      );
      await modal.waitFor();
      const detailVisual = modal.locator(".detail-visual");
      await detailVisual.locator(".personalized-scene.is-ready").waitFor();
      await detailVisual.scrollIntoViewIfNeeded();
      const detail = await geometry(detailVisual, `${width}/${caseId}/detail`);
      assert.equal(
        await modal.locator(".detail-info .outfit-components").count(),
        0,
        "no outside outfit strip",
      );
      await assertSwapKeyboard(page, detailVisual);
      await page.screenshot({
        path: `${root}/artifacts/compact-outfit-${width}-${caseId}-detail.png`,
      });
      const detailLinkedSku = detail.buttons[0].sku;
      await page.keyboard.press("Enter");
      await page
        .locator(`.modal[data-concierge-current-product="${detailLinkedSku}"]`)
        .waitFor();
      assert.equal(
        await page.locator(".modal[data-concierge-current-product]").count(),
        1,
        "outfit link replaces existing sheet",
      );
      await page
        .getByRole("button", { name: "Close / 关闭", exact: true })
        .click();
      await page
        .locator(".modal[data-concierge-current-product]")
        .waitFor({ state: "detached" });
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
        "horizontal overflow",
      );
      assert.deepEqual(errors, []);
      assert.deepEqual(providerCalls, []);
      results.push({
        width,
        caseId,
        feedComponents: feed.buttons.length,
        detailComponents: detail.buttons.length,
        target: "44px",
        image: "36px",
        keyboard: "pass",
        links: [linkedSku, detailLinkedSku],
        collision: "none",
      });
      console.log(
        `PASS ${width}/${caseId}: compact overlay, owned state, keyboard swap and exact SKU links`,
      );
      await page.close();
    }
    await browser.close();
    browser = null;
  }
  await writeFile(
    `${root}/artifacts/compact-outfit-e2e-report.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  server?.kill();
}
