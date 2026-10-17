import { exitDemoGuide } from "./demo-guide-helpers.mjs";
// Real local MP3 playback is checked with the bundled headless Chromium. These
// checks establish decoding/transport behavior, not subjective listening quality.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { MUSIC_TRACKS } from "../src/store-music.js";
import { initialState, STORAGE_KEY } from "../src/data.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:4195";
const results = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser,
  server,
  page,
  errors = [],
  requests = [];
const music = () => page.locator("audio[data-store-music]");
const sheet = () =>
  page.getByRole("dialog", { name: "The listening room.", exact: true });
const state = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);

async function until(check, message, timeout = 8000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(30);
  }
  throw Error(message);
}
async function reset(
  width = 1440,
  motion = "reduce",
  preferences = {},
  policy = "allow",
  enter = true,
) {
  await page.unrouteAll({ behavior: "wait" });
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.goto(base, { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ key, value, policy }) => {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem("music-test-policy", policy);
    },
    {
      key: STORAGE_KEY,
      value: {
        ...initialState(),
        onboardingStatus: "skipped",
        language: "en",
        ...preferences,
      },
      policy,
    },
  );
  requests = [];
  errors = [];
  await page.reload({ waitUntil: "domcontentloaded" });
  await music().waitFor({ state: "attached" });
  if (
    preferences.soundEnabled !== false &&
    !preferences.soundMuted &&
    preferences.soundVolume !== 0
  ) {
    await until(
      async () =>
        ["playing", "waiting", "error"].includes(
          await page
            .locator(".music-control")
            .getAttribute("data-music-status"),
        ),
      "initial playback attempt did not settle",
    );
  }
  // Navigating away from the previous case may finish an old media request.
  // Subsequent assertions concern only the newly initialized visit.
  requests = [];
  if (enter) {
    await finishSetup();
    if (preferences.soundEnabled === false) {
      // This is an explicit current-page pause, not the refreshed defaults.
      await page
        .locator(".music-control")
        .getByRole("button", { name: "Pause store music", exact: true })
        .click();
      await open();
      const index = Math.max(
        0,
        MUSIC_TRACKS.findIndex(
          (track) =>
            track.id === (preferences.soundTrack || MUSIC_TRACKS[0].id),
        ),
      );
      await sheet()
        .getByRole("radio")
        .nth((index + 1) % MUSIC_TRACKS.length)
        .check();
      await sheet().getByRole("radio").nth(index).check();
      await page.keyboard.press("Escape");
      await page.evaluate(() => {
        window.musicPlayAttempts = 0;
      });
      requests = [];
    }
  }
}
async function finishSetup() {
  if (!(await page.locator(".demo-setup[open]").count())) return;
  const compose = page.locator(".demo-setup-compose");
  if (await compose.isVisible()) await compose.click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 10000 });
  await exitDemoGuide(page);
  await page.locator(".demo-setup[open]").waitFor({ state: "detached" });
}
async function firstBrowseGesture() {
  if (await page.locator(".demo-setup-compose").isVisible())
    await page.locator(".demo-setup-compose").click();
  else if (
    await page.getByRole("button", { name: "Browse now", exact: true }).count()
  )
    await page.getByRole("button", { name: "Browse now", exact: true }).click();
  else
    await page
      .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
      .click();
}
async function open() {
  await page
    .getByRole("button", { name: "Store music and tracks", exact: true })
    .click();
  await sheet().waitFor();
}
async function playing(track = MUSIC_TRACKS[0]) {
  await until(
    () =>
      music().evaluate(
        (audio, src) =>
          !audio.paused &&
          audio.readyState >= 2 &&
          audio.currentSrc.endsWith(src) &&
          audio.currentTime > 0.12,
        track.src,
      ),
    `recording did not decode and play: ${track.id}`,
  );
}
async function run(name, fn) {
  if (
    process.env.E2E_FILTER &&
    !new RegExp(process.env.E2E_FILTER, "i").test(name)
  )
    return;
  try {
    const detail = await fn();
    assert.deepEqual(errors, [], "uncaught browser errors");
    results.push({ name, status: "pass", ...detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.error(`FAIL ${name}\n${error.stack}`);
    await page
      .screenshot({
        path: `${root}/artifacts/music-fail-${results.length}.png`,
      })
      .catch(() => {});
  }
}
function overlap(a, b) {
  return Boolean(
    a &&
    b &&
    Math.max(a.x, b.x) < Math.min(a.x + a.width, b.x + b.width) &&
    Math.max(a.y, b.y) < Math.min(a.y + a.height, b.y + b.height),
  );
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
        "4195",
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
    await until(
      () =>
        fetch(base)
          .then((response) => response.ok)
          .catch(() => false),
      "Vite did not start",
    );
  }
  browser = await chromium.launch({
    executablePath: process.env.E2E_CHROMIUM_PATH || await headless.executablePath(),
    headless: true,
    chromiumSandbox: process.platform === 'win32',
    ignoreDefaultArgs: process.platform === 'win32' ? ['--disable-extensions', '--disable-component-extensions-with-background-pages', '--unsafely-disable-devtools-self-xss-warnings'] : [],
    args: [
      ...(process.platform === 'win32' ? [] : headless.args.filter((arg) => !arg.startsWith("--autoplay-policy="))),
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const nativePlay = HTMLMediaElement.prototype.play;
    window.musicPlayAttempts = 0;
    HTMLMediaElement.prototype.play = function () {
      if (!this.matches("audio[data-store-music]"))
        return nativePlay.call(this);
      window.musicPlayAttempts += 1;
      const policy = localStorage.getItem("music-test-policy");
      // Deterministic policy failures exercise the NotAllowedError boundary;
      // successful attempts still decode and play the real local MP3.
      if (
        policy === "block" ||
        (policy === "block-first" && window.musicPlayAttempts === 1)
      )
        return Promise.reject(
          new DOMException("A user gesture is required", "NotAllowedError"),
        );
      return nativePlay.call(this);
    };
  });
  page = await context.newPage();
  page.setDefaultTimeout(6000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/music/")) requests.push(request.url());
  });

  await run(
    "allowed autoplay starts once on arrival, even in React StrictMode",
    async () => {
      await reset();
      await playing();
      assert.equal((await state()).soundEnabled, true);
      assert.equal(await page.evaluate(() => window.musicPlayAttempts), 1);
      assert.equal(
        await page.locator(".music-control").getAttribute("data-music-status"),
        "playing",
      );
      await page
        .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
        .click();
      await page.keyboard.press("Tab");
      await open();
      await page.keyboard.press("Escape");
      assert.equal(
        await page.evaluate(() => window.musicPlayAttempts),
        1,
        "rerenders and later gestures must not replay music",
      );
    },
  );

  await run(
    "blocked autoplay stays visibly pending and the first browse gesture starts music once",
    async () => {
      await reset(
        1440,
        "reduce",
        { onboardingStatus: "pending" },
        "block-first",
        false,
      );
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.equal(
        await page.locator(".music-control").getAttribute("data-music-status"),
        "waiting",
      );
      await firstBrowseGesture();
      await playing();
      await finishSetup();
      assert.equal(await page.evaluate(() => window.musicPlayAttempts), 2);
      await page.keyboard.press("Tab");
      await page
        .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.musicPlayAttempts),
        2,
        "the gesture listener must disarm after success",
      );
    },
  );

  await run(
    "blocked autoplay accepts keyboard activation without duplicate attempts",
    async () => {
      await reset(1440, "reduce", {}, "block-first", false);
      await page.keyboard.press("Tab");
      await playing();
      assert.equal(await page.evaluate(() => window.musicPlayAttempts), 2);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => window.musicPlayAttempts), 2);
      await finishSetup();
    },
  );

  await run(
    "a denied first gesture leaves manual retry available without replaying on every gesture",
    async () => {
      await reset(1440, "reduce", {}, "block", false);
      await firstBrowseGesture();
      await until(
        async () =>
          (await page
            .locator(".music-control")
            .getAttribute("data-music-status")) === "blocked",
        "a second policy denial was not disclosed",
      );
      assert.equal(await page.evaluate(() => window.musicPlayAttempts), 2);
      await finishSetup();
      await page
        .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
        .click();
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() => window.musicPlayAttempts),
        2,
        "automatic retries must stop after the first gesture",
      );
      await page
        .locator(".music-control")
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      assert.equal(
        await page.evaluate(() => window.musicPlayAttempts),
        3,
        "manual retry remains available",
      );
    },
  );

  await run(
    "explicit pause or pending mute stays silent until refresh re-enables music",
    async () => {
      for (const action of ["pause", "mute"]) {
        await reset(
          1440,
          "reduce",
          {},
          action === "pause" ? "allow" : "block",
          action === "pause",
        );
        const label =
          action === "pause" ? "Pause store music" : "Mute store music";
        const gateMute = page.locator(".demo-setup-mute");
        if (action === "mute" && (await gateMute.isVisible()))
          await gateMute.click();
        else
          await page
            .locator(".music-control")
            .getByRole("button", { name: label, exact: true })
            .click();
        await finishSetup();
        await page
          .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
          .click();
        await page.keyboard.press("Tab");
        assert.equal(
          await page.evaluate(() => window.musicPlayAttempts),
          1,
          "an explicit choice must disarm the pending retry",
        );
        assert.equal(
          await page
            .locator(".music-control")
            .getAttribute("data-music-status"),
          "paused",
        );
        assert.equal(
          (await state())[action === "pause" ? "soundEnabled" : "soundMuted"],
          action !== "pause",
        );
        await page.evaluate(() =>
          localStorage.setItem("music-test-policy", "allow"),
        );
        await page.reload({ waitUntil: "domcontentloaded" });
        await music().waitFor({ state: "attached" });
        await finishSetup();
        await playing();
        assert.equal(await page.evaluate(() => window.musicPlayAttempts), 1);
        assert.equal((await state()).soundEnabled, true);
        assert.equal((await state()).soundMuted, false);
        await page
          .getByRole("button", { name: "MAISON ÉDIT home", exact: true })
          .click();
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => window.musicPlayAttempts), 1);
      }
    },
  );

  await run(
    "current-page pause keeps visit, settings and paused selection silent",
    async () => {
      await reset(1440, "reduce", { soundEnabled: false });
      const pausedSource = await music().getAttribute("src");
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      await open();
      assert.equal(await sheet().getByRole("radio").count(), 3);
      await sheet().getByRole("radio").nth(1).check();
      await sleep(250);
      assert.equal((await state()).soundTrack, MUSIC_TRACKS[1].id);
      assert.equal(await music().getAttribute("src"), pausedSource);
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.deepEqual(requests, []);
      await sheet()
        .getByText(
          "AI-generated with Suno. Personal, non-commercial testing only.",
          { exact: true },
        )
        .waitFor();
      assert.equal(
        await sheet()
          .getByRole("link", { name: "View this track on Suno" })
          .getAttribute("href"),
        MUSIC_TRACKS[1].source,
      );
      await page.keyboard.press("Escape");
      assert.equal(await sheet().count(), 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Store music and tracks", exact: true })
          .evaluate((element) => element === document.activeElement),
        true,
      );
    },
  );

  await run(
    "all three actual MP3s serve as MPEG audio and decode for playback",
    async () => {
      await reset();
      await playing();
      await open();
      const decoded = [];
      for (let index = 0; index < MUSIC_TRACKS.length; index++) {
        const track = MUSIC_TRACKS[index];
        const response = await fetch(`${base}${track.src}`);
        assert.equal(response.status, 200);
        assert.match(response.headers.get("content-type"), /audio\/mpeg/i);
        assert.ok((await response.arrayBuffer()).byteLength > 100_000);
        await sheet().getByRole("radio").nth(index).check();
        await playing(track);
        const duration = await music().evaluate((audio) => audio.duration);
        assert.ok(
          Number.isFinite(duration) &&
            Math.abs(duration - track.durationSeconds) < 2,
        );
        assert.equal(await music().getAttribute("loop"), null);
        decoded.push({ id: track.id, duration });
      }
      return { decoded };
    },
  );

  await run(
    "pause retains position and resume continues the selected recording",
    async () => {
      const before = await music().evaluate((audio) => audio.currentTime);
      await sheet()
        .getByRole("button", { name: "Pause store music", exact: true })
        .click();
      const paused = await music().evaluate((audio) => audio.currentTime);
      await sleep(250);
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.equal(
        await music().evaluate((audio) => audio.currentTime),
        paused,
      );
      assert.ok(paused >= before);
      await sheet()
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      await until(
        () =>
          music().evaluate(
            (audio, position) =>
              !audio.paused && audio.currentTime > position + 0.12,
            paused,
          ),
        "resume restarted or failed",
      );
    },
  );

  await run(
    "reload starts the selected track from the beginning unmuted with saved positive volume",
    async () => {
      const volume = sheet().getByRole("slider", {
        name: "Music volume",
        exact: true,
      });
      await volume.fill("0.22");
      await volume.focus();
      await page.keyboard.press("ArrowLeft");
      assert.equal((await state()).soundVolume, 0.21);
      await sheet()
        .getByRole("button", { name: "Mute store music", exact: true })
        .click();
      assert.equal(await music().evaluate((audio) => audio.muted), true);
      assert.equal(await music().evaluate((audio) => audio.paused), false);
      await page.reload({ waitUntil: "domcontentloaded" });
      await music().waitFor({ state: "attached" });
      await finishSetup();
      assert.equal((await state()).soundTrack, MUSIC_TRACKS[2].id);
      assert.equal((await state()).soundMuted, false);
      assert.equal((await state()).soundEnabled, true);
      assert.equal((await state()).soundVolume, 0.21);
      await playing(MUSIC_TRACKS[2]);
      assert.ok(
        await music().evaluate((audio) => audio.currentTime < 8),
        "refresh begins near the start instead of restoring old position",
      );
      await open();
      assert.equal(await sheet().getByRole("radio").nth(2).isChecked(), true);
      await sheet()
        .getByRole("button", { name: "Mute store music", exact: true })
        .click();
      await sheet()
        .getByRole("button", { name: "Unmute store music", exact: true })
        .click();
      assert.equal(await music().evaluate((audio) => audio.muted), false);
      await playing(MUSIC_TRACKS[2]);
    },
  );

  await run(
    "failed recording reports an honest error and retries without a fallback",
    async () => {
      await reset(1440, "reduce", { soundEnabled: false });
      await page.route(`**${MUSIC_TRACKS[0].src}`, (route) =>
        route.fulfill({
          status: 503,
          contentType: "text/plain",
          body: "temporary audio failure",
        }),
      );
      await page
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      await until(
        () =>
          page
            .locator(".music-control")
            .getAttribute("data-music-status")
            .then((status) => status === "error"),
        "media failure was not disclosed",
      );
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.ok(requests.every((url) => url.endsWith(MUSIC_TRACKS[0].src)));
      await open();
      await sheet()
        .getByText("Music is unavailable. Retry or choose another track.", {
          exact: true,
        })
        .waitFor();
      await page.unroute(`**${MUSIC_TRACKS[0].src}`);
      await sheet()
        .getByRole("button", { name: "Retry store music", exact: true })
        .click();
      await playing();
    },
  );

  await run(
    "cancelled loading and rapid track changes cannot restart paused music",
    async () => {
      await reset(1440, "reduce", { soundEnabled: false });
      await page.route(`**${MUSIC_TRACKS[0].src}`, async (route) => {
        await sleep(800);
        await route.continue().catch(() => {});
      });
      await page
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      assert.equal(
        await page.locator(".music-control").getAttribute("data-music-status"),
        "loading",
      );
      await page
        .getByRole("button", { name: "Pause store music", exact: true })
        .click();
      await sleep(1000);
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.equal(
        await page.locator(".music-control").getAttribute("data-music-status"),
        "paused",
      );
      await page.unroute(`**${MUSIC_TRACKS[0].src}`);
      await open();
      await sheet()
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      await sheet().getByRole("radio").nth(1).check();
      await sheet().getByRole("radio").nth(2).check();
      await sheet()
        .getByRole("button", { name: "Pause store music", exact: true })
        .click();
      await sleep(350);
      assert.equal(await music().evaluate((audio) => audio.paused), true);
      assert.equal((await state()).soundTrack, MUSIC_TRACKS[2].id);
      await sheet()
        .getByRole("button", { name: "Play store music", exact: true })
        .click();
      await playing(MUSIC_TRACKS[2]);
    },
  );

  await run(
    "music sheet traps keyboard focus and closes without stopping music",
    async () => {
      const first = sheet().getByRole("button", {
        name: "Close / 关闭",
        exact: true,
      });
      await first.focus();
      await page.keyboard.press("Shift+Tab");
      assert.equal(
        await sheet()
          .getByRole("link", { name: "View this track on Suno" })
          .evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Tab");
      assert.equal(
        await first.evaluate((element) => element === document.activeElement),
        true,
      );
      await page.keyboard.press("Escape");
      await playing(MUSIC_TRACKS[2]);
      assert.equal(await page.evaluate(() => document.body.style.overflow), "");
    },
  );

  await run(
    "real Chromium activation policy blocks arrival and permits the first click",
    async () => {
      const ordinaryPage = page;
      const policyBrowser = await chromium.launch({
        executablePath: process.env.E2E_CHROMIUM_PATH || await headless.executablePath(),
        headless: true,
        chromiumSandbox: process.platform === 'win32',
        ignoreDefaultArgs: process.platform === 'win32' ? ['--disable-extensions', '--disable-component-extensions-with-background-pages', '--unsafely-disable-devtools-self-xss-warnings'] : [],
        args: [
          ...(process.platform === 'win32' ? [] : headless.args.filter(
            (arg) => !arg.startsWith("--autoplay-policy="),
          )),
          "--autoplay-policy=document-user-activation-required",
        ],
      });
      try {
        // No play() fixture: this case exercises Chromium's actual policy.
        page = await policyBrowser.newPage();
        page.setDefaultTimeout(6000);
        await reset(1440, "reduce", {}, "allow", false);
        assert.equal(
          await page
            .locator(".music-control")
            .getAttribute("data-music-status"),
          "waiting",
        );
        assert.equal(await music().evaluate((audio) => audio.paused), true);
        await firstBrowseGesture();
        await playing();
        await finishSetup();
      } finally {
        page = ordinaryPage;
        await policyBrowser.close();
      }
    },
  );

  await run(
    "desktop and small phones keep playback controls clear of guide and composer",
    async () => {
      for (const width of [1440, 768, 390, 320]) {
        await reset(width, width === 768 ? "no-preference" : "reduce");
        const control = await page.locator(".music-control").boundingBox();
        const guide = await page.locator(".concierge-button").boundingBox();
        const composer = await page.locator(".subtitle-composer").boundingBox();
        assert.ok(control.x >= 0 && control.x + control.width <= width);
        assert.equal(overlap(control, guide), false);
        assert.equal(overlap(control, composer), false);
        for (const bubble of await page.locator(".subtitle-bubble").all())
          assert.equal(overlap(control, await bubble.boundingBox()), false);
        await open();
        const dialog = await sheet().boundingBox();
        assert.ok(dialog.x >= 0 && dialog.x + dialog.width <= width + 1);
        assert.ok(
          dialog.y >= 0 &&
            dialog.y + dialog.height <= (width < 600 ? 844 : 1000) + 1,
        );
        await page.screenshot({ path: `${root}/artifacts/music-${width}.png` });
        await page.keyboard.press("Escape");
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          true,
        );
      }
    },
  );
} finally {
  await writeFile(
    `${root}/artifacts/music-e2e-results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser?.close();
  server?.kill("SIGTERM");
}
if (results.some((result) => result.status === "fail")) process.exitCode = 1;
console.log(
  `${results.filter((result) => result.status === "pass").length}/${results.length} music scenarios passed`,
);
