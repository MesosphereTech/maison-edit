import { initialState } from "./legacy-warm-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import {
  byId,
  buildFeed,
  filteredProducts,
  switchCuratedCase,
  restoreState,
} from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";

test("male case places every womenswear SKU after own-department and home products", () => {
  const state = switchCuratedCase(initialState(), "quiet-city");
  const products = buildFeed({}, state.profile)
    .filter((e) => e.type === "product")
    .map((e) => e.product);
  assert.equal(products.length, 28);
  const firstGift = products.findIndex((p) => p.category === "women");
  assert.ok(firstGift > 0);
  assert.ok(products.slice(firstGift).every((p) => p.category === "women"));
  assert.ok(products.slice(0, firstGift).some((p) => p.category === "men"));
  assert.ok(
    filteredProducts({ category: "women" }, state.profile).length > 0,
    "explicit women filter remains available for gifts",
  );
});
test("case switching round-trips edited history and local choices without leaking ownership", () => {
  const woman = initialState();
  woman.purchaseHistory = [];
  woman.purchaseHistoryOrigin = "edited";
  woman.wishlist = ["ME-015"];
  let man = switchCuratedCase(woman, "quiet-city");
  assert.equal(man.profile.personaId, "relaxed-man-50");
  assert.equal(man.profile.size, "L");
  assert.deepEqual(man.wishlist, []);
  assert.deepEqual(
    man.purchaseHistory.map((x) => x.skuId),
    ["ME-011", "ME-019"],
  );
  man.purchaseHistory = [
    { skuId: "ME-013", color: "Walnut", size: "ONE SIZE" },
  ];
  man.purchaseHistoryOrigin = "edited";
  man.wishlist = ["ME-010"];
  const restoredWoman = switchCuratedCase(man, "warm-everyday");
  assert.deepEqual(restoredWoman.purchaseHistory, []);
  assert.equal(restoredWoman.purchaseHistoryOrigin, "edited");
  assert.deepEqual(restoredWoman.wishlist, ["ME-015"]);
  const persisted = restoreState(restoredWoman).state;
  const restoredMan = switchCuratedCase(persisted, "quiet-city");
  assert.deepEqual(restoredMan.purchaseHistory, man.purchaseHistory);
  assert.deepEqual(restoredMan.wishlist, ["ME-010"]);
  assert.equal(switchCuratedCase(restoredMan, "unsupported"), restoredMan);
});
test("only the exact two supported case snapshots are restored and malformed history is discarded", () => {
  const state = initialState();
  state.caseSnapshots = {
    bad: { purchaseHistory: [{ skuId: "missing" }] },
    "quiet-city": {
      profile: { styles: ["quiet", "invalid"] },
      purchaseHistory: [{ skuId: "ME-015", color: "wrong", size: "M" }],
      cart: [{ skuId: "missing" }],
      wishlist: ["ME-010", "missing"],
      feedback: { "ME-010": "like", missing: "like" },
    },
  };
  const restored = restoreState(state).state;
  assert.deepEqual(Object.keys(restored.caseSnapshots), ["quiet-city"]);
  const man = switchCuratedCase(restored, "quiet-city");
  assert.deepEqual(man.purchaseHistory, []);
  assert.deepEqual(man.cart, []);
  assert.deepEqual(man.wishlist, ["ME-010"]);
  assert.deepEqual(man.feedback, { "ME-010": "like" });
  assert.deepEqual(man.profile.styles, ["quiet"]);
  assert.equal(curatedScenarios.length, 4);
});
