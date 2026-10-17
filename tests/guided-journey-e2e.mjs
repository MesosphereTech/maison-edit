// End-to-end tests use real wheel/keyboard/click input. No guide target is
// clicked by script, and no booking or real backend action is submitted.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY } from "../src/data.js";
import { curatedScenarioFor } from "../src/personalized-scenes.js";
import { journeyKey } from "../src/guided-journey.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4417";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const server = process.env.E2E_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4417",
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
let browser;
const results = [];
async function until(fn, label, timeout = 15000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {}
    await sleep(60);
  }
  throw Error(label);
}
async function progress(page, key) {
  return page.evaluate(
    (k) => JSON.parse(sessionStorage.getItem(k) || "null"),
    key,
  );
}
async function capture(page, path) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(path, Buffer.from(data, "base64"));
  } finally {
    await cdp.detach();
  }
}
async function reset(page) {
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, state }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state: { ...initialState(), language: "en" } },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup")
    .waitFor({ state: "detached", timeout: 20000 });
  const profile = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).profile,
    STORAGE_KEY,
  );
  return curatedScenarioFor(profile).id;
}
async function teachSwap(page, width, motion) {
  await page
    .locator(".personalized-scene")
    .first()
    .evaluate((el) =>
      scrollBy({
        top: el.getBoundingClientRect().top - 110,
        behavior: "instant",
      }),
    );
  const lesson = page.locator(".personalized-scene.is-swap-tutorial");
  await lesson.waitFor();
  assert.equal(await lesson.count(), 1);
  const target = lesson.locator(".scene-swap-button");
  const before = await lesson.getAttribute("data-scene-main");
  const y = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 400);
  await page.waitForTimeout(200);
  assert.ok(
    Math.abs((await page.evaluate(() => scrollY)) - y) < 2,
    "required swap holds scrolling",
  );
  await page.mouse.click(3, 400);
  assert.equal(
    await page.locator(".scene-swap-tutorial").count(),
    1,
    "backdrop does not complete or dismiss",
  );
  await target.evaluate((el) => el.click());
  await page.waitForTimeout(100);
  assert.equal(
    await lesson.getAttribute("data-scene-main"),
    before,
    "synthetic click cannot complete or swap required step",
  );
  await capture(page, `${root}artifacts/v17-guide-${width}-${motion}-swap.png`);
  if (width === 1440) await target.click();
  else {
    await target.focus();
    await page.keyboard.press(width === 390 ? "Enter" : "Space");
  }
  await page.locator('[data-guided-step="invite"]').waitFor();
  assert.equal(await page.locator(".scene-swap-required-mask").count(), 0);
  assert.equal(await page.locator(".scene-swap-tutorial").count(), 0);
}
async function browseEight(page, key) {
  await page.waitForTimeout(850);
  const first = await progress(page, key);
  assert.ok(
    !first || first.seen.length < 8,
    "rendered feed does not count as eight views",
  );
  for (let i = 0; i < 85; i++) {
    const p = await progress(page, key);
    if (p?.status === "pending") return p;
    if (p?.status === "exited")
      throw Error(
        `The test's wheel input interrupted travel: ${JSON.stringify(p)}`,
      );
    await page.mouse.wheel(0, 380);
    await page.waitForTimeout(1050);
  }
  throw Error("eight distinct viewed products never queued the visit");
}
try {
  await until(
    () =>
      fetch(base)
        .then((r) => r.ok)
        .catch(() => false),
    "Vite failed",
  );
  await mkdir(`${root}artifacts`, { recursive: true });
  const widths = process.env.E2E_WIDTH
    ? [Number(process.env.E2E_WIDTH)]
    : [1440, 390, 320];
  const motions = process.env.E2E_MOTION
    ? [process.env.E2E_MOTION]
    : ["no-preference", "reduce"];
  for (const width of widths)
    for (const motion of motions) {
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
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      try {
        const caseId = await reset(page),
          key = journeyKey(caseId);
        await teachSwap(page, width, motion);
        if (width === 390 && motion === "reduce") {
          // Previous required try-list/review steps keep ownership and never inflate
          // the browsing counter with their own automatic target scrolling.
          await page
            .getByRole("button", {
              name: "Start the three-step tour",
              exact: true,
            })
            .click();
          const sku = await page
            .locator('[data-guided-step="try-list"]')
            .getAttribute("data-guided-sku");
          await page
            .locator(
              `[data-concierge-product="${sku}"] [data-tour-action="try-list"]`,
            )
            .first()
            .click();
          await page.locator('[data-guided-step="review"]').waitFor();
          assert.equal(await page.locator(".guided-demo-panel").count(), 1);
          const beforeReview = await progress(page, key);
          await page.waitForTimeout(800);
          assert.deepEqual(
            await progress(page, key),
            beforeReview,
            "review modal is not browsing",
          );
          await page
            .locator('.product-detail [data-tour-action="review-list"]')
            .click();
          await page.locator('[data-guided-step="visit"]').waitFor();
        }
        await page.evaluate(() => {
          window.__journeySamples = [];
          const sample = () => {
            if (document.documentElement.dataset.guidedTravel)
              window.__journeySamples.push({
                y: scrollY,
                time: performance.now(),
              });
            requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        });
        const queued = await browseEight(page, key);
        assert.equal(queued.seen.length, 8);
        assert.equal(new Set(queued.seen).size, 8);
        await page
          .locator(
            '[data-guided-step="visit"][data-journey-phase="awaiting-click"]',
          )
          .waitFor({ timeout: 16000 });
        const samples = await page.evaluate(() => window.__journeySamples);
        if (motion === "no-preference") {
          assert.ok(
            samples.length >= 10,
            "normal travel has controlled animation frames",
          );
          assert.ok(
            new Set(samples.map((entry) => Math.round(entry.y))).size > 5,
            "normal travel moves smoothly through multiple positions",
          );
        }
        const actual = page
          .locator('[data-tour-action="plan-visit"]')
          .filter({ visible: true })
          .first();
        const rect = await actual.boundingBox();
        assert.ok(
          rect &&
            rect.y >= 60 &&
            rect.y + rect.height <= (width > 600 ? 1000 : 844),
          "real visit CTA is fully visible on arrival",
        );
        assert.equal(await page.locator(".guided-click-mask").count(), 1);
        await page.waitForTimeout(700);
        assert.equal(
          (await progress(page, key)).status,
          "pending",
          "arrival is not completion",
        );
        const y = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 450);
        await page.waitForTimeout(100);
        assert.ok(
          Math.abs((await page.evaluate(() => scrollY)) - y) < 2,
          "visit waits for real target",
        );
        await page.mouse.click(width - 2, 100);
        assert.equal((await progress(page, key)).status, "pending");
        await capture(
          page,
          `${root}artifacts/v17-guide-${width}-${motion}-visit.png`,
        );
        await actual.focus();
        await page.keyboard.press("Enter");
        await page.locator(".visit-page").waitFor();
        assert.equal((await progress(page, key)).status, "completed");
        const saved = await page.evaluate(
          (k) => JSON.parse(localStorage.getItem(k)),
          STORAGE_KEY,
        );
        assert.equal(
          saved.bookings.length,
          0,
          "guide does not fabricate booking",
        );
        assert.equal(
          await page
            .locator(
              ".guided-click-mask, .guided-demo-panel, .guided-journey-travel",
            )
            .count(),
          0,
          "visit workspace has no duplicate floating tour UI",
        );
        assert.deepEqual(errors, []);
        results.push({
          width,
          motion,
          status: "pass",
          seen: queued.seen,
          travelFrames: samples.length,
        });
        console.log(`PASS eight-product journey ${width} ${motion}`);
      } catch (error) {
        console.error(
          "Guide failure state",
          await page.evaluate(() => Object.entries(sessionStorage)),
        );
        await capture(
          page,
          `${root}artifacts/v17-guide-${width}-${motion}-failure.png`,
        ).catch(() => {});
        throw error;
      } finally {
        await browser.close();
        browser = null;
      }
    }
  const resultSuffix =
    process.env.E2E_WIDTH || process.env.E2E_MOTION
      ? `-${process.env.E2E_WIDTH || "all"}-${process.env.E2E_MOTION || "both"}`
      : "";
  await writeFile(
    `${root}artifacts/v17-guided-journey-e2e${resultSuffix}.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill();
}
