// Shared contracts for the hands-on guide. These events only reveal and measure
// existing UI; they never click a product, add an item, or submit a booking.
export const GUIDED_RESET_EVENT = "maison:guided-reset";
export const JOURNEY_REQUEST_EVENT = "maison:journey-request";
export const JOURNEY_READY_EVENT = "maison:journey-ready";
export const JOURNEY_RELEASE_EVENT = "maison:journey-release";
export const JOURNEY_PROGRESS_EVENT = "maison:journey-progress";
export const JOURNEY_STORAGE_PREFIX = "maison-edit-eight-piece-journey:v1:";
export const JOURNEY_PRODUCT_COUNT = 8;
export const MEANINGFUL_VIEW_MS = 550;

export function journeyKey(caseId) {
  return `${JOURNEY_STORAGE_PREFIX}${caseId}`;
}
export function restoreJourney(value) {
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    const seen = [
      ...new Set(
        (parsed?.seen || []).filter((id) => typeof id === "string" && id),
      ),
    ].slice(0, JOURNEY_PRODUCT_COUNT);
    const terminal = ["completed", "exited"].includes(parsed?.status)
      ? parsed.status
      : null;
    return {
      seen,
      status:
        terminal ||
        (seen.length >= JOURNEY_PRODUCT_COUNT ? "pending" : "browsing"),
      afterPosition: Number.isFinite(parsed?.afterPosition)
        ? parsed.afterPosition
        : -1,
    };
  } catch {
    return { seen: [], status: "browsing", afterPosition: -1 };
  }
}
export function recordViewedProduct(progress, sku, position) {
  if (progress.status !== "browsing" || !sku || progress.seen.includes(sku))
    return progress;
  const seen = [...progress.seen, sku].slice(0, JOURNEY_PRODUCT_COUNT);
  return {
    seen,
    afterPosition: Math.max(
      progress.afterPosition,
      Number.isFinite(position) ? position : -1,
    ),
    status: seen.length >= JOURNEY_PRODUCT_COUNT ? "pending" : "browsing",
  };
}
export function meaningfulProductRect(rect, viewport, headerBottom = 0) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return false;
  const height =
    Math.min(rect.bottom, viewport.height) - Math.max(rect.top, headerBottom);
  const width = Math.min(rect.right, viewport.width) - Math.max(rect.left, 0);
  return (
    height >= Math.min(170, rect.height * 0.48) && width >= rect.width * 0.72
  );
}
export function nextFeedPausePosition(feedLength, afterPosition = -1) {
  if (!feedLength) return null;
  const block = feedLength * Math.max(1, Math.ceil(18 / feedLength)) + 1;
  return (
    Math.max(0, Math.floor((Math.max(-1, afterPosition) + 1) / block)) * block +
    block -
    1
  );
}
export function journeyEase(progress) {
  const p = Math.max(0, Math.min(1, progress));
  return p * p * (3 - 2 * p);
}
export function guidanceInteractionBlocked({ allowGuidedMask = false } = {}) {
  if (typeof document === "undefined") return false;
  if (document.visibilityState === "hidden") return true;
  const visible = (node) =>
    node.getClientRects().length &&
    getComputedStyle(node).visibility !== "hidden";
  if (
    [
      ...document.querySelectorAll(
        ".overlay, dialog[open], .demo-setup[open], .subtitle-concierge.is-history-expanded",
      ),
    ].some(visible)
  )
    return true;
  if (!allowGuidedMask && document.querySelector(".guided-click-mask"))
    return true;
  const focused = document.activeElement;
  if (focused?.matches('input, textarea, select, [contenteditable="true"]'))
    return true;
  // Preserve an unfinished conversation even after its field loses focus.
  return [
    ...document.querySelectorAll(
      ".subtitle-composer input, .subtitle-composer textarea, .guide-input input, .guide-input textarea",
    ),
  ].some((node) => Boolean(node.value?.trim()));
}
