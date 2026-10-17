import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId, makeBooking } from "../src/data.js";
import { tryListVariant } from "../src/try-list.js";
import { curatedScenarios } from "../src/personalized-scenes.js";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4196";
const artifacts = fileURLToPath(
  new URL("../artifacts/visit-ai-v17/", import.meta.url),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server,
  browser,
  liveCalls = 0;
const results = [],
  failures = [];
const zh = /\p{Script=Han}/u;
async function visibleChinese(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
      ),
      out = [];
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (
        !el ||
        ["STYLE", "SCRIPT"].includes(el.tagName) ||
        !el.getClientRects().length ||
        el.closest("[hidden]")
      )
        continue;
      const css = getComputedStyle(el),
        text = node.textContent.trim();
      if (
        css.visibility !== "hidden" &&
        css.display !== "none" &&
        /\p{Script=Han}/u.test(text) &&
        text !== "中文"
      )
        out.push(text);
    }
    return [...new Set(out)];
  });
}
async function nav(page, name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const button = page.getByRole("button", { name, exact: true });
  if (!(await button.isVisible())) await page.locator(".mobile-menu").click();
  try {
    await button.click({ timeout: 2000 });
  } catch (error) {
    const message = `${page.viewportSize().width}px: ${name} navigation blocked by overlapping content`;
    failures.push(message);
    console.error(message);
    await page.screenshot({
      path: `${artifacts}/navigation-${name.replaceAll(" ", "-")}-${page.viewportSize().width}.png`,
    });
    await button.focus();
    await page.keyboard.press("Enter");
  }
  assert.equal(
    await page.locator(".mobile-menu").getAttribute("aria-expanded"),
    "false",
    "navigation closes the mobile menu",
  );
}
async function enter(page) {
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 18000 });
}
async function snapshotState(page) {
  return page.evaluate((key) => {
    const state = JSON.parse(localStorage.getItem(key));
    return { cart: state.cart, bookings: state.bookings };
  }, STORAGE_KEY);
}
async function uniqueMapStops(page) {
  const pairs = await page
    .locator("[data-map-stop] circle")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) => `${node.getAttribute("cx")},${node.getAttribute("cy")}`,
      ),
    );
  assert.equal(
    new Set(pairs).size,
    pairs.length,
    "every route-map stop must have a unique visible position",
  );
}
async function noDuplicateGuide(page) {
  assert.equal(
    await page
      .locator(
        ".subtitle-concierge:visible,.subtitle-composer:visible,.floating-tools .concierge-button:visible",
      )
      .count(),
    0,
    "visit must have only its integrated planning conversation",
  );
}
async function checkOverflow(page, label) {
  const size = await page.evaluate(() => ({
    width: innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  assert.ok(
    size.scroll <= size.width + 1,
    `${label}: horizontal page overflow ${size.scroll}/${size.width}`,
  );
}
async function stageRevision(page, expected) {
  assert.equal(
    await page
      .locator("[data-visit-showcase]")
      .getAttribute("data-plan-revision"),
    String(expected),
  );
  assert.match(
    await page.locator("[data-plan-summary] .va-revision").innerText(),
    new RegExp(`0?${expected}$`),
  );
  assert.match(
    await page.locator("[data-plan-stage] .va-update").innerText(),
    new RegExp(`0?${expected}$`),
  );
  assert.match(
    await page.locator(".va-message.is-assistant").last().innerText(),
    new RegExp(`LOCAL PLAN 0?${expected}`),
  );
}
async function exercise(page, width, label, seeded = false) {
  const baseline = await snapshotState(page);
  const companionBefore = await page.evaluate(() =>
    sessionStorage.getItem("maison-edit-companion"),
  );
  await nav(page, "Your visit");
  await page.locator(".visit-ai-workspace").waitFor();
  await noDuplicateGuide(page);
  await uniqueMapStops(page);
  await checkOverflow(page, label);
  assert.deepEqual(
    await visibleChinese(page),
    [],
    `${label}: English locale leak`,
  );
  assert.equal(
    await page
      .locator("[data-visit-showcase]")
      .getAttribute("data-visit-source"),
    seeded ? "booking" : "recommended",
  );
  await page.screenshot({
    path: `${artifacts}/${label}-initial.png`,
    fullPage: true,
  });
  console.log(`SCREENSHOT ${artifacts}/${label}-initial.png`);
  const beforeRoute = await page.locator("[data-plan-route]").innerText();
  await page
    .locator(".va-quick-choices button")
    .filter({ hasText: "30 minutes" })
    .click();
  await stageRevision(page, 2);
  assert.match(
    await page.locator("[data-plan-minutes]").innerText(),
    /^30\s*min$/,
  );
  assert.notEqual(
    await page.locator("[data-plan-route]").innerText(),
    beforeRoute,
  );
  assert.match(
    await page.locator(".va-message.is-assistant").last().innerText(),
    /30 minutes/,
  );
  assert.equal(
    await page
      .locator("[data-plan-map-revision]")
      .getAttribute("data-plan-map-revision"),
    "2",
  );
  await page
    .locator(".va-quick-choices button")
    .filter({ hasText: "Shoes first" })
    .click();
  await stageRevision(page, 3);
  const stops = await page
    .locator("[data-visit-stop]")
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.visitStop));
  assert.match(stops[1], /^shoes/);
  assert.match(
    await page.locator(".va-first-stop").innerText(),
    /Find your fit/,
  );
  assert.equal(
    await page
      .locator("[data-current-visit-stop]")
      .getAttribute("data-current-visit-stop"),
    stops[1],
  );
  await page
    .locator(".va-quick-choices button")
    .filter({ hasText: "Less walking" })
    .click();
  await stageRevision(page, 4);
  await uniqueMapStops(page);
  assert.equal(
    await page.locator(".va-map-path").getAttribute("stroke"),
    "#49604e",
  );
  assert.match(await page.locator(".va-map-legend").innerText(), /Lifts first/);
  assert.match(
    await page.locator(".va-message.is-assistant").last().innerText(),
    /lifts first/,
  );
  await page
    .locator(".va-quick-choices button")
    .filter({ hasText: "Plan a gift" })
    .click();
  await stageRevision(page, 5);
  assert.equal(
    await page.locator("[data-plan-stage]").getAttribute("data-stage"),
    "gift",
  );
  assert.match(
    await page.locator("[data-plan-gift]").innerText(),
    /Size to confirm|size to confirm|Recipient size/i,
  );
  assert.equal(
    await page
      .locator("[data-current-visit-stop]")
      .getAttribute("data-current-visit-stop"),
    "gift",
  );
  assert.match(
    await page.locator(".va-gift-stage").innerText(),
    /recipient.*size|size.*recipient/i,
  );
  assert.match(
    await page.locator(".va-message.is-assistant").last().innerText(),
    /Gift size still needs confirming/,
  );
  for (const [name, id, revision] of [
    ["Cotton-ribbon box", "recycled-cotton", 6],
    ["Botanical keepsake", "floral-accent", 7],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    await stageRevision(page, revision);
    assert.match(
      await page.locator("[data-plan-gift]").innerText(),
      new RegExp(name),
    );
    assert.equal(
      await page.locator(".va-gift-photo img").getAttribute("src"),
      `/gift-packaging/${id}.webp`,
    );
    await page.screenshot({
      path: `${artifacts}/${label}-gift-${id}.png`,
      fullPage: true,
    });
  }
  const routeTab = page.getByRole("tab", { name: "Route", exact: true });
  await routeTab.click();
  await routeTab.focus();
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("tab", { name: "Fitting", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page.locator("[data-plan-stage]").getAttribute("data-stage"),
    "outfit",
  );
  assert.match(
    await page
      .locator("[data-current-visit-stop]")
      .getAttribute("data-current-visit-stop"),
    /^wardrobe-/,
  );
  assert.match(
    await page
      .locator('[data-visit-stop][aria-pressed="true"]')
      .getAttribute("data-visit-stop"),
    /^wardrobe-/,
  );
  assert.match(
    await page.locator(".va-photo-caption").innerText(),
    /PRE-GENERATED FITTING REFERENCE/,
  );
  assert.match(
    await page.locator(".va-photo-caption").innerText(),
    /Not a live try-on/,
  );
  await page.screenshot({
    path: `${artifacts}/${label}-fitting.png`,
    fullPage: true,
  });
  await page.keyboard.press("End");
  assert.equal(
    await page
      .getByRole("tab", { name: "Gifts", exact: true })
      .getAttribute("aria-selected"),
    "true",
  );
  assert.equal(
    await page
      .locator("[data-current-visit-stop]")
      .getAttribute("data-current-visit-stop"),
    "gift",
  );
  assert.equal(
    await page
      .locator('[data-visit-stop][aria-pressed="true"]')
      .getAttribute("data-visit-stop"),
    "gift",
  );
  await page.keyboard.press("Home");
  assert.equal(await routeTab.getAttribute("aria-selected"), "true");
  const log = page.getByRole("log", {
    name: "Planning conversation history",
    exact: true,
  });
  assert.ok(
    await log.evaluate((el) => el.scrollHeight > el.clientHeight),
    "chat history must scroll rather than escape its region",
  );
  await log.focus();
  await page.keyboard.press("Home");
  await sleep(100);
  if (!(await log.evaluate((el) => el.scrollTop < 3))) {
    failures.push(
      `${label}: keyboard Home does not reach oldest chat messages`,
    );
    console.error(failures.at(-1));
  }
  await page.keyboard.press("End");
  await sleep(100);
  if (
    !(await log.evaluate(
      (el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 3,
    ))
  ) {
    failures.push(`${label}: keyboard End does not reach newest chat messages`);
    console.error(failures.at(-1));
  }
  const transcript = await page.locator(".va-message").allTextContents();
  const revision = await page
    .locator("[data-visit-showcase]")
    .getAttribute("data-plan-revision");
  await page
    .getByRole("button", {
      name: "Minimize planning conversation",
      exact: true,
    })
    .click();
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("maison-edit-visit-chat")),
    "minimized",
  );
  assert.equal(await page.locator(".va-chat-log:visible").count(), 0);
  await noDuplicateGuide(page);
  await page
    .getByRole("button", { name: "Expand planning conversation", exact: true })
    .click();
  assert.deepEqual(
    await page.locator(".va-message").allTextContents(),
    transcript,
  );
  assert.equal(
    await page
      .locator("[data-visit-showcase]")
      .getAttribute("data-plan-revision"),
    revision,
  );
  await page
    .getByRole("textbox", { name: "Tell ÉDIT your plans", exact: true })
    .fill("my size is XL");
  await page
    .getByRole("button", { name: "Send planning message", exact: true })
    .click();
  await stageRevision(page, 8);
  assert.match(await page.locator("[data-plan-size]").innerText(), /XL/);
  assert.match(
    await page
      .locator("[data-current-visit-stop]")
      .getAttribute("data-current-visit-stop"),
    /^wardrobe-/,
  );
  assert.match(
    await page
      .locator('[data-visit-stop][aria-pressed="true"]')
      .getAttribute("data-visit-stop"),
    /^wardrobe-/,
  );
  assert.match(
    await page.locator("[data-plan-gift]").innerText(),
    /size to confirm/i,
  );
  await checkOverflow(page, `${label} adjusted`);
  await page.screenshot({
    path: `${artifacts}/${label}-adjusted.png`,
    fullPage: true,
  });
  assert.deepEqual(
    await snapshotState(page),
    baseline,
    `${label}: planning must not alter cart or booking data`,
  );
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("maison-edit-companion")),
    companionBefore,
    "global companion preference must survive visit",
  );
  const finalTranscript = await page.locator(".va-message").allTextContents();
  const finalRevision = await page
    .locator("[data-visit-showcase]")
    .getAttribute("data-plan-revision");
  await nav(page, "Discover");
  assert.equal(
    await page.evaluate(() => sessionStorage.getItem("maison-edit-companion")),
    companionBefore,
    "returning to Discover must preserve global companion preference",
  );
  if (companionBefore === "minimized")
    await page.locator(".subtitle-concierge.is-minimized").waitFor();
  else await page.locator(".subtitle-concierge").waitFor();
  await nav(page, "Your visit");
  await page.locator(".visit-ai-workspace").waitFor();
  assert.equal(
    await page
      .locator("[data-visit-showcase]")
      .getAttribute("data-plan-revision"),
    finalRevision,
    "returning to the workspace keeps the plan",
  );
  assert.deepEqual(
    await page.locator(".va-message").allTextContents(),
    finalTranscript,
    "returning to the workspace keeps its complete transcript",
  );
  await noDuplicateGuide(page);
  results.push(
    `${label}: responsive regions, 4 coupled plan updates, keyboard tabs/history, independent chat minimize/reopen, no duplicate guide, cart/booking unchanged, companion ${companionBefore} preserved`,
  );
}
try {
  await mkdir(artifacts, { recursive: true });
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      "npm",
      ["run", "dev", "--", "--port", "4196", "--strictPort"],
      { cwd: fileURLToPath(new URL("../", import.meta.url)), stdio: "ignore" },
    );
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(baseURL)).ok) break;
      } catch {}
      await sleep(100);
    }
  }
  for (const [width, height, label, companion, seeded] of [
    [1440, 1000, "desktop", "active", false],
    [390, 844, "mobile", "minimized", true],
    [320, 740, "narrow-320", "active", false],
  ]) {
    browser = await chromium.launch({
      executablePath: await headless.executablePath(),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const context = await browser.newContext({
      viewport: { width, height },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/guide", (route) => {
      liveCalls++;
      return route.abort();
    });
    await page.addInitScript(
      ({ ids, companion }) => {
        for (const id of ids) {
          sessionStorage.setItem(`maison-edit-guided-case:${id}`, "exited");
          sessionStorage.setItem(
            `maison-edit-scene-swap-tutorial:v2:${id}`,
            "dismissed",
          );
        }
        sessionStorage.setItem("maison-edit-companion", companion);
      },
      { ids: curatedScenarios.map((s) => s.id), companion },
    );
    await page.goto(baseURL, { waitUntil: "networkidle" });
    await page.locator(".demo-setup[open]").waitFor();
    assert.equal(await page.locator("html").getAttribute("lang"), "en");
    assert.deepEqual(
      await visibleChinese(page),
      [],
      `${label} fresh onboarding`,
    );
    await checkOverflow(page, `${label} onboarding`);
    if (label === "desktop") {
      await page.locator(".demo-setup-language").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      await page.reload({ waitUntil: "networkidle" });
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      await page.locator(".demo-setup-language").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
    }
    if (seeded) {
      const state = initialState();
      const ids = ["ME-015", "ME-007", "ME-017"];
      state.cart = ids.map((skuId, index) => {
        const item = byId(skuId);
        return {
          lineId: `qa-${index}`,
          skuId,
          ...tryListVariant(item, state.profile),
          color: item.color,
          quantity: 1,
        };
      });
      state.bookings = [
        makeBooking(
          state.cart,
          {
            date: "2030-01-02",
            time: "14:30",
            name: "QA Guest",
            sharedFields: { name: true, items: true, dateTime: true },
          },
          1000,
        ),
      ];
      await page.evaluate(
        ({ key, state }) => localStorage.setItem(key, JSON.stringify(state)),
        { key: STORAGE_KEY, state },
      );
      await page.reload({ waitUntil: "networkidle" });
    }
    await enter(page);
    await exercise(page, width, label, seeded);
    if (label === "desktop") {
      await page.locator(".language").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
      assert.equal(
        await page.locator("[data-plan-summary] h1").innerText(),
        "你的到店之旅，已开始。",
      );
      await page.screenshot({
        path: `${artifacts}/desktop-chinese.png`,
        fullPage: true,
      });
      await page.locator(".language").click();
      assert.equal(await page.locator("html").getAttribute("lang"), "en");
    }
    assert.deepEqual(errors, [], `${label}: runtime errors`);
    await browser.close();
    browser = null;
  }
  // This is a fully intercepted browser test, not a real provider call.
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const mockContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const mockPage = await mockContext.newPage();
  const mockedRequests = [];
  await mockPage.addInitScript(
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
  await mockPage.route("**/api/status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        provider: "gemini",
        guide: "configured",
        analysis: "unavailable",
        scene: "unavailable",
      }),
    }),
  );
  await mockPage.route("**/api/guide", async (route) => {
    mockedRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        mode: "gemini",
        reply: "MOCK PROVIDER: consent-path browser QA only.",
      }),
    });
  });
  await mockPage.goto(baseURL, { waitUntil: "networkidle" });
  await enter(mockPage);
  await nav(mockPage, "Your visit");
  const mockInput = mockPage.getByRole("textbox", {
    name: "Tell ÉDIT your plans",
    exact: true,
  });
  const mockSend = mockPage.getByRole("button", {
    name: "Send planning message",
    exact: true,
  });
  await mockInput.fill("20 minutes");
  await mockSend.click();
  assert.equal(
    mockedRequests.length,
    0,
    "configured backend still needs explicit checkbox consent",
  );
  await mockPage.locator(".va-ai-consent input").check();
  await mockInput.fill("30 minutes");
  await mockSend.click();
  await mockPage
    .getByText("MOCK PROVIDER: consent-path browser QA only.", { exact: true })
    .waitFor();
  assert.equal(mockedRequests.length, 1);
  const payload = mockedRequests[0];
  assert.deepEqual(Object.keys(payload).sort(), [
    "consent",
    "context",
    "history",
    "language",
    "message",
  ]);
  assert.equal(payload.message, "30 minutes");
  assert.equal(payload.language, "en");
  assert.deepEqual(payload.history, []);
  assert.deepEqual(payload.consent, { googleAI: true });
  assert.deepEqual(Object.keys(payload.context).sort(), [
    "budget",
    "category",
    "occasion",
    "selectedProductIds",
    "styleTags",
  ]);
  assert.ok(
    payload.context.selectedProductIds.length > 0 &&
      payload.context.selectedProductIds.length <= 8,
  );
  assert.ok(payload.context.selectedProductIds.every(byId));
  assert.match(payload.context.occasion, /^Local visit plan: 30 minutes/);
  assert.doesNotMatch(
    JSON.stringify(payload),
    /purchaseHistory|profile|personaId|homeId|personaImage|homeImage|QA Guest|Alex|data:image/,
  );
  await mockPage.locator(".va-ai-consent input").uncheck();
  await mockInput.fill("less walking");
  await mockSend.click();
  await sleep(100);
  assert.equal(
    mockedRequests.length,
    1,
    "unchecking consent blocks subsequent provider requests",
  );
  await nav(mockPage, "Discover");
  await nav(mockPage, "Your visit");
  assert.equal(
    await mockPage.locator(".va-ai-consent input").isChecked(),
    false,
    "live API consent is never restored from the planning session",
  );
  await noDuplicateGuide(mockPage);
  console.log(
    "PASS mocked configured-Gemini consent path: zero requests before consent, one fully intercepted minimal payload, zero additional requests after revoke; no real provider network.",
  );
  await browser.close();
  browser = null;
  assert.equal(liveCalls, 0, "QA must not invoke a paid/live model");
  assert.deepEqual(failures, [], "workspace accessibility failures");
  console.log(
    `PASS ${results.length} viewports; no live AI calls.\n${results.join("\n")}`,
  );
} finally {
  await browser?.close();
  server?.kill();
}
