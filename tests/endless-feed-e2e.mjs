import {exitDemoGuide} from "./demo-guide-helpers.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, buildFeed, byId } from "../src/data.js";
import {
  endlessFeedPage,
  MAX_MOUNTED_FEED_PAGES,
} from "../src/endless-feed.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4202";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let server, browser, page, context;
const errors = [],
  calls = [];
async function wait(check, message, timeout = 10000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(30);
  }
  throw Error(message);
}
async function reset(width = 1440, motion = "reduce") {
  if (page) await page.close();
  context = await browser.newContext({
    viewport: { width, height: width < 600 ? 844 : 1000 },
    reducedMotion: motion,
  });
  page = await context.newPage();
  errors.length = 0;
  calls.length = 0;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/\/api\/(guide|analyze)$/.test(r.url())) calls.push(r.url());
  });
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.clear();
    },
    { key: STORAGE_KEY, state: { ...initialState(), language: "en" } },
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".demo-setup-compose").click();
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await exitDemoGuide(page);
  await page.locator(".demo-setup").waitFor({ state: "detached" });
  await page.mouse.move(1, 1);
}
const state = () =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
const search = () =>
  page.getByRole("textbox", { name: "Search products or styles", exact: true });
async function bottom() {
  await page.evaluate(() => {
    document.activeElement?.blur();
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: "instant",
    });
  });
  await sleep(130);
}
async function run(name, fn) {
  try {
    const detail = await fn();
    assert.deepEqual(errors, []);
    assert.equal(calls.length, 0);
    results.push({ name, status: "pass", ...detail });
    console.log(`PASS ${name}`);
  } catch (e) {
    results.push({ name, status: "fail", error: e.message });
    console.error(`FAIL ${name}\n${e.stack}`);
    await page
      .screenshot({
        path: `${root}/artifacts/endless-feed-fail-${results.length}.png`,
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
      "4202",
      "--strictPort",
    ],
    { cwd: root, stdio: "ignore" },
  );
  await wait(
    () =>
      fetch(base)
        .then((r) => r.ok)
        .catch(() => false),
    "Vite did not start",
  );
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  await run(
    "three full catalog cycles, nonterminal footer, bounded DOM and back-scroll restoration",
    async () => {
      await reset();
      const current = await state();
      const feed = buildFeed({}, current.profile, current.feedback);
      const required = (feed.length + 1) * 3;
      const seen = new Map();
      let maxCards = 0,
        footerSeen = false;
      for (let step = 0; step < 32; step++) {
        const visible = await page
          .locator("[data-feed-position]")
          .evaluateAll((els) =>
            els.map((e) => ({
              position: Number(e.dataset.feedPosition),
              sku: e.dataset.conciergeProduct || null,
              pause: e.classList.contains("feed-pause"),
            })),
          );
        for (const entry of visible) seen.set(entry.position, entry);
        footerSeen ||= visible.some((e) => e.pause);
        maxCards = Math.max(
          maxCards,
          await page.locator(".endless-feed .feed-card").count(),
        );
        const pages = Number(
          await page.locator(".endless-feed").getAttribute("data-feed-pages"),
        );
        if (pages * 6 > required + 6 && seen.has(required - 2)) break;
        await bottom();
      }
      for (
        let pageNumber = 0;
        pageNumber < Math.ceil(required / 6);
        pageNumber++
      )
        for (const expected of endlessFeedPage(feed, pageNumber)) {
          if (expected.position >= required) continue;
          assert.ok(
            seen.has(expected.position),
            `occurrence ${expected.position} was browsable`,
          );
          if (expected.type === "product")
            assert.equal(seen.get(expected.position).sku, expected.id);
        }
      assert.ok(footerSeen, "footer appeared during browsing");
      assert.ok(
        [...seen.values()].some((e) => e.position > feed.length && e.sku),
        "products continue after the original footer",
      );
      assert.ok(
        maxCards <= (MAX_MOUNTED_FEED_PAGES + 1) * 6,
        `bounded cards: ${maxCards}`,
      );
      assert.equal(
        await page
          .locator("[id]")
          .evaluateAll(
            (els) => els.length - new Set(els.map((e) => e.id)).size,
          ),
        0,
        "unique DOM IDs",
      );
      await page.evaluate(() =>
        window.scrollTo({
          top:
            document.querySelector("#the-edit").getBoundingClientRect().top +
            window.scrollY,
          behavior: "instant",
        }),
      );
      await sleep(200);
      await page.evaluate(() => window.scrollBy(0, 500));
      await sleep(150);
      await page.locator('[data-concierge-occurrence="feed-0"]').waitFor();
      const anchor = page.locator('[data-concierge-occurrence="feed-1"]');
      await anchor.scrollIntoViewIfNeeded();
      await sleep(100);
      const before = await anchor.boundingBox();
      await sleep(350);
      const after = await anchor.boundingBox();
      assert.ok(
        Math.abs(before.y - after.y) < 2,
        "retention does not jump the visible anchor",
      );
      return {
        catalogCycles: 3,
        seenOccurrences: seen.size,
        maxMountedCards: maxCards,
      };
    },
  );
  await run(
    "same SKU shares saved and bag state while each visible occurrence gets its own attention",
    async () => {
      await reset();
      const original = await state();
      await search().fill("ME-001");
      await search().blur();
      const cards = page.locator(
        '.endless-feed [data-concierge-product="ME-001"]',
      );
      await cards.first().locator(".save-button").click();
      assert.equal(
        await cards.locator('.save-button[aria-pressed="true"]').count(),
        await cards.count(),
      );
      const firstOccurrence = await cards
        .first()
        .getAttribute("data-concierge-occurrence");
      await cards.first().locator(".product-name").focus();
      await sleep(350);
      assert.equal(
        await page
          .locator(".concierge-attention-frame")
          .getAttribute("data-attention-occurrence"),
        firstOccurrence,
      );
      const second = cards.nth(1);
      await second.scrollIntoViewIfNeeded();
      await second.locator(".product-name").focus();
      await sleep(350);
      const secondOccurrence = await second.getAttribute(
        "data-concierge-occurrence",
      );
      assert.notEqual(firstOccurrence, secondOccurrence);
      assert.equal(
        await page
          .locator(".concierge-attention-frame")
          .getAttribute("data-attention-occurrence"),
        secondOccurrence,
      );
      assert.equal(
        await page
          .locator(".concierge-attention-frame")
          .getAttribute("data-attention-product"),
        "ME-001",
      );
      await second.locator(".product-name").click();
      const modal = page.getByRole("dialog", {
        name: byId("ME-001").en,
        exact: true,
      });
      await modal.waitFor();
      await modal
        .getByRole("button", { name: "Add to visit bag", exact: true })
        .click();
      await modal
        .getByRole("button", { name: "Close / 关闭", exact: true })
        .click();
      const saved = await state();
      assert.deepEqual(saved.wishlist, ["ME-001"]);
      assert.equal(saved.cart[0].skuId, "ME-001");
      assert.deepEqual(saved.purchaseHistory, original.purchaseHistory);
      await page.evaluate(() => document.activeElement?.blur());
      for (let i = 0; i < 4; i++) await bottom();
      const pause = page.locator(".feed-pause").first();
      await pause.waitFor();
      await pause
        .getByRole("button", { name: "Continue the edit", exact: true })
        .click();
      await sleep(200);
      assert.ok(
        await page.locator('[data-feed-position="19"]').count(),
        "a piece immediately follows the pause",
      );
      const later = page
        .locator('.endless-feed [data-concierge-product="ME-001"]')
        .last();
      assert.equal(
        await later.locator(".save-button").getAttribute("aria-pressed"),
        "true",
      );
      await later.locator(".save-button").click();
      assert.equal(
        (await state()).wishlist.length,
        0,
        "removing a later occurrence updates the SKU once",
      );
      assert.equal((await state()).cart[0].quantity, 1);
      return { firstOccurrence, secondOccurrence, sharedSku: "ME-001" };
    },
  );
  await run(
    "filters restart the stream, empty results stay honest, and saved/history survive",
    async () => {
      await reset();
      await page.locator(".endless-feed .save-button").first().click();
      const previous = await state();
      await search().fill("no-such-piece-xyz");
      assert.equal(await page.locator(".endless-feed").count(), 0);
      assert.ok(
        await page
          .getByRole("heading", {
            name: "No discoveries on this page, yet.",
            exact: true,
          })
          .isVisible(),
      );
      await sleep(250);
      assert.equal(await page.locator(".endless-feed").count(), 0);
      await page
        .getByRole("button", { name: "Reset filters", exact: true })
        .click();
      assert.equal(
        await page.locator(".endless-feed").getAttribute("data-feed-pages"),
        "1",
      );
      await page
        .getByRole("group", { name: "Product categories" })
        .getByRole("button", { name: "Home & living", exact: true })
        .click();
      const filteredState = await state();
      assert.deepEqual(filteredState.wishlist, previous.wishlist);
      assert.deepEqual(filteredState.purchaseHistory, previous.purchaseHistory);
      assert.ok(
        (
          await page
            .locator(".endless-feed [data-concierge-product]")
            .evaluateAll((els) => els.map((e) => e.dataset.conciergeProduct))
        ).every((id) => byId(id).category === "home"),
      );
      return { retainedSaved: previous.wishlist.length };
    },
  );
  await run(
    "mobile repeated feed is responsive, keyboard-loadable and honors reduced motion",
    async () => {
      await reset(390);
      await search().fill("ME-002");
      await search().blur();
      await page.locator(".feed-end button").focus();
      await page.keyboard.press("Enter");
      await sleep(180);
      assert.ok(
        Number(
          await page.locator(".endless-feed").getAttribute("data-feed-pages"),
        ) >= 2,
      );
      await bottom();
      await bottom();
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth + 1,
        ),
        false,
      );
      assert.equal(
        await page.evaluate(
          () => matchMedia("(prefers-reduced-motion: reduce)").matches,
        ),
        true,
      );
      const card = page
        .locator(".endless-feed [data-concierge-product]")
        .last();
      await card.scrollIntoViewIfNeeded();
      await card.locator(".product-name").focus();
      await sleep(400);
      const rect = await card.boundingBox();
      assert.ok(rect.width <= 390 && rect.x >= 0);
      await page.screenshot({
        path: `${root}/artifacts/endless-feed-mobile.png`,
      });
      return { width: 390 };
    },
  );
} finally {
  await writeFile(
    `${root}/artifacts/endless-feed-results.json`,
    JSON.stringify({ results }, null, 2),
  );
  await browser?.close();
  server?.kill();
}
if (results.some((r) => r.status !== "pass")) process.exitCode = 1;
