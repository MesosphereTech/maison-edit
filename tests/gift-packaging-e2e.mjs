import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile, mkdtemp, cp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { byId, initialState, STORAGE_KEY } from "../src/data.js";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4315);
const base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const widths = process.env.E2E_WIDTH
  ? [Number(process.env.E2E_WIDTH)]
  : [1440, 390, 320];
const motions = process.env.E2E_MOTION
  ? [process.env.E2E_MOTION]
  : ["no-preference", "reduce"];
let server, browser, snapshotRoot;
const results = [];
async function timed(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error(label)), ms);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function capture(page, name) {
  const session = await page.context().newCDPSession(page);
  try {
    const { data } = await timed(
      session.send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      }),
      12000,
      "Screenshot timeout",
    );
    await writeFile(
      `${root}/artifacts/gift-${name}.png`,
      Buffer.from(data, "base64"),
    );
  } catch (error) {
    console.log(`Screenshot unavailable (${name}): ${error.message}`);
  } finally {
    await timed(session.detach(), 1000, "Screenshot detach timeout").catch(
      () => {},
    );
  }
}
async function setup(page) {
  await page.locator(".demo-setup-compose").click();
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
  await exitDemoGuide(page);
}
const stored = (page) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
async function noOverflow(page, reason) {
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    reason,
  );
  const modal = page.locator(".modal").last();
  if (await modal.count())
    assert.equal(
      await modal.evaluate(
        (element) => element.scrollWidth > element.clientWidth + 1,
      ),
      false,
      `${reason}: modal`,
    );
}
try {
  if (!process.env.E2E_BASE_URL) {
    snapshotRoot = await mkdtemp(join(tmpdir(), "maison-gift-preview-"));
    await cp(`${root}/dist/client`, `${snapshotRoot}/client`, {
      recursive: true,
    });
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "preview",
        "--outDir",
        `${snapshotRoot}/client`,
        "--host",
        "127.0.0.1",
        "--port",
        `${port}`,
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
  }
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base)
        .then((response) => response.ok)
        .catch(() => false)
    )
      break;
    if (attempt > 150) throw Error("Production preview did not start");
    await sleep(80);
  }
  await mkdir(`${root}/artifacts`, { recursive: true });
  for (const width of widths)
    for (const motion of motions) {
      browser = await chromium.launch({
        executablePath:
          process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
        headless: true,
        args: [...headless.args, "--disable-gpu"],
        env: { ...process.env, HOME: "/tmp" },
      });
      const context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        reducedMotion: motion,
      });
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [],
        providerCalls = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("request", (request) => {
        if (/\/api\/(guide|analyze|scene)$/.test(request.url()))
          providerCalls.push(request.url());
      });
      await page.addInitScript(
        ({ key, state }) => {
          if (!localStorage.getItem(key))
            localStorage.setItem(key, JSON.stringify(state));
        },
        {
          key: STORAGE_KEY,
          state: {
            ...initialState(),
            language: "en",
            onboardingStatus: "skipped",
          },
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
      await page.goto(base, { waitUntil: "networkidle" });
      await setup(page);
      console.log("setup", width, motion);
      await page
        .getByRole("textbox", {
          name: "Search products or styles",
          exact: true,
        })
        .fill(byId("ME-012").en);
      const card = page
        .locator('.product-card[data-concierge-product="ME-012"]')
        .first();
      await card.scrollIntoViewIfNeeded();
      await card.locator('[data-scene-model="fictional"]').waitFor();
      assert.match(
        await card.locator(".scene-personalized").getAttribute("src"),
        /man-tailoring/,
      );
      assert.equal(
        (await stored(page)).cart.length,
        0,
        "a gift idea never submits a gift or a preparation request",
      );
      await capture(page, `${width}-${motion}-model-gift-idea`);
      await card.locator(".product-image-button").click();
      console.log("detail opened", width, motion);
      const detail = page.getByRole("dialog", {
        name: byId("ME-012").en,
        exact: true,
      });
      await detail.waitFor();
      const editor = detail.locator(".gift-editor");
      await editor
        .getByRole("radio", { name: "Give as a gift", exact: true })
        .check();
      console.log("gift selected", width, motion);
      assert.match(
        await detail.locator(".automatic-fit").textContent(),
        /Recipient size: confirm at store/,
      );
      assert.equal(
        await detail.locator(".gift-recipient-size select").inputValue(),
        "",
      );
      await editor
        .getByRole("textbox", { name: "Recipient (optional)", exact: true })
        .fill("A dear friend");
      await editor.getByLabel("Occasion (optional)").selectOption("birthday");
      await editor
        .getByRole("checkbox", {
          name: "Include a little gift card",
          exact: true,
        })
        .check();
      await editor
        .getByRole("textbox", { name: /Your message \(optional\)/ })
        .fill("Wishing you a lovely day.");
      assert.equal(
        await editor
          .getByRole("textbox", { name: "Recipient (optional)", exact: true })
          .inputValue(),
        "A dear friend",
      );
      for (const image of await editor
        .locator(".gift-packaging-visual img")
        .all())
        assert.equal(
          await image.evaluate(
            (element) => element.complete && element.naturalWidth > 0,
          ),
          true,
          "actual wrapping assets decode",
        );
      await editor.scrollIntoViewIfNeeded();
      await capture(page, `${width}-${motion}-packaging-controls`);
      console.log("controls checked", width, motion);
      await noOverflow(page, "gift editor fits");
      console.log("overflow checked", width, motion);
      const add = detail.locator('[data-tour-action="add-bag"]');
      await add.click();
      console.log("added first gift", width, motion);
      await add.click();
      console.log("upsert gift", width, motion);
      let state = await stored(page);
      assert.equal(state.cart.length, 1, "identical gifts upsert once");
      assert.equal(state.cart[0].quantity, 1);
      assert.equal(state.cart[0].gift.recipient, "A dear friend");
      assert.equal(state.cart[0].gift.cardMessage, "Wishing you a lovely day.");
      assert.equal(state.cart[0].fit.status, "pending");
      assert.equal(state.cart[0].preparation.status, "pending");
      await editor.locator('input[value="floral-accent"]').check();
      assert.match(
        await detail.locator(".gift-scene-packaging img").getAttribute("src"),
        /floral-accent/,
      );
      await add.click();
      state = await stored(page);
      assert.equal(
        state.cart.length,
        2,
        "different wrapping notes are separate bag lines",
      );
      await editor
        .getByRole("radio", { name: "For myself", exact: true })
        .check();
      await add.click();
      state = await stored(page);
      assert.equal(state.cart.length, 3, "self and gift stay separate");
      assert.equal(state.cart.filter((line) => line.gift?.isGift).length, 2);
      await detail
        .getByRole("button", { name: "Close / 关闭", exact: true })
        .click();
      await page
        .getByRole("button", {
          name: "Store try-on & experience list",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", { name: /Review list & preparation/ })
        .click();
      const bag = page.locator(".modal").last();
      assert.equal(await bag.locator(".gift-summary").count(), 2);
      assert.match(await bag.textContent(), /Recipient size: confirm at store/);
      const edit = bag.locator(".bag-gift-edit").first();
      await edit.locator("summary").click();
      await edit
        .getByRole("textbox", { name: "Recipient (optional)", exact: true })
        .fill("Our good friend");
      await edit.getByLabel("Recipient size (optional)").selectOption("L");
      await edit.locator('input[value="recycled-cotton"]').check();
      await edit
        .getByRole("textbox", { name: /Your message \(optional\)/ })
        .fill("For all our happy memories.");
      state = await stored(page);
      assert.equal(state.cart[0].gift.recipient, "Our good friend");
      assert.equal(state.cart[0].gift.recipientSize, "L");
      assert.equal(state.cart[0].gift.packagingId, "recycled-cotton");
      assert.equal(state.cart[0].fit.source, "recipient");
      assert.equal(state.cart[0].fit.status, "matched");
      await noOverflow(page, "compact bag editor fits");
      await capture(page, `${width}-${motion}-bag-gift-edit`);
      await edit.locator("summary").click();
      await bag
        .getByRole("button", { name: "Arrange a private visit", exact: true })
        .click();
      const booking = page.locator(".modal").last();
      assert.equal(
        await booking.locator(".gift-summary").count(),
        2,
        "booking visibly carries gift preferences",
      );
      await booking.locator('.consent input[type="checkbox"]').check();
      await booking
        .getByRole("button", { name: "Confirm demo visit", exact: true })
        .click();
      await booking
        .getByText("Local demo booking confirmed", { exact: true })
        .waitFor();
      state = await stored(page);
      assert.equal(state.cart.length, 0);
      assert.equal(state.bookings.length, 1);
      assert.equal(
        state.bookings[0].items.filter((line) => line.gift?.isGift).length,
        2,
      );
      assert.equal(
        state.bookings[0].items[0].gift.cardMessage,
        "For all our happy memories.",
      );
      await booking
        .getByRole("button", { name: "View itinerary & route", exact: true })
        .click();
      assert.equal(
        await page.locator(".booking-card .gift-summary").count(),
        2,
      );
      await page
        .getByRole("button", { name: "Merchant studio", exact: true })
        .click();
      assert.equal(
        await page.locator(".merchant-booking .gift-summary").count(),
        2,
      );
      await capture(page, `${width}-${motion}-merchant-gift-prep`);
      await noOverflow(page, "merchant gift notes fit");
      const beforeReload = structuredClone(
        state.bookings[0].items.map((line) => line.gift || null),
      );
      await page.reload({ waitUntil: "networkidle" });
      await setup(page);
      state = await stored(page);
      assert.deepEqual(
        state.bookings[0].items.map((line) => line.gift || null),
        beforeReload,
        "gift notes survive real browser reload",
      );
      assert.deepEqual(
        providerCalls,
        [],
        "browsing, wrapping and demo booking make no provider requests",
      );
      assert.deepEqual(errors, [], "no runtime errors");
      results.push({
        width,
        motion,
        passed: true,
        assertions:
          "matching fictional model + wrapping preview, explicit gifting, three assets decode, pending recipient size, distinct bag lines, no duplicate quantity, compact editor, card notes, booking and merchant continuity, reload persistence, no overflow/provider requests/runtime errors",
      });
      await writeFile(
        `${root}/artifacts/gift-packaging-e2e.json`,
        JSON.stringify(results, null, 2),
      );
      console.log(`gift passed ${width} ${motion}`);
      await context.close();
      await browser.close();
      browser = null;
    }
  await writeFile(
    `${root}/artifacts/gift-packaging-e2e.json`,
    JSON.stringify(results, null, 2),
  );
  console.log(JSON.stringify(results, null, 2));
} finally {
  await timed(browser?.close(), 5000, "Browser close timeout").catch(() => {});
  server?.kill("SIGTERM");
  if (snapshotRoot) await rm(snapshotRoot, { recursive: true, force: true });
}
