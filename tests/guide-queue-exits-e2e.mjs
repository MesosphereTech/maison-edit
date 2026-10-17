// Focused pending-eight regressions. Setup may seed eight already-viewed SKUs;
// all swaps, visit completion and interruption use real trusted browser input.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { curatedScenarios } from "../src/personalized-scenes.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const base = process.env.GUIDE_QUEUE_BASE_URL || "http://127.0.0.1:4418";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const server = process.env.GUIDE_QUEUE_BASE_URL
  ? null
  : spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        "4418",
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
let browser;
const results = [];
async function until(fn, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await fn()) return;
    } catch {}
    await sleep(40);
  }
  throw Error(label);
}
async function setup(config = {}, opts = {}) {
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({
    viewport: { width: opts.width || 1280, height: 900 },
    reducedMotion: opts.motion || "no-preference",
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const failedRequests = [];
  if (opts.failedAI)
    await page.route(/\/(?:personalized-scenes|outfit-scenes)\//, (route) => {
      failedRequests.push(route.request().url());
      return route.abort("failed");
    });
  await page.goto(`${base}/tests/fixtures/guide-queue-exits.html`, {
    waitUntil: "networkidle",
  });
  await page.evaluate(
    (config) => window.mountGuideFixture({ clearStorage: true, ...config }),
    config,
  );
  return { page, context, errors, failedRequests };
}
async function status(page, name) {
  return page.evaluate((name) => window.fixtureStatus(name), name);
}
async function travel(page) {
  await until(
    () => page.locator("html").getAttribute("data-guided-travel").then(Boolean),
    "automatic travel never began",
  );
}
async function arrived(page) {
  await page
    .locator('[data-guided-step="visit"][data-journey-phase="awaiting-click"]')
    .waitFor({ timeout: 20000 });
  await page.locator(".guided-target-ring").waitFor();
}
async function assertExited(page, name = "warm-everyday") {
  await until(
    async () => (await status(page, name)).guide === "exited",
    "guide did not record explicit exit",
  );
  assert.equal((await status(page, name)).journey.status, "exited");
  assert.equal(
    await page
      .locator(
        ".guided-click-mask,.guided-journey-travel,.scene-swap-required-mask",
      )
      .count(),
    0,
  );
  assert.notEqual(
    await page.locator("html").evaluate((el) => el.style.overflow),
    "hidden",
  );
  assert.equal(await page.evaluate(() => window.fixtureVisits), 0);
}
async function run(name, fn) {
  if (
    process.env.GUIDE_QUEUE_FILTER &&
    !name.includes(process.env.GUIDE_QUEUE_FILTER)
  )
    return;
  const started = Date.now();
  await fn();
  results.push({ name, ok: true, ms: Date.now() - started });
  console.log(`PASS ${name}`);
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
  for (const blocker of [
    "product",
    "overlay",
    "editor",
    "draft",
    "suspended",
  ]) {
    await run(
      `pending eight queues behind ${blocker} and resumes safely`,
      async () => {
        const { page, context, errors } = await setup({
          seedPending: true,
          blocker,
        });
        await page.waitForTimeout(900);
        assert.equal((await status(page)).journey.status, "pending");
        assert.equal(
          await page.evaluate(() => window.fixtureRequests.length),
          0,
          "blocked guide requested a destination",
        );
        assert.equal(
          await page
            .locator(".guided-click-mask,.guided-journey-travel")
            .count(),
          0,
        );
        assert.equal(
          await page.evaluate(() => scrollY),
          0,
          "blocked guide moved the page",
        );
        if (blocker === "draft") {
          await page.getByRole("button", { name: "Neutral focus" }).click();
          await page.waitForTimeout(650);
          assert.equal(
            await page.evaluate(() => window.fixtureRequests.length),
            0,
            "blurred unfinished draft did not preserve the queue",
          );
          await page.getByRole("textbox").fill("");
          await page.getByRole("button", { name: "Neutral focus" }).click();
        } else if (blocker === "editor") {
          assert.equal(
            await page
              .getByRole("textbox")
              .evaluate((el) => document.activeElement === el),
            true,
          );
          await page.getByRole("button", { name: "Neutral focus" }).click();
        } else if (blocker === "product")
          await page
            .getByRole("button", { name: "Close product", exact: true })
            .click();
        else if (blocker === "overlay")
          await page
            .getByRole("button", { name: "Close independent dialog" })
            .click();
        else await page.getByRole("button", { name: "Clear blocker" }).click();
        await travel(page);
        await page.keyboard.press("Escape");
        await assertExited(page);
        assert.deepEqual(errors, []);
        await browser.close();
      },
    );
  }
  await run(
    "new product modal during travel pauses pending guide and resumes safely",
    async () => {
      const { page } = await setup({ seedPending: true });
      await travel(page);
      await page.evaluate(() => window.fixtureSetBlocker("product"));
      await page.getByRole("dialog", { name: "Open product" }).waitFor();
      await until(
        () =>
          page
            .locator("html")
            .getAttribute("data-guided-travel")
            .then((value) => !value),
        "modal did not pause travel",
      );
      await page.waitForTimeout(250);
      const scroll = await page.evaluate(() => scrollY);
      const requests = await page.evaluate(() => window.fixtureRequests.length);
      await page.waitForTimeout(600);
      assert.equal((await status(page)).journey.status, "pending");
      assert.equal((await status(page)).guide, null);
      assert.equal(
        await page.evaluate(() => window.fixtureRequests.length),
        requests,
        "open product restarted travel",
      );
      assert.ok(
        Math.abs((await page.evaluate(() => scrollY)) - scroll) < 2,
        "travel continued moving behind a product",
      );
      assert.equal(
        await page.locator(".guided-click-mask,.guided-journey-travel").count(),
        0,
      );
      await page
        .getByRole("button", { name: "Close product", exact: true })
        .click();
      await travel(page);
      await page.keyboard.press("Escape");
      await assertExited(page);
      await browser.close();
    },
  );
  for (const input of ["Escape", "wheel", "pointer"]) {
    await run(
      `${input} interrupts automatic travel without completing`,
      async () => {
        const { page, context, errors } = await setup({ seedPending: true });
        await travel(page);
        if (input === "Escape") await page.keyboard.press("Escape");
        else if (input === "wheel") await page.mouse.wheel(0, 260);
        else await page.mouse.click(15, 80);
        await assertExited(page);
        const releases = await page.evaluate(() => window.fixtureReleases);
        assert.ok(releases > 0, "travel did not release pinned content");
        await page.waitForTimeout(700);
        assert.equal(
          await page
            .locator(".guided-journey-travel,.guided-click-mask")
            .count(),
          0,
          "exited travel restarted",
        );
        assert.deepEqual(errors, []);
        await browser.close();
      },
    );
  }
  await run("only trusted highlighted Plan your visit completes", async () => {
    const { page, context, errors } = await setup(
      { seedPending: true },
      { motion: "reduce" },
    );
    await arrived(page);
    const position = await page
      .locator('[data-tour-action="plan-visit"]:focus')
      .evaluate(
        (el) => el.closest("[data-feed-position]").dataset.feedPosition,
      );
    const target = page.locator(
      `[data-feed-position="${position}"] [data-tour-action="plan-visit"]`,
    );
    assert.equal(await target.count(), 1);
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.equal(
        await page.evaluate(() =>
          Boolean(
            document.activeElement?.closest(".guided-demo-panel") ||
            document.activeElement?.matches('[data-tour-action="plan-visit"]'),
          ),
        ),
        true,
        "Tab escaped the required lesson controls",
      );
    }
    await target.focus();
    await target.evaluate((el) => el.click());
    await page.waitForTimeout(150);
    assert.equal(
      (await status(page)).journey.status,
      "pending",
      "synthetic CTA click completed the guide",
    );
    // The fixture's ordinary action handler may observe the synthetic click;
    // the guide must independently require trusted user input.
    await page.evaluate(() => (window.fixtureVisits = 0));
    const scroll = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 360);
    await page.keyboard.press("PageDown");
    await page.waitForTimeout(150);
    assert.ok(
      Math.abs((await page.evaluate(() => scrollY)) - scroll) < 2,
      "required CTA did not hold scrolling",
    );
    await page.mouse.click(4, 120);
    assert.equal(
      (await status(page)).journey.status,
      "pending",
      "backdrop click completed the guide",
    );
    assert.equal(await page.locator(".guided-click-mask").count(), 1);
    await target.focus();
    await page.keyboard.press("Enter");
    await until(
      async () => (await status(page)).guide === "completed",
      "trusted Enter did not complete visit guide",
    );
    assert.equal((await status(page)).journey.status, "completed");
    assert.equal(await page.evaluate(() => window.fixtureVisits), 1);
    assert.equal(await page.locator(".guided-click-mask").count(), 0);
    assert.notEqual(
      await page.locator("html").evaluate((el) => el.style.overflow),
      "hidden",
    );
    assert.deepEqual(errors, []);
    await browser.close();
  });
  for (const blocker of ["product", "editor", "draft"]) {
    await run(
      `independent ${blocker} owns focus during visit spotlight and safely resumes`,
      async () => {
        const { page } = await setup(
          { seedPending: true },
          { motion: "reduce" },
        );
        await arrived(page);
        await page.evaluate(
          (blocker) => window.fixtureSetBlocker(blocker),
          blocker,
        );
        const surface =
          blocker === "product"
            ? page.getByRole("dialog", { name: "Open product" })
            : page.locator(".fixture-editor");
        await surface.waitFor();
        await until(
          () => surface.evaluate((el) => el.contains(document.activeElement)),
          "required spotlight stole independent surface focus",
        );
        await page.waitForTimeout(450);
        assert.equal(
          await surface.evaluate((el) => el.contains(document.activeElement)),
          true,
          "guide restored old focus over the independent surface",
        );
        assert.equal(await page.locator(".guided-click-mask").count(), 0);
        assert.equal((await status(page)).journey.status, "pending");
        assert.notEqual(
          await page.locator("html").evaluate((el) => el.style.overflow),
          "hidden",
        );
        if (blocker === "draft") {
          await page.getByRole("button", { name: "Neutral focus" }).click();
          await page.waitForTimeout(450);
          assert.equal(
            await page.locator(".guided-click-mask").count(),
            0,
            "blurred draft reactivated required spotlight",
          );
          assert.equal((await status(page)).journey.status, "pending");
        }
        await page.getByRole("button", { name: "Clear blocker" }).click();
        await arrived(page);
        await page.keyboard.press("Escape");
        await assertExited(page);
        await browser.close();
      },
    );
  }
  await run(
    "Escape exits required visit spotlight without completing",
    async () => {
      const { page, context } = await setup(
        { seedPending: true },
        { motion: "reduce" },
      );
      await arrived(page);
      await page.keyboard.press("Escape");
      await assertExited(page);
      await browser.close();
    },
  );
  for (const terminal of ["exited", "completed"]) {
    await run(
      `generic cases isolate counters and returning to ${terminal} case does not replay`,
      async () => {
        const { page, context } = await setup(
          { caseName: "generic-a", seedPending: true },
          { motion: terminal === "completed" ? "reduce" : "no-preference" },
        );
        const idA = (await status(page, "generic-a")).id;
        assert.ok(idA.includes("fixture-study"));
        if (terminal === "exited") {
          await travel(page);
          await page.keyboard.press("Escape");
          await assertExited(page, "generic-a");
        } else {
          await arrived(page);
          await page.locator('[data-tour-action="plan-visit"]:focus').click();
          await until(
            async () => (await status(page, "generic-a")).guide === "completed",
            "generic case did not complete",
          );
        }
        await page.evaluate(() =>
          window.mountGuideFixture({
            caseName: "generic-b",
            seedBrowsing: true,
          }),
        );
        await page.locator('[data-guided-step="invite"]').waitFor();
        assert.notEqual((await status(page, "generic-b")).id, idA);
        assert.notEqual((await status(page, "generic-b")).guide, terminal);
        await page.evaluate(() =>
          window.mountGuideFixture({ caseName: "generic-a" }),
        );
        await page.waitForTimeout(650);
        assert.equal((await status(page, "generic-a")).guide, terminal);
        assert.equal(
          await page
            .locator(
              ".guided-demo-panel,.guided-journey-travel,.guided-click-mask",
            )
            .count(),
          0,
          "returning to a terminal generic case replayed the guide",
        );
        await browser.close();
      },
    );
  }
  await run(
    "explicit current-case restart and reset-all clear persistent and in-memory lessons",
    async () => {
      const { page, context, errors } = await setup({ includeScene: true });
      await page.locator(".scene-swap-tutorial").waitFor();
      await page.locator(".scene-swap-button").click();
      await page.locator('[data-guided-step="invite"]').waitFor();
      assert.equal((await status(page)).swap, "swapped");
      await page.evaluate(() => window.restartGuidedCase("warm-everyday"));
      await page.waitForTimeout(200);
      assert.equal(
        (await status(page)).swap,
        "swapped",
        "ordinary case selection replayed a lesson",
      );
      await page
        .getByRole("button", { name: "Exit guide", exact: true })
        .click();
      await assertExited(page);
      await page.evaluate(() =>
        window.restartGuidedCase("warm-everyday", { resetSwapTutorial: true }),
      );
      await page.locator(".scene-swap-tutorial").waitFor();
      assert.equal((await status(page)).guide, null);
      assert.equal(
        (await status(page)).swap,
        null,
        "restart left stale in-memory swap status",
      );
      const p = (await status(page)).journey;
      assert.ok(!p || p.status === "browsing");
      assert.ok(
        !p || p.seen.length < 8,
        "restart retained the old eight-product counter",
      );
      await page.locator(".scene-swap-button").click();
      await page.locator('[data-guided-step="invite"]').waitFor();
      await page.evaluate(() =>
        window.mountGuideFixture({
          caseName: "generic-b",
          seedPending: true,
          blocker: "overlay",
        }),
      );
      await page.waitForTimeout(200);
      await page.evaluate(() => window.resetAllGuidedCases());
      assert.equal((await status(page, "warm-everyday")).guide, null);
      assert.equal(
        (await status(page, "warm-everyday")).swap,
        null,
        "reset-all retained unmounted case in-memory status",
      );
      assert.equal((await status(page, "generic-b")).guide, null);
      assert.equal((await status(page, "generic-b")).journey, null);
      await page.evaluate(() =>
        window.mountGuideFixture({ includeScene: true }),
      );
      await page.locator(".scene-swap-tutorial").waitFor();
      assert.deepEqual(errors, []);
      await browser.close();
    },
  );
  for (const scenario of curatedScenarios) {
    await run(
      `curated ${scenario.id} requires actual swap and preserves explicit close on return`,
      async () => {
        const { page, errors } = await setup({
          caseName: scenario.id,
          includeScene: true,
        });
        await page.locator(".scene-swap-tutorial").waitFor();
        assert.equal(await page.locator(".scene-swap-tutorial").count(), 1);
        const scene = page.locator(".personalized-scene");
        assert.equal(
          await scene.getAttribute("data-scene-main"),
          "personalized",
        );
        await page.locator(".scene-swap-button").click();
        await page.locator('[data-guided-step="invite"]').waitFor();
        assert.equal(await scene.getAttribute("data-scene-main"), "original");
        assert.equal((await status(page, scenario.id)).swap, "swapped");
        await page
          .getByRole("button", { name: "Exit guide", exact: true })
          .click();
        await assertExited(page, scenario.id);
        await page.evaluate(() =>
          window.mountGuideFixture({
            caseName: "generic-a",
            seedBrowsing: true,
          }),
        );
        await page.locator('[data-guided-step="invite"]').waitFor();
        await page.evaluate(
          (caseName) =>
            window.mountGuideFixture({ caseName, includeScene: true }),
          scenario.id,
        );
        await page.waitForTimeout(450);
        assert.equal(
          await page
            .locator(
              ".guided-demo-panel,.scene-swap-required-mask,.scene-swap-tutorial",
            )
            .count(),
          0,
        );
        assert.equal((await status(page, scenario.id)).guide, "exited");
        assert.deepEqual(errors, []);
        await browser.close();
      },
    );
  }
  for (const failure of ["original", "ai", "missing-mapping"]) {
    await run(
      `${failure} failure never creates a mandatory no-op swap lock`,
      async () => {
        const { page, context, errors, failedRequests } = await setup(
          {
            includeScene: true,
            ...(failure === "original" ? { original: "missing" } : {}),
            ...(failure === "missing-mapping"
              ? { scene: "missing-mapping" }
              : {}),
          },
          { failedAI: failure === "ai" },
        );
        await page.locator(".scene-original").waitFor();
        await page.waitForTimeout(900);
        if (failure === "ai")
          assert.ok(
            failedRequests.length > 0,
            "AI failure injection did not reach a real scene asset",
          );
        assert.equal(
          await page
            .locator(
              ".scene-swap-required-mask,.scene-swap-tutorial,.scene-swap-button",
            )
            .count(),
          0,
          "unusable pair created a mandatory swap",
        );
        assert.equal(
          (await status(page)).swap,
          null,
          "failed asset silently completed the tutorial",
        );
        assert.notEqual(
          await page.locator("html").evaluate((el) => el.style.overflow),
          "hidden",
        );
        const y = await page.evaluate(() => scrollY);
        await page.mouse.wheel(0, 400);
        await page.waitForTimeout(200);
        assert.ok(
          (await page.evaluate(() => scrollY)) > y,
          "failed asset left scrolling locked",
        );
        assert.deepEqual(errors, []);
        await browser.close();
      },
    );
  }
  await writeFile(
    `${root}artifacts/v17-guide-queue-exits.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
} catch (error) {
  await writeFile(
    `${root}artifacts/v17-guide-queue-exits.json`,
    JSON.stringify({ results, error: error.stack }, null, 2),
  );
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
