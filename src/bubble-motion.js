// The live companion has one durable surface. Only an explicit dismissal or
// minimization retires it; attention, navigation and elapsed time change copy.
export const BUBBLE_EXIT_MS = 360;
export function retireBubbles(
  bubbles,
  matches = () => true,
  reason = "dismiss",
  now = Date.now(),
) {
  return bubbles.map((bubble) =>
    !bubble.retiring && matches(bubble)
      ? { ...bubble, retiring: true, exitAt: now, exitReason: reason }
      : bubble,
  );
}
export function replaceBubble(bubbles, next) {
  return [{ ...next, remaining: Infinity, surfaceKey: "concierge-live" }];
}
export function advanceBubbles(bubbles, { now, exitMs = BUBBLE_EXIT_MS }) {
  const next = bubbles.filter(
    (bubble) => !bubble.retiring || now - bubble.exitAt < exitMs,
  );
  // Keep the reference unchanged on the steady-state timer. Nothing ages.
  return next.length === bubbles.length ? bubbles : next;
}

// Phrase-sized fades preserve every original character and reserve the final
// line layout, avoiding a typing cursor or a jumping, growing paragraph.
export function revealPhrases(value = "") {
  const text = String(value);
  const cjk = /[\u3400-\u9fff]/u.test(text);
  const limit = cjk ? 13 : 30;
  const tokens = cjk ? Array.from(text) : text.match(/\S+\s*|\s+/gu) || [];
  const phrases = [];
  let phrase = "";
  for (const token of tokens) {
    if (phrase && phrase.length + token.length > limit) {
      phrases.push(phrase);
      phrase = "";
    }
    phrase += token;
    if (/[.!?;。！？；，,]\s*$/u.test(phrase) && phrase.trim().length > 5) {
      phrases.push(phrase);
      phrase = "";
    }
  }
  if (phrase) phrases.push(phrase);
  return phrases.length ? phrases : [text];
}

export function placementOverlap(a, b, gap = 8) {
  return (
    a.left < b.right + gap &&
    a.right > b.left - gap &&
    a.top < b.bottom + gap &&
    a.bottom > b.top - gap
  );
}

// Find a real empty rectangle, rather than moving the companion over another
// product. Candidate edges come from the content, not arbitrary left/right lanes.
export function findBlankPlacement({
  width,
  height,
  panelWidth,
  panelHeight,
  obstacles = [],
  preferred,
  top = 12,
  bottom = height - 12,
  margin = 12,
}) {
  const maxX = width - panelWidth - margin;
  const maxY = Math.min(height - margin, bottom) - panelHeight;
  if (maxX < margin || maxY < top) return null;
  const clampX = (x) => Math.round(Math.max(margin, Math.min(maxX, x)));
  const clampY = (y) => Math.round(Math.max(top, Math.min(maxY, y)));
  const xs = [
    ...new Set(
      [
        preferred.left,
        margin,
        maxX,
        ...obstacles.flatMap((r) => [r.left - panelWidth - 9, r.right + 9]),
      ].map(clampX),
    ),
  ];
  const ys = [
    ...new Set(
      [
        preferred.top,
        top,
        maxY,
        ...obstacles.flatMap((r) => [r.top - panelHeight - 9, r.bottom + 9]),
      ].map(clampY),
    ),
  ];
  const candidates = xs.flatMap((left) =>
    ys.map((y) => ({
      left,
      top: y,
      right: left + panelWidth,
      bottom: y + panelHeight,
    })),
  );
  candidates.sort(
    (a, b) =>
      Math.hypot(a.left - preferred.left, a.top - preferred.top) -
      Math.hypot(b.left - preferred.left, b.top - preferred.top),
  );
  return (
    candidates.find((candidate) =>
      obstacles.every((obstacle) => !placementOverlap(candidate, obstacle)),
    ) || null
  );
}
