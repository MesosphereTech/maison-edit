import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = 4196;
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let browser, server, previousPage;
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
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  for (const width of process.env.E2E_WIDTH
    ? [Number(process.env.E2E_WIDTH)]
    : [1440, 390, 320]) {
    const page = await context.newPage();
    await previousPage?.close();
    previousPage = page;
    await page.setViewportSize({ width, height: width > 600 ? 1000 : 844 });
    const errors = [],
      guideCalls = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("request", (request) => {
      if (/\/api\/guide/.test(request.url())) guideCalls.push(request.url());
    });
    await page.goto(
      `${base}/tests/fixtures/bubble-history.html${width < 600 ? "?overlay" : ""}`,
      { waitUntil: "networkidle" },
    );
    const side = page.locator(".subtitle-concierge");
    const trigger = page.getByRole("button", {
      name: "Show conversation history",
      exact: true,
    });
    const history = page.getByRole("log", {
      name: "Conversation history",
      exact: true,
    });
    const launcher = page.getByRole("button", {
      name: "Expand ÉDIT conversation",
      exact: true,
    });
    assert.equal(
      await side.locator(".subtitle-bubble").count(),
      1,
      "collapsed view only shows the current bubble",
    );
    assert.equal(await trigger.getAttribute("aria-expanded"), "false");
    assert.equal(
      await side.locator("button button").count(),
      0,
      "buttons must never nest",
    );
    await side.locator(".bubble-owned-reference button").click({ force: true });
    await side.locator(".bubble-replies button").dispatchEvent("click");
    assert.equal(
      await trigger.getAttribute("aria-expanded"),
      "false",
      "source and reply actions do not toggle history",
    );
    assert.deepEqual(await page.evaluate(() => window.historyActions), [
      "product",
      "quick",
    ]);
    await trigger.click();
    await history.waitFor();
    assert.equal(await history.locator(".subtitle-bubble").count(), 21);
    assert.equal(
      await history.locator(".subtitle-bubble:visible").count(),
      21,
      "narrow product overlay must not hide earlier turns",
    );
    assert.ok(
      await history
        .innerText()
        .then(
          (text) =>
            text.includes("History turn 2.") &&
            text.includes("Current guide reply."),
        ),
      "history includes both roles and full text",
    );
    assert.equal(
      await page.evaluate(() => window.historyHeld),
      true,
      "reading history pauses bubble expiry",
    );
    await history.evaluate((el) => {
      el.scrollTop = 180;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const before = await history.evaluate((el) => ({
      top: el.scrollTop,
      height: el.scrollHeight,
    }));
    await page.evaluate(() => window.appendHistoryTurn());
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".subtitle-history .subtitle-bubble")
          .length === 22,
    );
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - before.top) <=
        1,
      "incoming message must not pull reader to end",
    );
    await page.evaluate(() => window.updateLiveHistory());
    await page.waitForFunction(() =>
      document
        .querySelector(".subtitle-history")
        .textContent.includes("Live content has changed"),
    );
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - before.top) <=
        1,
      "live edits keep reading position",
    );
    await history.evaluate((el) => {
      el.scrollTop = 600;
      el.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    const anchor = await history.evaluate((el) => {
      const top = el.getBoundingClientRect().top;
      const line = [...el.querySelectorAll("[data-bubble-id]")].find(
        (line) => line.getBoundingClientRect().bottom > top + 1,
      );
      return {
        id: line.dataset.bubbleId,
        offset: line.getBoundingClientRect().top - top,
      };
    });
    await page.evaluate(() => window.updateEarlierHistory());
    await page.waitForFunction(() =>
      document
        .querySelector(".subtitle-history")
        .textContent.includes("Earlier expanded detail"),
    );
    const offset = await history.evaluate(
      (el, id) =>
        el.querySelector(`[data-bubble-id="${id}"]`).getBoundingClientRect()
          .top - el.getBoundingClientRect().top,
      anchor.id,
    );
    assert.ok(
      Math.abs(offset - anchor.offset) <= 1,
      "edits before reading anchor preserve the same visible text",
    );
    const savedTop = await history.evaluate((el) => el.scrollTop);
    await side.locator(".subtitle-history-heading button").click();
    await launcher.waitFor();
    assert.equal(await side.locator(".subtitle-bubble").count(), 0);
    await launcher.focus();
    await page.keyboard.press("Enter");
    await history.waitFor();
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - savedTop) <= 1,
      "reopening restores reading position",
    );
    await page
      .getByRole("button", { name: "Minimize subtitles", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Expand ÉDIT conversation", exact: true })
      .click();
    await history.waitFor();
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - savedTop) <= 1,
      `minimize and resume preserve expanded reading position: saved=${savedTop}, actual=${await history.evaluate((el) => el.scrollTop)}`,
    );
    await side.locator(".subtitle-history-heading button").focus();
    await page.keyboard.press("Space");
    await launcher.waitFor();
    assert.equal(
      await history.count(),
      0,
      "Space closes history to the launcher",
    );
    await launcher.focus();
    await page.keyboard.press("Space");
    await history.waitFor();
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - savedTop) <= 1,
      "keyboard close and resume preserve reading position",
    );
    await page.keyboard.press("Escape");
    await launcher.waitFor();
    assert.equal(await history.count(), 0, "Escape minimizes expanded history");
    await launcher.click();
    await history.waitFor();
    assert.ok(
      Math.abs((await history.evaluate((el) => el.scrollTop)) - savedTop) <= 1,
      "Escape and resume preserve expanded reading position",
    );
    await history.locator(".bubble-history-trigger").focus();
    await page.keyboard.press("Space");
    assert.equal(
      await trigger.getAttribute("aria-expanded"),
      "false",
      "bubble disclosure still changes history reading mode",
    );
    await side.locator(".bubble-dismiss").click();
    await launcher.waitFor();
    assert.equal(await history.count(), 0, "bubble close never opens history");
    assert.equal(
      await side.locator(".subtitle-bubble").count(),
      0,
      "closed current bubble leaves only the launcher",
    );
    await launcher.click();
    assert.equal(
      await side.locator(".subtitle-bubble").count(),
      1,
      "bubble close and resume retain the current surface",
    );
    assert.equal(
      await page.evaluate(() => window.getHistoryCount()),
      22,
      "visual actions never delete durable transcript",
    );
    assert.equal(guideCalls.length, 0, "opening history never requests AI");
    assert.deepEqual(errors, []);
    console.log(
      `PASS bubble history click, keyboard, source/reply isolation, reading anchor and new turns ${width}px`,
    );
  }
  // Exercise the real parent-owned transcript and morph, beyond the fixture.
  const page = await context.newPage();
  await previousPage?.close();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.clear();
    },
    {
      key: STORAGE_KEY,
      state: { ...initialState(), onboardingStatus: "skipped", language: "en" },
    },
  );
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: {
        guide: "not_configured",
        analysis: "unavailable",
        scene: "unavailable",
      },
    }),
  );
  let guideRequests = 0;
  page.on("request", (request) => {
    if (/\/api\/guide/.test(request.url())) guideRequests++;
  });
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".demo-setup-compose").click();
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
  const exitGuide = page
    .getByRole("button", { name: "Exit guide", exact: true })
    .first();
  if (await exitGuide.isVisible()) await exitGuide.click();
  await page
    .getByRole("textbox", { name: "Search products or styles", exact: true })
    .fill(byId("ME-001").en);
  await page
    .getByRole("button", { name: `View ${byId("ME-001").en}`, exact: true })
    .first()
    .click();
  const trigger = page.getByRole("button", {
    name: "Show conversation history",
    exact: true,
  });
  await trigger.waitFor();
  await page.waitForFunction(() => {
    const bubble = document.querySelector(".subtitle-bubble");
    const frame = document.querySelector(".concierge-attention-frame");
    return bubble && !bubble.inert && frame?.dataset.phase === "settled";
  });
  const bubbleId = await page
    .locator(".subtitle-bubble")
    .getAttribute("data-bubble-id");
  await trigger.click();
  const history = page.getByRole("log", {
    name: "Conversation history",
    exact: true,
  });
  await history.waitFor();
  assert.equal(
    await history.locator(".subtitle-bubble").count(),
    2,
    "App passes its durable greeting and product reply",
  );
  await page.evaluate(() => {
    window.historyMorphReplay = false;
    window.historyReplayObserver = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.attributeName === "data-surface-owned" &&
            record.target.hasAttribute("data-surface-owned"),
        )
      )
        window.historyMorphReplay = true;
    });
    window.historyReplayObserver.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-surface-owned"],
    });
  });
  await page.locator(".subtitle-history-heading button").click();
  await page
    .getByRole("button", { name: "Expand ÉDIT conversation", exact: true })
    .click();
  await history.waitFor();
  await history.locator(".bubble-history-trigger").click();
  await page.waitForTimeout(750);
  assert.equal(
    await page.locator(".subtitle-bubble").getAttribute("data-bubble-id"),
    bubbleId,
  );
  assert.equal(
    await page.evaluate(() => window.historyMorphReplay),
    false,
    "collapse never replays an already-presented attention morph",
  );
  assert.equal(guideRequests, 0, "real history expansion does not request AI");
  console.log(
    "PASS real parent transcript wiring and collapse without attention morph replay",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
