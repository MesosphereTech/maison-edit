import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { STORAGE_KEY } from "../src/data.js";
import {
  curatedScenarios,
  personalizedSceneFor,
} from "../src/personalized-scenes.js";
import { getPersonaPreset, getHomePreset } from "../src/presets.js";
import { buildAIVisitPlan } from "../src/visit-ai-plan.js";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4195";
const artifacts = fileURLToPath(
  new URL("../artifacts/visit-ai-v17/", import.meta.url),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server,
  browser,
  liveCalls = 0;
async function english(page, label) {
  assert.equal(await page.locator("html").getAttribute("lang"), "en", label);
  const leaked = await page.evaluate(() => {
    const values = [],
      walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const el = node.parentElement;
      if (
        !el ||
        ["SCRIPT", "STYLE"].includes(el.tagName) ||
        !el.getClientRects().length ||
        el.closest("[hidden]")
      )
        continue;
      const style = getComputedStyle(el),
        text = node.textContent.trim();
      if (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        /\p{Script=Han}/u.test(text) &&
        text !== "中文"
      )
        values.push(text);
    }
    return [...new Set(values)];
  });
  assert.deepEqual(leaked, [], `${label}: visible Chinese leaked into English`);
}
try {
  assert.equal(
    curatedScenarios.length,
    4,
    "this final traversal requires all four registered cases",
  );
  await mkdir(artifacts, { recursive: true });
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      "npm",
      ["run", "dev", "--", "--port", "4195", "--strictPort"],
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
  });
  const page = await context.newPage(),
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
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator(".demo-setup[open]").waitFor();
  assert.equal(await page.locator(".demo-setup-scenario").count(), 4);
  for (const scenario of curatedScenarios) {
    const persona = getPersonaPreset(scenario.personaId),
      home = getHomePreset(scenario.homeId);
    const choice = page.locator(`[data-scene-scenario="${scenario.id}"]`);
    await choice.click();
    assert.equal(await choice.getAttribute("aria-pressed"), "true");
    assert.equal(
      await page.locator(".demo-setup-person img").getAttribute("src"),
      persona.image,
    );
    assert.equal(
      await page.locator(".demo-setup-room img").getAttribute("src"),
      home.images.living,
    );
    await page
      .locator(".demo-setup-person img")
      .evaluate((img) => img.decode());
    assert.equal(
      await page
        .locator(".demo-setup-person img")
        .evaluate((img) => img.complete && img.naturalWidth > 0),
      true,
      `${scenario.id}: persona image loaded`,
    );
    await english(page, `${scenario.id} onboarding`);
  }
  await page
    .locator(`[data-scene-scenario="${curatedScenarios[0].id}"]`)
    .click();
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 18000 });
  for (let index = 0; index < curatedScenarios.length; index++) {
    const scenario = curatedScenarios[index],
      persona = getPersonaPreset(scenario.personaId);
    await page.waitForFunction(
      ({ key, id }) =>
        JSON.parse(localStorage.getItem(key)).profile.personaId === id,
      { key: STORAGE_KEY, id: scenario.personaId },
    );
    await english(page, `${scenario.id} storefront`);
    await page.getByRole("button", { name: "Your visit", exact: true }).click();
    await page.locator(".visit-ai-workspace").waitFor();
    assert.equal(
      await page.locator(".va-persona img").getAttribute("src"),
      persona.image,
      `${scenario.id}: selected model is retained in visit`,
    );
    assert.match(
      await page.locator(".va-persona").innerText(),
      new RegExp(persona.en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
    await english(page, `${scenario.id} workspace`);
    const state = await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)),
      STORAGE_KEY,
    );
    const plan = buildAIVisitPlan(state);
    assert.equal(plan.persona.id, scenario.personaId);
    const wear = plan.lines.find(
      (line) =>
        !line.gift?.isGift &&
        ["women", "men"].includes(line.product.category) &&
        line.product.kind !== "shoe",
    );
    const scene =
      wear && personalizedSceneFor(wear.skuId, plan.profile, wear.color);
    await page.getByRole("tab", { name: "Fitting", exact: true }).click();
    assert.match(
      await page
        .locator("[data-current-visit-stop]")
        .getAttribute("data-current-visit-stop"),
      /^wardrobe-/,
    );
    assert.equal(
      await page.locator(".va-photo-stage img").getAttribute("src"),
      scene?.src || plan.heroImage,
      `${scenario.id}: exact prepared fitting image`,
    );
    await page.locator(".va-photo-stage img").evaluate((img) => img.decode());
    await page.locator(".toast").waitFor({ state: "hidden", timeout: 6000 });
    await page.screenshot({
      path: `${artifacts}/case-${scenario.id}-fitting.png`,
      fullPage: true,
    });
    await page
      .locator(".va-quick-choices button")
      .filter({ hasText: "30 minutes" })
      .click();
    assert.equal(
      await page
        .locator("[data-visit-showcase]")
        .getAttribute("data-plan-revision"),
      "2",
    );
    await page.getByRole("button", { name: "Discover", exact: true }).click();
    await page
      .getByRole("button", { name: "Change case", exact: true })
      .click();
    console.log(
      `PASS ${scenario.id}: English onboarding/store/visit, exact selected persona and fitting scene, isolated plan session`,
    );
  }
  await page.getByRole("button", { name: "Your visit", exact: true }).click();
  assert.equal(
    await page
      .locator("[data-visit-showcase]")
      .getAttribute("data-plan-revision"),
    "2",
    "returning to first case restores its isolated plan",
  );
  assert.match(
    await page.locator("[data-plan-minutes]").innerText(),
    /^30\s*min$/,
  );
  await page.locator(".language").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await page.locator("html").getAttribute("lang"),
    "zh-CN",
    "explicit Chinese choice persists after all four cases",
  );
  assert.equal(await page.locator(".demo-setup-scenario").count(), 4);
  assert.deepEqual(errors, []);
  assert.equal(liveCalls, 0);
  console.log(
    "PASS four-case English traversal, isolated return state, persistent Chinese choice, and zero live AI requests.",
  );
  await browser.close();
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const directContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  const directPage = await directContext.newPage();
  await directPage.addInitScript(
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
  await directPage.route("**/api/guide", (route) => {
    liveCalls++;
    return route.abort();
  });
  await directPage.goto(baseURL, { waitUntil: "networkidle" });
  assert.equal(
    await directPage.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).profile.personaId,
      STORAGE_KEY,
    ),
    "claire-model-32",
  );
  await directPage.locator('[data-scene-scenario="julian-city-edit"]').click();
  await directPage.locator(".demo-setup-compose").click();
  await directPage
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 18000 });
  const directState = await directPage.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)),
    STORAGE_KEY,
  );
  assert.equal(directState.profile.personaId, "julian-model-34");
  assert.equal(
    directState.profile.size,
    "L",
    "direct onboarding selection uses Julian’s own clothing size",
  );
  assert.equal(
    directState.profile.height,
    186,
    "direct onboarding selection uses Julian’s own height",
  );
  await directPage
    .getByRole("button", { name: "Your visit", exact: true })
    .click();
  assert.match(
    await directPage.locator("[data-plan-size]").innerText(),
    /L \/ EU 43/,
  );
  await directPage.getByRole("tab", { name: "Fitting", exact: true }).click();
  await directPage
    .locator(".va-photo-stage img")
    .evaluate((img) => img.decode());
  await directPage.screenshot({
    path: `${artifacts}/direct-julian-onboarding-visit.png`,
    fullPage: true,
  });
  assert.equal(liveCalls, 0);
  console.log(
    "PASS direct fresh onboarding Claire → Julian: selected persona Julian, clothing L, height 186 cm, shoe template EU 43; no live AI requests.",
  );
} finally {
  await browser?.close();
  server?.kill();
}
