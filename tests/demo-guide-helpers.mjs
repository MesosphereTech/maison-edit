// Unrelated regression suites explicitly leave the optional hands-on tour.
// The dedicated revision suite tests every real guided click and exit path.
export async function exitDemoGuide(page) {
  const exit = page
    .locator(
      ".scene-swap-tutorial .scene-tutorial-dismiss,.scene-swap-help .text-link,.guided-demo-panel .guided-exit",
    )
    .first();
  try {
    await exit.waitFor({ state: "visible", timeout: 800 });
  } catch {
    return;
  }
  await exit.click();
  await page.locator(".guided-click-mask").waitFor({ state: "detached" });
}
