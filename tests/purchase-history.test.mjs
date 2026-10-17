import test from "node:test";
import assert from "node:assert/strict";
import { catalog, byId } from "../src/data.js";
import {
  purchaseHistoryPresets,
  sanitizePurchaseHistory,
  findHistoryGuidance,
} from "../src/purchase-history.js";

const entry = (skuId, extra = {}) => {
  const item = byId(skuId);
  return {
    skuId,
    color: item.color,
    size: item.sizes.includes("M") ? "M" : item.sizes[0],
    ...extra,
  };
};
const guide = (productId, history, extra = {}) =>
  findHistoryGuidance({ productId, history, language: "en", ...extra });

test("fictional history starts empty and rejects malformed storage", () => {
  for (const value of [
    undefined,
    null,
    "ME-001",
    {},
    1,
    [null, false, [], "ME-001"],
  ])
    assert.deepEqual(sanitizePurchaseHistory(value), []);
});

test("history rejects unknown SKUs, missing variants and invalid variants", () => {
  assert.deepEqual(
    sanitizePurchaseHistory([
      { skuId: "unknown", color: "Walnut", size: "M" },
      { skuId: "ME-001" },
      entry("ME-001", { color: "made-up" }),
      entry("ME-001", { size: "XXXL" }),
      entry("ME-018", { size: "M" }),
    ]),
    [],
  );
});

test("history deduplicates by SKU, copies safe fields and never stores receipt data", () => {
  const raw = [
    entry("ME-001", { receipt: "private", paid: 99, date: "2030-01-01" }),
    entry("ME-001", { color: "Ink", size: "L" }),
    entry("ME-018"),
  ];
  const snapshot = structuredClone(raw);
  const result = sanitizePurchaseHistory(raw);
  assert.deepEqual(result, [entry("ME-001"), entry("ME-018")]);
  assert.deepEqual(raw, snapshot);
  assert.notEqual(result[0], raw[0]);
  assert.deepEqual(Object.keys(result[0]), ["skuId", "color", "size"]);
});

test("history contains at most twelve valid unique catalog items", () => {
  const result = sanitizePurchaseHistory([
    { skuId: "bad" },
    ...catalog.map((item) => entry(item.id)),
  ]);
  assert.equal(result.length, 12);
  assert.equal(new Set(result.map((item) => item.skuId)).size, 12);
  assert.deepEqual(
    result,
    catalog.slice(0, 12).map((item) => entry(item.id)),
  );
});

test("all three selectable presets are compact, valid fictional catalog entries", () => {
  assert.deepEqual(
    purchaseHistoryPresets.map((preset) => preset.id),
    ["women", "men", "home"],
  );
  for (const preset of purchaseHistoryPresets) {
    assert.ok(preset.zh && preset.en);
    assert.equal(preset.items.length, 3);
    assert.deepEqual(sanitizePurchaseHistory(preset.items), preset.items);
  }
});

test("guidance never invents ownership from an empty or invalid history", () => {
  assert.equal(guide("ME-001", []), null);
  assert.equal(guide("ME-001", [{ skuId: "ME-003" }]), null);
  assert.equal(guide("unknown", [entry("ME-003")]), null);
  assert.equal(findHistoryGuidance(), null);
  assert.equal(guide("ME-001", [entry("ME-017")]), null);
});

test("exact owned SKU warns about duplication even for a different saved variant", () => {
  const result = guide("ME-001", [
    entry("ME-001", { color: "Ink", size: "L" }),
  ]);
  assert.equal(result.duplicate, true);
  assert.equal(result.relationship, "duplicate");
  assert.deepEqual(result.productIds, []);
  assert.deepEqual(result.ownedProductIds, ["ME-001"]);
  assert.match(result.text, /fictional history/);
  assert.match(result.text, /same SKU/);
  assert.match(result.text, /Ink · L/);
  assert.match(result.text, /Check before buying/);
});

test("pairing suggestions exclude the viewed SKU and every fictional owned item", () => {
  const history = [entry("ME-010"), entry("ME-013")];
  const result = guide("ME-011", history, { budget: 4000 });
  assert.ok(result);
  assert.equal(result.duplicate, false);
  assert.equal(result.relationship, "pairing");
  assert.ok(result.productIds.length <= 1);
  assert.ok(result.productIds.length > 0);
  assert.ok(
    result.ownedProductIds.every((id) =>
      history.some((owned) => owned.skuId === id),
    ),
  );
  for (const id of result.productIds) {
    assert.notEqual(id, "ME-011");
    assert.ok(!history.some((owned) => owned.skuId === id));
    assert.ok(byId(id));
    assert.notEqual(byId(id).category, "women");
    assert.notEqual(byId(id).category, "home");
  }
  assert.match(result.text, /fictional history/);
  assert.match(result.text, /complementary pieces/);
  assert.match(result.text, /Optional complement/);
  assert.match(result.text, /Another purchase isn’t necessary/);
});

test("guidance respects inclusive per-item budgets and never forces an upsell", () => {
  const history = [entry("ME-010")];
  const broad = guide("ME-011", history, { budget: 4000 });
  const price = byId(broad.productIds[0]).price;
  const exact = guide("ME-011", history, { budget: price });
  assert.ok(exact.productIds.every((id) => byId(id).price <= price));
  for (const budget of [0, 100, NaN, Infinity, -1, "4000"]) {
    const result = guide("ME-011", history, { budget });
    assert.deepEqual(result.productIds, []);
    assert.match(result.text, /exceeds your budget/);
  }
  const noExtra = guide("ME-012", history, { budget: 1000 });
  assert.deepEqual(noExtra.productIds, []);
});

test("same-series requires an exact collection ID on both products", () => {
  const blazer = byId("ME-001"),
    trouser = byId("ME-003");
  assert.equal(blazer.collectionId, "walnut-tailoring");
  assert.equal(trouser.collectionId, blazer.collectionId);
  const result = guide("ME-001", [entry("ME-003")]);
  assert.equal(result.relationship, "same-series");
  assert.match(result.text, /declared demo series/);
  assert.match(result.text, /Walnut wool tailoring/);
  assert.ok(!result.text.includes("Same-series unverified"));
});

test("same colour and a shared editorial edit do not verify a series", () => {
  const result = guide("ME-012", [entry("ME-011")]);
  assert.equal(byId("ME-012").color, byId("ME-011").color);
  assert.equal(result.relationship, "pairing");
  assert.match(result.text, /Same-series unverified/);
  assert.ok(!result.text.includes("Both belong"));
});

test("one declared series member cannot confer its series on a same-brand piece", () => {
  assert.equal(byId("ME-001").brand, byId("ME-006").brand);
  const result = guide("ME-001", [entry("ME-006")]);
  assert.equal(result.relationship, "pairing");
  assert.match(result.text, /Same-series unverified/);
});

test("bilingual copy uses real catalog names and explicitly fictional ownership", () => {
  for (const language of ["zh", "en"]) {
    const result = guide("ME-011", [entry("ME-010")], { language });
    assert.ok(
      result.text.includes(
        language === "zh" ? byId("ME-010").name : byId("ME-010").en,
      ),
    );
    assert.match(
      result.text,
      language === "zh" ? /虚构购买记录/ : /fictional history/,
    );
    assert.match(
      result.text,
      language === "zh" ? /同系列未核实/ : /Same-series unverified/,
    );
    assert.ok(result.visualText.length < 100);
  }
});

test("a curtain sample is never treated as a usable throw in history pairing", () => {
  assert.equal(guide("ME-017", [entry("ME-028")]), null);
  const result = guide("ME-019", [entry("ME-017")], { budget: 6000 });
  assert.ok(result);
  assert.ok(!result.productIds.includes("ME-028"));
});

test("local state restores only explicitly saved valid history and clears completely", async () => {
  const { initialState, restoreState } = await import("../src/data.js");
  const state = initialState();
  assert.ok(state.purchaseHistory.length);
  assert.equal(state.purchaseHistoryOrigin, "seeded");
  state.purchaseHistory = [
    { skuId: "ME-001", color: "wrong", size: "M" },
    ...purchaseHistoryPresets[0].items,
    { ...purchaseHistoryPresets[0].items[0], receipt: "never keep" },
  ];
  const restored = restoreState(state).state;
  assert.deepEqual(restored.purchaseHistory, purchaseHistoryPresets[0].items);
  delete state.purchaseHistory;
  assert.ok(restoreState(state).state.purchaseHistory.length);
  assert.deepEqual(
    restoreState({ ...state, purchaseHistory: [] }).state.purchaseHistory,
    [],
  );
});
