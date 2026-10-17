import {exitDemoGuide} from "./demo-guide-helpers.mjs";
// Real, unmocked local-dialogue integration. No external model calls are allowed.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4199";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const turns = [];
const failures = [];
let server, browser, page;
async function waitFor(check, message, timeout = 9000) {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    if (await check()) return;
    await sleep(35);
  }
  throw Error(message);
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
      "4199",
      "--strictPort",
    ],
    { cwd: root, stdio: "ignore" },
  );
  await waitFor(
    () =>
      fetch(base)
        .then((r) => r.ok)
        .catch(() => false),
    "Vite did not start",
  );
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 1000 },
  });
  page = await context.newPage();
  const errors = [],
    calls = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (/\/api\/(guide|analyze)$/.test(request.url()))
      calls.push(request.url());
  });
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.clear();
    },
    { key: STORAGE_KEY, state: { ...initialState(), language: "zh" } },
  );
  await page.route("**/api/status", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        provider: "gemini",
        guide: "configured",
        analysis: "unavailable",
        scene: "unavailable",
      }),
    }),
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await page.locator(".demo-setup-compose").click();
  await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
  await exitDemoGuide(page);
  await page.locator(".demo-setup").waitFor({ state: "detached" });
  const search = page.getByRole("textbox", {
    name: "搜索商品或风格",
    exact: true,
  });
  await search.fill(byId("ME-015").name);
  await page
    .getByRole("button", { name: `查看${byId("ME-015").name}`, exact: true })
    .first()
    .click();
  await page
    .getByRole("dialog", { name: byId("ME-015").name, exact: true })
    .waitFor();
  await page
    .locator(".subtitle-concierge")
    .getByRole("button", { name: "对话", exact: true })
    .click();
  const guide = page.getByRole("dialog", {
    name: "你的私人导购。",
    exact: true,
  });
  await guide.waitFor();
  const questions = [
    "我想找周末和朋友吃饭穿的，轻松一点",
    "我不喜欢 Terracotta，预算 2000 以内",
    "那有什么更低调的替代款？",
    "它和刚才那条裙子比，有什么不同？",
    `和我虚构记录里的${byId("ME-007").name}怎么搭？`,
    "不要再推荐手袋了，我只想用已有的鞋",
    "我喜欢温暖的客厅，先看看轻一点的家居",
    `${byId("ME-017").name}和记录里的${byId("ME-019").name}怎么搭？`,
    `记录里已经有${byId("ME-019").name}，还需要再买吗？`,
    "如果想一起到店看看，下一步怎么做？",
  ];
  for (const question of questions) {
    const before = await guide.locator(".chat-message.assistant").count();
    await guide
      .getByRole("textbox", { name: "告诉导购你的需求", exact: true })
      .fill(question);
    await guide
      .getByRole("button", { name: "发送导购消息", exact: true })
      .click();
    await waitFor(
      async () =>
        (await guide.locator(".chat-message.assistant").count()) > before,
      `No reply: ${question}`,
    );
    const response = guide.locator(".chat-message.assistant").last();
    const text = await response.locator("p").first().innerText();
    const productNames = await response
      .locator(".chat-products strong")
      .allTextContents();
    turns.push({ question, reply: text, productNames });
    assert.doesNotMatch(
      await response.locator(".chat-author").innerText(),
      /GEMINI|LIVE AI|GPT CLI/,
    );
    assert.doesNotMatch(
      text,
      /保证合身|保证.*适合|库存已确认|已经预约成功|真实购买记录/,
    );
    console.log(`TURN ${turns.length} ${question}\n${text}`);
  }
  assert.equal(
    new Set(turns.map((turn) => turn.reply)).size,
    10,
    "all ten replies must be meaningfully distinct",
  );
  assert.match(turns[1].reply, /2[,.]?000/);
  assert.match(turns[3].reply, /对比|比较|区别|不同|更|相比|相差/);
  assert.match(turns[4].reply, new RegExp(byId("ME-007").name));
  assert.match(turns[7].reply, new RegExp(byId("ME-019").name));
  assert.match(turns[8].reply, /重复|同款|已有/);
  assert.deepEqual(
    turns[8].productNames,
    [],
    "duplicate warning must not upsell",
  );
  assert.match(turns[9].reply, /本地.*演示|演示.*预约/);
  assert.deepEqual(
    calls,
    [],
    "neither browsing nor unconsented replies may call a provider",
  );
  assert.deepEqual(errors, []);
  console.log(
    "PASS ten-turn Chinese contextual dialogue, truthful local mode and no provider requests",
  );
  // Probe the existing request contract with a local synthetic DEMO response.
  // This is not a real Gemini invocation and never produces a live-AI label.
  const bodies = [];
  await page.route("**/api/guide", (route) => {
    bodies.push(route.request().postDataJSON());
    return route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        mode: "demo",
        warning: "synthetic_contract_probe",
      }),
    });
  });
  const askProbe = async (question) => {
    const count = await guide.locator(".chat-message.assistant").count();
    await guide
      .getByRole("textbox", { name: "告诉导购你的需求", exact: true })
      .fill(question);
    await guide
      .getByRole("button", { name: "发送导购消息", exact: true })
      .click();
    await waitFor(
      async () =>
        (await guide.locator(".chat-message.assistant").count()) > count,
      "synthetic contract probe did not finish",
    );
  };
  await guide.locator(".ai-consent input").check();
  await askProbe("继续帮我看看");
  assert.equal(bodies.length, 1);
  assert.equal(bodies[0].context.ownedItems, undefined);
  assert.ok(bodies[0].history.length <= 8);
  for (const line of bodies[0].history.filter(
    (line) => line.role === "assistant",
  )) {
    assert.ok(
      !line.text.includes(byId("ME-007").name),
      "local owned-shoe answers need the separate history permission",
    );
    assert.ok(
      !line.text.includes(byId("ME-019").name),
      "local owned-lamp answers need the separate history permission",
    );
  }
  await guide.locator(".ai-history-consent input").check();
  await askProbe("和我当前记录里的已有单品怎么搭");
  assert.equal(bodies.length, 2);
  assert.deepEqual(
    bodies[1].context.ownedItems,
    initialState().purchaseHistory,
  );
  assert.equal(bodies[1].consent.fictionalHistory, true);
  await guide.locator(".ai-consent input").uncheck();
  await askProbe("再看看这款的颜色");
  assert.equal(
    bodies.length,
    2,
    "revoked main permission returns to local dialogue",
  );
  console.log(
    "PASS separate fictional-history consent, bounded conversational memory and revoked provider permission",
  );
} catch (error) {
  failures.push(error.stack);
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  await writeFile(
    `${root}/artifacts/guide-conversation-results.json`,
    JSON.stringify({ turns, failures, externalModelTested: false }, null, 2) +
      "\n",
  );
  await browser?.close();
  server?.kill("SIGTERM");
}
