import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
import { tryListVariant } from "../src/try-list.js";
import {
  curatedScenarios,
  personalizedSceneFor,
} from "../src/personalized-scenes.js";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4197";
const artifacts = fileURLToPath(
  new URL("../artifacts/visit-ai-v17/", import.meta.url),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server,
  browser,
  liveCalls = 0;
try {
  await mkdir(artifacts, { recursive: true });
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      "npm",
      ["run", "dev", "--", "--port", "4197", "--strictPort"],
      { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "ignore" },
    );
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(baseURL)).ok) break;
      } catch {}
      await sleep(100);
    }
  }
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
      reducedMotion: "reduce",
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/api/guide", (route) => {
    liveCalls++;
    return route.abort();
  });
  await page.addInitScript(
    (ids) => {
      for (const id of ids) {
        sessionStorage.setItem(`maison-edit-guided-case:${id}`, "exited");
        sessionStorage.setItem(
          `maison-edit-scene-swap-tutorial:v2:${id}`,
          "dismissed",
        );
      }
    },
    curatedScenarios.map((entry) => entry.id),
  );
  for (const fixture of [
    {
      skuId: "ME-015",
      color: "Ink",
      label: "unmapped-ink",
      caption: "No prepared fitting scene for this piece or colour",
      note: "A prepared fitting scene is unavailable for this exact piece or colour.",
    },
    {
      skuId: "ME-017",
      label: "home-only",
      caption: "No clothing selected for a fitting",
      note: "There are no clothing pieces in this plan.",
    },
  ]) {
    const state = initialState(),
      item = byId(fixture.skuId),
      color = fixture.color || item.color;
    assert.ok(item.colors.includes(color));
    if (fixture.color)
      assert.equal(
        personalizedSceneFor(item.id, state.profile, color),
        null,
        "Ink intentionally has no prepared fitting mapping",
      );
    state.cart = [
      {
        lineId: `fallback-${fixture.label}`,
        skuId: item.id,
        ...tryListVariant(item, state.profile),
        color,
        quantity: 1,
      },
    ];
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.evaluate(
      ({ key, state }) => {
        localStorage.setItem(key, JSON.stringify(state));
        Object.keys(sessionStorage)
          .filter((key) => key.startsWith("maison-edit-visit-plan:"))
          .forEach((key) => sessionStorage.removeItem(key));
      },
      { key: STORAGE_KEY, state },
    );
    await page.reload({ waitUntil: "networkidle" });
    await page.locator(".demo-setup-compose").click();
    await page
      .locator(".demo-setup[open]")
      .waitFor({ state: "hidden", timeout: 18000 });
    const before = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      return { cart: state.cart, bookings: state.bookings };
    }, STORAGE_KEY);
    await page.getByRole("button", { name: "Your visit", exact: true }).click();
    await page.getByRole("tab", { name: "Fitting", exact: true }).click();
    const image = page.locator(".va-photo-stage img"),
      src = await image.getAttribute("src");
    assert.equal(src, item.image);
    assert.match(src, /^\/images\//);
    assert.doesNotMatch(
      src,
      /architecture|personalized-scenes|outfit-scenes|personas/,
    );
    await image.evaluate((img) => img.decode());
    const caption = await page.locator(".va-photo-caption").innerText();
    assert.match(caption, /ORIGINAL CATALOG CONCEPT/);
    assert.ok(caption.includes(fixture.caption));
    assert.doesNotMatch(caption, /PRE-GENERATED FITTING REFERENCE/);
    assert.ok(
      (await page.locator(".va-fitting-notes").innerText()).includes(
        fixture.note,
      ),
    );
    assert.equal(
      await page
        .locator(".subtitle-concierge:visible,.subtitle-composer:visible")
        .count(),
      0,
    );
    const after = await page.evaluate((key) => {
      const state = JSON.parse(localStorage.getItem(key));
      return { cart: state.cart, bookings: state.bookings };
    }, STORAGE_KEY);
    assert.deepEqual(after, before);
    await page.screenshot({
      path: `${artifacts}/fitting-fallback-${fixture.label}.png`,
      fullPage: true,
    });
    console.log(
      `PASS ${fixture.label}: ${src}, ORIGINAL CATALOG CONCEPT and exact unavailable/no-clothing note; cart/bookings unchanged.`,
    );
  }
  assert.deepEqual(errors, []);
  assert.equal(liveCalls, 0);
  console.log(
    "PASS honest fitting fallbacks; no runtime errors or live provider calls.",
  );
} finally {
  await browser?.close();
  server?.kill();
}
