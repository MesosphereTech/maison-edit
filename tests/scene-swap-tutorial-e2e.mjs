// Real scene buttons and first-visible lesson ownership; no provider calls.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4407";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser;
const server = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    "4407",
    "--strictPort",
  ],
  { cwd: root, stdio: "ignore" },
);
const results = [];
async function until(fn, label, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(40);
  }
  throw Error(label);
}
try {
  await until(
    () =>
      fetch(base)
        .then((r) => r.ok)
        .catch(() => false),
    "Vite failed",
  );
  await mkdir(`${root}/artifacts`, { recursive: true });
  for (const [width, motion, language] of [
    [1440, "no-preference", "en"],
    [390, "reduce", "zh"],
    [320, "reduce", "en"],
  ]) {
    browser = await chromium.launch({
      executablePath:
        process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const context = await browser.newContext({
      viewport: { width, height: width > 600 ? 1000 : 844 },
      reducedMotion: motion,
    });
    const page = await context.newPage();
    const errors = [],
      calls = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("request", (r) => {
      if (/\/api\/(guide|analyze)$/.test(r.url())) calls.push(r.url());
    });
    await page.goto(`${base}/tests/fixtures/scene-swap-tutorial.html`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(
      ({ language }) =>
        window.renderSceneTutorialFixture({ language, twoScenes: true }),
      { language },
    );
    await page
      .locator('[data-fixture-location="visible"] .scene-swap-tutorial')
      .waitFor();
    await page
      .locator('[data-fixture-location="offscreen"] img')
      .evaluateAll((images) =>
        Promise.all(
          images.map(async (img) => {
            img.loading = "eager";
            await img.decode();
          }),
        ),
      );
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 1);
    assert.equal(
      await page
        .locator('[data-fixture-location="offscreen"] .scene-swap-tutorial')
        .count(),
      0,
    );
    assert.equal(await page.locator(".scene-swap-help").count(), 0);
    const visible = page.locator(
      '[data-fixture-location="visible"] .personalized-scene',
    );
    const geometry = await visible.evaluate((node) => {
      const rail = node
        .querySelector(".scene-swap-tutorial")
        .getBoundingClientRect();
      const main = node
        .querySelector(".scene-image-plane.is-main")
        .getBoundingClientRect();
      const contentRight = node
        .querySelector(".scene-tutorial-dismiss")
        .getBoundingClientRect().right;
      const controls = [...node.parentElement.querySelectorAll("button")].map(
        (button) => {
          const r = button.getBoundingClientRect();
          return {
            label: button.getAttribute("aria-label"),
            hit:
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest("button") === button,
            tutorial: button.classList.contains("scene-tutorial-dismiss"),
            overlap:
              r.top < rail.bottom &&
              r.bottom > rail.top &&
              r.left < contentRight &&
              r.right > rail.left,
          };
        },
      );
      return {
        rail: {
          top: rail.top,
          bottom: rail.bottom,
          left: rail.left,
          right: rail.right,
        },
        mainTop: main.top,
        controls,
        overflows: document.documentElement.scrollWidth > innerWidth + 1,
        animations: node
          .getAnimations({ subtree: true })
          .map((animation) => animation.animationName),
      };
    });
    assert.ok(
      geometry.mainTop >= geometry.rail.bottom - 1,
      JSON.stringify(geometry),
    );
    assert.ok(geometry.rail.bottom <= (width > 600 ? 1000 : 844));
    assert.ok(!geometry.overflows);
    assert.ok(
      geometry.controls.every((control) => control.hit),
      JSON.stringify(geometry.controls),
    );
    assert.ok(
      geometry.controls
        .filter((control) => !control.tutorial)
        .every((control) => !control.overlap),
      JSON.stringify(geometry.controls),
    );
    if (motion === "reduce") assert.deepEqual(geometry.animations, []);
    else assert.ok(geometry.animations.includes("scene-tutorial-hand"));
    const swap = visible.locator(".scene-swap-button");
    assert.ok(await swap.getAttribute("aria-describedby"));
    await page.screenshot({
      path: `${root}/artifacts/swap-tutorial-${width}.png`,
    });
    // Independent overlays must not leave hidden copy or an inaccessible close
    // button. Removing the obstruction restores the same unconsumed lesson.
    await visible.locator(".scene-tutorial-copy").evaluate((copy) => {
      const rect = copy.getBoundingClientRect();
      const overlay = document.createElement("div");
      overlay.id = "fixture-tutorial-obstruction";
      Object.assign(overlay.style, {
        position: "fixed",
        zIndex: "99999",
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        background: "white",
      });
      document.body.append(overlay);
    });
    await until(
      () =>
        page
          .locator(".scene-swap-tutorial")
          .count()
          .then((count) => count === 0),
      "obstructed lesson remained active",
    );
    await page.waitForTimeout(100);
    assert.equal(
      await page.locator(".scene-swap-tutorial").count(),
      0,
      "obstructed lesson oscillated into view",
    );
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem(
          "maison-edit-scene-swap-tutorial:v2:warm-everyday",
        ),
      ),
      null,
    );
    await page.evaluate(() =>
      document.getElementById("fixture-tutorial-obstruction").remove(),
    );
    await visible.locator(".scene-swap-tutorial").waitFor();
    // Closing teaches once per case/tab, with predictable keyboard focus.
    await visible.locator(".scene-tutorial-dismiss").focus();
    await page.keyboard.press("Enter");
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    assert.equal(
      await swap.evaluate((button) => document.activeElement === button),
      true,
    );
    await page.evaluate(() =>
      window.renderSceneTutorialFixture({ sku: "ME-009" }),
    );
    await page.waitForTimeout(150);
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator(".scene-swap-tutorial").count(),
      0,
      "reload repeated a dismissed lesson",
    );
    await page.evaluate(() =>
      window.renderSceneTutorialFixture({
        caseId: "quiet-city",
        sku: "ME-014",
      }),
    );
    await page.locator(".scene-swap-tutorial").waitFor();
    await page.locator(".scene-tutorial-dismiss").click();
    await page.evaluate(() => window.renderSceneTutorialFixture());
    await page.waitForTimeout(150);
    assert.equal(
      await page.locator(".scene-swap-tutorial").count(),
      0,
      "returning to case repeated a dismissed lesson",
    );
    // Explicit reset replays the current lesson. Swapping is the real action.
    await page.evaluate(() => window.resetSceneSwapTutorial("warm-everyday"));
    await page.locator(".scene-swap-tutorial").waitFor();
    const actual = page.locator(".scene-swap-button");
    await actual.focus();
    await page.keyboard.press("Enter");
    await until(
      () =>
        page
          .locator(".personalized-scene")
          .getAttribute("data-scene-main")
          .then((value) => value === "original"),
      "Enter did not swap",
    );
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    assert.equal(await page.locator(".scene-image-plane > img").count(), 2);
    assert.equal(await page.evaluate(() => window.sceneOpenCount), 0);
    await page.keyboard.press("Space");
    await until(
      () =>
        page
          .locator(".personalized-scene")
          .getAttribute("data-scene-main")
          .then((value) => value === "personalized"),
      "Space did not return",
    );
    assert.ok(
      (await page.locator(".scene-personalized").getAttribute("alt")).includes(
        "ME-015",
      ),
    );
    await page.evaluate(() => window.resetSceneSwapTutorial("warm-everyday"));
    await page.locator(".scene-swap-tutorial").waitFor();
    await actual.focus();
    await page.keyboard.press("Escape");
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    // Opposite-department gift imagery keeps the model disclosure and exact
    // SKU mapping. The lesson is still scoped to the shopper's current case.
    await page.evaluate(() => {
      window.renderSceneTutorialFixture({
        sku: "ME-014",
        gift: { isGift: true },
      });
      window.resetSceneSwapTutorial("warm-everyday");
    });
    await page.locator(".scene-swap-tutorial").waitFor();
    const giftScene = page.locator(
      '.personalized-scene[data-gift-preview="true"]',
    );
    assert.equal(await giftScene.getAttribute("data-scene-model"), "fictional");
    assert.equal(
      await giftScene.getAttribute("data-scene-id"),
      "man-knit-cafe",
    );
    assert.match(
      await giftScene.locator(".scene-personalized").getAttribute("alt"),
      /fictional adult model, not the shopper or recipient/,
    );
    assert.match(
      await giftScene.locator(".gift-model-note").innerText(),
      /not you or the recipient/,
    );
    await giftScene.locator(".scene-swap-button").click();
    assert.equal(await giftScene.getAttribute("data-scene-main"), "original");
    assert.equal(
      await page.evaluate(() =>
        sessionStorage.getItem(
          "maison-edit-scene-swap-tutorial:v2:warm-everyday",
        ),
      ),
      "swapped",
    );
    await page.evaluate(() => {
      window.renderSceneTutorialFixture({ color: "unprepared-colour" });
      window.resetSceneSwapTutorial("warm-everyday");
    });
    await page.waitForTimeout(120);
    assert.equal(
      await page.locator(".scene-swap-button").count(),
      0,
      "unsupported variant cannot teach a nonexistent swap",
    );
    assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    results.push({
      width,
      motion,
      language,
      status: "pass",
      firstVisibleOnly: true,
      perCaseTabDismissal: true,
      explicitReset: true,
      keyboardSwap: true,
      unclippedControls: true,
    });
    console.log(`PASS scene swap tutorial ${width}px ${language} ${motion}`);
    await browser.close();
    browser = null;
  }
  await writeFile(
    `${root}/artifacts/swap-tutorial-e2e.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  if (browser) await browser.close();
  server.kill("SIGTERM");
}
