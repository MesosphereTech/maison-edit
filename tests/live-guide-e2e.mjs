// Browser regression with synthetic provider responses; no external AI calls.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { createAppServer } from "../server/index.mjs";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";

const server = createAppServer({ env: {} });
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({
  executablePath: process.env.E2E_CHROMIUM_PATH,
  headless: true,
});
const page = await browser.newPage({
  viewport: {
    width: Number(process.env.E2E_WIDTH || 1440),
    height: Number(process.env.E2E_HEIGHT || 1000),
  },
  reducedMotion: "reduce",
});
const errors = [],
  calls = [];
page.on("pageerror", (error) => errors.push(error.message));
let replyMode = "success",
  release;
async function until(check, label, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await page.waitForTimeout(40);
  }
  throw Error(label);
}
try {
  await page.route("**/api/status", (route) =>
    route.fulfill({
      json: { provider: "gemini", guide: "configured", scene: "unavailable" },
    }),
  );
  await page.route("**/api/guide", async (route) => {
    const body = route.request().postDataJSON();
    calls.push(body);
    const mode = replyMode;
    if (mode === "daily") {
      await route.fulfill({
        status: 429,
        json: { code: "review_daily_limit" },
      });
      return;
    }
    if (mode === "http-rate") {
      await route.fulfill({ status: 429, json: { error: "Please wait" } });
      return;
    }
    if (mode === "held")
      await new Promise((resolve) => {
        release = resolve;
      });
    const json =
      mode === "quota"
        ? {
            mode: "demo",
            warning: "provider_rate_limited",
            reply: "PRESET MUST NOT BE SHOWN",
            productIds: [],
          }
        : {
            mode: "gemini",
            model: "synthetic-browser-test",
            externalCall: true,
            reply:
              mode === "held"
                ? "LATE REPLY MUST NOT APPEAR"
                : `Synthetic styling reply ${calls.length}: soften the tailored silhouette with a warm neutral.`,
            productIds: [body.context.attention?.productId || "ME-001"],
          };
    await route.fulfill({ json }).catch(() => {});
  });
  await page.addInitScript(() =>
    sessionStorage.setItem("maison-edit-google-consent", "true"),
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 15000 });
  await exitDemoGuide(page);
  await page
    .locator(".product-image-button")
    .first()
    .click({ position: { x: 100, y: 100 } });
  await page.locator(".modal[data-concierge-current-product]").waitFor();
  const panel = page.locator(".subtitle-concierge:not(.is-minimized)");
  await panel.waitFor();
  assert.equal(
    await panel
      .getByRole("button", { name: /Pause proactive|暂停主动/ })
      .count(),
    0,
  );
  await panel
    .locator(".subtitle-bubble .bubble-text")
    .waitFor({ timeout: 1200 });
  assert.equal(await panel.locator('[data-copy-mode="immediate"]').count(), 1);
  assert.match(await panel.innerText(), /LOCAL GUIDE/);
  const placement = await panel.evaluate((el) => {
    const a = el.getBoundingClientRect(),
      m = document
        .querySelector(".modal[data-concierge-current-product]")
        .getBoundingClientRect();
    return {
      overlap:
        Math.max(0, Math.min(a.right, m.right) - Math.max(a.left, m.left)) *
        Math.max(0, Math.min(a.bottom, m.bottom) - Math.max(a.top, m.top)),
      opacity: getComputedStyle(el.querySelector(".subtitle-bubble")).opacity,
      contained:
        a.left >= 0 &&
        a.right <= innerWidth &&
        a.top >= 0 &&
        a.bottom <= innerHeight,
    };
  });
  assert.equal(
    placement.overlap,
    0,
    "product guide must not cover product or purchase controls",
  );
  assert.equal(
    placement.opacity,
    "1",
    "product introductions remain fully readable",
  );
  assert.equal(placement.contained, true);
  await page.waitForTimeout(1600);
  assert.equal(
    calls.length,
    0,
    "browsing remains prewritten even with a previous AI consent session",
  );
  await page.screenshot({
    path: `artifacts/product-guide-${process.env.E2E_WIDTH || 1440}.png`,
  });
  await panel
    .locator("#subtitle-message")
    .fill("How would you style this piece?");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(
    () => calls.length > 0,
    "starting the conversation did not call Gemini automatically",
  );
  await until(
    async () => /Synthetic styling reply 1/.test(await panel.innerText()),
    "provider prose did not reach bubble",
  );
  assert.equal(calls[0].consent.googleAI, true);
  assert.equal(calls[0].context.ownedItems, undefined);
  assert.ok(calls[0].context.attention.productId);
  await panel.locator("#subtitle-message").fill("Make that a little softer.");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(() => calls.length >= 2, "manual message did not call the guide");
  await until(
    async () => /Synthetic styling reply 2/.test(await panel.innerText()),
    "manual reply missing",
  );
  assert.ok(
    calls[1].history.some((line) =>
      /Synthetic styling reply 1/.test(line.text),
    ),
    "generated context is preserved",
  );
  await panel
    .locator(".subtitle-controls")
    .getByRole("button", { name: "Show conversation history", exact: true })
    .click();
  assert.ok((await panel.locator(".subtitle-bubble").count()) >= 3);
  await panel
    .locator(".subtitle-history-heading")
    .getByRole("button", { name: "Collapse conversation history", exact: true })
    .click();
  assert.equal(await panel.locator(".subtitle-bubble").count(), 1);
  assert.equal(
    await page.locator(".subtitle-resume").count(),
    0,
    "collapsing history must keep the window open",
  );

  replyMode = "quota";
  await panel.locator("#subtitle-message").fill("Another idea, please.");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(
    async () => /AI quota is unavailable/.test(await panel.innerText()),
    "quota notice missing",
  );
  assert.doesNotMatch(await panel.innerText(), /PRESET MUST NOT BE SHOWN/);

  replyMode = "http-rate";
  await panel.locator("#subtitle-message").fill("Check again, please.");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(() => calls.length >= 4, "HTTP rate-limit request missing");
  await until(
    async () => (await panel.locator(".subtitle-thinking").count()) === 0,
    "HTTP quota response did not settle",
  );
  assert.match(await panel.innerText(), /AI quota is unavailable/);

  replyMode = "daily";
  await panel.locator("#subtitle-message").fill("One more styling idea.");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(
    async () =>
      /Today's review AI request allowance/.test(await panel.innerText()),
    "daily allowance notice missing",
  );

  replyMode = "held";
  await panel.locator("#subtitle-message").fill("Try again now.");
  await panel
    .getByRole("button", { name: "Send subtitle reply", exact: true })
    .click();
  await until(() => Boolean(release), "held request never started");
  await panel
    .locator(".subtitle-controls")
    .getByRole("button", { name: "Move guide to the side", exact: true })
    .click();
  await page.locator(".subtitle-resume").waitFor();
  const count = calls.length;
  release();
  await page.mouse.wheel(0, 600);
  await page.waitForTimeout(1800);
  assert.equal(
    calls.length,
    count,
    "minimized guide must not make new requests",
  );
  replyMode = "success";
  await page.locator(".subtitle-resume").click();
  await panel.waitFor();
  await panel
    .locator(".subtitle-controls")
    .getByRole("button", { name: "Show conversation history", exact: true })
    .click();
  assert.doesNotMatch(await panel.innerText(), /LATE REPLY MUST NOT APPEAR/);
  assert.match(await panel.innerText(), /Synthetic styling reply 2/);
  assert.deepEqual(errors, []);
  console.log(
    "PASS synthetic provider: instant local browsing + automatic typed Gemini routing, shared context, independent history collapse, no pause control, quota notice, abort/no generation while minimized, preserved history.",
  );
} finally {
  release?.();
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
