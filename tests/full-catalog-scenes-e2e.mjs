import { exitDemoGuide } from "./demo-guide-helpers.mjs";
// Real decoded scene files and exact interactive targets; no generator/provider calls.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId, catalog } from "../src/data.js";
import {
  curatedScenarios,
  personalizedSceneFor,
} from "../src/personalized-scenes.js";
import { giftSceneContext } from "../src/gift-scenes.js";
import { outfitSceneFor } from "../src/outfit-scenes.js";
import {
  demoScenePreview,
  DEMO_CRITICAL_SCENE_COUNT,
} from "../src/demo-personalization.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4206";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
let server, browser, context, page;
async function until(fn, label, ms = 9000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return;
    await sleep(30);
  }
  throw Error(label);
}
async function run(name, fn) {
  if (
    process.env.E2E_FILTER &&
    !new RegExp(process.env.E2E_FILTER, "i").test(name)
  )
    return;
  const errors = [],
    providerCalls = [];
  // This single-process Chromium cannot safely cycle isolated contexts in one
  // browser. A fresh process also gives every loading-budget check a cold cache.
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/(guide|analyze)$/.test(request.url()))
      providerCalls.push(request.url());
  });
  try {
    const detail = await fn();
    assert.deepEqual(errors, []);
    assert.deepEqual(providerCalls, []);
    results.push({ name, status: "pass", ...detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.stack });
    console.error(`FAIL ${name}\n${error.stack}`);
  } finally {
    await browser.close();
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
      "4206",
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
  for (const scenario of curatedScenarios) {
    await run(
      `${scenario.id}: all 28 exact scenes decode and the visible inset swaps only that SKU`,
      async () => {
        await page.goto(`${base}/tests/fixtures/personalized-scene.html`, {
          waitUntil: "networkidle",
        });
        const verified = [];
        for (const product of scenario.products) {
          const profile = {
            ...initialState().profile,
            personaId: scenario.personaId,
            homeId: scenario.homeId,
            room: scenario.room,
          };
          await page.evaluate(
            ({ sku, color, profile }) =>
              window.renderSceneFixture({ sku, color, profile }),
            { sku: product.skuId, color: product.color, profile },
          );
          const host = page.locator(`[data-scene-product="${product.skuId}"]`);
          await until(
            () =>
              host
                .count()
                .then(
                  async (n) =>
                    n === 1 &&
                    (await host.evaluate((el) =>
                      el.classList.contains("is-ready"),
                    )),
                ),
            `not decoded: ${scenario.id}/${product.skuId}`,
          );
          const displayProfile =
            giftSceneContext(byId(product.skuId), profile)?.profile || profile;
          const outfit = outfitSceneFor(
            product.skuId,
            displayProfile,
            product.color,
          );
          const prepared = personalizedSceneFor(
            product.skuId,
            displayProfile,
            product.color,
          );
          assert.ok(
            outfit || prepared,
            `no exact scene mapping: ${product.skuId}`,
          );
          assert.equal(
            await host.getAttribute("data-scene-id"),
            outfit?.id || prepared.scenarioId,
          );
          // Preserve and independently decode each original exact prepared scene,
          // even when the main UI now selects its new full-outfit illustration.
          await page.evaluate(async (src) => {
            const image = new Image();
            image.src = src;
            await image.decode();
            if (image.naturalWidth < 500)
              throw Error("Original scene decode failed");
          }, `/personalized-scenes/${product.file}`);
          // The optional gift-box overlay is a separate concept image. Preserve
          // the exact two scene planes and independently decode all 56 originals.
          const sceneImages = host.locator(".scene-image-plane > img");
          const images = await sceneImages.evaluateAll((els) =>
            els.map((el) => ({
              src: el.getAttribute("src"),
              alt: el.alt,
              loaded:
                el.complete && el.naturalWidth > 500 && el.naturalHeight > 500,
              loading: el.loading,
            })),
          );
          assert.equal(images.length, 2);
          await sceneImages.evaluateAll((elements) =>
            Promise.all(elements.map((element) => element.decode())),
          );
          assert.ok(
            images.every((x) => x.loaded && x.loading === "lazy"),
            JSON.stringify(images),
          );
          assert.equal(images[1].src, outfit?.src || prepared.src);
          assert.ok(
            images[1].alt.includes(product.skuId) &&
              images[1].alt.includes(product.color),
          );
          assert.equal(
            await host.getAttribute("data-scene-main"),
            "personalized",
          );
          const opensBefore = await page.evaluate(() => window.sceneOpenCount);
          const swap = host.locator(".scene-swap-button");
          const target = await swap.evaluate((el) => {
            const r = el.getBoundingClientRect();
            return (
              document
                .elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
                ?.closest(".scene-swap-button") === el
            );
          });
          assert.equal(
            target,
            true,
            `${product.skuId} inset is not the click target`,
          );
          await swap.click();
          await until(
            () =>
              host
                .getAttribute("data-scene-main")
                .then((x) => x === "original"),
            "click did not exchange views",
          );
          assert.equal(
            await page.evaluate(() => window.sceneOpenCount),
            opensBefore,
          );
          await page.keyboard.press("Enter");
          await until(
            () =>
              host
                .getAttribute("data-scene-main")
                .then((x) => x === "personalized"),
            "Enter did not exchange views",
          );
          await page.keyboard.press("Space");
          await until(
            () =>
              host
                .getAttribute("data-scene-main")
                .then((x) => x === "original"),
            "Space did not exchange views",
          );
          await host
            .locator(".scene-open-button")
            .click({ position: { x: 20, y: 100 } });
          assert.equal(
            await page.evaluate(() => window.sceneOpenCount),
            opensBefore + 1,
          );
          await page.evaluate(
            ({ sku, profile }) =>
              window.renderSceneFixture({
                sku,
                color: "unprepared-colour",
                profile,
              }),
            { sku: product.skuId, profile },
          );
          await until(
            () =>
              page
                .locator(".scene-personalized")
                .count()
                .then((x) => x === 0),
            "unsupported colour reused a scene",
          );
          assert.equal(await page.locator(".scene-swap-button").count(), 0);
          verified.push({
            skuId: product.skuId,
            src: images[1].src,
            decoded: true,
            insetClick: true,
            keyboard: true,
            unsupportedColourFallsBack: true,
          });
        }
        assert.equal(verified.length, 28);
        return { verified };
      },
    );
    for (const width of [390, 1440]) {
      await run(
        `${scenario.id} at ${width}px: only two critical files gate setup and the viewport keeps scene downloads bounded`,
        async () => {
          await page.setViewportSize({
            width,
            height: width < 600 ? 844 : 1000,
          });
          await page.addInitScript(
            ({ key, state }) => {
              localStorage.clear();
              sessionStorage.clear();
              localStorage.setItem(key, JSON.stringify(state));
            },
            {
              key: STORAGE_KEY,
              state: {
                ...initialState(),
                language: "en",
                profile: {
                  ...initialState().profile,
                  personaId: scenario.personaId,
                  homeId: scenario.homeId,
                  room: scenario.room,
                },
              },
            },
          );
          const critical = new Set(
            demoScenePreview(scenario)
              .slice(0, DEMO_CRITICAL_SCENE_COUNT)
              .map((x) => x.file),
          );
          const requests = new Set();
          const loadingRequests = new Set();
          const delayed = [];
          let releaseNoncritical = false;
          await page.route("**/personalized-scenes/*.webp", async (route) => {
            const file = new URL(route.request().url()).pathname
              .split("/")
              .at(-1);
            requests.add(file);
            if (
              await page
                .locator('.demo-setup[open][data-setup-phase="loading"]')
                .count()
            )
              loadingRequests.add(file);
            if (!critical.has(file) && !releaseNoncritical)
              await new Promise((resolve) => delayed.push(resolve));
            await route.continue().catch(() => {});
          });
          await page.goto(base, { waitUntil: "networkidle" });
          assert.equal(
            requests.size,
            0,
            "choose screen must not download the scene catalog",
          );
          assert.equal(
            await page.locator(".demo-setup-product-strip figure").count(),
            DEMO_CRITICAL_SCENE_COUNT,
          );
          assert.ok(
            (
              await page
                .locator(`[data-scene-scenario="${scenario.id}"]`)
                .innerText()
            ).includes("28 pieces with pre-generated scenes"),
          );
          const selectedReferences = await page
            .locator(".demo-setup-references img")
            .evaluateAll((images) => images.map((image) => image.src));
          await page.locator(".demo-setup-compose").click();
          assert.equal(
            await page.locator(".demo-setup").getAttribute("data-setup-phase"),
            "loading",
          );
          assert.deepEqual(
            await page
              .locator(".demo-setup-references img")
              .evaluateAll((images) => images.map((image) => image.src)),
            selectedReferences,
            "loading keeps the chosen person and room on the same screen",
          );
          assert.equal(
            await page.locator(".demo-setup-pending").isDisabled(),
            true,
          );
          assert.equal(
            await page.locator(".demo-setup-result,.demo-setup-enter").count(),
            0,
          );
          await page
            .locator(".demo-setup[open]")
            .waitFor({ state: "hidden", timeout: 9000 });
          assert.deepEqual(
            [...loadingRequests].sort(),
            [...critical].sort(),
            "only the two inline critical scene assets load before automatic entry",
          );
          const setupRequests = loadingRequests.size;
          releaseNoncritical = true;
          delayed.splice(0).forEach((resolve) => resolve());
          await exitDemoGuide(page);
          await page.locator(".editorial-grid").first().waitFor();
          await sleep(550);
          // Two critical files plus nearby first-page cards have a small,
          // explicit budget; 27 of 28 is not meaningfully lazy loading.
          assert.ok(
            requests.size <= 12,
            `first viewport downloaded entire ${requests.size}-scene catalog`,
          );
          const shopperProfile = {
            ...initialState().profile,
            personaId: scenario.personaId,
            homeId: scenario.homeId,
            room: scenario.room,
          };
          const allowedProfiles = new Set([
            `${shopperProfile.personaId}__${shopperProfile.homeId}`,
            ...catalog.map((item) => {
              const displayProfile =
                giftSceneContext(item, shopperProfile)?.profile ||
                shopperProfile;
              return `${displayProfile.personaId}__${displayProfile.homeId}`;
            }),
          ]);
          assert.ok(
            [...requests].every((file) =>
              [...allowedProfiles].some((profileKey) =>
                file.includes(profileKey),
              ),
            ),
            "a scene outside the shopper or matching gift-model profiles downloaded",
          );
          assert.ok(
            (await page.locator(".scene-personalized").count()) <= 12,
            "first viewport mounted whole scene catalog",
          );
          const pictureLoading = await page
            .locator(".scene-personalized")
            .evaluateAll((els) => els.map((el) => el.loading));
          assert.ok(pictureLoading.every((x) => x === "lazy"));
          return {
            catalogScenes: 28,
            mandatoryScenes: critical.size,
            inlineScenes: DEMO_CRITICAL_SCENE_COUNT,
            setupRequests,
            firstViewportRequests: requests.size,
            mountedScenes: pictureLoading.length,
          };
        },
      );
    }
  }
  await run(
    "late critical responses after timeout and cancelled retry cannot enter the store",
    async () => {
      const scenario = curatedScenarios[1];
      const critical = new Set(
        demoScenePreview(scenario)
          .slice(0, DEMO_CRITICAL_SCENE_COUNT)
          .map((entry) => entry.file),
      );
      const held = [];
      let release = false;
      await page.addInitScript(
        ({ key, state }) => {
          localStorage.clear();
          sessionStorage.clear();
          localStorage.setItem(key, JSON.stringify(state));
        },
        { key: STORAGE_KEY, state: { ...initialState(), language: "en" } },
      );
      await page.route("**/personalized-scenes/*.webp", async (route) => {
        const file = new URL(route.request().url()).pathname.split("/").at(-1);
        if (critical.has(file) && !release)
          await new Promise((resolve) => held.push(resolve));
        await route.continue().catch(() => {});
      });
      await page.goto(base, { waitUntil: "networkidle" });
      const before = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).profile,
        STORAGE_KEY,
      );
      await page.locator(`[data-scene-scenario="${scenario.id}"]`).click();
      await page.locator(".demo-setup-compose").click();
      await until(
        () =>
          page
            .locator(".demo-setup")
            .getAttribute("data-setup-phase")
            .then((phase) => phase === "unavailable"),
        "critical timeout did not reveal unavailable state",
      );
      await page.locator(".demo-setup-retry").click();
      await until(
        () =>
          page
            .locator(".demo-setup")
            .getAttribute("data-setup-phase")
            .then((phase) => phase === "loading"),
        "retry did not start",
      );
      await page.keyboard.press("Escape");
      release = true;
      held.splice(0).forEach((resolve) => resolve());
      await sleep(2100);
      assert.equal(
        await page.locator(".demo-setup").getAttribute("data-setup-phase"),
        "choose",
      );
      assert.equal(await page.locator(".demo-setup-enter").count(), 0);
      assert.deepEqual(
        await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)).profile,
          STORAGE_KEY,
        ),
        before,
      );
      await page.locator(".demo-setup-compose").click();
      await page
        .locator(".demo-setup[open]")
        .waitFor({ state: "hidden", timeout: 9000 });
      await exitDemoGuide(page);
      assert.equal(await page.locator(".editorial-grid").isVisible(), true);
      const recoveredProfile = await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key)).profile,
        STORAGE_KEY,
      );
      assert.equal(recoveredProfile.personaId, scenario.personaId);
      assert.equal(recoveredProfile.homeId, scenario.homeId);
      return {
        criticalTimeout: true,
        cancelledRetryStayedCancelled: true,
        lateResponsesDidNotCommitProfile: true,
        freshRetryRecovered: true,
      };
    },
  );

  await run(
    "a failed noncritical scene never blocks entry and the actual product stays an honest concept",
    async () => {
      const scenario = curatedScenarios[0];
      // A room scene has no full-outfit replacement, so this exercises the
      // actual failed product asset rather than an unused old preview file.
      const failed = demoScenePreview(scenario)
        .slice(DEMO_CRITICAL_SCENE_COUNT)
        .find((entry) => entry.type === "room");
      assert.ok(failed);
      let failedRequests = 0;
      await page.addInitScript(
        ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
        { key: STORAGE_KEY, state: { ...initialState(), language: "en" } },
      );
      await page.route(`**/personalized-scenes/${failed.file}`, (route) => {
        failedRequests++;
        return route.abort();
      });
      await page.goto(base, { waitUntil: "networkidle" });
      await page.locator(".demo-setup-compose").click();
      await page
        .locator(".demo-setup[open]")
        .waitFor({ state: "hidden", timeout: 9000 });
      await exitDemoGuide(page);
      assert.equal(
        await page.locator(".demo-setup-result,.demo-setup-enter").count(),
        0,
      );
      await page
        .getByRole("textbox", {
          name: "Search products or styles",
          exact: true,
        })
        .fill(byId(failed.skuId).en);
      const result = page
        .locator(`[data-scene-product="${failed.skuId}"]`)
        .first();
      await result.scrollIntoViewIfNeeded();
      await until(
        async () =>
          failedRequests > 0 &&
          (await result.locator(".scene-personalized").count()) === 0,
        "failed scene did not fall back on its actual product",
      );
      assert.equal(await result.getAttribute("data-scene-main"), "original");
      assert.equal(await result.getAttribute("data-scene-id"), null);
      assert.equal(
        await result.locator(".scene-swap-button,.scene-image-caption").count(),
        0,
      );
      assert.match(
        await result.locator(".scene-original").getAttribute("src"),
        /^\/images\//,
      );
      assert.match(
        await result.locator(".scene-original").getAttribute("alt"),
        new RegExp(`${failed.skuId}.*product concept image`),
      );
      await until(
        () =>
          result
            .locator(".scene-original")
            .evaluate((x) => x.complete && x.naturalWidth > 0),
        "concept fallback did not decode",
      );
      await page.screenshot({
        path: `${root}/artifacts/full-catalog-noncritical-concept-fallback.png`,
      });
      return {
        failedSku: failed.skuId,
        conceptFallback: true,
        automaticallyEntered: true,
        failedRequests,
      };
    },
  );
} finally {
  await browser?.close();
  server?.kill();
  await writeFile(
    `${root}/artifacts/full-catalog-scenes-e2e-results.json`,
    JSON.stringify(
      {
        results,
        passed: results.filter((x) => x.status === "pass").length,
        failed: results.filter((x) => x.status === "fail").length,
      },
      null,
      2,
    ),
  );
}
if (
  results.some((x) => x.status === "fail") ||
  (!process.env.E2E_FILTER && results.length !== 8) ||
  results.length === 0
)
  process.exitCode = 1;
