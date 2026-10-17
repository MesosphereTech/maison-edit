import {exitDemoGuide} from "./demo-guide-helpers.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import {
  initialState,
  STORAGE_KEY,
  demoHistoryForProfile,
  defaultProfile,
  byId,
} from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";
import { outfitSceneFor } from "../src/outfit-scenes.js";
const root = fileURLToPath(new URL("../", import.meta.url)),
  port = Number(process.env.E2E_PORT || 4193),
  base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser,
  server,
  context,
  page,
  errors = [],
  calls = [];
const results = [];
const captureWarnings = [];
const captureScreenshots = process.env.E2E_CAPTURE_SCREENSHOTS === "1";
async function until(fn, label, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(35);
  }
  throw Error(label);
}
async function captureScreenshot(options) {
  // Diagnostic captures are opt-in. Never detach a pending screenshot request:
  // doing so can disturb later navigation in this headless browser.
  if (!captureScreenshots) return;
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await session.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(options.path, Buffer.from(data, "base64"));
  } catch (error) {
    const warning = { path: options.path, error: error.message };
    captureWarnings.push(warning);
    console.warn(`CAPTURE WARNING ${warning.path}: ${warning.error}`);
  } finally {
    await session.detach();
  }
}
async function completeSetup() {
  await page.locator(".demo-setup-compose").click();
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await exitDemoGuide(page);
  await until(
    () =>
      page
        .locator(".demo-setup")
        .count()
        .then((count) => count === 0),
    "mandatory setup did not close",
  );
}
async function reset(profile, width = 1440, motion = "no-preference") {
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(
    ({ key, state }) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, JSON.stringify(state));
    },
    {
      key: STORAGE_KEY,
      state: {
        ...initialState(),
        onboardingStatus: "completed",
        language: "en",
        profile,
        purchaseHistory: demoHistoryForProfile(profile),
      },
    },
  );
  errors = [];
  calls = [];
  await page.reload({ waitUntil: "networkidle" });
  await completeSetup();
}
const state = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function run(name, fn) {
  if (
    process.env.E2E_FILTER &&
    !new RegExp(process.env.E2E_FILTER, "i").test(name)
  )
    return;
  // Each scenario gets a fresh document. Repeated product-sheet/AudioContext
  // teardown in this headless runtime can otherwise stall the next navigation.
  const previous = page;
  page = await context.newPage();
  await previous?.close();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/(guide|analyze)$/.test(request.url()))
      calls.push(request.url());
  });
  try {
    const detail = await fn();
    assert.deepEqual(errors, []);
    assert.deepEqual(calls, []);
    results.push({ name, status: "pass", ...detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.stack });
    console.error(`FAIL ${name}: ${error.stack}`);
    await captureScreenshot({
      path: `${root}/artifacts/scenes-fail-${results.length}.png`,
    }).catch(() => {});
  }
}
try {
  await mkdir(`${root}/artifacts`, { recursive: true });
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
  await until(
    () =>
      fetch(base)
        .then((r) => r.ok)
        .catch(() => false),
    "Vite failed",
  );
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  context = await browser.newContext();
  page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(guide|analyze)$/.test(r.url())) calls.push(r.url());
  });
  for (const scenario of curatedScenarios) {
    const profile = {
      ...defaultProfile,
      personaId: scenario.personaId,
      homeId: scenario.homeId,
      room: scenario.room,
      size: scenario.personaId === "relaxed-man-50" ? "L" : "M",
    };
    await run(
      `${scenario.id}: all five exact images load, default scene is large and thumbnail swaps by click and keyboard`,
      async () => {
        await reset(profile);
        const frames = [];
        for (const product of scenario.products.slice(0, 5)) {
          const target = page
            .locator(`[data-scene-product="${product.skuId}"]`)
            .first();
          await target.scrollIntoViewIfNeeded();
          await until(
            () => target.evaluate((el) => el.classList.contains("is-ready")),
            `scene not loaded ${product.skuId}`,
          );
          const image = target.locator(".scene-personalized");
          const outfit=outfitSceneFor(product.skuId,profile,product.color);
          assert.equal(await image.getAttribute("src"),outfit?.src || `/personalized-scenes/${product.file}`);
          assert.ok((await image.getAttribute("alt")).includes(product.skuId));
          for (const selector of [".scene-original", ".scene-personalized"])
            assert.equal(
              await target
                .locator(selector)
                .evaluate(
                  (el) =>
                    el.complete &&
                    el.naturalWidth > 0 &&
                    getComputedStyle(el).visibility === "visible",
                ),
              true,
            );
          assert.equal(
            await image.evaluate(
              (el) => el.naturalWidth > 500 && el.naturalHeight > 500,
            ),
            true,
          );
          assert.equal(
            await target.getAttribute("data-scene-main"),
            "personalized",
          );
          const dimensions = () =>
            target.evaluate((el) => {
              const host = el.getBoundingClientRect(),
                original = el
                  .querySelector(".scene-original")
                  .getBoundingClientRect(),
                prepared = el
                  .querySelector(".scene-personalized")
                  .getBoundingClientRect();
              return {
                width: host.width,
                original: original.width,
                prepared: prepared.width,
                originalRight: host.right - original.right,
                originalTop: original.top - host.top,
              };
            });
          let box = await dimensions();
          assert.ok(
            box.original < box.width * 0.4 && box.prepared > box.width * 0.99,
            JSON.stringify(box),
          );
          assert.ok(
            box.originalRight > 0 &&
              box.originalRight < 20 &&
              box.originalTop > 0 &&
              box.originalTop < 20,
            JSON.stringify(box),
          );
          assert.equal(await target.locator("button button").count(), 0);
          const swap = target.getByRole("button", {
            name: "Show product as the main image",
            exact: true,
          });
          await swap.click();
          await sleep(120);
          box = await dimensions();
          assert.ok(
            box.original > box.width * 0.3 && box.original < box.width * 0.99,
            JSON.stringify(box),
          );
          assert.equal(
            await page.getByRole("dialog").count(),
            0,
            "swap must not open product details",
          );
          await sleep(530);
          assert.equal(
            await target.getAttribute("data-scene-main"),
            "original",
          );
          box = await dimensions();
          assert.ok(
            box.original > box.width * 0.99 && box.prepared < box.width * 0.4,
            JSON.stringify(box),
          );
          assert.equal(
            await target
              .locator(".scene-swap-button")
              .evaluate((el) => el === document.activeElement),
            true,
          );
          await page.keyboard.press("Enter");
          await sleep(620);
          assert.equal(
            await target.getAttribute("data-scene-main"),
            "personalized",
          );
          await page.keyboard.press("Space");
          await sleep(620);
          assert.equal(
            await target.getAttribute("data-scene-main"),
            "original",
          );
          for (let click = 0; click < 5; click++)
            await target.locator(".scene-swap-button").click();
          await sleep(620);
          assert.equal(
            await target.getAttribute("data-scene-main"),
            "personalized",
          );
          const heart = await target
            .locator("..")
            .locator(".save-button")
            .boundingBox();
          const thumb = await target
            .locator(".scene-swap-button")
            .boundingBox();
          assert.ok(
            heart.x + heart.width < thumb.x,
            "heart and thumbnail must not overlap",
          );
          const path = `artifacts/scene-${scenario.id}-${product.skuId}-swap.png`;
          await captureScreenshot({
            path: `${root}/${path}`,
            animations: "disabled",
            timeout: 5000,
          });
          await target
            .locator(".scene-open-button")
            .click({ position: { x: 35, y: 100 } });
          await page
            .getByRole("dialog", { name: byId(product.skuId).en, exact: true })
            .waitFor();
          await page.keyboard.press("Escape");
          assert.equal(await page.getByRole("dialog").count(), 0);
          frames.push({
            skuId: product.skuId,
            path,
            main: "personalized",
            allImagesLoaded: true,
          });
        }
        return { frames };
      },
    );
    await run(
      `${scenario.id}: seeded guide names exact fictional owned piece and does not infer a series`,
      async () => {
        await reset(profile, 1440, "reduce");
        const product = scenario.products[0],
          card = page
            .locator(`[data-concierge-product="${product.skuId}"]`)
            .first();
        await card.scrollIntoViewIfNeeded();
        await card.locator(".product-name").focus();
        await until(
          async () =>
            (
              await page
                .locator(".subtitle-bubble:not(.is-retiring) .bubble-text")
                .allTextContents()
            ).some((text) => /same-series unverified/i.test(text)),
          "grounded short guide missing",
        );
        const current = page
          .locator(".subtitle-bubble:not(.is-retiring)")
          .last();
        assert.match(
          await current.locator(".bubble-owned-reference").innerText(),
          /Fictional history/,
        );
        await current
          .getByRole("button", {
            name: "Show conversation history",
            exact: true,
          })
          .click();
        const text = await page
          .getByRole("log", { name: "Conversation history", exact: true })
          .innerText();
        assert.match(text, /fictional history lists/);
        assert.match(text, /palette|catalog variants/);
        assert.match(text, /same-series unverified/i);
        assert.ok(!text.includes("Both belong to the declared demo series"));
        return { history: (await state()).purchaseHistory, guideText: text };
      },
    );
  }
  await run(
    "unsupported combinations, colour changes and failed assets show product alone without a false inset",
    async () => {
      await page.goto(`${base}/tests/fixtures/personalized-scene.html`, {
        waitUntil: "domcontentloaded",
      });
      await until(
        () =>
          page
            .locator(".personalized-scene.is-ready")
            .count()
            .then((count) => count === 1),
        "fixture prepared scene missing",
      );
      await page.evaluate((profile) => window.renderSceneFixture({ profile }), {
        ...defaultProfile,
        personaId: "silver-woman-68",
        homeId: "airy-couple",
        room: "bedroom",
      });
      await until(
        () =>
          page
            .locator(".scene-personalized")
            .count()
            .then((count) => count === 0),
        "unsupported scene was reused",
      );
      assert.equal(await page.locator(".scene-swap-button").count(), 0);
      assert.equal(await page.locator(".scene-original").count(), 1);
      await page.evaluate(() => window.renderSceneFixture({ color: "Ink" }));
      assert.equal(await page.locator(".scene-swap-button").count(), 0);
      await page.evaluate(() => window.renderSceneFixture());
      await until(
        () =>
          page
            .locator(".personalized-scene.is-ready")
            .count()
            .then((count) => count === 1),
        "restored exact scene missing",
      );
      assert.equal(
        await page
          .locator(".personalized-scene")
          .getAttribute("data-scene-main"),
        "personalized",
      );
      await page.route("**/{personalized-scenes,outfit-scenes}/*.webp", (route) =>
        route.abort(),
      );
      await page.reload({ waitUntil: "networkidle" });
      await sleep(200);
      assert.equal(
        await page.locator(".personalized-scene.is-ready").count(),
        0,
      );
      assert.equal(await page.locator(".scene-swap-button").count(), 0);
      assert.equal(await page.locator(".scene-personalized").count(), 0);
      assert.equal(
        await page
          .locator(".scene-original")
          .evaluate((image) => image.complete && image.naturalWidth > 0),
        true,
      );
      await page.locator(".scene-open-button").click();
      assert.equal(await page.evaluate(() => window.sceneOpenCount), 1);
      await page.unroute("**/{personalized-scenes,outfit-scenes}/*.webp");
    },
  );
  await run(
    "prepared selection, edited/cleared history and introductory drafts persist correctly",
    async () => {
      await reset(defaultProfile);
      await page.locator(".shop-preference-entry").click();
      const dialog = page.getByRole("dialog", {
        name: "A little more you.",
        exact: true,
      });
      await dialog.locator('[data-scene-scenario="quiet-city"]').click();
      await dialog
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      let saved = await state();
      assert.equal(saved.profile.personaId, "relaxed-man-50");
      assert.equal(saved.profile.homeId, "compact-city");
      assert.equal(saved.purchaseHistory[0].skuId, "ME-011");
      await page.locator(".shop-history-entry").click();
      await dialog
        .getByRole("button", {
          name: "Clear / reset fictional history",
          exact: true,
        })
        .click();
      await dialog
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      saved = await state();
      assert.deepEqual(saved.purchaseHistory, []);
      assert.equal(saved.purchaseHistoryOrigin, "edited");
      await page.reload({ waitUntil: "networkidle" });
      await completeSetup();
      assert.deepEqual((await state()).purchaseHistory, []);
      await page.locator(".shop-preference-entry").click();
      await dialog.locator('[data-scene-scenario="warm-everyday"]').click();
      await dialog
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      assert.deepEqual((await state()).purchaseHistory, []);
    },
  );
  await run(
    "responsive and reduced-motion scene layouts remain contained",
    async () => {
      for (const width of [320, 390, 768, 1024, 1440]) {
        await reset(defaultProfile, width, "reduce");
        const scene = page.locator('[data-scene-product="ME-015"]').first();
        await scene.scrollIntoViewIfNeeded();
        await until(
          () => scene.evaluate((el) => el.classList.contains("is-ready")),
          "responsive asset missing",
        );
        assert.equal(
          await scene.getAttribute("data-scene-main"),
          "personalized",
        );
        assert.equal(
          await scene
            .locator(".scene-image-plane")
            .first()
            .evaluate((el) => getComputedStyle(el).transitionDuration),
          "0s",
        );
        await scene.locator(".scene-swap-button").click();
        assert.equal(await scene.getAttribute("data-scene-main"), "original");
        const boxes = await scene.evaluate((el) => {
          const host = el.getBoundingClientRect(),
            thumb = el
              .querySelector(".scene-swap-button")
              .getBoundingClientRect();
          return {
            contained:
              thumb.left >= host.left &&
              thumb.right <= host.right &&
              thumb.top >= host.top &&
              thumb.bottom <= host.bottom,
            width: thumb.width,
            height: thumb.height,
          };
        });
        assert.equal(boxes.contained, true);
        assert.ok(
          boxes.width >= 44 && boxes.height >= 44,
          JSON.stringify(boxes),
        );
        assert.ok(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
        );
        await captureScreenshot({
          path: `${root}/artifacts/scenes-${width}.png`,
        });
        await page.locator(".shop-preference-entry").click();
        assert.ok(
          await page
            .getByRole("dialog")
            .evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
        );
      }
    },
  );
  await run(
    "history palette follows the selected exact product colour",
    async () => {
      await reset(defaultProfile, 1440, "reduce");
      const card = page.locator('[data-concierge-product="ME-015"]').first();
      await card.locator(".product-image-button").click();
      const product = page.getByRole("dialog", {
        name: byId("ME-015").en,
        exact: true,
      });
      await product.waitFor();
      await product.getByRole("button", { name: "Ink", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Reply to your guide", exact: true })
        .fill("Pair this with my history");
      await page
        .getByRole("button", { name: "Send subtitle reply", exact: true })
        .click();
      await until(
        async () =>
          (
            await page
              .locator(".subtitle-bubble:not(.is-retiring)")
              .allTextContents()
          ).some((text) =>
            text.toLowerCase().includes("same-series unverified"),
          ),
        "variant-specific history line missing",
      );
      await page
        .locator(".subtitle-bubble:not(.is-retiring)")
        .last()
        .getByRole("button", { name: "Show conversation history", exact: true })
        .click();
      const latest = page.locator(".subtitle-history .subtitle-bubble").last();
      assert.match(await latest.innerText(), /palette pairs Burgundy with Ink/);
      assert.ok(!(await latest.innerText()).includes("Terracotta"));
    },
  );
  await run(
    "a landed real attention bubble stays inert throughout dismissal",
    async () => {
      await reset(defaultProfile);
      const card = page.locator('[data-concierge-product="ME-015"]').first();
      await card.scrollIntoViewIfNeeded();
      await card.locator(".product-name").focus();
      const bubble = page.locator(".subtitle-bubble:not(.is-retiring)").last();
      await bubble.waitFor();
      await until(
        () =>
          bubble.evaluate(
            (el) =>
              el.classList.contains("has-morphed") &&
              !el.hasAttribute("data-surface-owned"),
          ),
        "attention morph did not land",
      );
      const id = await bubble.getAttribute("data-bubble-id");
      await bubble.locator(".bubble-dismiss").click();
      const retired = page.locator(`[data-bubble-id="${id}"].is-retiring`);
      await retired.waitFor();
      assert.equal(await retired.evaluate((el) => el.inert), true);
      await retired
        .locator("button")
        .first()
        .evaluate((button) => button.focus());
      assert.equal(
        await retired.evaluate((el) => el.contains(document.activeElement)),
        false,
      );
      await sleep(120);
      assert.equal(await retired.evaluate((el) => el.inert), true);
      await until(
        () => retired.count().then((count) => count === 0),
        "landed bubble did not exit",
      );
    },
  );
  await run(
    "expanded transcript fades as a composed surface on dismiss and minimize",
    async () => {
      for (const action of [
        "Dismiss subtitle concierge",
        "Minimize subtitles",
      ]) {
        await reset(defaultProfile);
        const card = page.locator('[data-concierge-product="ME-015"]').first();
        await card.scrollIntoViewIfNeeded();
        await card.locator(".product-name").focus();
        const bubble = page
          .locator(".subtitle-bubble:not(.is-retiring)")
          .last();
        await bubble.waitFor();
        await until(
          () =>
            bubble.evaluate(
              (el) =>
                el.classList.contains("has-morphed") &&
                !el.hasAttribute("data-surface-owned"),
            ),
          "attention morph did not land",
        );
        await bubble
          .getByRole("button", {
            name: "Show conversation history",
            exact: true,
          })
          .click();
        const history = page.locator(".subtitle-history");
        const count = await history.locator(".subtitle-bubble").count();
        await page.getByRole("button", { name: action, exact: true }).click();
        const leaving = page.locator(".subtitle-concierge.is-leaving");
        await leaving.waitFor();
        await sleep(110);
        const opacity = await history.evaluate((el) =>
          Number(getComputedStyle(el).opacity),
        );
        assert.ok(
          opacity > 0 && opacity < 1,
          `composed history opacity ${opacity}`,
        );
        assert.equal(await leaving.evaluate((el) => el.inert), true);
        await captureScreenshot({
          path: `${root}/artifacts/bubble-history-exit-${action.startsWith("Dismiss") ? "dismiss" : "minimize"}.png`,
        });
        await until(
          () => leaving.count().then((count) => count === 0),
          "expanded history did not exit",
        );
        await page
          .getByRole("button", { name: "Your private guide", exact: true })
          .click();
        const guide = page.getByRole("dialog", {
          name: "Your private guide.",
          exact: true,
        });
        await guide.waitFor();
        assert.equal(await guide.locator(".chat-message").count(), count);
      }
    },
  );
  for (const reason of ["dismiss", "expire", "source", "navigation", "replace"])
    await run(
      `bubble ${reason} keeps a real intermediate exit frame and preserves transcript`,
      async () => {
        await page.emulateMedia({ reducedMotion: "no-preference" });
        await page.goto(`${base}/tests/fixtures/bubble-motion.html`, {
          waitUntil: "domcontentloaded",
        });
        errors = [];
        calls = [];
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.evaluate(
          (reason) =>
            window.addTestBubble(
              reason === "source"
                ? { source: { passive: true, productId: "ME-001" } }
                : {},
            ),
          reason,
        );
        const current = page.locator(".subtitle-bubble:not(.is-retiring)");
        await current.waitFor();
        await sleep(700);
        const id = await current.getAttribute("data-bubble-id"),
          count = await page.evaluate(() => window.getTestHistoryCount());
        const before = await current.boundingBox();
        if (reason === "dismiss")
          await current.locator(".bubble-dismiss").dispatchEvent("click");
        if (reason === "expire") {
          await page.mouse.move(5, 5);
          await page.evaluate(() => window.expireTestBubble());
        }
        if (reason === "source")
          await page.evaluate(() => window.retireTestAttention());
        if (reason === "navigation")
          await page.evaluate(() => window.changeTestContext());
        if (reason === "replace")
          await page.evaluate(() => window.addTestBubble());
        const outgoing = page.locator(`[data-bubble-id="${id}"].is-retiring`);
        await outgoing.waitFor();
        await sleep(110);
        const frame = await outgoing.evaluate((el) => ({
          opacity: Number(getComputedStyle(el).opacity),
          transform: getComputedStyle(el).transform,
          hidden: el.getAttribute("aria-hidden"),
          inert: el.inert,
          reason: el.dataset.exitReason,
          height: el.getBoundingClientRect().height,
        }));
        assert.ok(
          frame.opacity > 0 && frame.opacity < 1,
          JSON.stringify(frame),
        );
        assert.notEqual(frame.transform, "none");
        assert.equal(frame.hidden, "true");
        assert.equal(frame.inert, true);
        assert.ok(
          Math.abs(frame.height - before.height) < 8,
          JSON.stringify({ frame, before }),
        );
        await captureScreenshot({
          path: `${root}/artifacts/bubble-exit-${reason}.png`,
        });
        await until(
          () => outgoing.count().then((count) => count === 0),
          "outgoing surface was never removed",
        );
        assert.equal(
          await page.evaluate(() => window.getTestHistoryCount()),
          count + Number(reason === "replace"),
        );
        return { frame };
      },
    );
  await run(
    "reduced-motion bubble exit is immediate and keeps transcript",
    async () => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${base}/tests/fixtures/bubble-motion.html`, {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => window.addTestBubble());
      const bubble = page.locator(".subtitle-bubble");
      await bubble.waitFor();
      await bubble.locator(".bubble-dismiss").dispatchEvent("click");
      await sleep(120);
      assert.equal(await bubble.count(), 0);
      assert.equal(await page.evaluate(() => window.getTestHistoryCount()), 2);
    },
  );
} finally {
  await writeFile(
    `${root}/artifacts/personalized-scenes-e2e-results.json`,
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        results,
        captureWarnings,
        captureScreenshots,
      },
      null,
      2,
    ),
  );
  await browser?.close();
  server?.kill();
}
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
