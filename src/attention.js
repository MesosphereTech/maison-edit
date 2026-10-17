// Local interaction signals, never gaze tracking, camera or microphone input.
export const ATTENTION_SETTLE_MS = 0;
export const POINTER_INTENT_MS = 32;
export const ATTENTION_VISIBLE_RATIO = 0.14;

export function targetVisual(element) {
  return element?.querySelector?.(".product-visual,.detail-visual") || element;
}
export function attentionScore(rect, viewport, headerBottom = 0) {
  headerBottom = Math.max(0, Math.min(headerBottom, viewport.height - 1));
  const top = Math.max(headerBottom, rect.top),
    bottom = Math.min(viewport.height, rect.bottom);
  const left = Math.max(0, rect.left),
    right = Math.min(viewport.width, rect.right);
  if (bottom <= top || right <= left || !rect.width || !rect.height)
    return -Infinity;
  const coverage =
    ((bottom - top) * (right - left)) /
    (Math.min(rect.width, viewport.width) *
      Math.min(rect.height, viewport.height - headerBottom));
  if (coverage < ATTENTION_VISIBLE_RATIO) return -Infinity;
  const cx = (left + right) / 2,
    cy = (top + bottom) / 2;
  const dx = (cx - viewport.width * 0.5) / viewport.width;
  const dy =
    (cy - (headerBottom + (viewport.height - headerBottom) * 0.48)) /
    (viewport.height - headerBottom);
  return coverage * 0.28 - Math.hypot(dx * 1.1, dy * 1.5);
}
export function hottestTarget(elements, viewport, headerBottom = 0) {
  return (
    elements
      .map((element) => ({
        element,
        score: attentionScore(
          targetVisual(element).getBoundingClientRect(),
          viewport,
          headerBottom,
        ),
      }))
      .filter(({ score }) => Number.isFinite(score))
      .sort((a, b) => b.score - a.score)[0]?.element || null
  );
}
export function targetIdentity(element) {
  return (
    element?.dataset.conciergeOccurrence ||
    element?.dataset.conciergeProduct ||
    element?.dataset.conciergeCurrentProduct ||
    element?.dataset.conciergeSection ||
    null
  );
}
export function targetRect(element) {
  if (!element?.isConnected) return null;
  const visual = targetVisual(element);
  const r = visual.getBoundingClientRect();
  const header = element.closest(".modal")
    ? 0
    : document.querySelector(".site-header")?.getBoundingClientRect().bottom ||
      0;
  const left = Math.max(3, r.left),
    top = Math.max(3, header + 3, r.top);
  const right = Math.min(window.innerWidth - 3, r.right),
    bottom = Math.min(window.innerHeight - 3, r.bottom);
  return right > left && bottom > top
    ? { left, top, width: right - left, height: bottom - top }
    : null;
}

export function sourceIdentity(source) {
  return source?.occurrenceId || source?.productId || source?.section || null;
}
