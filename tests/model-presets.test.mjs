import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  initialState,
  switchCuratedCase,
  restoreState,
  byId,
  catalog,
} from "../src/data.js";
import {
  curatedScenarios,
  personalizedSceneFor,
} from "../src/personalized-scenes.js";
import {
  modelPersonaPresets,
  modelOutfitScenes,
  modelScenarios,
} from "../src/model-presets.js";
import { outfitSceneFor } from "../src/outfit-scenes.js";
import { tryListVariant } from "../src/try-list.js";
import { giftSceneContext } from "../src/gift-scenes.js";
import { buildVisitJourney, visitExamples } from "../src/visit-journey.js";
import { renderCuratedGuideTurn } from "../src/guide-dialogue-bank.js";

const manifest = JSON.parse(
  readFileSync(
    new URL("../docs/model-presets-v17/provenance.json", import.meta.url),
  ),
);
const cases = [
  ["claire-city-edit", "claire-model-32", "S", 175, "EU 39"],
  ["julian-city-edit", "julian-model-34", "L", 186, "EU 43"],
  ["warm-everyday", "everyday-woman-45", "M", 165, "EU 38"],
  ["quiet-city", "relaxed-man-50", "L", 172, "EU 42"],
];

test("new adult model cases are first, old cases retained, and fresh visits default to Claire in English", () => {
  assert.deepEqual(
    curatedScenarios.map((s) => s.id),
    cases.map(([id]) => id),
  );
  const state = initialState();
  assert.equal(state.profile.personaId, "claire-model-32");
  assert.equal(state.profile.size, "S");
  assert.equal(state.language, "en");
  assert.equal(modelPersonaPresets.length, 2);
  assert.deepEqual(
    visitExamples.map((e) => e.id),
    cases.map(([id]) => id),
  );
});

test("all four cases have independent template sizes, shoe sizes, histories and restored choices", () => {
  let state = initialState();
  const expected = new Map();
  for (const [id, personaId, size, height, shoeSize] of cases) {
    state = switchCuratedCase(state, id);
    assert.equal(state.profile.personaId, personaId);
    assert.equal(state.profile.size, size);
    assert.equal(state.profile.height, height);
    const shoe =
      personaId.includes("julian") || personaId.includes("man-50")
        ? "ME-013"
        : "ME-007";
    assert.equal(
      tryListVariant(byId(shoe), state.profile).fit.displaySize,
      shoeSize,
    );
    state.wishlist = [id.includes("julian") ? "ME-010" : "ME-015"];
    state.purchaseHistory = [
      { skuId: "ME-021", color: "Oak", size: "ONE SIZE" },
    ];
    state.purchaseHistoryOrigin = "edited";
    state.profile = { ...state.profile, budget: 6000 + expected.size * 1000 };
    expected.set(
      id,
      structuredClone({
        history: state.purchaseHistory,
        wishlist: state.wishlist,
        budget: state.profile.budget,
      }),
    );
  }
  state = restoreState(state).state;
  for (const [id] of cases) {
    state = switchCuratedCase(state, id);
    assert.deepEqual(state.purchaseHistory, expected.get(id).history);
    assert.deepEqual(state.wishlist, expected.get(id).wishlist);
    assert.equal(state.profile.budget, expected.get(id).budget);
  }
});

test("all gender-matched catalog apparel is covered by seven real full outfits with exact colors", () => {
  assert.equal(modelOutfitScenes.length, 7);
  assert.deepEqual(
    modelScenarios.map((s) => [s.products.length, s.assetCount]),
    [
      [13, 5],
      [7, 2],
    ],
  );
  for (const scenario of modelScenarios) {
    const category = modelPersonaPresets.find(
      (p) => p.id === scenario.personaId,
    ).category;
    for (const item of catalog.filter((p) => p.category === category)) {
      const scene = outfitSceneFor(item.id, scenario, item.color);
      assert.ok(scene, `${scenario.id} ${item.id} full outfit missing`);
      assert.equal(scene.personaId, scenario.personaId);
    }
    for (const entry of scenario.products) {
      const scene = personalizedSceneFor(entry.skuId, scenario, entry.color);
      assert.equal(scene.personaId, scenario.personaId);
      assert.equal(entry.color, byId(entry.skuId).color);
      assert.ok(scene.src.includes("v17-"));
      assert.ok(existsSync(new URL(`../public${scene.src}`, import.meta.url)));
      assert.equal(
        personalizedSceneFor(entry.skuId, scenario, "unsupported"),
        null,
      );
    }
  }
});

test("new-model home and unsupported accessories use original concepts rather than old people", () => {
  for (const scenario of modelScenarios) {
    for (const item of catalog.filter((p) => p.category === "home"))
      assert.equal(personalizedSceneFor(item.id, scenario, item.color), null);
    for (const entry of scenario.products)
      assert.doesNotMatch(entry.file, /everyday-woman|relaxed-man/);
  }
  assert.equal(
    personalizedSceneFor("ME-008", modelScenarios[1], "Brass"),
    null,
  );
});

test("gift references use the new matching adult model and selected wrap without changing shopper", () => {
  for (const scenario of modelScenarios) {
    const state = switchCuratedCase(initialState(), scenario.id),
      before = structuredClone(state);
    const target = scenario.id.includes("claire") ? "ME-014" : "ME-006";
    const context = giftSceneContext(byId(target), state.profile, {
      isGift: true,
      packagingId: "ivory-silk",
    });
    assert.equal(context.explicitGift, true);
    assert.equal(context.packaging.id, "ivory-silk");
    assert.ok(context.profile.personaId.includes("model"));
    assert.ok(outfitSceneFor(target, context.profile, byId(target).color));
    assert.deepEqual(state, before);
  }
});

test("all four visit and guide plans retain the selected exact adult identity", () => {
  for (const [id, personaId] of cases) {
    const state = switchCuratedCase(initialState(), id),
      journey = buildVisitJourney(state);
    assert.equal(journey.persona.id, personaId);
    assert.equal(journey.profile.personaId, personaId);
    assert.ok(
      renderCuratedGuideTurn(id, "welcome", {
        profile: state.profile,
        history: state.purchaseHistory,
      }),
    );
  }
});

test("all nine new optimized WebP assets match private provenance without a paid provider", () => {
  assert.equal(manifest.assetCount, 9);
  assert.equal(manifest.generatedSceneCount, 7);
  assert.equal(manifest.identityPortraitCount, 2);
  assert.equal(manifest.generationTool, "built-in imagegen");
  assert.equal(manifest.paidThirdPartyGeneration, false);
  assert.ok(manifest.productionBytes < 1500000);
  for (const asset of manifest.assets) {
    const bytes = readFileSync(
      new URL(`../${asset.output.path}`, import.meta.url),
    );
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(bytes.length, asset.output.bytes);
    assert.equal(
      createHash("sha256").update(bytes).digest("hex"),
      asset.output.sha256,
    );
    assert.equal(asset.reviewStatus, "visually-reviewed");
    assert.ok(asset.generation.prompt);
    assert.ok(asset.generation.references.length);
    assert.equal(asset.claims.synthetic, true);
  }
});
