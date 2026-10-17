import { exitDemoGuide } from "./demo-guide-helpers.mjs";
// Required, two-set visit setup. One confirmation leads directly to the store.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4198";
const scenePattern = "**/personalized-scenes/*.webp";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, context, page;
const results = [];
let errors = [],
  providerCalls = [];
const readState = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const intro = () => page.locator(".store-onboarding");
async function wait(check, message, timeout = 7000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await sleep(35);
  }
  throw Error(message);
}
async function reset(
  state = { ...initialState(), language: "en" },
  width = 1440,
  motion = "reduce",
) {
  const previous = page;
  page = await context.newPage();
  await previous?.close();
  errors = [];
  providerCalls = [];
  page.setDefaultTimeout(7000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/(guide|analyze)$/.test(request.url()))
      providerCalls.push(request.url());
  });
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.evaluate(
    ({ key, state }) => {
      localStorage.clear();
      sessionStorage.clear();
      if (state) localStorage.setItem(key, JSON.stringify(state));
    },
    { key: STORAGE_KEY, state },
  );
  await page.reload({ waitUntil: "networkidle" });
}
async function entered() {
  await intro().waitFor({ state: "detached" });
  await exitDemoGuide(page);
  assert.equal(await page.locator(".editorial-grid").isVisible(), true);
}
async function enter() {
  await intro().locator(".demo-setup-compose").click();
  await entered();
}
async function noOverflow(label) {
  const sizes = await page.evaluate(() => {
    const dialog = document.querySelector(".store-onboarding"),
      body = dialog?.querySelector(".demo-setup-body");
    return {
      page: document.documentElement.scrollWidth <= innerWidth + 1,
      dialog: !dialog || dialog.scrollWidth <= dialog.clientWidth + 1,
      body: !body || body.scrollWidth <= body.clientWidth + 1,
    };
  });
  assert.ok(
    Object.values(sizes).every(Boolean),
    `${label}: ${JSON.stringify(sizes)}`,
  );
}
async function holdScenes() {
  let release;
  const requests = [];
  const held = new Promise((resolve) => {
    release = resolve;
  });
  await page.route(scenePattern, async (route) => {
    requests.push(route.request().url());
    await held;
    await route.continue().catch(() => {});
  });
  return { release, requests };
}
async function run(name, fn) {
  try {
    await fn();
    assert.deepEqual(errors, []);
    assert.deepEqual(providerCalls, []);
    results.push({ name, status: "pass" });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.stack });
    console.error(`FAIL ${name}: ${error.stack}`);
    await page
      .screenshot({
        path: `${root}/artifacts/setup-fail-${results.length}.png`,
      })
      .catch(() => {});
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
      "4198",
      "--strictPort",
    ],
    { cwd: root, stdio: "ignore" },
  );
  await wait(
    () =>
      fetch(base)
        .then((response) => response.ok)
        .catch(() => false),
    "Vite did not start",
  );
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  context = await browser.newContext({ reducedMotion: "reduce" });
  page = await context.newPage();

  await run(
    "each fresh opening gates the catalog; Escape and saved state cannot skip it",
    async () => {
      await reset(null);
      assert.equal(await intro().isVisible(), true);
      assert.equal(await page.locator("dialog:modal").count(), 1);
      assert.equal(await page.locator(".editorial-grid").isVisible(), false);
      assert.equal(
        await page
          .locator(".storefront-shell")
          .evaluate((element) => element.inert && element.hidden),
        true,
      );
      assert.equal(await page.locator('input[type="file"]').count(), 0);
      assert.equal(
        await page
          .locator(
            ".subtitle-concierge,.subtitle-bubble,.concierge-attention-frame",
          )
          .count(),
        0,
      );
      assert.equal(
        await page.evaluate(() => document.activeElement.id),
        "onboarding-title",
      );
      for (let index = 0; index < 12; index++) {
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(
            () => !!document.activeElement.closest(".store-onboarding"),
          ),
          true,
        );
      }
      await page.keyboard.press("Escape");
      assert.equal(await intro().locator(".demo-setup-hint").isVisible(), true);
      assert.equal(await intro().locator(".demo-setup-enter").count(), 0);
      assert.equal(
        await intro()
          .getByRole("button", { name: /skip|browse now/i })
          .count(),
        0,
      );
      await enter();
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await intro().isVisible(), true);
      assert.equal(await page.locator(".editorial-grid").isVisible(), false);
    },
  );

  await run(
    "only two complete fictional sets are selectable; references update inline",
    async () => {
      await reset();
      assert.equal(await intro().locator("[data-scene-scenario]").count(), 2);
      await intro().locator("summary").click();
      assert.equal(
        await intro()
          .locator(".demo-setup-unavailable[aria-disabled='true']")
          .count(),
        9,
      );
      assert.equal(
        await intro()
          .locator(
            ".demo-setup-unavailable button,.demo-setup-unavailable input",
          )
          .count(),
        0,
      );
      assert.match(
        await intro().locator(".demo-setup-more").innerText(),
        /coming later|not yet available/i,
      );
      for (const scenario of curatedScenarios) {
        await intro().locator(`[data-scene-scenario="${scenario.id}"]`).click();
        assert.equal(
          await intro()
            .locator(`[data-scene-scenario="${scenario.id}"]`)
            .getAttribute("aria-pressed"),
          "true",
        );
        assert.match(
          await intro().locator(".demo-setup-person img").getAttribute("src"),
          new RegExp(scenario.personaId),
        );
        assert.match(
          await intro().locator(".demo-setup-room img").getAttribute("src"),
          new RegExp(scenario.homeId),
        );
      }
      await enter();
      await page.locator(".shop-preference-entry").click();
      const profile = page.getByRole("dialog", {
        name: "A little more you.",
        exact: true,
      });
      assert.equal(await profile.locator(".persona-option").count(), 2);
      await profile
        .getByRole("button", { name: "My space", exact: true })
        .click();
      assert.equal(await profile.locator(".home-option").count(), 2);
      assert.equal(
        await profile
          .locator("select[aria-describedby='demo-room-availability']")
          .isDisabled(),
        true,
      );
    },
  );

  await run(
    "one confirmation loads only two critical assets then enters automatically, with no result page",
    async () => {
      await reset({ ...initialState(), language: "en" }, 1440, "no-preference");
      const before = (await readState()).profile;
      const held = await holdScenes();
      const started = Date.now();
      await intro().locator(".demo-setup-compose").click();
      await wait(
        () =>
          intro()
            .getAttribute("data-setup-phase")
            .then((phase) => phase === "loading"),
        "loading never appeared",
      );
      assert.equal(await intro().locator("[aria-busy='true']").count(), 1);
      assert.equal(
        await intro().locator(".demo-setup-selection").isVisible(),
        true,
      );
      assert.equal(
        await intro()
          .locator(
            ".demo-setup-results,.demo-setup-composition,.demo-setup-enter",
          )
          .count(),
        0,
      );
      assert.match(
        await intro().locator(".demo-setup-loading").innerText(),
        /Pre-generated assets.*automatically/s,
      );
      assert.doesNotMatch(
        await intro().innerText(),
        /\d+%|Arranging pieces|Getting your scene preview/,
      );
      await wait(
        () => held.requests.length === 2,
        "two critical assets were not requested",
      );
      assert.equal(await page.locator(".editorial-grid").isVisible(), false);
      assert.deepEqual((await readState()).profile, before);
      held.release();
      await entered();
      assert.ok(Date.now() - started < 2400, "normal entry should stay brief");
      assert.equal((await readState()).onboardingStatus, "completed");
    },
  );

  await run(
    "Back and Escape cancel delayed preparation, retain selection and never enter later",
    async () => {
      for (const method of ["back", "escape"]) {
        await reset({ ...initialState(), language: "en" }, 390);
        const before = (await readState()).profile;
        await intro().locator('[data-scene-scenario="quiet-city"]').click();
        const held = await holdScenes();
        await intro()
          .locator(".demo-setup-body")
          .evaluate((element) => {
            element.scrollTop = element.scrollHeight;
          });
        const scroll = await intro()
          .locator(".demo-setup-body")
          .evaluate((element) => element.scrollTop);
        await intro().locator(".demo-setup-compose").click();
        await intro().locator(".demo-setup-loading").waitFor();
        assert.equal(
          await intro()
            .locator(".demo-setup-body")
            .evaluate((element) => element.scrollTop),
          scroll,
          "loading must keep selection scroll position",
        );
        if (method === "back")
          await intro().locator(".demo-setup-back").click();
        else await page.keyboard.press("Escape");
        held.release();
        await sleep(2600);
        assert.equal(await intro().getAttribute("data-setup-phase"), "choose");
        assert.equal(
          await intro()
            .locator('[data-scene-scenario="quiet-city"]')
            .getAttribute("aria-pressed"),
          "true",
        );
        assert.deepEqual((await readState()).profile, before);
        assert.equal(await page.locator(".editorial-grid").isVisible(), false);
        await page.unroute(scenePattern);
        await enter();
        assert.equal((await readState()).profile.personaId, "relaxed-man-50");
      }
    },
  );

  await run(
    "same-case entry preserves preferences and shopping data; reload prefills and case snapshots survive",
    async () => {
      const item = byId("ME-001");
      const seeded = {
        ...initialState(),
        language: "en",
        onboardingStatus: "skipped",
        profile: {
          ...initialState().profile,
          name: "My own edit",
          styles: ["artful"],
          height: 186,
          size: "XL",
          budget: 9000,
        },
        wishlist: ["ME-002"],
        cart: [
          {
            lineId: "kept",
            skuId: item.id,
            color: item.color,
            size: "M",
            quantity: 1,
          },
        ],
        purchaseHistory: [{ skuId: "ME-003", color: "Walnut", size: "S" }],
        purchaseHistoryOrigin: "edited",
      };
      await reset(seeded);
      assert.equal(
        (await readState()).profile.personaId,
        seeded.profile.personaId,
      );
      await enter();
      const saved = await readState();
      assert.equal(saved.onboardingStatus, "completed");
      assert.equal(saved.profile.personaId, "everyday-woman-45");
      assert.equal(saved.profile.homeId, "warm-family");
      assert.equal(saved.profile.room, "living");
      for (const key of ["name", "height", "size", "budget", "styles"])
        assert.deepEqual(saved.profile[key], seeded.profile[key]);
      for (const key of ["cart", "wishlist", "purchaseHistory"])
        assert.deepEqual(saved[key], seeded[key]);
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await intro().isVisible(), true);
      assert.equal(
        await intro()
          .locator('[data-scene-scenario="warm-everyday"]')
          .getAttribute("aria-pressed"),
        "true",
      );
      await enter();
      assert.deepEqual(
        (await readState()).purchaseHistory,
        seeded.purchaseHistory,
      );
      await page.reload({ waitUntil: "networkidle" });
      await intro().locator('[data-scene-scenario="quiet-city"]').click();
      await enter();
      const switched = await readState();
      assert.deepEqual(switched.cart, []);
      assert.deepEqual(
        switched.caseSnapshots[curatedScenarios[0].id].cart,
        seeded.cart,
      );
      assert.deepEqual(
        switched.caseSnapshots[curatedScenarios[0].id].purchaseHistory,
        seeded.purchaseHistory,
      );
      await page.reload({ waitUntil: "networkidle" });
      await intro()
        .locator(`[data-scene-scenario="${curatedScenarios[0].id}"]`)
        .click();
      await enter();
      for (const key of ["cart", "wishlist", "purchaseHistory"])
        assert.deepEqual((await readState())[key], seeded[key]);
    },
  );

  await run(
    "failed assets stay inline with retry/back; successful retry enters without a preview page",
    async () => {
      await reset();
      await page.route(scenePattern, (route) => route.abort());
      await intro().locator(".demo-setup-compose").click();
      await intro().locator(".demo-setup-retry").waitFor();
      assert.equal(
        await intro().getAttribute("data-setup-phase"),
        "unavailable",
      );
      assert.equal(
        await intro().locator(".demo-setup-selection").isVisible(),
        true,
      );
      assert.match(
        await intro().locator(".demo-setup-error").innerText(),
        /couldn’t load/,
      );
      assert.equal(await page.locator(".editorial-grid").isVisible(), false);
      await intro().locator(".demo-setup-back").click();
      assert.equal(await intro().getAttribute("data-setup-phase"), "choose");
      await intro().locator(".demo-setup-compose").click();
      await intro().locator(".demo-setup-retry").waitFor();
      await page.unroute(scenePattern);
      await intro().locator(".demo-setup-retry").click();
      await entered();
    },
  );

  await run(
    "deadline is bounded and an explicit failed-image fallback can browse product concepts",
    async () => {
      await reset();
      const held = await holdScenes();
      const started = Date.now();
      await intro().locator(".demo-setup-compose").click();
      await intro().locator(".demo-setup-retry").waitFor();
      assert.ok(Date.now() - started >= 2300 && Date.now() - started < 3600);
      await intro().locator(".demo-setup-enter").click();
      held.release();
      await entered();
      assert.equal((await readState()).onboardingStatus, "completed");
    },
  );

  await run(
    "mute remains available and synchronized during preparation",
    async () => {
      await reset();
      const held = await holdScenes();
      const mutedBefore = await intro()
        .locator(".demo-setup-mute")
        .getAttribute("aria-pressed");
      await intro().locator(".demo-setup-compose").click();
      await intro().locator(".demo-setup-loading").waitFor();
      await intro().locator(".demo-setup-mute").click();
      await wait(
        () =>
          intro()
            .locator(".demo-setup-mute")
            .getAttribute("aria-pressed")
            .then((value) => value !== mutedBefore),
        "mute did not update",
      );
      held.release();
      await entered();
    },
  );

  for (const language of ["zh", "en"])
    for (const width of [320, 390, 1024, 1440]) {
      await run(
        `${language} direct-entry selection/loading/store and failed-asset layout at ${width}px`,
        async () => {
          await reset({ ...initialState(), language }, width);
          await noOverflow(`${language} ${width} choose`);
          await page.screenshot({
            path: `${root}/artifacts/setup-${language}-${width}-choose.png`,
          });
          const held = await holdScenes();
          await intro().locator(".demo-setup-compose").click();
          await intro().locator(".demo-setup-loading").waitFor();
          await noOverflow(`${language} ${width} loading`);
          assert.equal(
            await intro()
              .locator(".demo-setup-spinner")
              .evaluate((element) => getComputedStyle(element).animationName),
            "none",
          );
          const footer = await intro()
            .locator(".demo-setup-footer")
            .boundingBox();
          assert.ok(
            footer.y >= 0 &&
              footer.y + footer.height <= page.viewportSize().height + 1,
          );
          await page.screenshot({
            path: `${root}/artifacts/setup-${language}-${width}-loading.png`,
          });
          await intro().locator(".demo-setup-back").click();
          held.release();
          await page.unroute(scenePattern);
          await page.route(scenePattern, (route) => route.abort());
          await intro().locator(".demo-setup-compose").click();
          await intro().locator(".demo-setup-retry").waitFor();
          await noOverflow(`${language} ${width} unavailable`);
          const errorFooter = await intro()
            .locator(".demo-setup-footer")
            .boundingBox();
          assert.ok(
            errorFooter.y >= 0 &&
              errorFooter.y + errorFooter.height <=
                page.viewportSize().height + 1,
          );
          await page.screenshot({
            path: `${root}/artifacts/setup-${language}-${width}-unavailable.png`,
          });
          await page.unroute(scenePattern);
          await intro().locator(".demo-setup-retry").click();
          await entered();
          await noOverflow(`${language} ${width} store`);
        },
      );
    }
} finally {
  await writeFile(
    `${root}/artifacts/onboarding-e2e-results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser?.close();
  server?.kill();
}
console.log(
  `${results.filter((result) => result.status === "pass").length}/${results.length} setup scenarios passed.`,
);
if (results.some((result) => result.status !== "pass")) process.exitCode = 1;
