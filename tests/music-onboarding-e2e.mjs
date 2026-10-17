// Regression coverage for real first-visit gestures. Successful playback always
// uses the bundled MP3, including after deterministic delayed policy denial.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY } from "../src/data.js";
import { MUSIC_TRACKS } from "../src/store-music.js";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = process.env.E2E_PORT || "4428";
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const prefix = process.env.E2E_OUTPUT_PREFIX || "music-onboarding";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
let server, active;
async function until(check, message, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(40);
  }
  throw Error(message);
}
async function launch(policy) {
  return chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: [
      ...headless.args.filter((arg) => !arg.startsWith("--autoplay-policy=")),
      `--autoplay-policy=${policy}`,
    ],
    env: { ...process.env, HOME: "/tmp" },
  });
}
async function fresh({
  fixture = false,
  preferences = {},
  width = 1440,
  empty = false,
} = {}) {
  await active?.browser.close();
  const browser = await launch(
    fixture ? "no-user-gesture-required" : "document-user-activation-required",
  );
  const context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const record = {
    browser,
    context,
    page,
    errors: [],
    providerCalls: [],
    externalCalls: [],
    musicRequests: [],
    musicResponses: [],
    checkpoints: [],
  };
  active = record;
  page.on("pageerror", (error) => record.errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/music/"))
      record.musicRequests.push(request.url());
  });
  page.on("response", (response) => {
    if (response.url().includes("/music/"))
      record.musicResponses.push({
        url: response.url(),
        status: response.status(),
        contentType: response.headers()["content-type"],
      });
  });
  // Prevent any external/provider activity even if a regression requests it.
  await context.route("**/*", async (route) => {
    const url = route.request().url();
    if (/\/api\/(?:guide|analyze)(?:\?|$)/.test(url)) {
      record.providerCalls.push(url);
      return route.abort();
    }
    if (/^https?:/.test(url) && new URL(url).origin !== new URL(base).origin) {
      record.externalCalls.push(url);
      return route.abort();
    }
    return route.continue();
  });
  await context.addInitScript(
    ({ key, value, fixture }) => {
      if (!sessionStorage.getItem("music-onboarding-seeded")) {
        localStorage.clear();
        sessionStorage.clear();
        if (value) localStorage.setItem(key, JSON.stringify(value));
        sessionStorage.setItem("music-onboarding-seeded", "yes");
      }
      window.musicEvidence = {
        attempts: [],
        events: [],
        initialReleased: false,
      };
      for (const name of [
        "playing",
        "pause",
        "error",
        "loadedmetadata",
        "ended",
      ]) {
        document.addEventListener(
          name,
          (event) => {
            if (event.target.matches?.("audio[data-store-music]"))
              window.musicEvidence.events.push({
                name,
                time: performance.now(),
                currentTime: event.target.currentTime,
                paused: event.target.paused,
              });
          },
          true,
        );
      }
      if (!fixture) return; // Native-policy cases do not replace play().
      const nativePlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function () {
        if (!this.matches("audio[data-store-music]"))
          return nativePlay.call(this);
        window.musicEvidence.attempts.push({
          time: performance.now(),
          activated: navigator.userActivation.isActive,
          src: this.src,
        });
        if (window.musicEvidence.attempts.length === 1) {
          return new Promise((resolve, reject) => {
            window.releaseInitialMusicDenial = () => {
              window.musicEvidence.initialReleased = true;
              reject(
                new DOMException(
                  "Delayed initial activation required",
                  "NotAllowedError",
                ),
              );
            };
          });
        }
        return nativePlay.call(this);
      };
    },
    {
      key: STORAGE_KEY,
      value: empty
        ? null
        : { ...initialState(), language: "en", ...preferences },
      fixture,
    },
  );
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.locator(".demo-setup[open]").waitFor();
  await page.locator("audio[data-store-music]").waitFor({ state: "attached" });
  if (
    fixture &&
    preferences.soundEnabled !== false &&
    !preferences.soundMuted &&
    preferences.soundVolume !== 0
  ) {
    await until(
      () => page.evaluate(() => window.musicEvidence.attempts.length === 1),
      "initial fixture attempt never began",
    );
  }
  return record;
}
const audio = (page) => page.locator("audio[data-store-music]");
async function checkpoint(label) {
  const { page } = active;
  const detail = await page.evaluate(
    ({ key, label }) => {
      const a = document.querySelector("audio[data-store-music]");
      const saved = JSON.parse(localStorage.getItem(key) || "null");
      return {
        label,
        status: document.querySelector(".music-control")?.dataset.musicStatus,
        paused: a.paused,
        currentTime: a.currentTime,
        readyState: a.readyState,
        duration: Number.isFinite(a.duration) ? a.duration : null,
        currentSrc: a.currentSrc,
        muted: a.muted,
        volume: a.volume,
        selectedTrack: saved?.soundTrack,
        soundEnabled: saved?.soundEnabled,
        soundMuted: saved?.soundMuted,
        soundVolume: saved?.soundVolume,
        evidence: window.musicEvidence,
      };
    },
    { key: STORAGE_KEY, label },
  );
  active.checkpoints.push(detail);
  return detail;
}
async function playing(page, track = MUSIC_TRACKS[0]) {
  await until(
    () =>
      audio(page).evaluate(
        (a, src) =>
          !a.paused &&
          a.readyState >= 2 &&
          a.currentTime > 0.12 &&
          a.currentSrc.endsWith(src),
        track.src,
      ),
    `real MP3 did not decode and progress: ${track.id}`,
  );
  const before = await audio(page).evaluate((a) => a.currentTime);
  await sleep(200);
  assert.ok(
    await audio(page).evaluate((a, before) => a.currentTime > before, before),
    "audio clock did not progress",
  );
  const shot = await checkpoint("decoded-playing");
  assert.equal(shot.muted, false);
  assert.ok(shot.volume > 0);
  assert.ok(Math.abs(shot.duration - track.durationSeconds) < 2);
  assert.ok(
    active.musicResponses.some(
      (r) =>
        r.url.endsWith(track.src) &&
        [200, 206].includes(r.status) &&
        /audio\/mpeg/i.test(r.contentType),
    ),
    "selected MP3 was not served successfully",
  );
}
async function release(page) {
  await page.evaluate(() => window.releaseInitialMusicDenial());
  await sleep(80);
}
async function enter(page, synthetic = false) {
  const button = page.locator(".demo-setup-compose");
  if (synthetic) await button.dispatchEvent("click");
  else await button.click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "detached", timeout: 20000 });
}
async function finishBrowse(page) {
  await page.evaluate(() => {
    window.__navigationMusicNode = document.querySelector(
      "audio[data-store-music]",
    );
    window.__navigationMusicPosition = window.__navigationMusicNode.currentTime;
    window.__navigationMusicSource = window.__navigationMusicNode.currentSrc;
  });
  await exitDemoGuide(page);
  await page.mouse.wheel(0, 650);
  await sleep(200);
  await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
  const nav = page.getByRole("button", { name: "Your visit", exact: true });
  if (!(await nav.isVisible())) await page.locator(".mobile-menu").click();
  await nav.click();
  await page.locator(".visit-ai-workspace").waitFor();
  assert.equal(
    await page.evaluate(
      () =>
        document.querySelector("audio[data-store-music]") ===
        window.__navigationMusicNode,
    ),
    true,
    "visit navigation remounted audio",
  );
  assert.equal(
    await audio(page).evaluate(
      (a) =>
        a.currentSrc === window.__navigationMusicSource &&
        a.currentTime >= window.__navigationMusicPosition - 0.03,
    ),
    true,
    "visit navigation changed source or restarted recording",
  );
}
async function swap(page) {
  // Lesson ownership begins when its real scene reaches the viewport.
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
  const before = await lesson.getAttribute("data-scene-main");
  const product = await lesson.getAttribute("data-scene-product");
  await lesson.locator(".scene-swap-button").click();
  const scene = page.locator(`[data-scene-product="${product}"]`).first();
  await until(
    async () => (await scene.getAttribute("data-scene-main")) !== before,
    "real guided swap did not change image",
  );
}
async function run(name, fn) {
  if (
    process.env.E2E_FILTER &&
    !new RegExp(process.env.E2E_FILTER, "i").test(name)
  )
    return;
  try {
    await fn();
    assert.deepEqual(active.errors, [], "uncaught browser errors");
    assert.deepEqual(active.providerCalls, [], "unexpected provider calls");
    assert.deepEqual(active.externalCalls, [], "unexpected external requests");
    results.push({ name, status: "pass", ...(await evidence()) });
    console.log(`PASS ${name}`);
  } catch (error) {
    await checkpoint("failure").catch(() => {});
    results.push({
      name,
      status: "fail",
      error: error.stack,
      ...(await evidence()),
    });
    console.error(`FAIL ${name}: ${error.message}`);
    await active?.page
      .screenshot({
        path: `${root}/artifacts/${prefix}-fail-${results.length}.png`,
      })
      .catch(() => {});
  }
}
async function evidence() {
  if (!active) return {};
  return {
    checkpoints: active.checkpoints,
    musicRequests: active.musicRequests,
    musicResponses: active.musicResponses,
    providerCalls: active.providerCalls,
    externalCalls: active.externalCalls,
    errors: active.errors,
  };
}
try {
  await mkdir(`${root}/artifacts`, { recursive: true });
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        port,
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
    await until(
      () =>
        fetch(base)
          .then((r) => r.ok)
          .catch(() => false),
      "Vite did not start",
    );
  }

  for (const gesture of ["model", "language", "entry"]) {
    await run(
      `delayed initial denial preserves early ${gesture} activation and selected recording`,
      async () => {
        const track =
          gesture === "language" ? MUSIC_TRACKS[1] : MUSIC_TRACKS[0];
        const { page } = await fresh({
          fixture: true,
          preferences: { soundTrack: track.id },
        });
        const first = await checkpoint("pending-initial-attempt");
        assert.equal(first.status, "loading");
        assert.equal(first.paused, true);
        if (gesture === "model")
          await page.locator(".demo-setup-scenario").nth(1).click();
        else if (gesture === "language")
          await page.locator(".demo-setup-language").click();
        else await page.locator(".demo-setup-compose").click();
        await checkpoint("after-early-trusted-gesture");
        await release(page);
        await playing(page, track);
        const evidence = await page.evaluate(() => window.musicEvidence);
        assert.equal(
          evidence.attempts.length,
          2,
          "activation should cause exactly one retry",
        );
        assert.equal(
          evidence.attempts[1].activated,
          true,
          "retry was not made during user activation",
        );
        if (gesture !== "entry") await enter(page);
        else
          await page
            .locator(".demo-setup[open]")
            .waitFor({ state: "detached", timeout: 20000 });
        await swap(page);
        await playing(page, track);
        if (gesture === "language") {
          // Restore English through the visible language control for navigation.
          await exitDemoGuide(page);
          const language = page.getByRole("button", {
            name: /Switch to English/,
          });
          if (await language.count()) await language.click();
          else await page.locator(".language-toggle").click();
        }
        await finishBrowse(page);
        await playing(page, track);
        assert.equal(
          await page.evaluate(() => window.musicEvidence.attempts.length),
          2,
          "later browse, swap, scroll, or visit replayed music",
        );
      },
    );
  }

  await run(
    "waiting retry sees stopPropagation guided swap and survives scroll and visit",
    async () => {
      const { page } = await fresh({ fixture: true });
      // Synthetic setup is preparation only, deliberately without user activation.
      // The tested activation below is a real pointer click on the guided target.
      await enter(page, true);
      await release(page);
      await until(
        async () =>
          (await checkpoint("waiting-before-swap")).status === "waiting",
        "initial denial did not become waiting",
      );
      await swap(page);
      await playing(page);
      await finishBrowse(page);
      await playing(page);
    },
  );

  await run(
    "waiting retry accepts defaultPrevented onboarding focus-trap keydown",
    async () => {
      const { page } = await fresh({ fixture: true });
      await release(page);
      await until(
        async () =>
          (await page
            .locator(".music-control")
            .getAttribute("data-music-status")) === "waiting",
        "not waiting",
      );
      await page.locator(".demo-setup-compose").focus();
      await page.evaluate(() =>
        document.addEventListener(
          "keydown",
          (event) => {
            window.musicPreventedKey = {
              key: event.key,
              prevented: event.defaultPrevented,
              trusted: event.isTrusted,
            };
          },
          { once: true },
        ),
      );
      await page.keyboard.press("Tab");
      assert.deepEqual(
        await page.evaluate(() => window.musicPreventedKey),
        { key: "Tab", prevented: true, trusted: true },
        "focus-trap event was not actually defaultPrevented",
      );
      await playing(page);
      assert.equal(
        await page.evaluate(() => window.musicEvidence.attempts.length),
        2,
      );
    },
  );

  for (const gesture of ["model", "language", "entry"]) {
    await run(
      `native Chromium policy starts real recording on first ${gesture} click`,
      async () => {
        const { page } = await fresh({
          empty: true,
          width: gesture === "model" ? 390 : 1440,
        });
        await until(
          async () =>
            (await page
              .locator(".music-control")
              .getAttribute("data-music-status")) === "waiting",
          "native initial denial was not disclosed as waiting",
        );
        const first = await checkpoint("native-before-first-click");
        assert.equal(first.paused, true);
        assert.equal(first.currentTime, 0);
        if (gesture === "model")
          await page.locator(".demo-setup-scenario").nth(1).click();
        else if (gesture === "language")
          await page.locator(".demo-setup-language").click();
        else await page.locator(".demo-setup-compose").click();
        await playing(page);
      },
    );
  }

  await run(
    "native policy keeps wheel silent then starts on real guided swap",
    async () => {
      const { page } = await fresh({ empty: true });
      await enter(page, true);
      await page.locator(".personalized-scene.is-swap-tutorial").waitFor();
      await page.mouse.wheel(0, 300);
      await sleep(250);
      const before = await checkpoint("native-wheel-is-not-activation");
      assert.equal(before.paused, true);
      assert.equal(before.currentTime, 0);
      assert.equal(before.status, "waiting");
      await swap(page);
      await playing(page);
      await finishBrowse(page);
      await playing(page);
    },
  );

  for (const [label, preferences] of [
    ["pause", { soundEnabled: false }],
    ["mute", { soundMuted: true }],
    ["zero-volume", { soundVolume: 0 }],
  ]) {
    await run(
      `refresh resets saved ${label} while preserving track and positive volume; in-page choice survives visit`,
      async () => {
        const track = MUSIC_TRACKS[2];
        const savedVolume = label === "zero-volume" ? 0 : 0.22;
        const { page } = await fresh({
          preferences: {
            soundTrack: track.id,
            soundVolume: savedVolume,
            ...preferences,
          },
          width: label === "mute" ? 390 : 1440,
        });
        await until(
          async () =>
            (await page
              .locator(".music-control")
              .getAttribute("data-music-status")) === "waiting",
          "refresh did not arm native activation",
        );
        const first = await checkpoint("saved-choice-reset-on-fresh-document");
        assert.equal(first.soundEnabled, true);
        assert.equal(first.soundMuted, false);
        assert.ok(first.soundVolume > 0);
        if (savedVolume > 0) assert.equal(first.soundVolume, savedVolume);
        assert.equal(first.selectedTrack, track.id);
        assert.equal(first.currentTime, 0);
        await page.locator(".demo-setup-scenario").nth(1).click();
        await playing(page, track);
        await enter(page);
        await swap(page);
        await exitDemoGuide(page);
        await audio(page).evaluate((a) => {
          a.currentTime = 42;
        });
        if (label === "pause") {
          await page
            .locator(".music-control")
            .getByRole("button", { name: "Pause store music", exact: true })
            .click();
        } else if (label === "mute") {
          await page
            .locator(".music-control")
            .getByRole("button", { name: "Mute store music", exact: true })
            .click();
        } else {
          await page
            .getByRole("button", {
              name: "Store music and tracks",
              exact: true,
            })
            .click();
          await page
            .getByRole("dialog", { name: "The listening room.", exact: true })
            .getByRole("slider", { name: "Music volume", exact: true })
            .fill("0");
          await page.keyboard.press("Escape");
        }
        await checkpoint("explicit-in-page-choice");
        await finishBrowse(page);
        const chosen = await checkpoint("explicit-in-page-choice-after-visit");
        assert.equal(chosen.selectedTrack, track.id);
        if (label === "pause") {
          assert.equal(chosen.paused, true);
          assert.equal(chosen.soundEnabled, false);
        } else if (label === "mute") assert.equal(chosen.muted, true);
        else assert.equal(chosen.volume, 0);
        assert.ok(
          chosen.currentTime >= 42,
          "navigation reset playback position",
        );
        const saved = await page.evaluate(
          (key) => JSON.parse(localStorage.getItem(key)),
          STORAGE_KEY,
        );
        const preservedVolume =
          saved.soundVolume > 0 ? saved.soundVolume : null;
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.locator(".demo-setup[open]").waitFor();
        await until(
          async () =>
            ["waiting", "playing"].includes(
              await page
                .locator(".music-control")
                .getAttribute("data-music-status"),
            ),
          "reload music did not start or await activation",
        );
        const refreshed = await checkpoint(
          "actual-full-refresh-starts-at-zero",
        );
        assert.equal(refreshed.soundEnabled, true);
        assert.equal(refreshed.soundMuted, false);
        assert.equal(refreshed.muted, false);
        assert.ok(refreshed.volume > 0);
        if (preservedVolume) assert.equal(refreshed.volume, preservedVolume);
        assert.equal(refreshed.selectedTrack, track.id);
        assert.ok(
          refreshed.currentTime < 3,
          `refresh resumed old position: ${refreshed.currentTime}`,
        );
        await page.locator(".demo-setup-scenario").nth(1).click();
        await playing(page, track);
      },
    );
  }

  await run(
    "mute during unresolved initial attempt stays silent across navigation until explicit unmute",
    async () => {
      const { page } = await fresh({ fixture: true });
      await page.locator(".demo-setup-mute").click();
      await page.locator(".demo-setup-scenario").nth(1).click();
      await release(page);
      await until(
        async () =>
          (await page
            .locator(".music-control")
            .getAttribute("data-music-status")) === "paused",
        "pending mute did not disarm arrival retry",
      );
      await page.locator(".demo-setup-language").click();
      await page.locator(".demo-setup-language").click();
      await enter(page);
      await swap(page);
      await finishBrowse(page);
      const muted = await checkpoint("pending-mute-survived-navigation");
      assert.equal(muted.muted, true);
      assert.equal(muted.soundMuted, true);
      assert.equal(muted.paused, true);
      assert.equal(muted.currentTime, 0);
      assert.equal(
        muted.evidence.attempts.length,
        1,
        "later gesture overrode explicit mute",
      );
      await page
        .locator(".music-control")
        .getByRole("button", { name: "Unmute store music", exact: true })
        .click();
      await playing(page);
      assert.equal(
        await page.evaluate(() => window.musicEvidence.attempts.length),
        2,
      );
    },
  );

  await run(
    "natural MP3 ended advances sequentially and wraps; pause prevents advance across visit",
    async () => {
      const { page } = await fresh({
        preferences: { soundTrack: MUSIC_TRACKS[2].id, soundVolume: 0.21 },
      });
      await page.locator(".demo-setup-scenario").nth(1).click();
      await playing(page, MUSIC_TRACKS[2]);
      await enter(page);
      await swap(page);
      await exitDemoGuide(page);
      assert.equal(
        await audio(page).evaluate((a) => a.loop),
        false,
        "single-track loop prevents playlist advancement",
      );
      for (const track of [MUSIC_TRACKS[0], MUSIC_TRACKS[1], MUSIC_TRACKS[2]]) {
        const previous = await audio(page).evaluate((a) => a.currentSrc);
        await audio(page).evaluate((a) => {
          a.currentTime = a.duration - 0.12;
        });
        await playing(page, track);
        const shot = await checkpoint(`playlist-advanced-to-${track.id}`);
        assert.notEqual(shot.currentSrc, previous);
        assert.equal(shot.selectedTrack, track.id);
        assert.equal(shot.volume, 0.21);
      }
      const endedCount = await page.evaluate(
        () =>
          window.musicEvidence.events.filter((e) => e.name === "ended").length,
      );
      assert.equal(
        endedCount,
        3,
        "playlist was not advanced by real media ended events",
      );
      await page
        .locator(".music-control")
        .getByRole("button", { name: "Pause store music", exact: true })
        .click();
      await audio(page).evaluate((a) => {
        a.currentTime = a.duration - 0.08;
      });
      const before = await checkpoint("paused-near-end");
      await finishBrowse(page);
      await sleep(600);
      const after = await checkpoint("paused-near-end-after-visit");
      assert.equal(after.paused, true);
      assert.equal(after.currentSrc, before.currentSrc);
      assert.equal(after.selectedTrack, before.selectedTrack);
      assert.ok(Math.abs(after.currentTime - before.currentTime) < 0.03);
      assert.equal(
        after.evidence.events.filter((e) => e.name === "ended").length,
        endedCount,
      );
    },
  );
} finally {
  await writeFile(
    `${root}/artifacts/${prefix}-e2e-results.json`,
    JSON.stringify(results, null, 2),
  );
  await active?.browser.close();
  server?.kill("SIGTERM");
}
console.log(
  `${results.filter((r) => r.status === "pass").length}/${results.length} music onboarding scenarios passed`,
);
if (results.some((r) => r.status === "fail")) process.exitCode = 1;
