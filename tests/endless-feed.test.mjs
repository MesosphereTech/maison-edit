import test from "node:test";
import assert from "node:assert/strict";
import { buildFeed, initialState, filteredProducts } from "../src/data.js";
import {
  cycleEntries,
  endlessFeedPage,
  feedPageOffsets,
  feedPageWindow,
  MAX_MOUNTED_FEED_PAGES,
} from "../src/endless-feed.js";
import { targetIdentity, sourceIdentity } from "../src/attention.js";
const state = initialState();
const feed = buildFeed({}, state.profile);
test("three complete catalog cycles contain every eligible SKU exactly once and no boundary duplicate", () => {
  const expected = feed
    .filter((e) => e.type === "product")
    .map((e) => e.id)
    .sort();
  const snapshot = JSON.stringify(feed);
  const all = [];
  for (let cycle = 0; cycle < 5; cycle++) {
    const entries = cycleEntries(feed, cycle);
    assert.deepEqual(
      entries
        .filter((e) => e.type === "product")
        .map((e) => e.id)
        .sort(),
      expected,
    );
    all.push(...entries.filter((e) => e.type === "product"));
    assert.deepEqual(
      cycleEntries(feed, cycle),
      entries,
      "no render-time randomness",
    );
  }
  for (let i = 1; i < all.length; i++)
    assert.notEqual(all[i].id, all[i - 1].id);
  assert.equal(JSON.stringify(feed), snapshot);
});
test("occurrences have unique keys, honest repeated SKUs and a nonterminal pause", () => {
  const entries = Array.from({ length: 24 }, (_, page) =>
    endlessFeedPage(feed, page),
  ).flat();
  assert.equal(
    new Set(entries.map((e) => e.occurrenceId)).size,
    entries.length,
  );
  const pauses = entries
    .map((e, index) => (e.type === "pause" ? index : -1))
    .filter((i) => i >= 0);
  assert.ok(pauses.length >= 3);
  for (const index of pauses)
    assert.ok(entries[index + 1] && entries[index + 1].type !== "pause");
  for (const entry of entries.filter((e) => e.type === "product"))
    assert.equal(entry.id, entry.product.id);
});
test("filters and less-like exclusions apply to all repeated cycles, with no loop for empty results", () => {
  const filters = { category: "home", budget: 1000 };
  const feedback = { "ME-018": "less" };
  const filtered = buildFeed(filters, state.profile, feedback);
  const eligible = new Set(
    filteredProducts(filters, state.profile, feedback).map((p) => p.id),
  );
  for (let page = 0; page < 20; page++)
    for (const entry of endlessFeedPage(filtered, page)) {
      if (entry.type === "product") assert.ok(eligible.has(entry.id));
      else if (entry.type !== "pause")
        assert.ok(entry.ids.every((id) => eligible.has(id)));
    }
  assert.deepEqual(endlessFeedPage([], 99), []);
});
test("small catalogs avoid immediate duplicates where possible and space out footer pauses", () => {
  const products = feed.filter((e) => e.type === "product");
  const two = Array.from({ length: 6 }, (_, page) =>
    endlessFeedPage(products.slice(0, 2), page),
  ).flat();
  assert.equal(
    two.findIndex((e) => e.type === "pause"),
    18,
  );
  const pieces = two.filter((e) => e.type === "product");
  for (let i = 1; i < pieces.length; i++)
    assert.notEqual(pieces[i].id, pieces[i - 1].id);
  assert.ok(
    endlessFeedPage(products.slice(0, 1), 4).some((e) => e.type === "product"),
  );
});
test("window retention is bounded and measured offsets preserve old page geometry", () => {
  const heights = new Map(Array.from({ length: 300 }, (_, i) => [i, 1200 + i]));
  const offsets = feedPageOffsets(300, heights);
  for (const top of [0, 2000, 20000, 200000, offsets.at(-1)]) {
    const range = feedPageWindow(offsets, top, 1000);
    assert.ok(range.end - range.start + 1 <= MAX_MOUNTED_FEED_PAGES);
    assert.equal(
      offsets[range.start] +
        (offsets[range.end + 1] - offsets[range.start]) +
        offsets.at(-1) -
        offsets[range.end + 1],
      offsets.at(-1),
    );
  }
});
test("attention distinguishes repeated occurrences while preserving SKU-only compatibility", () => {
  assert.equal(
    targetIdentity({
      dataset: { conciergeProduct: "ME-001", conciergeOccurrence: "feed-50" },
    }),
    "feed-50",
  );
  assert.equal(
    targetIdentity({ dataset: { conciergeProduct: "ME-001" } }),
    "ME-001",
  );
  assert.equal(
    sourceIdentity({ productId: "ME-001", occurrenceId: "feed-50" }),
    "feed-50",
  );
  assert.equal(sourceIdentity({ productId: "ME-001" }), "ME-001");
});

test("source resolution selects the visible occurrence rather than an earlier duplicate SKU", async () => {
  const { conciergeTargets } = await import("../src/concierge-visibility.js");
  const oldWindow = globalThis.window,
    oldDocument = globalThis.document;
  const element = (occurrence, top) => ({
    dataset: { conciergeProduct: "ME-001", conciergeOccurrence: occurrence },
    isConnected: true,
    closest: () => null,
    getBoundingClientRect: () => ({
      top,
      bottom: top + 500,
      left: 100,
      right: 500,
      width: 400,
      height: 500,
    }),
  });
  const first = element("feed-0", -900),
    second = element("feed-50", 150),
    third = element("feed-80", 160);
  globalThis.window = { innerWidth: 1440, innerHeight: 1000 };
  globalThis.document = {
    querySelectorAll: () => [first, second, third],
    querySelector: () => null,
  };
  try {
    assert.deepEqual(
      conciergeTargets({
        source: { productId: "ME-001", occurrenceId: "feed-50" },
      }),
      [second],
    );
    assert.deepEqual(
      conciergeTargets({
        source: { productId: "ME-001", occurrenceId: "feed-0" },
      }),
      [],
    );
    assert.deepEqual(conciergeTargets({ source: { productId: "ME-001" } }), [
      second,
      third,
    ]);
  } finally {
    globalThis.window = oldWindow;
    globalThis.document = oldDocument;
  }
});
