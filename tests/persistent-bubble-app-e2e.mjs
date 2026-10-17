import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4205),
  base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, server;
try {
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
    await sleep(50);
  }
  await mkdir(`${root}/artifacts`, { recursive: true });
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  for (const width of [1440, 1024, 390, 320]) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(
      ({ key, state }) => {
        localStorage.setItem(key, JSON.stringify(state));
        sessionStorage.clear();
      },
      {
        key: STORAGE_KEY,
        state: {
          ...initialState(),
          language: "en",
          onboardingStatus: "skipped",
        },
      },
    );
    await page.route("**/api/status", (route) =>
      route.fulfill({
        json: {
          guide: "not_configured",
          analysis: "unavailable",
          scene: "unavailable",
        },
      }),
    );
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".demo-setup-compose").click();
    await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
    await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
    const exit = page
      .getByRole("button", { name: "Exit guide", exact: true })
      .first();
    if (await exit.isVisible()) await exit.click();
    await page
      .getByRole("textbox", { name: "Search products or styles", exact: true })
      .fill(byId("ME-001").en);
    const product = page
      .locator('.product-card[data-concierge-product="ME-001"]')
      .first();
    await product.scrollIntoViewIfNeeded();
    await product.locator(".product-name").focus();
    const bubble = page.locator(".subtitle-bubble[data-persistent-surface]");
    await bubble.waitFor();
    await page.evaluate(() => {
      window.realBubble = document.querySelector("[data-persistent-surface]");
    });
    if (await product.locator(".scene-swap-button").count()) {
      await product.locator(".scene-swap-button").dispatchEvent("click");
      await page.waitForSelector(".subtitle-concierge.is-yielding");
      assert.equal(
        await bubble.evaluate((el) => Number(getComputedStyle(el).opacity)),
        0.5,
      );
      await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
      await page.waitForFunction(
        () =>
          !document
            .querySelector(".subtitle-concierge")
            ?.classList.contains("is-yielding"),
      );
    }
    await product
      .locator(".product-image-button")
      .first()
      .click({ position: { x: 36, y: 160 } });
    await page
      .locator('.modal[data-concierge-current-product="ME-001"]')
      .waitFor();
    await page.waitForSelector(".subtitle-concierge.is-yielding");
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () =>
          window.realBubble ===
          document.querySelector("[data-persistent-surface]"),
      ),
      true,
      "catalog → product sheet keeps exact live DOM",
    );
    assert.equal(
      await bubble.evaluate((el) => Number(getComputedStyle(el).opacity)),
      0.5,
    );
    const placement = await page
      .locator(".subtitle-concierge")
      .getAttribute("data-yield-placement");
    const panel = await page.locator(".subtitle-concierge").boundingBox();
    const image = await page.locator(".detail-visual").boundingBox();
    assert.ok(
      panel.x + panel.width <= image.x ||
        panel.x >= image.x + image.width ||
        panel.y + panel.height <= image.y ||
        panel.y >= image.y + image.height,
      `product sheet image stays clear at ${width}px (${placement})`,
    );
    const input = await page.locator(".subtitle-composer").boundingBox();
    const sheet = await page
      .locator(".modal[data-concierge-current-product]")
      .boundingBox();
    assert.ok(
      sheet.y + sheet.height <= input.y - 10,
      `product sheet and composer are separate at ${width}px`,
    );
    assert.ok(
      Math.abs(input.x + input.width / 2 - width / 2) < 1,
      "sheet input remains centered",
    );
    assert.ok(
      panel.y + panel.height <= input.y - 6 ||
        panel.y >= input.y + input.height + 6 ||
        panel.x + panel.width <= input.x - 6 ||
        panel.x >= input.x + input.width + 6,
      `bubble and composer remain separate at ${width}px`,
    );
    const capture = await page.context().newCDPSession(page);
    const { data } = await capture.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await (
      await import("node:fs/promises")
    ).writeFile(
      `${root}/artifacts/persistent-bubble-sheet-${width}.png`,
      Buffer.from(data, "base64"),
    );
    await capture.detach();
    await page
      .locator(".modal")
      .evaluate((el) =>
        el.dispatchEvent(new Event("scroll", { bubbles: true })),
      );
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".subtitle-concierge")
          ?.classList.contains("is-yielding"),
    );
    assert.equal(
      await bubble.evaluate((el) => Number(getComputedStyle(el).opacity)),
      1,
    );
    const thumbnail = page.locator(".modal [data-outfit-product]").first();
    if (await thumbnail.count()) {
      const id = await thumbnail.getAttribute("data-outfit-product");
      await thumbnail.click();
      await page
        .locator(`.modal[data-concierge-current-product="${id}"]`)
        .waitFor();
      assert.equal(
        await page.evaluate(
          () =>
            window.realBubble ===
            document.querySelector("[data-persistent-surface]"),
        ),
        true,
        "pictured-component links preserve live surface",
      );
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(
      `PASS real App stable portal, image-click yield, unobstructed product and centered composer ${width}px (${placement})`,
    );
  }
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
