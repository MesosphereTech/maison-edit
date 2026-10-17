// Content appears immediately. These timings only pace its decorative
// product contour, pixel handoff and arrival accent.
export const ATTENTION_LAP_MS = 560;
export const PARTICLE_FLIGHT_MS = 420;
export const PARTICLE_STAGGER_MS = 9;
export const PARTICLE_COUNT = 19;
export const ARRIVAL_PULSE_MS = 320;
export const ARRIVAL_TEXT_DELAY_MS = 0;

const center = (rect) => ({
  x: rect.left + rect.width / 2,
  y: rect.top + rect.height / 2,
});

export function attentionRoute(source, destination, { avoid = [] } = {}) {
  const startCenter = center(source);
  const endCenter = center(destination);
  const inside = (point, rect, padding = 0) =>
    point.x > rect.left - padding &&
    point.x < rect.left + rect.width + padding &&
    point.y > rect.top - padding &&
    point.y < rect.top + rect.height + padding;
  const boundary = (rect, toward, inset = 0) => {
    const middle = center(rect);
    const dx = toward.x - middle.x;
    const dy = toward.y - middle.y;
    const scale = Math.min(
      (rect.width / 2 - inset) / Math.max(0.01, Math.abs(dx)),
      (rect.height / 2 - inset) / Math.max(0.01, Math.abs(dy)),
    );
    return { x: middle.x + dx * scale, y: middle.y + dy * scale };
  };
  const curve = (start, end, direction = 1) => {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const distance = Math.hypot(dx, dy);
    const bend = Math.min(54, distance * 0.12) * direction;
    return {
      start,
      end,
      control: {
        x: start.x + dx * 0.5 - (dy / Math.max(1, distance)) * bend,
        y: start.y + dy * 0.5 + (dx / Math.max(1, distance)) * bend,
      },
    };
  };
  const fallback = curve(
    boundary(source, endCenter, 1),
    boundary(destination, startCenter, 3),
  );
  const overlaps =
    source.left < destination.left + destination.width &&
    source.left + source.width > destination.left &&
    source.top < destination.top + destination.height &&
    source.top + source.height > destination.top;
  if (!overlaps) return fallback;
  // The centered reading bubble can cover part of a large editorial image.
  // A ray through both centers would then fly backwards through the bubble.
  // Use a visible contour edge and its facing arrival edge instead.
  const candidates = [];
  const pad = Math.min(18, destination.width * 0.12, destination.height * 0.12);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  for (const fraction of [0.25, 0.5, 0.75]) {
    candidates.push(
      { x: source.left + source.width * fraction, y: source.top + 1 },
      {
        x: source.left + source.width * fraction,
        y: source.top + source.height - 1,
      },
      { x: source.left + 1, y: source.top + source.height * fraction },
      {
        x: source.left + source.width - 1,
        y: source.top + source.height * fraction,
      },
    );
  }
  const contained =
    destination.left >= source.left &&
    destination.left + destination.width <= source.left + source.width &&
    destination.top >= source.top &&
    destination.top + destination.height <= source.top + source.height;
  const minimumTravel = contained
    ? Math.min(160, Math.max(source.width, source.height) * 0.5)
    : 80;
  const approachShift = contained ? 180 : 100;
  const routes = candidates
    .filter((point) => !inside(point, destination, 8))
    .flatMap((start) => {
      const end = {
        x: clamp(
          start.x,
          destination.left + pad,
          destination.left + destination.width - pad,
        ),
        y: clamp(
          start.y,
          destination.top + pad,
          destination.top + destination.height - pad,
        ),
      };
      const horizontalEdge =
        start.y < destination.top ||
        start.y > destination.top + destination.height;
      if (start.y < destination.top) end.y = destination.top + 2;
      else if (start.y > destination.top + destination.height)
        end.y = destination.top + destination.height - 2;
      else if (start.x < destination.left) end.x = destination.left + 2;
      else end.x = destination.left + destination.width - 2;
      // When the bubble sits wholly inside the image (common on phones), the
      // nearest edge can be only 20px away. Approach another point on that same
      // facing edge so the connection still has readable travel distance.
      return [0, -approachShift, approachShift].flatMap((shift) => {
        const arrival = { ...end };
        if (horizontalEdge)
          arrival.x = clamp(
            end.x + shift,
            destination.left + pad,
            destination.left + destination.width - pad,
          );
        else
          arrival.y = clamp(
            end.y + shift,
            destination.top + pad,
            destination.top + destination.height - pad,
          );
        return [1, -1].map((direction) => {
          const route = curve(start, arrival, direction);
          const distance = Math.hypot(arrival.x - start.x, arrival.y - start.y);
          let blocked = distance < minimumTravel;
          for (let sample = 0; sample < 16 && !blocked; sample++) {
            const point = pointOnAttentionRoute(route, sample / 16);
            blocked =
              inside(point, destination, -1) ||
              avoid.some((rect) => inside(point, rect, 6));
          }
          return { route, score: distance + (blocked ? 100000 : 0) };
        });
      });
    });
  routes.sort((first, second) => first.score - second.score);
  return routes[0]?.route || fallback;
}

export function pointOnAttentionRoute(route, progress) {
  const remaining = 1 - progress;
  return {
    x:
      remaining * remaining * route.start.x +
      2 * remaining * progress * route.control.x +
      progress * progress * route.end.x,
    y:
      remaining * remaining * route.start.y +
      2 * remaining * progress * route.control.y +
      progress * progress * route.end.y,
  };
}

// Retained geometry helpers for earlier consumers. The current presentation
// keeps the product contour anchored; it never morphs the bubble surface.
export const FRAME_MORPH_MS = 620;
export function frameTransform(source, destination) {
  return `translate3d(${source.left}px, ${source.top}px, 0) scale(${source.width / destination.width}, ${source.height / destination.height})`;
}
export function destinationTransform(destination) {
  return `translate3d(${destination.left}px, ${destination.top}px, 0) scale(1, 1)`;
}
