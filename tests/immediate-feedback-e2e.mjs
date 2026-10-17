import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";
const port = 4335,
  base = `http://127.0.0.1:${port}`,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let browser, server;
async function capture(page, name) {
  const s = await page.context().newCDPSession(page);
  try {
    const { data } = await s.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(`artifacts/${name}.png`, Buffer.from(data, "base64"));
  } finally {
    await s.detach();
  }
}
try {
  await mkdir("artifacts", { recursive: true });
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
    { stdio: "ignore" },
  );
  for (let i = 0; i < 100; i++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    await sleep(50);
  }
  for (const width of [1440, 390])
    for (const motion of ["no-preference", "reduce"]) {
      browser = await chromium.launch({
        executablePath: await headless.executablePath(),
        headless: true,
        args: headless.args,
        env: { ...process.env, HOME: "/tmp" },
      });
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        reducedMotion: motion,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(8000);
      const errors = [],
        calls = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("request", (r) => {
        if (/\/api\/(guide|analyze)$/.test(r.url())) calls.push(r.url());
      });
      await page.addInitScript(
        ({ key, state }) => {
          localStorage.setItem(key, JSON.stringify(state));
          localStorage.setItem("maison-edit-swap-help-v1", "seen");
          sessionStorage.setItem(
            "maison-edit-guided-case:warm-everyday",
            "exited",
          );
          sessionStorage.setItem(
            "maison-edit-guided-case:quiet-city",
            "exited",
          );
          window.feedbackMetrics = {};
          let wasSetup = false;
          const inspect = () => {
            const setup = Boolean(document.querySelector(".demo-setup[open]"));
            if (setup) wasSetup = true;
            if (wasSetup && !setup && !window.feedbackMetrics.entryAt)
              window.feedbackMetrics.entryAt = performance.now();
            const target = document.querySelector(
              ".concierge-attention-current",
            );
            const phrase = document.querySelector(
              ".attention-bubble .bubble-reveal-phrase",
            );
            if (
              window.feedbackMetrics.entryAt &&
              !window.feedbackMetrics.readableAt &&
              target &&
              phrase &&
              Number(getComputedStyle(phrase).opacity) > 0.9
            ) {
              window.feedbackMetrics.readableAt = performance.now();
              window.feedbackMetrics.product = target.dataset.conciergeProduct;
            }
            requestAnimationFrame(inspect);
          };
          requestAnimationFrame(inspect);
        },
        { key: STORAGE_KEY, state: { ...initialState(), language: "zh" } },
      );
      await page.goto(base, { waitUntil: "networkidle" });
      await capture(page, `v16-onboarding-${width}-${motion}`);
      await page.locator(".demo-setup-compose").click();
      await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
      await exitDemoGuide(page);
      // The first visible product has a legible hint during the contour, not after it.
      await page.waitForFunction(() => window.feedbackMetrics.readableAt);
      const metrics = await page.evaluate(() => ({
        ...window.feedbackMetrics,
        latency:
          window.feedbackMetrics.readableAt - window.feedbackMetrics.entryAt,
      }));
      assert.ok(
        metrics.latency <= 250,
        `entry feedback took ${metrics.latency}ms`,
      );
      const phrase = page.locator(".attention-bubble .bubble-reveal-phrase");
      assert.ok(
        (
          await phrase.evaluateAll((els) =>
            els.map((e) => Number(getComputedStyle(e).opacity)),
          )
        ).every((x) => x > 0.99),
        "all passive copy is immediately readable",
      );
      await capture(page, `v16-entry-feedback-${width}-${motion}`);
      // Fast scrolling and a stop must retarget the current card in the next frame.
      const cards = page.locator("[data-concierge-product]");
      const count = await cards.count();
      let lastId;
      for (let i = 0; i < Math.min(6, count); i++) {
        const card = cards.nth(i);
        lastId = await card.getAttribute("data-concierge-product");
        await card.evaluate((el) => {
          document.activeElement?.blur();
          const v = el.querySelector(".product-visual") || el;
          const r = v.getBoundingClientRect();
          scrollTo({
            top:
              scrollY +
              r.top -
              (innerHeight - Math.min(r.height, innerHeight)) / 2,
            behavior: "instant",
          });
        });
        await sleep(36);
      }
      const stopped = Date.now();
      // Side-by-side cards can have an equal viewport score; preserve the current
      // eligible card rather than flicker between the two columns.
      await page.waitForFunction(() =>
        document.querySelector(".concierge-attention-current"),
      );
      lastId = await page
        .locator(".concierge-attention-current")
        .getAttribute("data-concierge-product");
      await page.waitForFunction(
        (name) =>
          document
            .querySelector(".subtitle-bubble:not(.is-retiring) .bubble-text")
            ?.textContent.includes(name),
        byId(lastId).name,
      );
      const stopLatency = Date.now() - stopped;
      assert.ok(stopLatency <= 200, `scroll-stop copy took ${stopLatency}ms`);
      assert.equal(
        await page.locator(".subtitle-bubble:not(.is-retiring)").count(),
        1,
      );
      await capture(page, `v16-scroll-stop-${width}-${motion}`);
      await sleep(750);
      assert.ok(
        (
          await page.locator(".subtitle-bubble:not(.is-retiring)").innerText()
        ).includes(byId(lastId).name),
        "stale copy never replaces settled target",
      );
      // Hover/focus acknowledge a different already-visible card without waiting.
      const active = page.locator(".concierge-attention-current").first();
      await active.locator(".product-name").focus();
      assert.equal(
        await active.evaluate(
          (el) =>
            getComputedStyle(el.querySelector(".product-visual")).outlineStyle,
        ),
        "solid",
      );
      if (motion === "reduce")
        assert.equal(
          await page.locator(".concierge-particle-field").count(),
          0,
        );
      // Close is durable across scrolling; there is no automatic expansion.
      await page.locator(".bubble-dismiss").click();
      await page.locator(".subtitle-concierge.is-minimized").waitFor();
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      await sleep(200);
      await page.evaluate(() =>
        scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      await sleep(450);
      assert.equal(
        await page.locator(".subtitle-concierge:not(.is-minimized)").count(),
        0,
      );
      assert.equal(await page.locator(".concierge-particle-field").count(), 0);
      await capture(page, `v16-closed-stays-closed-${width}-${motion}`);
      assert.deepEqual(errors, []);
      assert.deepEqual(calls, []);
      const result = {
        width,
        motion,
        entryLatencyMs: Math.round(metrics.latency),
        stopLatencyMs: stopLatency,
        product: lastId,
        noExternalAI: true,
        closedStaysClosed: true,
      };
      results.push(result);
      console.log("PASS", JSON.stringify(result));
      await context.close();
      await browser.close();
      browser = null;
    }
  await writeFile(
    "artifacts/v16-immediate-feedback-report.json",
    JSON.stringify({ results }, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
