// Occurrences are presentation only. Every repeated card retains its catalog SKU.
export const FEED_PAGE_SIZE = 6;
export const MAX_MOUNTED_FEED_PAGES = 7;

export function cycleEntries(feed, cycle) {
  const products = feed.filter((entry) => entry.type === "product");
  // Two pieces keep their order so a cycle boundary cannot repeat its neighbor.
  const offset = products.length > 2 ? cycle % products.length : 0;
  let productIndex = 0;
  return feed.map((entry) =>
    entry.type === "product"
      ? products[(productIndex++ + offset) % products.length]
      : entry,
  );
}

export function endlessFeedPage(feed, page, size = FEED_PAGE_SIZE) {
  if (!feed.length) return [];
  // Short filtered lists still get a useful browsing stretch between pauses.
  const cyclesPerPause = Math.max(1, Math.ceil(18 / feed.length));
  const blockSize = feed.length * cyclesPerPause + 1;
  const cycles = new Map();
  return Array.from({ length: size }, (_, index) => {
    const position = page * size + index;
    const block = Math.floor(position / blockSize);
    const withinBlock = position % blockSize;
    const cycle =
      block * cyclesPerPause +
      Math.min(cyclesPerPause - 1, Math.floor(withinBlock / feed.length));
    const slot = withinBlock % feed.length;
    const occurrenceId = `feed-${position}`;
    if (withinBlock === blockSize - 1)
      return { type: "pause", cycle, occurrenceId, position };
    if (!cycles.has(cycle)) cycles.set(cycle, cycleEntries(feed, cycle));
    return { ...cycles.get(cycle)[slot], cycle, occurrenceId, position };
  });
}

export function feedPageOffsets(count, heights, estimate = 2400) {
  const offsets = [0];
  for (let page = 0; page < count; page++)
    offsets.push(offsets[page] + (heights.get(page) || estimate));
  return offsets;
}

export function feedPageWindow(offsets, top, height, overscan = 1400) {
  const count = offsets.length - 1;
  if (!count) return { start: 0, end: 0 };
  const pageAt = (position) => {
    let lo = 0,
      hi = count - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (offsets[mid + 1] <= position) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const start = pageAt(Math.max(0, top - overscan));
  const end = Math.min(
    pageAt(top + height + overscan),
    start + MAX_MOUNTED_FEED_PAGES - 1,
  );
  return { start, end };
}
