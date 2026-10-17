import { ATTENTION_VISIBLE_RATIO, targetVisual } from "./attention.js";

// Geometry is checked again at delivery, so an old observer entry cannot speak
// about a piece the visitor has already passed. Tall cards can still qualify.
export function visibleTargetRatio(rect, viewport, headerBottom = 0) {
  if (!rect.width || !rect.height) return 0;
  headerBottom = Math.max(0, Math.min(headerBottom, viewport.height - 1));
  const height = Math.max(
    0,
    Math.min(rect.bottom, viewport.height) - Math.max(rect.top, headerBottom),
  );
  const width = Math.max(
    0,
    Math.min(rect.right, viewport.width) - Math.max(rect.left, 0),
  );
  return (
    (height * width) /
    (Math.min(rect.height, viewport.height - headerBottom) *
      Math.min(rect.width, viewport.width))
  );
}

export function targetIsVisible(element, minimum = ATTENTION_VISIBLE_RATIO) {
  if (
    !element?.isConnected ||
    element.closest('[hidden], [aria-hidden="true"]')
  )
    return false;
  const header = element.closest(".modal")
    ? 0
    : document.querySelector(".site-header")?.getBoundingClientRect().bottom ||
      0;
  return (
    visibleTargetRatio(
      targetVisual(element).getBoundingClientRect(),
      { width: window.innerWidth, height: window.innerHeight },
      header,
    ) >= minimum
  );
}

export function conciergeTargets(message) {
  const source = message?.source;
  const ids = source?.productId
    ? [source.productId]
    : message?.productIds || [];
  const targets = [
    ...document.querySelectorAll(
      "[data-concierge-product], [data-concierge-products], [data-concierge-current-product], [data-concierge-section]",
    ),
  ];
  // The active sheet takes precedence over the feed behind its backdrop.
  const sheet = document.querySelector(
    ".modal[data-concierge-current-product]",
  );
  if (sheet)
    return ids.includes(sheet.dataset.conciergeCurrentProduct) &&
      targetIsVisible(sheet, 0.1)
      ? [sheet]
      : [];
  const matches = targets.filter((element) => {
    if (
      source?.occurrenceId &&
      element.dataset.conciergeOccurrence !== source.occurrenceId
    )
      return false;
    const matches = source?.section
      ? element.dataset.conciergeSection === source.section
      : ids.some(
          (id) =>
            element.dataset.conciergeProduct === id ||
            element.dataset.conciergeProducts?.split(" ").includes(id),
        );
    return matches && targetIsVisible(element);
  });
  const direct = matches.filter((el) =>
    ids.includes(el.dataset.conciergeProduct),
  );
  return source?.productId && direct.length ? direct : matches;
}

export const visualIsCurrent = (message) =>
  !(message?.source?.passive || message?.source?.contextual) ||
  conciergeTargets(message).length > 0;
