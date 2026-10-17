// Desktop readability, breakpoint isolation and expanded-history rail.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import headless from "@sparticuz/chromium";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = "http://127.0.0.1:4197";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let server, browser, previous;
try {
  server = spawn(
    process.execPath,
    [
      "node_modules/vite/bin/vite.js",
      "--host",
      "127.0.0.1",
      "--port",
      "4197",
      "--strictPort",
    ],
    { cwd: root, stdio: "ignore" },
  );
  for (
    let attempt = 0;
    !(await fetch(base)
      .then((r) => r.ok)
      .catch(() => false));
    attempt++
  ) {
    if (attempt > 100) throw Error("Vite did not start");
    await sleep(50);
  }
  browser = await chromium.launch({
    executablePath:
      process.env.E2E_CHROMIUM_PATH || (await headless.executablePath()),
    headless: true,
    args: headless.args,
    env: { ...process.env, HOME: "/tmp" },
  });
  const context = await browser.newContext({ reducedMotion: "reduce" });
  for (const width of [320, 390, 900, 1023, 1024, 1440]) {
    const page = await context.newPage();
    await previous?.close();
    previous = page;
    const desktop = width >= 1024;
    await page.setViewportSize({ width, height: desktop ? 768 : 844 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/tests/fixtures/bubble-history.html`, {
      waitUntil: "networkidle",
    });
    const side = page.locator(".subtitle-concierge");
    const composer = page.locator(".subtitle-composer");
    const input = page.getByRole("textbox", {
      name: "Reply to your guide",
      exact: true,
    });
    const metrics = await side.evaluate((el) => {
      const form = el.querySelector(".subtitle-composer"),
        text = el.querySelector(".bubble-text"),
        bubble = el.querySelector(".subtitle-bubble");
      return {
        width: el.getBoundingClientRect().width,
        composerWidth: form.getBoundingClientRect().width,
        composerHeight: form.getBoundingClientRect().height,
        font: getComputedStyle(text).fontSize,
        inputFont: getComputedStyle(form.querySelector("input")).fontSize,
        fill: getComputedStyle(bubble).getPropertyValue("--bubble-fill").trim(),
        background: getComputedStyle(el).backgroundColor,
        pointers: getComputedStyle(el).pointerEvents,
      };
    });
    assert.equal(
      metrics.width,
      desktop ? 392 : width <= 360 ? 198 : width <= 580 ? 218 : 292,
    );
    assert.equal(
      metrics.composerWidth,
      desktop ? 600 : Math.min(420, width - 40),
    );
    assert.equal(metrics.composerHeight, desktop ? 60 : 44);
    assert.equal(
      metrics.font,
      desktop ? "18px" : width <= 580 ? "14px" : "15px",
    );
    assert.equal(
      metrics.inputFont,
      desktop ? "18px" : width <= 580 ? "16px" : "11px",
    );
    assert.equal(metrics.fill, desktop ? "#f8f4ecf5" : "#f8f4ecc9");
    assert.equal(metrics.background, "rgba(0, 0, 0, 0)");
    assert.equal(metrics.pointers, "none");
    for (const target of [side, composer]) {
      const box = await target.boundingBox();
      assert.ok(
        Math.abs(box.x + box.width / 2 - width / 2) <= 1,
        "both surfaces share the viewport centerline",
      );
    }
    await page.evaluate(() => {
      document.documentElement.lang = "zh-CN";
    });
    assert.equal(
      await page
        .locator(".bubble-text")
        .evaluate((el) => getComputedStyle(el).fontSize),
      desktop ? "18px" : width <= 580 ? "12px" : "13px",
    );
    await side.evaluate((el) => el.classList.add("is-scrolling"));
    assert.equal(
      await composer.evaluate((el) => getComputedStyle(el).opacity),
      desktop ? "1" : "0.78",
    );
    const scrollFill = await page
      .locator(".subtitle-bubble")
      .evaluate((el) =>
        getComputedStyle(el).getPropertyValue("--bubble-fill").trim(),
      );
    assert.equal(scrollFill, desktop ? "#f8f4ecf5" : "#faf8f3a8");
    await side.evaluate((el) => el.classList.remove("is-scrolling"));
    await input.fill("A thought");
    if (desktop)
      assert.equal(
        await composer.evaluate((el) => getComputedStyle(el).borderColor),
        "rgb(84, 43, 53)",
        "focus keeps strong shell contrast",
      );
    await page
      .getByRole("button", { name: "Show conversation history", exact: true })
      .click();
    const history = page.getByRole("log", {
      name: "Conversation history",
      exact: true,
    });
    await history.waitFor();
    const historyBox = await history.boundingBox();
    assert.ok(
      historyBox.height <= (desktop ? 420 : width <= 580 ? 300 : 390) + 1,
      "history remains bounded",
    );
    if (desktop) {
      await page.waitForTimeout(80);
      assert.ok(
        (await side.boundingBox()).y >= 15,
        "expanded desktop heading stays inside the viewport",
      );
      assert.equal(
        await history
          .locator(".bubble-text")
          .evaluate((el) => getComputedStyle(el).fontSize),
        "16px",
      );
      assert.equal(
        await history.evaluate((el) => getComputedStyle(el).backgroundColor),
        "rgba(0, 0, 0, 0)",
        "history gaps remain transparent",
      );
    }
    assert.deepEqual(errors, []);
    console.log(
      `PASS desktop readability / unchanged compact breakpoint ${width}px`,
    );
  }
} finally {
  await browser?.close();
  server?.kill("SIGTERM");
}
