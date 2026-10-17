import { exitDemoGuide } from "./demo-guide-helpers.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId, catalog } from "../src/data.js";
import { purchaseHistoryPresets } from "../src/purchase-history.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4192),
  base = `http://127.0.0.1:${port}`,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server, browser, context, page;
const results = [];
let errors = [],
  requests = [];
async function wait(check, message, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await check()) return;
    await sleep(20);
  }
  throw Error(message);
}
async function enterDemo() {
  await page.locator(".demo-setup-compose").click();
  await page
    .locator(".demo-setup[open]")
    .waitFor({ state: "hidden", timeout: 10000 });
  await exitDemoGuide(page);
  await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
}
async function reset(overrides = {}, width = 1440, motion = "reduce") {
  if (page) await page.close();
  page = await context.newPage();
  errors = [];
  requests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (r.url().endsWith("/api/guide")) requests.push(r);
  });
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(
    ({ key, state }) => {
      if (!sessionStorage.getItem("e2e-initialized")) {
        localStorage.setItem(key, JSON.stringify(state));
        sessionStorage.clear();
        sessionStorage.setItem("e2e-initialized", "true");
      }
    },
    {
      key: STORAGE_KEY,
      state: {
        ...initialState(),
        onboardingStatus: "skipped",
        language: "en",
        ...overrides,
      },
    },
  );
  await page.route("**/api/status", (r) =>
    r.fulfill({
      json: {
        provider: "gemini",
        guide: "configured",
        analysis: "unavailable",
        scene: "unavailable",
      },
    }),
  );
  await page.goto(base, { waitUntil: "networkidle" });
  await enterDemo();
  await page.mouse.move(1, 1);
}
const bubbles = () => page.locator(".subtitle-bubble:not(.is-retiring)");
const frame = () => page.locator(".concierge-attention-frame");
const historyState = () =>
  page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).purchaseHistory,
    STORAGE_KEY,
  );
async function openProduct(id) {
  const item = byId(id);
  await page
    .getByRole("textbox", { name: "Search products or styles", exact: true })
    .fill(item.en);
  await page
    .getByRole("button", { name: `View ${item.en}`, exact: true })
    .first()
    .click();
  await page.getByRole("dialog", { name: item.en, exact: true }).waitFor();
  await sleep(150);
}
async function guide() {
  const conversation = page.getByRole("button", {
    name: "Conversation",
    exact: true,
  });
  if (!(await conversation.isVisible()))
    await page
      .getByRole("button", { name: "Show conversation history", exact: true })
      .click();
  await conversation.click();
  const modal = page.getByRole("dialog", {
    name: "Your private guide.",
    exact: true,
  });
  await modal.waitFor();
  return modal;
}
async function editHistory() {
  await page
    .getByRole("button", {
      name: "Edit fictional purchase history",
      exact: true,
    })
    .click();
  return page.getByRole("dialog", { name: "A little more you.", exact: true });
}
async function run(name, fn) {
  if (
    process.env.E2E_FILTER &&
    !new RegExp(process.env.E2E_FILTER, "i").test(name)
  )
    return;
  try {
    const detail = await fn();
    assert.deepEqual(errors, []);
    results.push({ name, status: "pass", ...detail });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: "fail", error: error.message });
    console.error(`FAIL ${name}\n${error.stack}`);
    await page
      .screenshot({
        path: `${root}/artifacts/attention-history-fail-${results.length}.png`,
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
      `${port}`,
    ],
    { cwd: root, stdio: "ignore" },
  );
  await wait(async () => {
    try {
      return (await fetch(base)).ok;
    } catch {
      return false;
    }
  }, "vite did not start");
  browser = await chromium.launch({
    executablePath: await headless.executablePath(),
    headless: true,
    args: headless.args,
  });
  context = await browser.newContext();
  await run(
    "visible center wins over first DOM card and pointer or focus takes priority",
    async () => {
      await reset();
      const first = page.locator("[data-concierge-product]").nth(0),
        second = page.locator("[data-concierge-product]").nth(1);
      await second.scrollIntoViewIfNeeded();
      await sleep(60);
      const center = await frame().getAttribute("data-attention-product");
      assert.ok(center, "visible card highlights immediately");
      await second.locator(".product-name").focus();
      assert.equal(
        await frame().getAttribute("data-attention-product"),
        await second.getAttribute("data-concierge-product"),
      );
      const secondId = await second.getAttribute("data-concierge-product");
      await sleep(360);
      assert.match(
        await bubbles().last().innerText(),
        new RegExp(byId(secondId).en.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      );
      await first.scrollIntoViewIfNeeded();
      // Lazy prepared images can add controls while a stationary pointer is
      // waiting to settle. Those DOM updates must not cancel hover intent.
      await page.evaluate(() => {
        let ticks = 0;
        const timer = setInterval(() => {
          const marker = document.createElement("span");
          marker.hidden = true;
          document.getElementById("main").append(marker);
          marker.remove();
          if (++ticks === 8) clearInterval(timer);
        }, 30);
      });
      await first.locator(".product-image-button").hover();
      const firstId = await first.getAttribute("data-concierge-product");
      await wait(
        async () =>
          (await frame().getAttribute("data-attention-product")) === firstId,
        "pointer attention did not replace stale keyboard focus",
        1800,
      );
      assert.equal(requests.length, 0);
    },
  );
  await run(
    "rapid changes never deliver a passed source and replace without 45-second cooldown",
    async () => {
      await reset();
      const cards = page.locator("[data-concierge-product]");
      const ids = [];
      for (let i = 0; i < 4; i++) {
        const card = cards.nth(i);
        const id = await card.getAttribute("data-concierge-product");
        ids.push(id);
        await card.scrollIntoViewIfNeeded();
        await card.locator(".product-name").focus();
        await sleep(70);
      }
      const last = ids.at(-1);
      await sleep(400);
      assert.equal(await frame().getAttribute("data-attention-product"), last);
      assert.ok((await bubbles().last().innerText()).includes(byId(last).en));
      assert.equal(await bubbles().count(), 1, "a single current passive hint");
      await cards.nth(0).scrollIntoViewIfNeeded();
      await cards.nth(0).locator(".product-name").focus();
      await sleep(430);
      assert.ok((await bubbles().last().innerText()).includes(byId(ids[0]).en));
      assert.equal(await bubbles().count(), 1);
      await page.evaluate(() =>
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      await sleep(210);
      assert.equal(
        await page
          .locator(
            `.subtitle-bubble:not(.is-retiring)[data-source-product="${ids[0]}"]`,
          )
          .count(),
        0,
      );
      assert.equal(requests.length, 0);
    },
  );
  await run(
    "reading a bubble cannot retain a passed product frame",
    async () => {
      await reset();
      const card = page.locator("[data-concierge-product]").first();
      const id = await card.getAttribute("data-concierge-product");
      await card.scrollIntoViewIfNeeded();
      await card.locator(".product-name").focus();
      await sleep(450);
      await bubbles().last().hover();
      await page.evaluate(() =>
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "instant",
        }),
      );
      await sleep(210);
      assert.equal(
        await card.evaluate((el) => {
          const r = el.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight;
        }),
        false,
        "the old source must be outside the compact catalog viewport",
      );
      assert.equal(
        await page
          .locator(`.concierge-attention-frame[data-attention-product="${id}"]`)
          .count(),
        0,
      );
      assert.equal(
        await bubbles()
          .filter({ hasText: byId(id).en })
          .count(),
        0,
      );
    },
  );
  for (const width of [320, 390, 1024, 1440])
    await run(`history editor and attention layout ${width}px`, async () => {
      await reset({}, width);
      let modal = await editHistory();
      await modal
        .getByRole("button", { name: "Women’s wardrobe", exact: true })
        .click();
      assert.equal(await modal.locator(".purchase-history-item").count(), 3);
      await modal
        .locator(".purchase-history-item")
        .first()
        .getByLabel("Colour", { exact: true })
        .selectOption("Ink");
      await modal
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      assert.equal((await historyState())[0].color, "Ink");
      await openProduct("ME-001");
      await wait(
        () =>
          bubbles()
            .count()
            .then((n) => n > 0),
        "history bubble missing",
      );
      assert.match(await bubbles().last().innerText(), /collection pairing/);
      assert.match(
        await bubbles().last().innerText(),
        /(?:fictional|current example) history/i,
      );
      const form = await page.locator(".subtitle-composer").boundingBox();
      assert.ok(Math.abs(form.x + form.width / 2 - width / 2) < 1);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 1,
      );
      assert.equal(overflow, false);
      await page.locator(".toast").waitFor({ state: "hidden" });
      await page.screenshot({
        path: `${root}/artifacts/attention-history-${width}.png`,
      });
      return { composer: form, ownedItems: (await historyState()).length };
    });
  await run(
    "history persists, removes, clears, and cancelled drafts never invent ownership",
    async () => {
      await reset({ purchaseHistory: purchaseHistoryPresets[0].items });
      await page.reload({ waitUntil: "networkidle" });
      await enterDemo();
      assert.equal((await historyState()).length, 3);
      let modal = await editHistory();
      await modal.locator(".purchase-history-remove").first().click();
      await modal
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      assert.equal((await historyState()).length, 2);
      modal = await editHistory();
      await modal
        .getByRole("button", {
          name: "Clear / reset fictional history",
          exact: true,
        })
        .click();
      await modal
        .getByRole("button", { name: "Save & refine my edit", exact: true })
        .click();
      assert.deepEqual(await historyState(), []);
      modal = await editHistory();
      await modal
        .getByRole("button", { name: "Men’s wardrobe", exact: true })
        .click();
      await modal
        .getByRole("button", { name: "Close / 关闭", exact: true })
        .click();
      assert.deepEqual(await historyState(), []);
      await openProduct("ME-001");
      await wait(
        () =>
          bubbles()
            .count()
            .then((n) => n > 0),
        "product bubble missing",
      );
      assert.equal(await page.locator(".bubble-owned-reference").count(), 0);
    },
  );
  await run(
    "owned duplicate is a warning with no new-product upsell",
    async () => {
      await reset({ purchaseHistory: purchaseHistoryPresets[0].items });
      await openProduct("ME-003");
      await wait(
        () =>
          bubbles()
            .count()
            .then((n) => n > 0),
        "duplicate bubble missing",
      );
      const warning = await bubbles().innerText();
      const owned = purchaseHistoryPresets[0].items.find(
        (item) => item.skuId === "ME-003",
      );
      assert.match(warning, /already in the (?:example|fictional) history/i);
      assert.match(warning, /check (?:duplicate|a repeat)/i);
      assert.ok(
        warning.includes(`${owned.color} · ${owned.size}`),
        "inline duplicate warning retains the exact recorded variant",
      );
      assert.equal(
        await bubbles().getAttribute("data-source-product"),
        "ME-003",
      );
      assert.equal(await bubbles().locator(".bubble-piece").count(), 0);
      for (const item of catalog.filter((item) => item.id !== owned.skuId))
        assert.equal(
          warning.includes(item.en),
          false,
          `duplicate warning must not upsell ${item.id}`,
        );
      assert.equal(requests.length, 0);
    },
  );
  await run(
    "fictional history sharing is separate bounded opt-in and browsing never calls AI",
    async () => {
      const twelve = catalog.slice(0, 12).map((item) => ({
        skuId: item.id,
        color: item.color,
        size: item.sizes.includes("M") ? "M" : item.sizes[0],
      }));
      await reset({ purchaseHistory: twelve });
      const bodies = [];
      await page.route("**/api/guide", (route) => {
        bodies.push(route.request().postDataJSON());
        return route.fulfill({
          json: {
            mode: "gemini",
            reply: "Synthetic provider fixture.",
            productIds: ["ME-001"],
          },
        });
      });
      const modal = await guide();
      await modal
        .getByRole("checkbox", { name: /Allow this conversation/ })
        .check();
      await modal
        .getByRole("textbox", {
          name: "Tell your guide what you need",
          exact: true,
        })
        .fill("Pair my wardrobe");
      await modal
        .getByRole("button", { name: "Send guide message", exact: true })
        .click();
      await wait(() => bodies.length === 1, "first guide call missing");
      assert.equal("ownedItems" in bodies[0].context, false);
      assert.deepEqual(bodies[0].consent, { googleAI: true });
      await wait(
        () =>
          modal
            .locator(".guide-loading")
            .count()
            .then((n) => n === 0),
        "reply did not finish",
      );
      await modal
        .getByRole("checkbox", { name: /Also allow the first 8/ })
        .check();
      await modal
        .getByRole("textbox", {
          name: "Tell your guide what you need",
          exact: true,
        })
        .fill("Consider my previous pieces");
      await modal
        .getByRole("button", { name: "Send guide message", exact: true })
        .click();
      await wait(() => bodies.length === 2, "history guide call missing");
      assert.deepEqual(bodies[1].context.ownedItems, twelve.slice(0, 8));
      assert.equal(bodies[1].context.ownedItems.length, 8);
      assert.equal(bodies[1].consent.fictionalHistory, true);
      assert.ok(
        bodies[1].context.ownedItems.every(
          (item) => Object.keys(item).sort().join(",") === "color,size,skuId",
        ),
      );
      await modal
        .getByRole("button", { name: "Continue in subtitles", exact: true })
        .click();
      await page
        .locator("[data-concierge-product]")
        .first()
        .scrollIntoViewIfNeeded();
      await sleep(500);
      assert.equal(bodies.length, 2);
    },
  );
  await run(
    "a new attention target aborts an in-flight provider reply before it can appear",
    async () => {
      await reset();
      let release,
        started = false,
        aborted = false;
      const gate = new Promise((resolve) => (release = resolve));
      page.on("requestfailed", (request) => {
        if (request.url().endsWith("/api/guide")) aborted = true;
      });
      await page.route("**/api/guide", async (route) => {
        started = true;
        await gate;
        await route
          .fulfill({
            json: {
              mode: "gemini",
              reply: "STALE ATTENTION FIXTURE",
              productIds: ["ME-001"],
            },
          })
          .catch(() => {});
      });
      const first = page.locator("[data-concierge-product]").nth(0),
        second = page.locator("[data-concierge-product]").nth(1);
      await first.scrollIntoViewIfNeeded();
      await first.locator(".product-name").focus();
      await sleep(400);
      const modal = await guide();
      await modal
        .getByRole("checkbox", { name: /Allow this conversation/ })
        .check();
      await modal
        .getByRole("button", { name: "Continue in subtitles", exact: true })
        .click();
      await page
        .getByRole("textbox", { name: "Reply to your guide", exact: true })
        .fill("Pair this piece");
      await page
        .getByRole("button", { name: "Send subtitle reply", exact: true })
        .click();
      await wait(() => started, "provider fixture did not start");
      await second.scrollIntoViewIfNeeded();
      await second.locator(".product-name").focus();
      release();
      await wait(
        () => aborted,
        "attention change did not abort the old provider request",
      );
      await sleep(500);
      assert.equal(
        await bubbles().filter({ hasText: "STALE ATTENTION FIXTURE" }).count(),
        0,
      );
      const reopened = await guide();
      assert.equal(
        await reopened
          .locator(".chat-message")
          .filter({ hasText: "STALE ATTENTION FIXTURE" })
          .count(),
        0,
      );
    },
  );
  await run(
    "anchored source lap and particle handoff keep the same bubble readable, with a static reduced-motion outline",
    async () => {
      await reset({}, 1440, "no-preference");
      // Observe phase geometry inside the browser so process latency cannot
      // turn a sample of the short particle flight into an arrival sample.
      const evidence = await page.evaluate(() => {
        const oldId = document.querySelector(".concierge-attention-frame")
          ?.dataset.attentionProduct;
        const target = [
          ...document.querySelectorAll("[data-concierge-product]"),
        ].find((element) => {
          const visual = element.querySelector(".product-visual");
          const box = visual?.getBoundingClientRect();
          return (
            element.dataset.conciergeProduct !== oldId &&
            box &&
            box.top >= 0 &&
            box.top < innerHeight - 100
          );
        });
        if (!target)
          throw Error(
            "No alternate visible product for the real-App attention handoff",
          );
        const productId = target.dataset.conciergeProduct;
        const savedBubble = document.querySelector(
          "[data-persistent-surface]:not(.is-retiring)",
        );
        const samples = [],
          phases = [],
          observed = new Set();
        const boxOf = (element) => {
          const rect = element.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          };
        };
        const snapshot = () => {
          const shell = document.querySelector(".concierge-attention-frame");
          const bubble = document.querySelector(
            "[data-persistent-surface]:not(.is-retiring)",
          );
          const visual = target.querySelector(".product-visual");
          const rect = visual.getBoundingClientRect();
          const header =
            document.querySelector(".site-header")?.getBoundingClientRect()
              .bottom || 0;
          const left = Math.max(3, rect.left),
            top = Math.max(3, header + 3, rect.top);
          const right = Math.min(innerWidth - 3, rect.right),
            bottom = Math.min(innerHeight - 3, rect.bottom);
          const outline = shell.querySelector(".attention-shell-outline");
          const field = document.querySelector(".concierge-particle-field");
          const pixels = [
            ...document.querySelectorAll(".concierge-magic-pixel"),
          ];
          return {
            phase: shell.dataset.phase,
            at: performance.now(),
            productId: shell.dataset.attentionProduct,
            source: {
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            },
            frame: boxOf(shell),
            shellAnimations: shell.getAnimations().length,
            shellVisible: getComputedStyle(shell).visibility,
            outlineAnimations: outline.getAnimations().map((animation) => ({
              duration: animation.effect.getTiming().duration,
              frames: animation.effect.getKeyframes(),
            })),
            bubble: boxOf(bubble),
            sameBubble: bubble === savedBubble,
            bubbleSource: bubble.dataset.sourceProduct,
            bubbleTransform: getComputedStyle(bubble).transform,
            contentOpacity: Number(
              getComputedStyle(bubble.querySelector(".bubble-content")).opacity,
            ),
            inert: Boolean(bubble.closest("[inert]")),
            phrases: [...bubble.querySelectorAll(".bubble-reveal-phrase")].map(
              (element) => Number(getComputedStyle(element).opacity),
            ),
            particles: pixels.length,
            visibleParticles: pixels.filter(
              (pixel) => Number(getComputedStyle(pixel).opacity) > 0.3,
            ).length,
            particleText: field?.textContent,
            particleOrigin: field?.dataset.origin,
            particleDestination: field?.dataset.destination,
            pixelAnimations: pixels.map((pixel) =>
              pixel.getAnimations().map((animation) => ({
                duration: animation.effect.getTiming().duration,
                delay: animation.effect.getTiming().delay,
                frames: animation.effect.getKeyframes(),
              })),
            ),
          };
        };
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            observer.disconnect();
            reject(
              Error(
                `Attention sequence did not settle: ${JSON.stringify({ productId, phases, samples })}`,
              ),
            );
          }, 5000);
          const observer = new MutationObserver(() => {
            const shell = document.querySelector(".concierge-attention-frame");
            const phase = document.querySelector(".subtitle-concierge")?.dataset
              .attentionPhase;
            if (
              shell?.dataset.attentionProduct !== productId ||
              observed.has(phase)
            )
              return;
            if (
              !["glow-lap", "particles", "arrival", "settled"].includes(phase)
            )
              return;
            observed.add(phase);
            phases.push({ phase, at: performance.now() });
            if (phase === "settled" && observed.has("glow-lap")) {
              setTimeout(() => {
                samples.push(snapshot());
                observer.disconnect();
                clearTimeout(timeout);
                resolve({ productId, phases, samples });
              }, 80);
            } else if (phase !== "settled") {
              const delay = { "glow-lap": 180, particles: 180, arrival: 70 }[
                phase
              ];
              setTimeout(() => samples.push(snapshot()), delay);
            }
          });
          observer.observe(document.body, {
            subtree: true,
            attributes: true,
            attributeFilter: ["data-attention-phase"],
          });
          target.querySelector(".product-name").focus({ preventScroll: true });
        });
      });
      assert.deepEqual(
        evidence.phases.map((entry) => entry.phase),
        ["glow-lap", "particles", "arrival", "settled"],
      );
      const lap = evidence.samples.find(
        (sample) => sample.phase === "glow-lap",
      );
      const flight = evidence.samples.find(
        (sample) => sample.phase === "particles",
      );
      const settled = evidence.samples.find(
        (sample) => sample.phase === "settled",
      );
      assert.ok(lap && flight && settled, JSON.stringify(evidence));
      assert.equal(lap.outlineAnimations[0].duration, 560);
      assert.notEqual(
        lap.outlineAnimations[0].frames[0].strokeDashoffset,
        lap.outlineAnimations[0].frames.at(-1).strokeDashoffset,
      );
      for (const sample of evidence.samples) {
        assert.equal(sample.productId, evidence.productId);
        assert.equal(
          sample.bubbleSource,
          evidence.productId,
          "live copy follows the exact source SKU",
        );
        assert.equal(
          sample.sameBubble,
          true,
          "all phases update the same persistent bubble node",
        );
        assert.equal(
          sample.bubbleTransform,
          "none",
          "decoration never transforms the live surface",
        );
        assert.equal(
          sample.inert,
          false,
          "live controls never become inert for the decoration",
        );
        assert.equal(sample.contentOpacity, 1);
        assert.ok(
          sample.phrases.length &&
            sample.phrases.every((opacity) => opacity > 0.99),
          "all passive copy is readable throughout the source lap and flight",
        );
        assert.equal(
          sample.shellAnimations,
          0,
          "the source shell never flies or morphs",
        );
        for (const key of ["x", "y", "width", "height"]) {
          assert.ok(
            Math.abs(sample.frame[key] - sample.source[key]) < 1.1,
            `source-anchored ${key} during ${sample.phase}`,
          );
          assert.ok(
            Math.abs(sample.bubble[key] - lap.bubble[key]) < 1.1,
            `stable bubble ${key} during ${sample.phase}`,
          );
        }
      }
      assert.equal(lap.shellVisible, "visible");
      assert.equal(flight.shellVisible, "hidden");
      assert.equal(flight.particles, 19);
      assert.ok(
        flight.visibleParticles >= 8,
        "the pixel trail remains plainly visible during flight",
      );
      assert.equal(
        flight.particleText,
        "",
        "the trail contains no emoji or text glyphs",
      );
      flight.pixelAnimations.forEach((animations, index) => {
        assert.equal(animations.length, 1);
        assert.equal(animations[0].duration, 420);
        assert.equal(animations[0].delay, index * 9);
        assert.notEqual(
          animations[0].frames[0].transform,
          animations[0].frames.at(-1).transform,
        );
        assert.ok(
          animations[0].frames.every(
            (frame) =>
              !["left", "top", "width", "height"].some((key) => key in frame),
          ),
          "pixels animate transforms rather than layout geometry",
        );
      });
      const [originX, originY] = flight.particleOrigin.split(",").map(Number);
      const [destinationX, destinationY] = flight.particleDestination
        .split(",")
        .map(Number);
      const distanceToEdge = (x, y, box) =>
        Math.min(
          Math.abs(x - box.x),
          Math.abs(x - box.x - box.width),
          Math.abs(y - box.y),
          Math.abs(y - box.y - box.height),
        );
      assert.ok(
        distanceToEdge(originX, originY, flight.source) <= 2,
        "trail starts on the anchored product contour",
      );
      assert.ok(
        distanceToEdge(destinationX, destinationY, flight.bubble) <= 4,
        "trail lands on the live bubble edge",
      );
      assert.ok(
        Math.hypot(destinationX - originX, destinationY - originY) >= 50,
        "handoff has a readable travel path",
      );
      assert.equal(
        settled.particles,
        0,
        "temporary decoration is cleaned up after arrival",
      );
      await page.screenshot({
        path: `${root}/artifacts/attention-stable-bubble-settled.png`,
      });
      await reset();
      const reducedCard = page.locator("[data-concierge-product]").first();
      await reducedCard.scrollIntoViewIfNeeded();
      await reducedCard.locator(".product-name").focus();
      await sleep(450);
      const reduced = await reducedCard.evaluate((element) => ({
        productId: element.dataset.conciergeProduct,
        outline: getComputedStyle(element.querySelector(".product-visual"))
          .outlineStyle,
        frameDisplay: getComputedStyle(
          document.querySelector(".concierge-attention-frame"),
        ).display,
        frameAnimations: document
          .querySelector(".concierge-attention-frame")
          .getAnimations({ subtree: true }).length,
        particles: document.querySelectorAll(".concierge-particle-field")
          .length,
        phrases: [
          ...document.querySelectorAll(
            ".subtitle-bubble:not(.is-retiring) .bubble-reveal-phrase",
          ),
        ].map((phrase) => Number(getComputedStyle(phrase).opacity)),
      }));
      assert.equal(
        reduced.outline,
        "solid",
        "reduced motion keeps the current product statically outlined",
      );
      assert.equal(reduced.frameDisplay, "none");
      assert.equal(reduced.frameAnimations, 0);
      assert.equal(reduced.particles, 0);
      assert.ok(
        reduced.phrases.length &&
          reduced.phrases.every((opacity) => opacity > 0.99),
      );
      await page.screenshot({
        path: `${root}/artifacts/attention-static-reduced-motion.png`,
      });
      return { evidence, reduced };
    },
  );
} finally {
  await writeFile(
    `${root}/artifacts/attention-history${process.env.E2E_FILTER ? "-focused" : ""}-results.json`,
    JSON.stringify(results, null, 2),
  );
  await browser?.close();
  server?.kill("SIGTERM");
}
console.log(
  `${results.filter((r) => r.status === "pass").length}/${results.length} attention/history scenarios passed`,
);
if (results.some((r) => r.status === "fail")) process.exitCode = 1;
