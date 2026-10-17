import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4335),
  base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let server, browser;
async function capture(page, name) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${root}/artifacts/${name}.png`,
      Buffer.from(data, "base64"),
    );
  } finally {
    await cdp.detach();
  }
}
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
        String(port),
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
  for (let i = 0; ; i++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (i > 100) throw Error("Vite did not start");
    await sleep(100);
  }
  for (const width of [1440, 1024, 390, 320]) {
    browser = await chromium.launch({
      executablePath: await headless.executablePath(),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const context = await browser.newContext({
      viewport: { width, height: width < 600 ? 844 : 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/tests/fixtures/visit-journey-preview.html`, {
      waitUntil: "networkidle",
    });
    await page.locator("[data-visit-showcase]").waitFor();
    const before = await page.evaluate(() =>
      JSON.stringify(window.__visitTestState),
    );
    assert.equal(await page.locator("[data-visit-product]").count(), 5);
    assert.equal(await page.locator("[data-visit-stop]").count(), 5);
    assert.equal(
      await page
        .locator("[data-visit-source]")
        .getAttribute("data-visit-source"),
      "recommended",
    );
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: innerWidth,
    }));
    assert.ok(overflow.scroll <= overflow.width, JSON.stringify(overflow));
    await capture(page, `visit-journey-${width}-hero`);
    await page.locator('[data-visit-stop="welcome"]').click();
    await page
      .locator('[data-current-visit-stop="welcome"] .vj-welcome')
      .waitFor();
    await page.locator('[data-visit-stop="gift"]').click();
    await page
      .locator('[data-current-visit-stop="gift"] .vj-pending')
      .waitFor();
    await page.getByRole("button", { name: "无台阶", exact: true }).click();
    assert.match(
      await page.locator(".vj-lift-line").innerText(),
      /全程中央电梯/,
    );
    await page
      .getByRole("button", { name: "2F · 女士衣橱", exact: true })
      .click();
    assert.equal(
      await page
        .locator(".vj-stop-detail")
        .getAttribute("data-current-visit-stop"),
      "wardrobe",
    );
    await page.locator("#vj-itinerary").scrollIntoViewIfNeeded();
    await capture(page, `visit-journey-${width}-itinerary`);
    const dress = page.locator('[data-visit-product="ME-015"]');
    await dress.click();
    await page.locator(".vj-product-dialog[open]").waitFor();
    assert.match(await page.locator(".vj-dialog-copy").innerText(), /ME-015/);
    await page.keyboard.press("Escape");
    await page
      .locator(".vj-product-dialog[open]")
      .waitFor({ state: "detached" });
    assert.ok(
      await dress.evaluate((el) => el === document.activeElement),
      "dialog returns focus to the product",
    );
    await page.locator('[data-visit-product="ME-006"]').click();
    assert.match(
      await page.locator(".vj-dialog-status").innerText(),
      /受赠人尺码待确认/,
    );
    await page
      .getByRole("button", { name: "关闭单品详情", exact: true })
      .click();
    await page.getByRole("button", { name: /城市慢生活/ }).click();
    assert.equal(await page.locator("[data-visit-product]").count(), 6);
    assert.ok(await page.locator('[data-visit-product="ME-014"]').count());
    assert.match(await page.locator(".vj-persona").innerText(), /服装 L/);
    assert.match(
      await page.locator('[data-visit-product="ME-013"]').innerText(),
      /EU 42/,
    );
    await page.locator('[data-visit-product="ME-014"]').click();
    await page
      .getByRole("button", { name: "查看完整目录详情", exact: true })
      .click();
    assert.equal(
      await page.evaluate(() => window.__visitAction),
      "product:ME-014",
    );
    assert.equal(
      await page.evaluate(() => JSON.stringify(window.__visitTestState)),
      before,
    );
    assert.deepEqual(errors, []);
    results.push({
      width,
      status: "pass",
      checks: [
        "populated empty state",
        "no overflow",
        "five itinerary stops",
        "step-free route",
        "floor navigation",
        "exact product details",
        "gift size pending",
        "dialog Escape and focus return",
        "two-persona switch",
        "no state mutation",
      ],
    });
    console.log(`PASS visit showcase ${width}px`);
    await page.goto(
      `${base}/tests/fixtures/visit-journey-preview.html?selected=ME-012&language=en`,
      { waitUntil: "networkidle" },
    );
    assert.equal(
      await page
        .locator("[data-visit-source]")
        .getAttribute("data-visit-source"),
      "selected",
    );
    assert.equal(await page.locator("[data-visit-product]").count(), 1);
    assert.equal(await page.locator(".vj-example-switch").count(), 0);
    await page
      .getByRole("button", { name: "Arrange a demo visit", exact: true })
      .click();
    assert.equal(await page.evaluate(() => window.__visitAction), "book");
    assert.ok(await page.locator('[data-visit-product="ME-012"]').count());
    assert.deepEqual(errors, []);
    await browser.close();
    browser = null;
  }
  await writeFile(
    `${root}/artifacts/visit-journey-e2e.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill();
}
