import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";
import { initialState, STORAGE_KEY, byId, makeBooking } from "../src/data.js";
import { tryListVariant } from "../src/try-list.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.env.E2E_PORT || 4336),
  base = process.env.E2E_BASE_URL || `http://127.0.0.1:${port}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let server, browser;
async function capture(page, name) {
  const cdp = await page.context().newCDPSession(page);
  try {
    const { data } = await cdp.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(
      `${root}/artifacts/${name}.png`,
      Buffer.from(data, "base64"),
    );
  } finally {
    await cdp.detach();
  }
}
try {
  await mkdir(`${root}/artifacts`, { recursive: true });
  if (!process.env.E2E_BASE_URL)
    server = spawn(
      process.execPath,
      [
        "node_modules/vite/bin/vite.js",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
      { cwd: root, stdio: "ignore" },
    );
  for (let i = 0; ; i++) {
    if (
      await fetch(base)
        .then((r) => r.ok)
        .catch(() => false)
    )
      break;
    if (i > 100) throw Error("Vite did not start");
    await sleep(100);
  }
  for (const mode of [
    "empty-desktop",
    "empty-phone",
    "empty-phone-320",
    "booked-desktop",
  ]) {
    browser = await chromium.launch({
      executablePath: await headless.executablePath(),
      headless: true,
      args: headless.args,
      env: { ...process.env, HOME: "/tmp" },
    });
    const width = mode.endsWith("320")
        ? 320
        : mode.includes("phone")
          ? 390
          : 1440,
      context = await browser.newContext({
        viewport: { width, height: width < 600 ? 844 : 1000 },
        reducedMotion: "reduce",
      }),
      page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const state = initialState();
    state.soundMuted = true;
    state.language = "zh";
    if (mode === "booked-desktop") {
      const item = byId("ME-015");
      const line = {
        lineId: "qa-booking-item",
        skuId: item.id,
        ...tryListVariant(item, state.profile),
        quantity: 1,
        color: item.color,
        preparation: {
          status: "ready",
          acknowledgedAt: "2026-10-16T12:00:00.000Z",
        },
      };
      state.bookings = [
        makeBooking([line], {
          date: "2026-10-20",
          time: "14:30",
          name: "演示顾客",
          sharedFields: { name: true, items: true, dateTime: true },
        }),
      ];
    }
    await page.addInitScript(
      ({ key, state }) => {
        localStorage.setItem(key, JSON.stringify(state));
        localStorage.setItem("maison-edit-swap-help-v1", "seen");
        sessionStorage.setItem(
          "maison-edit-guided-case:warm-everyday",
          "exited",
        );
        sessionStorage.setItem("maison-edit-guided-case:quiet-city", "exited");
      },
      { key: STORAGE_KEY, state },
    );
    await page.goto(base, { waitUntil: "networkidle" });
    await page.locator(".demo-setup-compose").click();
    await page
      .locator(".demo-setup")
      .waitFor({ state: "detached", timeout: 10000 });
    const possibleExit = page
      .locator(".guided-demo-panel .guided-exit,.scene-swap-help .text-link")
      .first();
    if (await possibleExit.isVisible().catch(() => false))
      await possibleExit.click();
    if (width < 600)
      await page.getByRole("button", { name: "打开导航", exact: true }).click();
    await page
      .locator("#primary-navigation")
      .getByRole("button", { name: "到店之旅", exact: true })
      .click();
    await page.locator("[data-visit-showcase]").waitFor();
    const snapshot = async () =>
      page.evaluate((key) => {
        const s = JSON.parse(localStorage.getItem(key));
        return {
          cart: s.cart,
          bookings: s.bookings,
          history: s.purchaseHistory,
        };
      }, STORAGE_KEY);
    const before = await snapshot();
    assert.equal(
      await page
        .locator("[data-visit-source]")
        .getAttribute("data-visit-source"),
      mode === "booked-desktop" ? "booking" : "recommended",
    );
    assert.equal(await page.locator(".visit-page .empty-state").count(), 0);
    const dock = page.locator(
      ".visit-companion-host .subtitle-concierge.is-inline:not(.is-minimized)",
    );
    await dock.waitFor();
    const layout = await page.evaluate(() => {
      const box = (selector) => {
        const r = document.querySelector(selector).getBoundingClientRect();
        return { x: r.x, y: r.y, right: r.right, bottom: r.bottom };
      };
      const input = document.querySelector(
        ".visit-companion-host .subtitle-composer input",
      );
      const rect = input.getBoundingClientRect();
      return {
        dock: box(".visit-companion-host .subtitle-concierge"),
        composer: box(".visit-companion-host .subtitle-composer"),
        hero: box(".vj-hero"),
        inputUsable:
          document.elementFromPoint(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
          ) === input,
      };
    });
    assert.ok(
      layout.dock.bottom <= layout.hero.y,
      "inline dock must not overlap hero",
    );
    assert.ok(
      layout.composer.bottom <= layout.hero.y,
      "inline composer must not overlap hero",
    );
    assert.equal(
      layout.inputUsable,
      true,
      "inline input is the hit target at its visible center",
    );
    const dockInput = dock.locator(".subtitle-composer input");
    await dockInput.fill("查看行程");
    assert.equal(await dockInput.inputValue(), "查看行程");
    await dockInput.fill("");
    await page
      .getByRole("button", { name: "关闭字幕陪伴", exact: true })
      .click();
    await page.locator(".visit-companion-host .is-minimized").waitFor();
    await page.locator(".vj-edit").scrollIntoViewIfNeeded();
    await page.waitForTimeout(250);
    assert.equal(await dock.count(), 0, "close stays closed while scrolling");
    await page
      .getByRole("button", { name: "展开 ÉDIT 对话", exact: true })
      .click();
    await dock.waitFor();
    await dockInput.fill("继续浏览");
    assert.equal(await dockInput.inputValue(), "继续浏览");
    await dockInput.fill("");
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `visit-app-${mode}-hero-dock-active`);
    await capture(page, `visit-app-${mode}-hero`);
    const checkHeroCta = async (phase) => {
      const checks = await page
        .locator(".vj-hero-actions button")
        .evaluateAll((buttons) =>
          buttons.map((button) => {
            const rect = button.getBoundingClientRect();
            const x = rect.x + rect.width / 2,
              y = rect.y + rect.height / 2;
            const inViewport =
              x >= 0 && x < innerWidth && y >= 0 && y < innerHeight;
            const utilities = [
              ...document.querySelectorAll(
                ".case-switch-button,.floating-tools",
              ),
            ].map((el) => el.getBoundingClientRect());
            return {
              name: button.textContent.trim(),
              inViewport,
              clickable:
                !inViewport ||
                document.elementFromPoint(x, y)?.closest("button") === button,
              noUtilityOverlap: utilities.every(
                (other) =>
                  rect.right <= other.left ||
                  rect.left >= other.right ||
                  rect.bottom <= other.top ||
                  rect.top >= other.bottom,
              ),
            };
          }),
        );
      for (const check of checks) {
        assert.equal(
          check.clickable,
          true,
          `${phase} ${check.name} center hit`,
        );
        assert.equal(
          check.noUtilityOverlap,
          true,
          `${phase} ${check.name} clear of case/music`,
        );
      }
      return checks;
    };
    const initialHeroCta = await checkHeroCta("initial");
    for (const cta of await page.locator(".vj-hero-actions button").all()) {
      await cta.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await checkHeroCta("scrolled");
    }
    await capture(page, `visit-app-${mode}-hero-cta-clear`);
    await page.locator(".vj-hero-actions .vj-primary").click();
    assert.ok(
      Math.abs(
        await page
          .locator("#vj-itinerary")
          .evaluate((el) => el.getBoundingClientRect().top),
      ) <= 40,
      "hero CTA reaches itinerary",
    );
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - innerWidth,
    );
    assert.ok(overflow <= 0, `overflow ${overflow}`);
    await page.locator('[data-visit-stop="wardrobe"]').click();
    await page.locator(".vj-stop-products>button").first().click();
    await page.locator(".vj-product-dialog[open]").waitFor();
    await page.keyboard.press("Escape");
    await page
      .locator(".vj-product-dialog[open]")
      .waitFor({ state: "detached" });
    await page.locator(".vj-stop-products>button").first().click();
    await page
      .getByRole("button", { name: "查看完整目录详情", exact: true })
      .click();
    await page.locator(".product-detail").waitFor();
    await page.keyboard.press("Escape");
    await page.locator(".product-detail").waitFor({ state: "detached" });
    await dock.waitFor();
    await page.evaluate(() => scrollTo(0, 0));
    await capture(page, `visit-app-${mode}-hero-dock-active`);
    await page.locator("#vj-itinerary").scrollIntoViewIfNeeded();
    await capture(page, `visit-app-${mode}-itinerary`);
    assert.deepEqual(
      await snapshot(),
      before,
      "viewing the showcase never mutates customer cart, booking, history",
    );
    if (mode === "booked-desktop") {
      await page
        .getByRole("button", { name: "查看演示预约", exact: true })
        .click();
      assert.equal(await page.locator(".booking-form").count(), 0);
      assert.ok(await page.locator(".visit-bookings .booking-card").count());
      await capture(page, `visit-app-${mode}-saved-booking`);
      await page
        .getByRole("button", { name: "取消演示预约", exact: true })
        .click();
      assert.equal((await snapshot()).bookings[0].status, "cancelled");
      assert.equal(
        await page
          .locator("[data-visit-source]")
          .getAttribute("data-visit-source"),
        "recommended",
      );
    }
    assert.deepEqual(errors, []);
    results.push({
      mode,
      status: "pass",
      width,
      heroCta: {
        initial: initialHeroCta,
        scrolledHitTest: true,
        clearOfUtilities: true,
      },
      inlineCompanion: {
        nonOverlapping: true,
        inputHitTest: true,
        closePersists: true,
        reopenUsable: true,
      },
    });
    console.log(`PASS actual app ${mode}`);
    await browser.close();
    browser = null;
  }
  await writeFile(
    `${root}/artifacts/visit-journey-app-e2e.json`,
    JSON.stringify(results, null, 2),
  );
} finally {
  await browser?.close();
  server?.kill();
}
