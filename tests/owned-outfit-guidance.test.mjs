import test from "node:test";
import assert from "node:assert/strict";
import { byId, catalog, defaultProfile } from "../src/data.js";
import {
  buildCatalogOutfit,
  clothingDepartmentFor,
  isOppositeClothingDepartment,
} from "../src/purchase-history.js";
import { createGuideDialogueReply } from "../src/guide-dialogue-bank.js";
import { createConciergeReply } from "../src/concierge.js";

const entry = (skuId, extra = {}) => ({
  skuId,
  color: byId(skuId).color,
  size: byId(skuId).sizes.includes("M") ? "M" : byId(skuId).sizes[0],
  ...extra,
});
const woman = { ...defaultProfile, personaId: "everyday-woman-45" };
const man = { ...defaultProfile, personaId: "relaxed-man-50" };
const render = (args = {}) =>
  createGuideDialogueReply({
    profile: woman,
    filters: { category: "all", budget: 10000 },
    language: "en",
    ...args,
  });

test("outfit helpers use only an explicit department or selected persona", () => {
  assert.equal(clothingDepartmentFor(woman), "women");
  assert.equal(clothingDepartmentFor(man), "men");
  assert.equal(
    clothingDepartmentFor({ department: "men", personaId: woman.personaId }),
    "men",
  );
  assert.equal(
    clothingDepartmentFor({ gender: "man", image: "male-photo.jpg" }),
    null,
  );
  assert.equal(isOppositeClothingDepartment("ME-001", man), true);
  assert.equal(isOppositeClothingDepartment("ME-012", woman), true);
  assert.equal(isOppositeClothingDepartment("ME-004", man), false);
  assert.equal(isOppositeClothingDepartment("unknown", man), false);
});

test("a verified outfit covers top, bottom, shoes and accessory with current owned substitutes", () => {
  const history = [
    entry("ME-003", { color: "Ink", size: "L" }),
    entry("ME-006"),
    entry("ME-007"),
  ];
  const args = {
    productId: "ME-001",
    profile: woman,
    history,
    budget: 6000,
    language: "en",
  };
  const snapshot = structuredClone(args);
  const outfit = buildCatalogOutfit(args);
  assert.equal(outfit.complete, true);
  for (const slot of ["top", "bottom", "shoes", "accessory"])
    assert.ok(outfit.components.some((component) => component.slot === slot));
  assert.deepEqual(
    new Set(outfit.ownedProductIds),
    new Set(history.map((line) => line.skuId)),
  );
  const bottom = outfit.components.find(
    (component) => component.slot === "bottom",
  );
  assert.equal(bottom.productId, "ME-003");
  assert.equal(bottom.color, "Ink");
  assert.equal(bottom.size, "L");
  assert.equal(bottom.source, "owned");
  assert.equal(bottom.relationship, "same-series");
  assert.ok(outfit.newItemsTotal <= 6000);
  assert.equal(
    outfit.newItemsTotal,
    outfit.productIds.reduce((sum, id) => sum + byId(id).price, 0),
  );
  assert.ok(
    outfit.productIds.every((id) => !outfit.ownedProductIds.includes(id)),
  );
  assert.deepEqual(args, snapshot);
  assert.deepEqual(outfit, buildCatalogOutfit(args));
});

test("editing or clearing current history replaces outfit ownership, without saved or bag inference", () => {
  const first = render({
    event: { type: "attention", productId: "ME-001" },
    history: [entry("ME-003")],
  });
  assert.ok(first.ownedProductIds.includes("ME-003"));
  assert.match(first.visualText, /long-line trouser/);
  const edited = render({
    event: { type: "dwell", productId: "ME-001" },
    session: first.session,
    history: [entry("ME-006", { color: "Ink", size: "XL" })],
  });
  assert.ok(!edited.ownedProductIds.includes("ME-003"));
  assert.ok(edited.ownedProductIds.includes("ME-006"));
  assert.match(edited.text, /Ink · XL/);
  assert.match(edited.visualText, /cashmere layer/);
  const empty = render({
    event: { type: "revisit", productId: "ME-001" },
    session: edited.session,
    history: [],
    purchaseHistory: [entry("ME-003")],
    wishlist: ["ME-003"],
    cart: [{ ...entry("ME-006"), quantity: 1 }],
  });
  assert.deepEqual(empty.ownedProductIds, []);
  assert.deepEqual(empty.outfit.ownedProductIds, []);
  assert.doesNotMatch(empty.text, /in current history|current example history/);
});

test("each proactive phase names the actual owned complement without waiting for a question", () => {
  const texts = [];
  const visualTexts = [];
  for (const type of ["attention", "dwell", "revisit", "product_open"]) {
    const value = render({
      event: { type, productId: "ME-001" },
      history: [entry("ME-003")],
    });
    assert.equal(value.mode, "demo");
    assert.equal(value.provider, null);
    assert.ok(value.ownedProductIds.includes("ME-003"));
    assert.match(value.text, /long-line trouser/);
    assert.match(value.visualText, /long-line trouser/);
    assert.match(value.text, /explicitly in/);
    assert.equal(value.relationship, "same-series");
    assert.ok(
      value.outfit.components.every((component) => byId(component.productId)),
    );
    texts.push(value.text);
    visualTexts.push(value.visualText);
  }
  assert.equal(new Set(texts).size, 4);
  assert.equal(new Set(visualTexts).size, 4);
});

test("empty and unrelated history never becomes an owned pairing or declared series", () => {
  for (const history of [[], [entry("ME-019")], [entry("ME-010")]]) {
    const result = render({
      event: { type: "attention", productId: "ME-001" },
      history,
    });
    assert.deepEqual(result.ownedProductIds, []);
    assert.deepEqual(result.outfit.ownedProductIds, []);
    assert.notEqual(result.relationship, "same-series");
    assert.doesNotMatch(
      result.visualText,
      /current example history|declared demo series/,
    );
  }
});

test("a current owned substitute stays visible even when reached through another outfit component", () => {
  const value = render({
    event: { type: "attention", productId: "ME-016" },
    history: [entry("ME-003")],
  });
  assert.ok(value.outfit.ownedProductIds.includes("ME-003"));
  assert.match(value.visualText, /long-line trouser/);
  assert.equal(value.relationship, "pairing");
  const asked = render({
    productId: "ME-016",
    intent: "pairing",
    history: [entry("ME-003")],
  });
  assert.doesNotMatch(asked.text, /No complementary owned piece/);
  assert.match(asked.text, /long-line trouser/);
});

test("men’s outfit components stay in men’s clothing plus accessories", () => {
  const result = render({
    event: { type: "product_open", productId: "ME-014" },
    profile: man,
    history: [entry("ME-011"), entry("ME-013"), entry("ME-003")],
  });
  assert.equal(result.outfit.department, "men");
  assert.equal(result.outfit.purpose, "self");
  assert.equal(result.outfit.complete, true);
  assert.ok(
    result.outfit.components.every((component) =>
      ["men", "accessories"].includes(byId(component.productId).category),
    ),
  );
  assert.ok(result.ownedProductIds.includes("ME-011"));
  assert.ok(!result.ownedProductIds.includes("ME-003"));
});

test("opposite-department clothing is an optional gifting idea with no invented promotion", () => {
  for (const [profile, productId] of [
    [man, "ME-001"],
    [woman, "ME-012"],
  ]) {
    for (const type of ["attention", "dwell", "revisit", "product_open"]) {
      const result = render({
        profile,
        event: { type, productId },
        history: [],
      });
      assert.equal(result.giftContext, true);
      assert.equal(result.outfit.purpose, "gift");
      assert.match(result.text, /optional gift idea/);
      assert.match(result.visualText, /optional gifting idea/);
      assert.match(result.text, /recipient’s preferences and size/);
      assert.doesNotMatch(
        result.text,
        /discount|promotion|sale|\d+% off|优惠|折扣/i,
      );
    }
  }
});

test("outfit choices respect total budget, current inventory and conversational exclusions", () => {
  const result = buildCatalogOutfit({
    productId: "ME-014",
    profile: man,
    history: [entry("ME-011"), entry("ME-013")],
    budget: 2000,
    excludedKinds: ["bag"],
    inventory: { "ME-016": 0 },
  });
  assert.ok(result.newItemsTotal <= 2000);
  assert.ok(!result.productIds.includes("ME-016"));
  assert.ok(
    !result.components.some(
      (component) => byId(component.productId).kind === "bag",
    ),
  );
  assert.ok(result.ownedProductIds.includes("ME-013"));
  const tooLow = buildCatalogOutfit({
    productId: "ME-001",
    history: [entry("ME-003")],
    budget: 100,
  });
  assert.deepEqual(tooLow.productIds, []);
  assert.equal(tooLow.newItemsTotal, 0);
  assert.ok(tooLow.ownedProductIds.includes("ME-003"));
  assert.equal(tooLow.complete, false);
});

test("a dress uses one-piece styling, and no household SKU is mislabelled as clothing", () => {
  const dress = buildCatalogOutfit({
    productId: "ME-015",
    profile: woman,
    history: [],
    budget: 10000,
  });
  assert.equal(dress.complete, true);
  assert.deepEqual(
    dress.components.map((component) => component.slot),
    ["onePiece", "shoes", "accessory"],
  );
  for (const item of catalog.filter((item) => item.category === "home"))
    assert.equal(buildCatalogOutfit({ productId: item.id }), null);
});

test("legacy concierge also uses fresh history and keeps empty history distinct from saved items", () => {
  const args = {
    event: { type: "product_open", productId: "ME-001" },
    profile: woman,
    language: "en",
  };
  const owned = createConciergeReply({
    ...args,
    purchaseHistory: [entry("ME-003")],
  });
  assert.ok(owned.ownedProductIds.includes("ME-003"));
  assert.match(owned.text, /declared demo series/);
  const empty = createConciergeReply({
    ...args,
    history: [],
    purchaseHistory: [entry("ME-003")],
    wishlist: ["ME-003"],
  });
  assert.deepEqual(empty.ownedProductIds, []);
  assert.deepEqual(empty.outfit.ownedProductIds, []);
  const gift = createConciergeReply({ ...args, profile: man, history: [] });
  assert.match(gift.text, /optional gift idea/);
  assert.equal(gift.provider, null);
});
