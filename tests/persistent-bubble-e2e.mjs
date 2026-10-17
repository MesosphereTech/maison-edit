import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import {
  attentionRoute,
  pointOnAttentionRoute,
} from "../src/attention-motion.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4198);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser;
const motionEvidence = [];
const captureMotion = process.env.E2E_CAPTURE_MOTION === "1";
async function capture(page, name) {
  await page.screenshot({
    path: `${root}/artifacts/${name}.png`,
    animations: "allow",
    timeout: 8000,
  });
}
async function motionSnapshot(page) {
  return page.evaluate(() => {
    const outline = document.querySelector(".attention-shell-outline");
    const bubble = document.querySelector("[data-persistent-surface]");
    const pixels = [...document.querySelectorAll(".concierge-magic-pixel")];
    return {
      at: performance.now(),
      phase: document.querySelector(".subtitle-concierge")?.dataset
        .attentionPhase,
      outlineOpacity: outline ? Number(getComputedStyle(outline).opacity) : 0,
      outlineWidth: outline
        ? Number.parseFloat(getComputedStyle(outline).strokeWidth)
        : 0,
      particles: pixels.length,
      visibleParticles: pixels.filter(
        (pixel) => Number(getComputedStyle(pixel).opacity) > 0.3,
      ).length,
      arrivalOpacity: bubble
        ? Number(getComputedStyle(bubble, "::after").opacity)
        : 0,
      bubbleTransform: bubble ? getComputedStyle(bubble).transform : null,
      phrases: [...document.querySelectorAll(".bubble-reveal-phrase")].map(
        (el) => Number(getComputedStyle(el).opacity),
      ),
    };
  });
}
async function launchBrowser() {
  return chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: process.env.E2E_CHROMIUM_PATH
      ? ["--no-sandbox", "--disable-dev-shm-usage"]
      : [...headless.args, "--disable-gpu"],
    env: { ...process.env, HOME: "/tmp" },
  });
}
for (const [source, bubble, composer] of [
  [
    { left: 65, top: 154, width: 719, height: 702 },
    { left: 524, top: 447, width: 392, height: 313 },
    { left: 420, top: 800, width: 600, height: 60 },
  ],
  [
    { left: 20, top: 374, width: 350, height: 327 },
    { left: 86, top: 399, width: 218, height: 251 },
    { left: 20, top: 686, width: 350, height: 42 },
  ],
]) {
  const route = attentionRoute(source, bubble, { avoid: [composer] });
  assert.ok(
    Math.hypot(route.end.x - route.start.x, route.end.y - route.start.y) >= 80,
    "overlapping desktop/mobile layouts keep a perceptible travel distance",
  );
  for (let step = 0; step < 16; step++) {
    const point = pointOnAttentionRoute(route, step / 16);
    const inside = (rect) =>
      point.x > rect.left + 1 &&
      point.x < rect.left + rect.width - 1 &&
      point.y > rect.top + 1 &&
      point.y < rect.top + rect.height - 1;
    assert.equal(
      inside(bubble),
      false,
      "trail stays outside the bubble until arrival",
    );
    assert.equal(inside(composer), false, "trail avoids the fixed input");
  }
}
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
  for (const width of process.env.E2E_WIDTH
    ? [Number(process.env.E2E_WIDTH)]
    : [1440, 390, 320]) {
    browser = await launchBrowser();
    const page = await browser.newPage({
      viewport: { width, height: width > 600 ? 1000 : 844 },
      reducedMotion: "no-preference",
    });
    await page.bringToFront();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`${base}/tests/fixtures/persistent-bubble.html`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      const snapshot = () => {
        const outline = document.querySelector(".attention-shell-outline");
        const bubble = document.querySelector("[data-persistent-surface]");
        const pixels = [...document.querySelectorAll(".concierge-magic-pixel")];
        return {
          at: performance.now(),
          phase: document.querySelector(".subtitle-concierge")?.dataset
            .attentionPhase,
          outlineOpacity: outline
            ? Number(getComputedStyle(outline).opacity)
            : 0,
          outlineWidth: outline
            ? Number.parseFloat(getComputedStyle(outline).strokeWidth)
            : 0,
          particles: pixels.length,
          particleText: document.querySelector(".concierge-particle-field")
            ?.textContent,
          visibleParticles: pixels.filter(
            (pixel) => Number(getComputedStyle(pixel).opacity) > 0.3,
          ).length,
          arrivalOpacity: bubble
            ? Number(getComputedStyle(bubble, "::after").opacity)
            : 0,
          bubbleTransform: bubble ? getComputedStyle(bubble).transform : null,
          phrases: [...document.querySelectorAll(".bubble-reveal-phrase")].map(
            (el) => Number(getComputedStyle(el).opacity),
          ),
        };
      };
      window.motionPhaseLog = [];
      window.motionSequence = new Promise((resolve) => {
        const frames = [];
        const observed = new Set();
        const delays = {
          "glow-lap": 260,
          particles: 300,
          arrival: 80,
        };
        const observer = new MutationObserver(() => {
          const phase = document.querySelector(".subtitle-concierge")?.dataset
            .attentionPhase;
          if (observed.has(phase)) return;
          observed.add(phase);
          window.motionPhaseLog.push({ phase, at: performance.now() });
          if (phase in delays)
            setTimeout(() => frames.push(snapshot()), delays[phase]);
          if (phase === "settled")
            setTimeout(() => {
              observer.disconnect();
              resolve(frames);
            }, 80);
        });
        observer.observe(document.body, {
          subtree: true,
          attributes: true,
          attributeFilter: ["data-attention-phase"],
        });
      });
      window.updatePersistentBubble();
    });
    const sequence = { width, frames: [] };
    const live = page.locator(".subtitle-bubble[data-persistent-surface]");
    await live.waitFor();
    await page.evaluate(() => {
      window.savedBubble = document.querySelector("[data-persistent-surface]");
    });
    const sourceBox = await page.locator(".product-visual").boundingBox();
    const frameBox = await page
      .locator(".concierge-attention-frame")
      .evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.x, width: r.width };
      });
    assert.ok(
      Math.abs(sourceBox.x - frameBox.x) < 1 &&
        Math.abs(sourceBox.width - frameBox.width) < 1,
      "glow stays anchored on product",
    );
    assert.equal(
      await live.evaluate((el) => el.inert),
      false,
      "live content is never hidden or made inert for the flow",
    );
    // Observe inside the real browser event loop. Cross-process CDP latency
    // must not move a sample into the next short phase on a busy CI host.
    const frames = await page.evaluate(() => window.motionSequence);
    sequence.frames.push(...frames);
    const lap = frames.find((frame) => frame.phase === "glow-lap");
    const flight = frames.find((frame) => frame.phase === "particles");
    const arrival = frames.find((frame) => frame.phase === "arrival");
    assert.ok(
      lap && lap.outlineOpacity > 0.85 && lap.outlineWidth >= 2.5,
      `the anchored gold lap is plainly visible at normal motion: ${JSON.stringify(frames)}`,
    );
    assert.ok(
      lap.phrases.length && lap.phrases.every((opacity) => opacity > 0.99),
      "passive reply is readable during the connection",
    );
    assert.ok(
      flight && flight.particles === 19 && flight.visibleParticles >= 8,
      `a coherent gold trail is visible for several frames: ${JSON.stringify(frames)}`,
    );
    assert.equal(
      flight.bubbleTransform,
      "none",
      "flight never animates the persistent surface",
    );
    assert.equal(
      flight.particleText,
      "",
      "particles contain no emoji or glyphs",
    );
    assert.ok(
      arrival && arrival.arrivalOpacity > 0.3,
      "one visible edge accent acknowledges arrival",
    );
    assert.ok(
      arrival.phrases.every((opacity) => opacity > 0.99),
      "arrival decoration never hides readable copy",
    );
    if (captureMotion)
      for (const [phase, pause, label] of [
        ["glow-lap", 260, "1-lap"],
        ["particles", 180, "2-particles"],
        ["arrival", 100, "3-arrival"],
      ]) {
        await page.evaluate(() => window.updatePersistentBubble());
        await page
          .waitForFunction(
            (expected) =>
              document.querySelector(".subtitle-concierge")?.dataset
                .attentionPhase === expected,
            phase,
            { timeout: 6000 },
          )
          .catch(async (error) => {
            console.log(
              "PHASE DEBUG",
              JSON.stringify(await page.evaluate(() => window.motionPhaseLog)),
            );
            throw error;
          });
        await page.waitForTimeout(pause);
        sequence.frames.push({
          capture: label,
          ...(await motionSnapshot(page)),
        });
        await capture(page, `persistent-motion-${width}-${label}`);
      }
    motionEvidence.push(sequence);
    await page.evaluate(() =>
      window.updatePersistentBubble(
        "ME-002",
        "A new silhouette, made for a quieter wardrobe. Each considered detail slowly becomes visible. This sentence arrives smoothly in short phrases.",
      ),
    );
    await page.waitForFunction(() =>
      document
        .querySelector("[data-persistent-surface]")
        ?.textContent.includes("A new silhouette"),
    );
    assert.equal(
      await page.evaluate(
        () =>
          window.savedBubble ===
          document.querySelector("[data-persistent-surface]"),
      ),
      true,
      "attention updates keep exact DOM surface",
    );
    const opacities = await page
      .locator(".bubble-reveal-phrase")
      .evaluateAll((els) =>
        els.map((el) => Number(getComputedStyle(el).opacity)),
      );
    assert.ok(
      opacities.length > 2 && opacities.every((opacity) => opacity > 0.99),
      "all new passive phrases are readable immediately",
    );
    assert.equal(
      await live.locator(".bubble-current-subject").count(),
      1,
      "current product is acknowledged immediately",
    );
    assert.equal(
      await live.locator(".bubble-text > .sr-only").count(),
      1,
      "one complete screen-reader text announcement",
    );
    assert.equal(
      await live.locator(".bubble-progressive-copy[aria-hidden=true]").count(),
      1,
    );
    await page.waitForSelector(".concierge-particle-field", {
      state: "attached",
    });
    const obsoleteToken = await page
      .locator(".concierge-particle-field")
      .getAttribute("data-attention-token");
    await page.evaluate(() =>
      window.updatePersistentBubble(
        "ME-001",
        "Fresh current copy, replacing the interrupted reveal. This should be the only visible reply.",
      ),
    );
    await page.waitForFunction(() =>
      document
        .querySelector("[data-persistent-surface]")
        ?.textContent.includes("Fresh current copy"),
    );
    assert.equal(
      await live
        .locator(".bubble-reveal-phrase")
        .allTextContents()
        .then((v) => v.join("").includes("A new silhouette")),
      false,
      "stale reveal is cancelled",
    );
    assert.equal(
      await page
        .locator(
          `.concierge-particle-field[data-attention-token="${obsoleteToken}"]`,
        )
        .count(),
      0,
      "new attention removes the obsolete in-flight trail immediately",
    );
    assert.equal(
      await page.locator(".has-attention-arrival").count(),
      0,
      "an interrupted flight cannot pulse the new reply",
    );
    await page.waitForSelector(".concierge-particle-field", {
      state: "attached",
    });
    await page.evaluate(() => {
      document.querySelector(".product-visual").style.transform =
        "translateX(12px)";
      window.dispatchEvent(new Event("resize"));
    });
    assert.equal(
      await page.locator(".concierge-particle-field").count(),
      0,
      "changed geometry cancels the obsolete route",
    );
    assert.equal(
      await page
        .locator(".concierge-attention-frame")
        .getAttribute("data-phase"),
      "settled",
    );
    await page.evaluate(() => {
      document.querySelector(".product-visual").style.transform = "";
      window.jumpPersistentClock();
      window.changePersistentContext();
    });
    await page.waitForTimeout(450);
    assert.equal(
      await page.evaluate(
        () =>
          window.savedBubble ===
          document.querySelector("[data-persistent-surface]"),
      ),
      true,
      "clock, stale source and context changes cannot remove live surface",
    );
    assert.equal(await page.locator(".subtitle-bubble").count(), 1);
    assert.equal(await page.locator(".subtitle-bubble.is-retiring").count(), 0);
    await page.locator(".scene-swap-button").dispatchEvent("click");
    await page.waitForSelector(".subtitle-concierge.is-yielding");
    await page.waitForTimeout(450);
    const aside = page.locator(".subtitle-concierge");
    assert.equal(
      await live.evaluate((el) => Number(getComputedStyle(el).opacity)),
      0.5,
      "inspection halves bubble opacity",
    );
    const panelBox = await aside.boundingBox();
    const productBox = await page.locator(".product-visual").boundingBox();
    assert.ok(
      panelBox.x + panelBox.width <= productBox.x ||
        panelBox.x >= productBox.x + productBox.width ||
        panelBox.y + panelBox.height <= productBox.y ||
        panelBox.y >= productBox.y + productBox.height,
      "yielded panel clears the inspected product",
    );
    const composer = await page.locator(".subtitle-composer").boundingBox();
    assert.ok(
      Math.abs(composer.x + composer.width / 2 - width / 2) < 1,
      "input remains centered while bubble yields",
    );
    if (captureMotion) await capture(page, `persistent-bubble-yield-${width}`);
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".subtitle-concierge")
          ?.classList.contains("is-yielding"),
    );
    await page.waitForTimeout(400);
    const centered = await aside.boundingBox();
    assert.ok(
      Math.abs(centered.x + centered.width / 2 - width / 2) < 1,
      "scroll restores centerline",
    );
    assert.equal(
      await live.evaluate((el) => Number(getComputedStyle(el).opacity)),
      1,
    );
    const historyCount = await page.evaluate(
      () => window.getPersistentTranscript().length,
    );
    await page
      .getByRole("button", { name: "Minimize subtitles", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand ÉDIT conversation", exact: true })
      .waitFor();
    await page
      .getByRole("button", { name: "Expand ÉDIT conversation", exact: true })
      .click();
    await live.waitFor();
    assert.ok(
      (await live.innerText()).includes("Fresh current copy"),
      "minimize and resume retain current copy",
    );
    await page
      .getByRole("button", { name: "Dismiss guide bubble", exact: true })
      .click();
    await live.waitFor({ state: "detached" });
    assert.equal(
      await page.evaluate(() => window.getPersistentTranscript().length),
      historyCount,
      "visual dismissal leaves complete history",
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      ),
      false,
      "no horizontal overflow",
    );
    assert.deepEqual(errors, []);
    await browser.close();
    browser = null;
    console.log(
      `PASS persistent surface, no expiry, glow/pixels, immediate copy, yielding, resume and dismiss ${width}px`,
    );
  }
  browser = await launchBrowser();
  const reduced = await browser.newPage({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  await reduced.goto(`${base}/tests/fixtures/persistent-bubble.html`, {
    waitUntil: "networkidle",
  });
  await reduced.evaluate(() => window.updatePersistentBubble());
  await reduced.waitForSelector("[data-persistent-surface]");
  assert.ok(
    (
      await reduced
        .locator(".bubble-reveal-phrase")
        .evaluateAll((els) => els.map((el) => getComputedStyle(el).opacity))
    ).every((opacity) => opacity === "1"),
  );
  assert.equal(await reduced.locator(".concierge-magic-pixel").count(), 0);
  assert.equal(
    await reduced
      .locator(".concierge-attention-frame")
      .getAttribute("data-phase"),
    "settled",
  );
  assert.equal(await reduced.locator(".has-attention-arrival").count(), 0);
  if (captureMotion) await capture(reduced, "persistent-motion-390-reduced");
  await writeFile(
    `${root}/artifacts/persistent-motion-evidence.json`,
    JSON.stringify(motionEvidence, null, 2),
  );
  console.log(
    "PASS reduced motion displays all text immediately without pixel flights or arrival pulses",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
