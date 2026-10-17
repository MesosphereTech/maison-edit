import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { STORAGE_KEY, byId } from "../src/data.js";
import { initialState } from "./legacy-warm-fixture.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4317);
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
async function capture(page, path) {
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(data, "base64"));
  } finally {
    await session.detach();
  }
}
let server, browser;
try {
  await mkdir(`${root}/artifacts`, { recursive: true });
  if (!process.env.E2E_BASE_URL)
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
      executablePath: await headless.executablePath(),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const context = await browser.newContext({
      viewport: { width, height: width > 600 ? 1000 : 844 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(12000);
    const errors = [],
      calls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\/api\/(guide|analyze)$/.test(request.url()))
        calls.push(request.url());
    });
    const state = initialState();
    state.language = "en";
    state.wishlist = ["ME-006"];
    const history = structuredClone(state.purchaseHistory);
    await page.addInitScript(
      ({ key, state }) => {
        if (!sessionStorage.getItem("try-list-test-initialized")) {
          localStorage.setItem(key, JSON.stringify(state));
          localStorage.setItem("maison-edit-swap-help-v1", "seen");
          sessionStorage.setItem(
            "maison-edit-guided-case:warm-everyday",
            "exited",
          );
          sessionStorage.setItem(
            "maison-edit-scene-swap-tutorial:v2:warm-everyday",
            "dismissed",
          );
          sessionStorage.setItem("try-list-test-initialized", "true");
        }
      },
      { key: STORAGE_KEY, state },
    );
    const stored = () =>
      page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)),
        STORAGE_KEY,
      );
    const search = async (sku) => {
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
      return product;
    };
    const openProduct = async (product) => {
      const name = product.locator(".product-name");
      await name.evaluate((element) =>
        element.scrollIntoView({ block: "center" }),
      );
      await sleep(300);
      const evidence = await name.evaluate((element) => {
        const rect = (node) => {
          if (!node) return null;
          const { x, y, width, height, bottom, right } =
            node.getBoundingClientRect();
          return { x, y, width, height, bottom, right };
        };
        const box = element.getBoundingClientRect();
        const top = document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        );
        const surface =
          top?.closest(
            ".subtitle-concierge,.subtitle-composer,.floating-tools,.toast",
          ) || top;
        return {
          name: element.textContent,
          nameRect: rect(element),
          targetIsName: top?.closest("button") === element,
          centerTop: {
            tag: top?.tagName,
            className: top?.className,
            rect: rect(top),
          },
          interceptor: { className: surface?.className, rect: rect(surface) },
          scrollY,
          viewport: { width: innerWidth, height: innerHeight },
          scrollMax: document.documentElement.scrollHeight - innerHeight,
        };
      });
      if (width < 600) {
        const sku = await product.getAttribute("data-concierge-product");
        await capture(
          page,
          `${root}/artifacts/try-list-${width}-${sku}-name-entry.png`,
        );
        await writeFile(
          `${root}/artifacts/try-list-${width}-${sku}-name-entry.json`,
          JSON.stringify(evidence, null, 2),
        );
        console.log("NAME_TARGET", JSON.stringify(evidence));
      }
      assert.equal(
        evidence.targetIsName,
        true,
        `product name intercepted: ${JSON.stringify(evidence)}`,
      );
      await name.click();
    };
    const close = () =>
      page.getByRole("button", { name: "Close / 关闭", exact: true }).click();
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".demo-setup-compose").click();
    await page
      .locator(".demo-setup[open]")
      .waitFor({ state: "hidden", timeout: 10000 });
    await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
    let product = await search("ME-001");
    const add = product.locator('[data-tour-action="try-list"]');
    assert.equal(
      await add.getAttribute("aria-label"),
      "Add to store try-on list",
    );
    const target = await add.boundingBox();
    assert.ok(target.width >= 44 && target.height >= 44);
    await add.click();
    await add.click();
    let data = await stored();
    assert.equal(data.cart.length, 1);
    assert.equal(data.cart[0].quantity, 1);
    assert.equal(data.cart[0].size, "M");
    assert.equal(data.cart[0].fit.source, "fictional-persona");
    assert.equal(data.cart[0].preparation.status, "pending");
    assert.deepEqual(data.wishlist, ["ME-006"]);
    assert.deepEqual(data.purchaseHistory, history);
    assert.deepEqual(data.bookings, []);
    await openProduct(product);
    let modal = page.locator('.modal[data-concierge-current-product="ME-001"]');
    assert.equal(await modal.locator(".automatic-fit").count(), 1);
    assert.equal(
      await modal.getByRole("button", { name: "M", exact: true }).count(),
      0,
    );
    await modal.locator('[data-tour-action="review-list"]').click();
    assert.equal((await stored()).cart[0].quantity, 1);
    await close();
    product = await search("ME-017");
    assert.equal(
      await product
        .locator('[data-tour-action="try-list"]')
        .getAttribute("aria-label"),
      "Add to store experience list",
    );
    await product.locator('[data-tour-action="try-list"]').click();
    assert.equal(
      (await stored()).cart.find((line) => line.skuId === "ME-017").fit.status,
      "not-required",
    );
    product = await search("ME-015");
    await openProduct(product);
    modal = page.locator('.modal[data-concierge-current-product="ME-015"]');
    await modal
      .getByRole("radio", { name: "Give as a gift", exact: true })
      .check();
    assert.match(
      await modal.locator(".automatic-fit").innerText(),
      /Recipient size: confirm at store/,
    );
    await modal.locator('[data-tour-action="add-bag"]').click();
    await close();
    await page
      .getByRole("button", {
        name: "Store try-on & experience list",
        exact: true,
      })
      .click();
    assert.equal(
      await page
        .locator('.live-try-list[data-live-try-list="consumer"] [data-try-sku]')
        .count(),
      3,
    );
    assert.match(
      await page.locator(".legacy-saved-pieces").innerText(),
      /not been submitted/,
    );
    assert.equal(
      (await stored()).cart.some((line) => line.skuId === "ME-006"),
      false,
    );
    const merchant = page.getByRole("button", {
      name: "Merchant studio",
      exact: true,
    });
    await merchant.scrollIntoViewIfNeeded();
    await merchant.click();
    const live = page.locator('.live-try-list[data-live-try-list="merchant"]');
    assert.equal(await live.locator("[data-try-sku]").count(), 3);
    assert.equal(
      (await stored()).bookings.length,
      0,
      "merchant receives list before booking",
    );
    const first = live.locator('[data-try-sku="ME-001"]');
    assert.match(await first.innerText(), /awaiting store confirmation/);
    await first.locator("select").selectOption("ready");
    assert.match(await first.innerText(), /confirmed ready/);
    const gift = live.locator('[data-try-sku="ME-015"]');
    assert.equal(
      await gift.locator('option[value="ready"]').getAttribute("disabled"),
      "",
    );
    assert.match(await gift.innerText(), /Recipient size: confirm at store/);
    assert.doesNotMatch(
      await gift.locator(".try-list-preparation").innerText(),
      /confirmed ready/,
    );
    await live
      .locator('[data-try-sku="ME-017"] select')
      .selectOption("unavailable");
    await capture(page, `${root}/artifacts/try-list-${width}-merchant.png`);
    await page
      .getByRole("button", {
        name: "Store try-on & experience list",
        exact: true,
      })
      .click();
    const consumer = page.locator(
      '.live-try-list[data-live-try-list="consumer"]',
    );
    assert.match(
      await consumer.locator('[data-try-sku="ME-001"]').innerText(),
      /confirmed ready/,
    );
    assert.match(
      await consumer.locator('[data-try-sku="ME-017"]').innerText(),
      /unavailable/,
    );
    await page
      .getByRole("button", { name: "Review list & preparation", exact: false })
      .click();
    assert.match(
      await page.locator(".bag-items").innerText(),
      /confirmed ready/,
    );
    assert.match(
      await page.locator(".bag-items").innerText(),
      /Recipient size: confirm at store/,
    );
    await capture(page, `${root}/artifacts/try-list-${width}-drawer.png`);
    await close();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
    );
    data = await stored();
    assert.deepEqual(data.purchaseHistory, history);
    const readyLine = data.cart.find((line) => line.skuId === "ME-001");
    assert.equal(readyLine.preparation.status, "ready");
    assert.ok(readyLine.preparation.acknowledgedAt);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(
      (await stored()).cart.find((line) => line.skuId === "ME-001").preparation
        .status,
      "ready",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    results.push({
      width,
      duplicateAdd: "none",
      autoSize: "M fictional template",
      experience: "no size",
      merchantBeforeBooking: true,
      readyAcknowledgement: "persisted",
      giftUnknownSize: "pending, cannot ready",
      legacyLikes: "kept unsubmitted",
      ownership: "unchanged",
    });
    console.log(
      `PASS ${width}: explicit list, auto size, merchant pre-booking ack, gift pending and persistence`,
    );
    await browser.close();
    browser = null;
  }
  await writeFile(
    `${root}/artifacts/try-list${process.env.E2E_WIDTH ? `-${process.env.E2E_WIDTH}` : ""}-e2e-report.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill();
}
