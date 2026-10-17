import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId } from "../src/data.js";
import { exitDemoGuide } from "./demo-guide-helpers.mjs";

// Real-App regression for every product inspection and close/resume entry point.
// The existing history fixture additionally delivers a new message while closed.
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4216);
const base = `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const widths = (
  process.env.E2E_WIDTHS ||
  process.env.E2E_WIDTH ||
  "1440,1024,390,320"
)
  .split(",")
  .map(Number);
const resultsPath =
  process.env.E2E_RESULTS_PATH ||
  `${root}/artifacts/concierge-reopen-results.json`;
const motions = process.env.E2E_MOTION
  ? [process.env.E2E_MOTION]
  : ["no-preference", "reduce"];
const results = [];
let browser, server;

function separate(a, b, gap = 0) {
  return (
    a.x + a.width <= b.x - gap ||
    b.x + b.width <= a.x - gap ||
    a.y + a.height <= b.y - gap ||
    b.y + b.height <= a.y - gap
  );
}

async function capture(page, name) {
  // The serverless Chromium compositor can hang capturing the animated full
  // storefront. Keep functional coverage independent; request captures for a
  // supported browser with E2E_SCREENSHOTS=1.
  if (process.env.E2E_SCREENSHOTS !== "1") return null;
  const path = `${root}/artifacts/concierge-reopen-${name}.png`;
  await page.screenshot({ path, animations: "disabled", timeout: 5000 });
  return path;
}

async function assertMinimized(page, width, reason) {
  const launcher = page.locator(".subtitle-resume");
  await launcher.waitFor({ state: "visible" });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".subtitle-resume").length === 1 &&
      !document.querySelector(".subtitle-concierge:not(.is-minimized)"),
  );
  assert.equal(await launcher.count(), 1, `${reason}: one launcher only`);
  assert.equal(
    await launcher.getAttribute("aria-label"),
    "Expand ÉDIT conversation",
  );
  assert.equal(
    await page.locator(".subtitle-composer:visible").count(),
    0,
    `${reason}: closed composer does not remain on screen`,
  );
  assert.equal(
    await page.locator(".concierge-button:visible").count(),
    0,
    `${reason}: no competing floating launcher`,
  );
  assert.equal(
    await page.locator(".subtitle-bubble:visible").count(),
    0,
    `${reason}: closed dialogue does not remain on screen`,
  );
  const box = await launcher.boundingBox();
  assert.ok(box.width >= 44 && box.height >= 44, `${reason}: touch target`);
  assert.ok(
    box.x >= width * 0.65 &&
      box.x + box.width <= width &&
      width - box.x - box.width <= 24,
    `${reason}: visible launcher stays at the right edge (${JSON.stringify(box)})`,
  );
  assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height);
  assert.equal(
    await launcher.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit === el || el.contains(hit);
    }),
    true,
    `${reason}: launcher is actually clickable above the page/sheet`,
  );
}

async function resume(page, method = "click") {
  const launcher = page.locator(".subtitle-resume");
  if (method === "click") await launcher.click();
  else {
    await launcher.focus();
    await page.keyboard.press(method);
  }
  await page.locator(".subtitle-composer").waitFor({ state: "visible" });
  assert.equal(await launcher.count(), 0, "open dialogue replaces launcher");
}

async function clickCatalog(target) {
  // A minimal scroll can leave a small target behind fixed mobile controls.
  // Bring it to the ordinary reading area before a real pointer interaction.
  await target.evaluate((el) =>
    el.scrollIntoView({ block: "center", behavior: "instant" }),
  );
  await target.page().waitForTimeout(60);
  await target.click();
}

async function assertLiveOpening(page, waitForReveal = false) {
  if (waitForReveal)
    await page.waitForFunction(() => {
      const phrase = document.querySelector(
        ".subtitle-bubbles:not(.subtitle-history) [data-persistent-surface] .bubble-reveal-phrase",
      );
      return phrase && Number(getComputedStyle(phrase).opacity) > 0.9;
    });
  const reading = await page
    .locator(".subtitle-bubbles:not(.subtitle-history)")
    .evaluate((rail) => {
      const phrase = rail.querySelector(
        "[data-persistent-surface] .bubble-reveal-phrase",
      );
      const rect = phrase?.getClientRects()[0];
      const viewport = rail.getBoundingClientRect();
      return {
        scrollTop: rail.scrollTop,
        scrollHeight: rail.scrollHeight,
        clientHeight: rail.clientHeight,
        opening: phrase?.textContent,
        firstLineTop: rect?.top,
        firstLineBottom: rect?.bottom,
        viewportTop: viewport.top,
        viewportBottom: viewport.bottom,
      };
    });
  assert.ok(
    Math.abs(reading.scrollTop) < 1,
    `single live bubble starts at viewport top: ${JSON.stringify(reading)}`,
  );
  assert.ok(
    reading.firstLineTop >= reading.viewportTop - 1 &&
      reading.firstLineTop < reading.viewportBottom &&
      reading.firstLineBottom > reading.viewportTop,
    `opening phrase is inside visible mobile rail: ${JSON.stringify(reading)}`,
  );
  return reading;
}

async function historyText(page) {
  const history = page.getByRole("log", {
    name: "Conversation history",
    exact: true,
  });
  if (!(await history.count())) {
    await page.locator(".bubble-history-trigger").last().click();
    await history.waitFor();
  }
  return history
    .locator(".subtitle-bubble")
    .evaluateAll((lines) =>
      lines.map((line) =>
        (
          line.querySelector(".bubble-text") || line.querySelector("p")
        )?.textContent.trim(),
      ),
    );
}

async function collapseHistory(page) {
  const history = page.locator(".subtitle-history");
  if (await history.count()) {
    // The bubble's disclosure changes reading mode. The history heading's
    // close control is separately tested as a concierge-minimize action.
    await history.locator(".bubble-history-trigger").last().click();
    await history.waitFor({ state: "detached" });
  }
}

async function assertInspection(page, id, path, width) {
  const sheet = page.locator(`.modal[data-concierge-current-product="${id}"]`);
  const side = page.locator(".subtitle-concierge:not(.is-minimized)");
  const bubble = side.locator("[data-persistent-surface]");
  await sheet.waitFor();
  await page.waitForSelector(".subtitle-concierge.is-yielding");
  await page.waitForFunction(() => {
    const bubble = document.querySelector("[data-persistent-surface]");
    return (
      bubble && Math.abs(Number(getComputedStyle(bubble).opacity) - 0.5) < 0.01
    );
  });
  // Read the destination after the normal-motion position transition as well.
  await page.waitForTimeout(450);
  const panel = await side.boundingBox();
  const visual = await sheet.locator(".detail-visual").boundingBox();
  const input = await page.locator(".subtitle-composer").boundingBox();
  const diagnostics = await side.evaluate((el) => ({
    className: el.className,
    inlineStyle: el.getAttribute("style"),
    animations: el.getAnimations().map((animation) => ({
      currentTime: animation.currentTime,
      playState: animation.playState,
    })),
  }));
  console.log(
    `INSPECT ${path} ${width}px ${JSON.stringify({ panel, visual, input, modal: await sheet.boundingBox(), placement: await side.getAttribute("data-yield-placement"), ...diagnostics })}`,
  );
  assert.ok(
    separate(panel, visual),
    `${path} ${width}px: dialogue clears image; panel=${JSON.stringify(panel)} visual=${JSON.stringify(visual)}`,
  );
  assert.ok(
    separate(panel, input, 6),
    `${path} ${width}px: dialogue clears composer`,
  );
  assert.ok(
    Math.abs(input.x + input.width / 2 - width / 2) < 1,
    `${path} ${width}px: composer remains horizontally centered`,
  );
  assert.equal(
    await bubble.evaluate((el) => Number(getComputedStyle(el).opacity)),
    0.5,
    `${path}: inspection dialogue is half-transparent`,
  );
  assert.ok(panel.x >= 0 && panel.x + panel.width <= width + 1);
  return {
    path,
    id,
    opacity: 0.5,
    placement: await side.getAttribute("data-yield-placement"),
    panel,
    visual,
    input,
  };
}

async function closeProduct(page) {
  await page
    .locator(".modal[data-concierge-current-product]")
    .getByRole("button", { name: "Close / 关闭", exact: true })
    .click();
  await page
    .locator(".modal[data-concierge-current-product]")
    .waitFor({ state: "detached" });
  await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
}

async function exerciseApp(context, width, motion, result) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  page.setDefaultTimeout(8000);
  const errors = [],
    external = [],
    guideCalls = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (request.url().includes("/api/guide")) guideCalls.push(request.url());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (!["127.0.0.1", "localhost"].includes(url.hostname)) {
      external.push(url.origin);
      return route.abort();
    }
    if (url.pathname === "/api/status")
      return route.fulfill({
        json: {
          guide: "not_configured",
          analysis: "unavailable",
          scene: "unavailable",
        },
      });
    return route.continue();
  });
  await page.addInitScript(
    ({ key, state }) => {
      localStorage.setItem(key, JSON.stringify(state));
      sessionStorage.clear();
    },
    {
      key: STORAGE_KEY,
      state: { ...initialState(), onboardingStatus: "skipped", language: "en" },
    },
  );
  try {
    console.log(`CHECK real App ${width}px ${motion}`);
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".demo-setup-compose").click();
    await page.locator(".demo-setup[open]").waitFor({state:"hidden",timeout:10000});
    await page.locator(".demo-setup[open]").waitFor({ state: "hidden" });
    await exitDemoGuide(page);
    const search = page.getByRole("textbox", {
      name: "Search products or styles",
      exact: true,
    });
    await search.fill(byId("ME-001").en);
    const card = page
      .locator('.product-card[data-concierge-product="ME-001"]')
      .first();
    await card.scrollIntoViewIfNeeded();
    assert.equal(
      await page.locator(".product-card").count(),
      1,
      "exact single-product search has one result without duplicate feed rounds",
    );
    await card.locator(".product-name").focus();
    await page.locator("[data-persistent-surface]").waitFor();
    await page.mouse.move(1, 1);
    if (width < 600) {
      result.openingReading = await assertLiveOpening(page, true);
      result.openingReading.screenshot = await capture(
        page,
        `${width}-${motion}-opening`,
      );
    }

    result.inspections = [];
    for (const selector of [".product-image-button", ".product-name"]) {
      console.log(`CHECK inspection ${selector} ${width}px ${motion}`);
      await clickCatalog(card.locator(selector).first());
      result.inspections.push(
        await assertInspection(page, "ME-001", `card ${selector}`, width),
      );
      await closeProduct(page);
    }
    const cardThumb = card.locator("[data-outfit-product]").first();
    assert.ok(
      await cardThumb.count(),
      "selected product has a catalog outfit thumbnail",
    );
    const cardThumbId = await cardThumb.getAttribute("data-outfit-product");
    await clickCatalog(cardThumb);
    result.inspections.push(
      await assertInspection(
        page,
        cardThumbId,
        "catalog outfit thumbnail",
        width,
      ),
    );
    const detailThumb = page.locator(".modal [data-outfit-product]").first();
    assert.ok(
      await detailThumb.count(),
      "selected outfit piece has a detail thumbnail",
    );
    const detailThumbId = await detailThumb.getAttribute("data-outfit-product");
    await detailThumb.click();
    result.inspections.push(
      await assertInspection(
        page,
        detailThumbId,
        "detail outfit thumbnail",
        width,
      ),
    );
    await closeProduct(page);

    // A deliberate local reply gives a stable saved turn and product link.
    const input = page.getByRole("textbox", {
      name: "Reply to your guide",
      exact: true,
    });
    const message = `Tell me more about this piece. Reopen check ${width} ${motion}.`;
    await input.fill(message);
    await page
      .getByRole("button", { name: "Send subtitle reply", exact: true })
      .click();
    await page.waitForFunction(() => {
      const button = document.querySelector(
        '.subtitle-composer button[type="submit"]',
      );
      return button && button.textContent.trim() !== "· · ·";
    });
    const productLink = page.locator(".subtitle-bubble .bubble-piece").last();
    await productLink.waitFor();
    const linkedName = (await productLink.innerText())
      .replace(/\s*↗\s*$/, "")
      .trim();
    await productLink.click();
    const linkedId = await page
      .locator(".modal[data-concierge-current-product]")
      .getAttribute("data-concierge-current-product");
    assert.equal(byId(linkedId).en, linkedName);
    result.inspections.push(
      await assertInspection(page, linkedId, "bubble product link", width),
    );
    result.screenshots.push(
      await capture(page, `${width}-${motion}-inspection`),
    );
    await closeProduct(page);

    await clickCatalog(card.locator(".product-name"));
    await assertInspection(
      page,
      "ME-001",
      "owned-reference preparation",
      width,
    );
    await input.fill(
      "How does this piece pair with my fictional owned pieces?",
    );
    await page
      .getByRole("button", { name: "Send subtitle reply", exact: true })
      .click();
    await page.waitForFunction(() => {
      const button = document.querySelector(
        '.subtitle-composer button[type="submit"]',
      );
      return button && button.textContent.trim() !== "· · ·";
    });
    const ownedLink = page
      .locator(".subtitle-bubble .bubble-owned-reference button")
      .last();
    // Compact product inspection intentionally hides secondary links. Return
    // to reading mode before using the owned-product link itself.
    await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
    await page.waitForFunction(
      () =>
        !document
          .querySelector(".subtitle-concierge")
          ?.classList.contains("is-yielding"),
    );
    await ownedLink.waitFor();
    await ownedLink.click();
    const ownedId = await page
      .locator(".modal[data-concierge-current-product]")
      .getAttribute("data-concierge-current-product");
    result.inspections.push(
      await assertInspection(page, ownedId, "bubble owned-product link", width),
    );
    await closeProduct(page);

    const draft = `Unsent conversation draft ${width} ${motion}`;
    await input.fill(draft);
    const originalHistory = await historyText(page);
    assert.ok(
      originalHistory.includes(message),
      "saved history contains explicit user turn",
    );
    assert.ok(
      originalHistory[0]?.startsWith("Hello."),
      "saved history includes original greeting",
    );
    await collapseHistory(page);

    result.closes = [];
    const closers = [
      [
        "bubble X",
        () => page.locator(".bubble-dismiss").last().click(),
        "click",
      ],
      [
        "global subtitle X",
        () =>
          page
            .getByRole("button", {
              name: "Dismiss subtitle concierge",
              exact: true,
            })
            .click(),
        "Enter",
      ],
      [
        "minimize",
        () =>
          page
            .getByRole("button", { name: "Minimize subtitles", exact: true })
            .click(),
        "Space",
      ],
      [
        "Escape",
        async () => {
          await input.focus();
          await page.keyboard.press("Escape");
        },
        "Enter",
      ],
      [
        "history close",
        async () => {
          await historyText(page);
          await page.locator(".subtitle-history-heading button").click();
        },
        "click",
      ],
      [
        "history Escape",
        async () => {
          await historyText(page);
          await input.focus();
          await page.keyboard.press("Escape");
        },
        "Space",
      ],
    ];
    for (const [reason, close, method] of closers) {
      console.log(`CHECK close ${reason} ${width}px ${motion}`);
      await close();
      await assertMinimized(page, width, reason);
      // Closing is sticky across real browsing/attention signals and native
      // scrolling, not merely during the exit transition.
      await page.evaluate(() => {
        window.dispatchEvent(new Event("scroll"));
        window.dispatchEvent(new WheelEvent("wheel", { deltaY: 160 }));
        const card = document.querySelector(".product-card .product-name");
        card?.focus();
        card?.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
      });
      await page.waitForTimeout(1000);
      await assertMinimized(page, width, `${reason} after scroll/attention`);
      if (reason === "bubble X")
        result.screenshots.push(
          await capture(page, `${width}-${motion}-launcher`),
        );
      await resume(page, method);
      assert.equal(
        await input.inputValue(),
        draft,
        `${reason}: unsent draft retained`,
      );
      if (width < 600 && !(await page.locator(".subtitle-history").count()))
        await assertLiveOpening(page);
      const after = await historyText(page);
      for (const line of originalHistory)
        assert.ok(
          after.includes(line),
          `${reason}: earlier conversation turn retained`,
        );
      result.closes.push({
        reason,
        resume: method,
        historyTurns: after.length,
        draftRetained: true,
      });
      await collapseHistory(page);
    }

    // The return point must also sit above a product overlay and remain in its
    // keyboard path, rather than becoming inert behind the modal.
    await clickCatalog(card.locator(".product-name"));
    await assertInspection(
      page,
      "ME-001",
      "product-overlay close preparation",
      width,
    );
    await page.locator(".bubble-dismiss").last().click();
    await assertMinimized(page, width, "bubble X with product overlay open");
    result.screenshots.push(
      await capture(page, `${width}-${motion}-sheet-launcher`),
    );
    await resume(page, "Enter");
    assert.equal(
      await input.inputValue(),
      draft,
      "product-overlay close retains draft",
    );
    assert.ok(
      await page
        .locator('.modal[data-concierge-current-product="ME-001"]')
        .isVisible(),
      "reopening dialogue leaves the selected product open",
    );
    const overlayHistory = await historyText(page);
    for (const line of originalHistory)
      assert.ok(
        overlayHistory.includes(line),
        "product-overlay close retains transcript",
      );
    result.closes.push({
      reason: "bubble X with product overlay",
      resume: "Enter",
      draftRetained: true,
    });
    await collapseHistory(page);
    await closeProduct(page);

    const pendingMessage = `What occasion suits this piece? Pending reply ${width} ${motion}.`;
    await input.fill(pendingMessage);
    await page
      .getByRole("button", { name: "Send subtitle reply", exact: true })
      .click();
    // Close inside the local reply's 320ms completion window.
    await page
      .getByRole("button", { name: "Dismiss subtitle concierge", exact: true })
      .click();
    await assertMinimized(page, width, "reply completes while closed");
    await page.waitForTimeout(1000);
    await assertMinimized(page, width, "completed reply must not auto-expand");
    await resume(page, "click");
    const completedHistory = await historyText(page);
    const pendingIndex = completedHistory.indexOf(pendingMessage);
    assert.ok(
      pendingIndex >= originalHistory.length,
      "closed conversation retains newly sent user turn",
    );
    assert.ok(
      completedHistory[pendingIndex + 1],
      "requested assistant reply finishes into history while closed",
    );
    await collapseHistory(page);
    await input.fill(draft);
    result.pendingLocalReply = {
      stayedMinimized: true,
      userTurn: pendingIndex,
      assistantRetained: true,
    };

    await page
      .getByRole("button", { name: "Conversation", exact: true })
      .click();
    const drawer = page.getByRole("dialog", {
      name: "Your private guide.",
      exact: true,
    });
    await drawer.waitFor();
    assert.ok(
      (await drawer.innerText()).includes(message),
      "full guide shares same transcript",
    );
    const drawerDraft = drawer.getByRole("textbox", {
      name: "Tell your guide what you need",
      exact: true,
    });
    assert.equal(
      await drawerDraft.inputValue(),
      draft,
      "drawer shares unsent draft",
    );
    for (const method of ["X", "Escape"]) {
      const scrollTop = await drawer.locator(".guide-chat").evaluate((el) => {
        el.scrollTop = Math.min(100, el.scrollHeight - el.clientHeight);
        return el.scrollTop;
      });
      if (method === "X")
        await drawer
          .getByRole("button", { name: "Close / 关闭", exact: true })
          .click();
      else {
        await drawerDraft.focus();
        await page.keyboard.press("Escape");
      }
      await drawer.waitFor({ state: "detached" });
      await assertMinimized(page, width, `full guide drawer ${method}`);
      await page.evaluate(() => window.dispatchEvent(new Event("scroll")));
      await page.waitForTimeout(1000);
      await assertMinimized(
        page,
        width,
        `full guide drawer ${method} after scroll`,
      );
      await page.locator(".subtitle-resume").focus();
      await page.keyboard.press(method === "X" ? "Enter" : "Space");
      await drawer.waitFor();
      assert.equal(
        await drawerDraft.inputValue(),
        draft,
        `drawer ${method}: shared draft retained`,
      );
      const afterScroll = await drawer
        .locator(".guide-chat")
        .evaluate((el) => el.scrollTop);
      assert.ok(
        Math.abs(afterScroll - scrollTop) <= 1,
        `drawer ${method}: reading position retained`,
      );
      assert.ok(
        (await drawer.innerText()).includes(message),
        `drawer ${method}: same conversation reopened`,
      );
      result.closes.push({
        reason: `full guide drawer ${method}`,
        resume: method === "X" ? "Enter" : "Space",
        draftRetained: true,
        scrollTop,
      });
    }
    await drawer
      .getByRole("button", { name: "Continue in subtitles", exact: true })
      .click();
    await input.waitFor();
    assert.equal(
      await input.inputValue(),
      draft,
      "full guide drawer close retains shared draft",
    );
    const finalHistory = await historyText(page);
    for (const line of originalHistory)
      assert.ok(
        finalHistory.includes(line),
        "drawer close retains earlier history",
      );
    result.screenshots.push(
      await capture(page, `${width}-${motion}-resumed-history`),
    );
    assert.deepEqual(errors, [], "no browser page errors");
    assert.deepEqual(
      guideCalls,
      [],
      "no external guide call for local close/resume",
    );
    result.blockedExternalOrigins = [...new Set(external)];
  } catch (error) {
    console.error(`App case error ${width}px ${motion}: ${error.stack}`);
    result.screenshots.push(
      await capture(page, `${width}-${motion}-failure`).catch(() => null),
    );
    throw error;
  } finally {
    await page.close();
  }
}

async function exerciseIncoming(context, width, motion, result) {
  const page = await context.newPage();
  await page.setViewportSize({ width, height: width < 600 ? 844 : 1000 });
  await page.emulateMedia({ reducedMotion: motion });
  page.setDefaultTimeout(8000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/tests/fixtures/bubble-history.html`, {
      waitUntil: "networkidle",
    });
    const input = page.getByRole("textbox", {
      name: "Reply to your guide",
      exact: true,
    });
    await input.fill("Fixture draft survives incoming messages");
    const before = await page.evaluate(() => window.getHistoryCount());
    await page
      .getByRole("button", { name: "Minimize subtitles", exact: true })
      .click();
    await assertMinimized(page, width, "incoming-message setup");
    await page.evaluate(() => {
      window.appendHistoryTurn();
      window.dispatchEvent(new Event("scroll"));
      window.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    });
    await page.waitForFunction(
      (count) => window.getHistoryCount() === count + 1,
      before,
    );
    await page.waitForTimeout(1000);
    await assertMinimized(
      page,
      width,
      "new incoming message must not auto-expand",
    );
    await resume(page, "Space");
    assert.equal(
      await input.inputValue(),
      "Fixture draft survives incoming messages",
    );
    const lines = await historyText(page);
    assert.equal(lines.length, before + 1);
    assert.ok(lines.includes(`New guide reply ${before + 1}.`));
    assert.ok(lines.includes("Current guide reply."));
    assert.deepEqual(errors, []);
    result.incomingMessage = {
      stayedMinimized: true,
      originalTurns: before,
      resumedTurns: lines.length,
      draftRetained: true,
    };
  } finally {
    await page.close();
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
      "--strictPort",
    ],
    { cwd: root, stdio: "ignore" },
  );
  for (let attempt = 0; ; attempt++) {
    if (
      await fetch(base)
        .then((response) => response.ok)
        .catch(() => false)
    )
      break;
    if (attempt > 100) throw Error("Vite did not start");
    await sleep(50);
  }
  browser = await chromium.launch({
    timeout: 30000,
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: [...headless.args, "--disable-gpu"],
    env: { ...process.env, HOME: "/tmp" },
  });
  // The bundled serverless Chromium uses --single-process; keep one context
  // while isolating every case in a fresh page with reset browser storage.
  const context = await browser.newContext();
  for (const motion of motions) {
    for (const width of widths) {
      const result = { width, motion, status: "running", screenshots: [] };
      results.push(result);
      try {
        await exerciseApp(context, width, motion, result);
        await exerciseIncoming(context, width, motion, result);
        result.status = "pass";
        console.log(
          `PASS concierge product-open paths, nine close contexts, click/Enter/Space resume, sticky minimization, retained draft/history and incoming message ${width}px ${motion}`,
        );
      } catch (error) {
        result.status = "fail";
        result.error = error.stack;
        console.error(
          `FAIL concierge close/reopen ${width}px ${motion}\n${error.stack}`,
        );
      } finally {
        result.screenshots = result.screenshots.filter(Boolean);
        await writeFile(resultsPath, JSON.stringify(results, null, 2));
      }
    }
  }
  assert.ok(
    results.every((result) => result.status === "pass"),
    "all concierge reopen configurations pass",
  );
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
