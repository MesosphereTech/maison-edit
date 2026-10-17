import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { STORAGE_KEY } from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:4193";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server;
let browser;
const scanChinese = (page) =>
  page.evaluate(() => {
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
    );
    const values = [];
    let node;
    while ((node = walker.nextNode())) {
      const parent = node.parentElement;
      if (!parent || ["STYLE", "SCRIPT"].includes(parent.tagName)) continue;
      if (!parent.getClientRects().length || parent.closest("[hidden]"))
        continue;
      const style = getComputedStyle(parent);
      if (style.display === "none" || style.visibility === "hidden") continue;
      const text = node.textContent.trim();
      // The language-switch control intentionally names its target language.
      if (/\p{Script=Han}/u.test(text) && text !== "中文") values.push(text);
    }
    return [...new Set(values)];
  });
const requireEnglish = async (page, stage) => {
  assert.equal(await page.locator("html").getAttribute("lang"), "en", stage);
  assert.deepEqual(
    await scanChinese(page),
    [],
    `${stage}: visible Chinese copy`,
  );
};
async function openStore(page) {
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 18000 });
  await exitDemoGuide(page);
}
try {
  if (!process.env.E2E_BASE_URL) {
    server = spawn(
      "npm",
      ["run", "dev", "--", "--port", "4193", "--strictPort"],
      {
        cwd: fileURLToPath(new URL("../", import.meta.url)),
        stdio: "ignore",
      },
    );
    for (let attempt = 0; attempt < 80; attempt++) {
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
  });
  await context.addInitScript(
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
  const page = await context.newPage();
  page.on("pageerror", (error) =>
    console.error("Browser error:", error.message),
  );
  page.on("requestfailed", (request) => {
    if (/\.(webp|jpg|png)/.test(request.url()))
      console.error(
        "Failed image request:",
        request.url(),
        request.failure()?.errorText,
      );
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && /\.(webp|jpg|png)/.test(response.url()))
      console.error("Asset response:", response.status(), response.url());
  });
  await page.goto(baseURL, { waitUntil: "networkidle" });
  await page.locator(".demo-setup[open]").waitFor();
  assert.equal(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).language,
      STORAGE_KEY,
    ),
    "en",
  );
  await requireEnglish(page, "fresh onboarding");
  await openStore(page);
  await requireEnglish(page, "fresh storefront");
  await page.locator(".shop-preference-entry").click();
  await requireEnglish(page, "profile modal");
  await page
    .getByRole("dialog", { name: "A little more you.", exact: true })
    .locator(".modal-head .icon-button")
    .click();
  await page
    .getByRole("textbox", { name: "Search products or styles", exact: true })
    .fill("The sculpted wool blazer");
  await page
    .locator('.product-card[data-concierge-product="ME-001"] .product-name')
    .first()
    .click();
  await requireEnglish(page, "product detail and gift editor");
  const productDialog = page.getByRole("dialog", {
    name: "The sculpted wool blazer",
    exact: true,
  });
  await productDialog.locator('[data-tour-action="add-bag"]').click();
  await productDialog.locator(".modal-head .icon-button").click();
  await page.locator(".try-list-nav").click();
  await requireEnglish(page, "store list and preparation");
  await page.getByRole("button", { name: "Your visit", exact: true }).click();
  await requireEnglish(page, "visit journey");
  await page
    .getByRole("button", { name: "Merchant studio", exact: true })
    .click();
  await requireEnglish(page, "merchant studio");
  await page
    .getByRole("button", { name: "Consumer view", exact: true })
    .click();
  await page.locator(".language").click();
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  assert.equal(
    await page.evaluate(
      (key) => JSON.parse(localStorage.getItem(key)).language,
      STORAGE_KEY,
    ),
    "zh",
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("html").getAttribute("lang"), "zh-CN");
  await page
    .getByRole("heading", { name: "选一组模板，开始逛店。", exact: true })
    .waitFor();
  await openStore(page);
  await page.locator(".language").click();
  await requireEnglish(page, "returned to English");
  await page.reload({ waitUntil: "networkidle" });
  await requireEnglish(page, "saved English reload");
  console.log(
    "PASS: fresh English onboarding/store/profile/product/list/visit/merchant, Chinese choice and reload, English toggle and reload; no visible Chinese leakage.",
  );
} finally {
  await browser?.close();
  server?.kill();
}
