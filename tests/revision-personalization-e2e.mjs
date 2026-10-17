import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4301";
let server;
if (!process.env.E2E_BASE_URL)
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "preview",
      "--host",
      "127.0.0.1",
      "--port",
      "4301",
      "--strictPort",
    ],
    { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "ignore" },
  );
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
for (
  let n = 0;
  !(await fetch(base)
    .then((r) => r.ok)
    .catch(() => false));
  n++
) {
  if (n > 100) throw Error("Vite did not start");
  await sleep(100);
}
await mkdir("artifacts", { recursive: true });
let browser;
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
async function wait(fn, message, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {}
    await sleep(60);
  }
  throw Error(message);
}
try {
  for (const width of process.env.E2E_WIDTH
    ? [Number(process.env.E2E_WIDTH)]
    : [1440, 390, 320]) {
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
    const page = await context.newPage(),
      errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/\/api\/(guide|analyze)$/.test(r.url())) calls.push(r.url());
    });
    await page.goto(base, { waitUntil: "networkidle" });
    await page.evaluate(
      ({ key, state }) => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.setItem(key, JSON.stringify(state));
      },
      { key: STORAGE_KEY, state: { ...initialState(), language: "en" } },
    );
    await page.reload({ waitUntil: "networkidle" });

    await page.locator(".demo-setup-compose").click();
    await page
      .locator(".demo-setup")
      .waitFor({ state: "detached", timeout: 20000 });
    const transport = page.locator(".music-transport:not(.music-quick-mute)");
    const beforeMusic = await transport.getAttribute("aria-pressed");
    await transport.click();
    assert.notEqual(
      await transport.getAttribute("aria-pressed"),
      beforeMusic,
      "music control must remain clickable through the pointer-transparent tools footprint",
    );
    await transport.click();
    assert.equal(await transport.getAttribute("aria-pressed"), beforeMusic);
    // Desktop first cards are only partly visible at entry: the top-rail
    // lesson must already teach there, before a bottom rail could be seen.
    const entrySceneVisible = await page
      .locator(".personalized-scene")
      .first()
      .evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return Math.min(innerHeight, rect.bottom) - Math.max(0, rect.top) >= 96;
      });
    if (width > 600 && entrySceneVisible) {
      await page.locator(".scene-swap-tutorial").waitFor();
      await capture(page, `artifacts/revision-${width}-swap-appearance.png`);
    }
    // A narrow viewport can open above the catalog. Teaching starts when the
    // shopper reaches the first scene, with no automatic scene scroll.
    await page
      .locator(".personalized-scene")
      .first()
      .evaluate((node) => {
        // Place the real scene in a clear upper reading band. Independent fixed
        // conversation controls remain visible in their own lower viewport area.
        scrollBy({
          top: node.getBoundingClientRect().top - 110,
          behavior: "instant",
        });
      });
    const liveLesson = page
      .locator(".personalized-scene.is-swap-tutorial")
      .first();
    await liveLesson.waitFor();
    await liveLesson.scrollIntoViewIfNeeded();
    assert.equal(
      await page.locator(".scene-swap-help").count(),
      0,
      "the lesson must belong to a real thumbnail, not a detached intro",
    );
    assert.equal(
      await page.locator(".scene-swap-tutorial").count(),
      1,
      "only the first visible scene teaches",
    );
    assert.equal(
      await page.locator(".guided-click-mask").count(),
      0,
      "image lesson must not block browsing",
    );
    await capture(page, `artifacts/revision-${width}-swap-help.png`);
    await liveLesson.locator(".scene-swap-button").click();
    await page.locator('[data-guided-step="invite"]').waitFor();
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    await page
      .getByRole("button", { name: "Start the three-step tour", exact: true })
      .click();
    await page.locator('[data-guided-step="try-list"]').waitFor();
    const tourSku = await page
      .locator('[data-guided-step="try-list"]')
      .getAttribute("data-guided-sku");
    const favorite = page
      .locator(
        `[data-concierge-product="${tourSku}"] [data-tour-action="try-list"]`,
      )
      .first();
    await sleep(700);
    assert.equal(
      await page.locator(".guided-demo-panel").count(),
      1,
      "guide sibling keys must stay unique",
    );
    await capture(page, `artifacts/revision-${width}-required-favorite.png`);
    await favorite.click({ timeout: 10000 });
    console.log("favorite clicked", width);
    await sleep(1000);
    assert.equal(
      await page.locator(".guided-demo-panel").count(),
      1,
      "favorite must not orphan guide nodes",
    );
    await page
      .locator('[data-guided-step="review"]')
      .waitFor({ timeout: 5000 });
    const modal = page.getByRole("dialog", {
      name: byId(tourSku).en,
      exact: true,
    });
    await modal.waitFor();
    await wait(
      async () =>
        await modal.locator('[data-tour-action="review-list"]').isVisible(),
      "bag action missing",
    );
    await capture(page, `artifacts/revision-${width}-required-bag.png`);
    assert.equal(
      await modal.locator('.automatic-fit[data-auto-fit="matched"]').count(),
      1,
    );
    assert.equal(
      await modal.getByRole("button", { name: "L", exact: true }).count(),
      0,
      "no manual product size selector",
    );
    const afterFirstAdd = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    assert.equal(
      afterFirstAdd.cart.filter((x) => x.skuId === tourSku).length,
      1,
    );
    assert.equal(
      afterFirstAdd.cart.find((x) => x.skuId === tourSku).quantity,
      1,
    );
    assert.equal(
      afterFirstAdd.cart.find((x) => x.skuId === tourSku).preparation.status,
      "pending",
    );
    await modal.locator('[data-tour-action="review-list"]').click();
    console.log("bag clicked", width);
    await page.locator('[data-guided-step="visit"]').waitFor();
    let stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    assert.ok(
      !stored.wishlist.includes(tourSku),
      "try-list additions are not old favorites",
    );
    assert.ok(
      stored.cart.some(
        (x) => x.skuId === tourSku && x.size === stored.profile.size,
      ),
    );
    assert.equal(
      stored.cart.find((x) => x.skuId === tourSku).quantity,
      1,
      "review must not duplicate add",
    );
    // The guide waits until the real visit planner is reached; no synthetic click.
    for (
      let n = 0;
      n < 80 &&
      !(await page.locator('[data-tour-action="plan-visit"]').count());
      n++
    ) {
      await page.evaluate(() => scrollBy(0, innerHeight * 1.2));
      await sleep(100);
    }
    const visit = page.locator('[data-tour-action="plan-visit"]').first();
    await visit.scrollIntoViewIfNeeded();
    await wait(
      async () => (await page.locator(".guided-target-ring").count()) > 0,
      "planner did not spotlight",
    );
    await visit.click();
    console.log("visit clicked", width);
    await page.locator('[data-guided-step="done"]').waitFor();
    assert.equal(
      (
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          STORAGE_KEY,
        )
      ).bookings.length,
      0,
      "planning must not make actual or demo booking without form",
    );
    await page
      .getByRole("button", { name: "Continue exploring", exact: true })
      .click();
    // Clear the planning modal if the button opened bag/booking, preserving shopper actions.
    const close = page.getByRole("button", {
      name: "Close / 关闭",
      exact: true,
    });
    if (await close.count()) await close.last().click();
    await page.evaluate(() => scrollTo(0, 0));
    await page
      .getByRole("button", { name: "Change case", exact: true })
      .click();
    // The second case has its own first-visible lesson. Closing it exits
    // the optional tour without replaying the lesson on a later case return.
    await page
      .locator(".personalized-scene")
      .first()
      .evaluate((node) => {
        // Place the real scene in a clear upper reading band. Independent fixed
        // conversation controls remain visible in their own lower viewport area.
        scrollBy({
          top: node.getBoundingClientRect().top - 110,
          behavior: "instant",
        });
      });
    const otherLesson = page.locator(
      ".scene-swap-tutorial .scene-tutorial-dismiss",
    );
    await otherLesson.waitFor();
    await otherLesson.click();
    stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    assert.equal(stored.profile.personaId, "relaxed-man-50");
    assert.ok(!stored.purchaseHistory.some((x) => x.skuId === "ME-003"));
    assert.equal(stored.cart.length, 0);
    assert.equal(
      await page.locator(".scene-swap-help").count(),
      0,
      "detached help must not return",
    );
    await page
      .getByRole("button", { name: "Change case", exact: true })
      .click();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.locator(".scene-swap-tutorial").count(),
      0,
      "completed lesson must stay dismissed when returning to the case",
    );
    stored = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    assert.ok(
      !stored.wishlist.includes(tourSku),
      "try-list additions are not old favorites",
    );
    assert.ok(stored.cart.some((x) => x.skuId === tourSku));
    // Open a product and swap images repeatedly without remounting a live bubble.
    await page
      .locator('input[aria-label="Search products or styles"]')
      .fill("ME-001");
    const scene = page
      .locator('[data-concierge-product="ME-001"] .personalized-scene')
      .first();
    await scene.scrollIntoViewIfNeeded();
    await wait(
      async () =>
        (await scene.getAttribute("data-scene-main")) === "personalized",
      "scene did not decode",
    );
    await scene.locator(".scene-swap-button").click();
    await scene.locator(".scene-swap-button").click();
    await sleep(1600);
    const live = page.locator("[data-persistent-surface]");
    if (await live.count()) {
      await page.evaluate(
        () =>
          (window.__revisionBubble = document.querySelector(
            "[data-persistent-surface]",
          )),
      );
      await scene.locator(".product-image-button").click();
      await sleep(650);
      assert.equal(
        await page.evaluate(
          () =>
            window.__revisionBubble ===
            document.querySelector("[data-persistent-surface]"),
        ),
        true,
        "product detail remounted live bubble",
      );
      const sheetBox = await page
        .locator(".modal[data-concierge-current-product]")
        .boundingBox();
      const composerBox = await page
        .locator(".subtitle-composer")
        .boundingBox();
      assert.ok(
        sheetBox.y + sheetBox.height <= composerBox.y - 10,
        "product sheet must reserve a clear band for composer",
      );
      const yielding = page.locator(".subtitle-concierge.is-yielding");
      assert.ok((await yielding.count()) > 0, "image click must yield");
      const opacity = await page
        .locator("[data-persistent-surface]")
        .evaluate((el) => Number(getComputedStyle(el).opacity));
      assert.ok(opacity <= 0.55, "yield opacity not half");
      await capture(page, `artifacts/revision-${width}-image-yield.png`);
      await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
      await sleep(400);
      assert.equal(
        await page.locator(".subtitle-concierge.is-yielding").count(),
        0,
        "scroll must restore bubble",
      );
      await page
        .getByRole("button", { name: "Close / 关闭", exact: true })
        .last()
        .click();
    }
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "horizontal overflow",
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    const mounted = await page.locator("[data-concierge-occurrence]").count();
    results.push({
      width,
      motion: "reduce",
      tour: "pass",
      caseHistory: "pass",
      imageSwap: "pass",
      mountedOccurrences: mounted,
      errors: errors.length,
      providerCalls: calls.length,
    });
    await capture(page, `artifacts/revision-${width}-final.png`);
    await context.close();
    await browser.close();
    browser = null;
  }
  await writeFile(
    "artifacts/revision-e2e-report.json",
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  server?.kill();
}
