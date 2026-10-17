import { initialState, defaultProfile } from "./legacy-warm-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  curatedScenarios as allCuratedScenarios,
  curatedScenarioFor,
  personalizedSceneFor,
} from "../src/personalized-scenes.js";
import {
  restoreState,
  demoHistoryForProfile,
  buildFeed,
  byId,
  catalog,
} from "../src/data.js";
import { findHistoryGuidance } from "../src/purchase-history.js";

const curatedScenarios = allCuratedScenarios.filter((s) =>
  ["warm-everyday", "quiet-city"].includes(s.id),
);

const profileFor = (scenario) => ({
  ...defaultProfile,
  personaId: scenario.personaId,
  homeId: scenario.homeId,
  room: scenario.room,
  size: scenario.personaId === "relaxed-man-50" ? "L" : "M",
});
test("exactly two curated preset combinations cover every catalog SKU with 56 exact variant mappings", () => {
  assert.equal(curatedScenarios.length, 2);
  const paths = new Set();
  for (const scenario of curatedScenarios) {
    const profile = profileFor(scenario);
    assert.equal(curatedScenarioFor(profile), scenario);
    assert.equal(scenario.products.length, 28);
    assert.deepEqual(
      new Set(scenario.products.map((entry) => entry.skuId)),
      new Set(catalog.map((entry) => entry.id)),
    );
    for (const product of scenario.products) {
      const scene = personalizedSceneFor(product.skuId, profile, product.color);
      assert.equal(scene.skuId, product.skuId);
      assert.equal(scene.color, byId(product.skuId).color);
      assert.equal(scene.scenarioId, scenario.id);
      assert.ok(scene.src.startsWith("/personalized-scenes/"));
      assert.ok(
        scene.src.includes(profile.personaId) &&
          scene.src.includes(profile.homeId),
      );
      paths.add(scene.src);
    }
  }
  assert.equal(paths.size, 56);
});
test("unsupported person, home, room, SKU and colour never reuse a personalized scene", () => {
  const profile = profileFor(curatedScenarios[0]);
  for (const patch of [
    { personaId: "soft-woman-60" },
    { homeId: "airy-couple" },
    { room: "bedroom" },
    { room: "kitchen" },
    { room: "study" },
    { personaId: "unknown" },
  ]) {
    assert.equal(curatedScenarioFor({ ...profile, ...patch }), null);
    assert.equal(
      personalizedSceneFor("ME-015", { ...profile, ...patch }),
      null,
    );
  }
  assert.equal(personalizedSceneFor("ME-015", profile, "Ink"), null);
  assert.equal(personalizedSceneFor("ME-999", profile), null);
  assert.equal(personalizedSceneFor("ME-015", {}), null);
});
test("scene matching remains exact when switching between prepared and unsupported variants", () => {
  for (const scenario of curatedScenarios) {
    const profile = profileFor(scenario);
    for (const product of scenario.products) {
      const matching = personalizedSceneFor(
        product.skuId,
        profile,
        product.color,
      );
      for (const color of byId(product.skuId).colors.filter(
        (color) => color !== product.color,
      ))
        assert.equal(personalizedSceneFor(product.skuId, profile, color), null);
      assert.equal(
        personalizedSceneFor(
          product.skuId,
          { ...profile, room: "bedroom" },
          product.color,
        ),
        null,
      );
      assert.deepEqual(
        personalizedSceneFor(product.skuId, profile, product.color),
        matching,
      );
    }
  }
});
test("fresh demo history has exact variants and only grounded curated-scene relationships", () => {
  assert.equal(initialState().purchaseHistoryOrigin, "seeded");
  for (const scenario of curatedScenarios) {
    const profile = profileFor(scenario),
      history = demoHistoryForProfile(profile);
    assert.ok(history.length && history.length <= 3);
    for (const entry of history) {
      assert.ok(byId(entry.skuId).colors.includes(entry.color));
      assert.ok(byId(entry.skuId).sizes.includes(entry.size));
      assert.deepEqual(Object.keys(entry), ["skuId", "color", "size"]);
    }
    for (const product of scenario.products) {
      const result = findHistoryGuidance({
        productId: product.skuId,
        history,
        language: "en",
      });
      const unrelated = {
        "warm-everyday": [
          "ME-018",
          "ME-020",
          "ME-022",
          "ME-023",
          "ME-024",
          "ME-028",
        ],
        "quiet-city": [
          "ME-001",
          "ME-002",
          "ME-003",
          "ME-005",
          "ME-006",
          "ME-008",
          "ME-009",
          "ME-015",
          "ME-018",
          "ME-020",
          "ME-022",
          "ME-023",
          "ME-024",
          "ME-025",
          "ME-026",
          "ME-028",
        ],
      };
      if (unrelated[scenario.id].includes(product.skuId)) {
        assert.equal(
          result,
          null,
          "a prepared scene does not manufacture an ownership pairing",
        );
        continue;
      }
      assert.ok(result);
      if (history.some((entry) => entry.skuId === product.skuId)) {
        assert.equal(result.duplicate, true);
        assert.deepEqual(result.productIds, []);
        continue;
      }
      assert.equal(result.duplicate, false);
      if (result.relationship === "same-series") {
        assert.equal(product.skuId, "ME-001");
        assert.deepEqual(result.ownedProductIds, ["ME-003"]);
        assert.match(result.text, /Walnut wool tailoring/);
        continue;
      }
      assert.match(result.text, /fictional history/);
      assert.match(result.text, /palette|catalog variants/);
      assert.match(result.text, /Same-series unverified/);
      assert.ok(
        history.some((entry) => result.ownedProductIds.includes(entry.skuId)),
      );
      assert.ok(result.visualText.includes(byId(result.ownedProductIds[0]).en));
    }
  }
});
test("seeded history explains the declared walnut series without inferring collections from colours", () => {
  const result = findHistoryGuidance({
    productId: "ME-001",
    history: initialState().purchaseHistory,
    language: "en",
  });
  assert.equal(result.relationship, "same-series");
  assert.deepEqual(result.ownedProductIds, ["ME-003"]);
  assert.match(result.text, /Walnut wool tailoring/);
  assert.match(result.text, /shared colour alone does not establish a series/);
});
test("fresh or pre-history profiles seed once; explicit empty and edited histories survive reload", () => {
  assert.ok(restoreState(null).state.purchaseHistory.length);
  const legacy = initialState();
  delete legacy.purchaseHistory;
  delete legacy.purchaseHistoryOrigin;
  const restored = restoreState(legacy).state;
  assert.ok(restored.purchaseHistory.length);
  assert.equal(restored.purchaseHistoryOrigin, "seeded");
  for (const patch of [
    { purchaseHistory: [] },
    { purchaseHistory: [], purchaseHistoryOrigin: "edited" },
    {
      purchaseHistory: [{ skuId: "ME-018", color: "Chalk", size: "ONE SIZE" }],
    },
  ]) {
    const saved = { ...legacy, ...patch };
    const result = restoreState(saved).state;
    assert.deepEqual(result.purchaseHistory, patch.purchaseHistory);
    assert.equal(result.purchaseHistoryOrigin, "edited");
    assert.deepEqual(
      restoreState(result).state.purchaseHistory,
      patch.purchaseHistory,
    );
  }
});
test("curated scenes are promoted within filters and feedback while all eligible products remain unique", () => {
  for (const scenario of curatedScenarios) {
    const profile = profileFor(scenario),
      featured = scenario.products.slice(0, 5).map((entry) => entry.skuId);
    const products = buildFeed({ budget: 10000 }, profile).filter(
      (entry) => entry.type === "product",
    );
    assert.deepEqual(
      new Set(products.slice(0, featured.length).map((entry) => entry.id)),
      new Set(featured),
    );
    assert.equal(
      new Set(products.map((entry) => entry.id)).size,
      products.length,
    );
    assert.ok(
      !buildFeed({ category: "home", budget: 1000 }, profile).some(
        (entry) => entry.id === "ME-017",
      ),
    );
    assert.ok(
      !buildFeed({}, profile, { [featured[0]]: "less" }).some(
        (entry) => entry.id === featured[0],
      ),
    );
  }
});

test("every prepared asset is real WebP data matching reviewed provenance", async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL("../public/personalized-scenes/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(manifest.assets.length, 56);
  assert.equal(manifest.assetCount, 56);
  assert.equal(
    new Set(manifest.assets.map((entry) => entry.output.sha256)).size,
    56,
    "every SKU scene has distinct actual output bytes",
  );
  assert.deepEqual(
    manifest.catalogCoverage.map((entry) => ({
      ready: entry.ready,
      missing: entry.missing,
    })),
    [
      { ready: 28, missing: [] },
      { ready: 28, missing: [] },
    ],
  );
  for (const source of manifest.sourceManifests) {
    const data = await readFile(
      new URL(
        `../public/personalized-scenes/${source.fileName}`,
        import.meta.url,
      ),
    );
    assert.equal(
      createHash("sha256").update(data).digest("hex"),
      source.sha256,
    );
    assert.equal(JSON.parse(data).assets.length, source.assetCount);
  }
  for (const scenario of curatedScenarios)
    for (const scene of scenario.products) {
      const asset = manifest.assets.find(
        (asset) => asset.fileName === scene.file,
      );
      assert.equal(asset.personaId, scenario.personaId);
      assert.equal(asset.homeId, scenario.homeId);
      assert.equal(asset.roomId, scenario.room);
      assert.equal(asset.primarySku, scene.skuId);
      assert.equal(asset.reviewStatus, "visually-reviewed");
      const bytes = await readFile(
        new URL(`../public/personalized-scenes/${scene.file}`, import.meta.url),
      );
      assert.equal(bytes.subarray(0, 4).toString(), "RIFF");
      assert.equal(bytes.subarray(8, 12).toString(), "WEBP");
      assert.equal(
        createHash("sha256").update(bytes).digest("hex"),
        asset.output.sha256,
      );
      assert.equal(bytes.length, asset.output.bytes);
      const references =
        asset.inputReferences || asset.referenceProvenance || [];
      if (asset.sourceManifest) assert.equal(references.length, 4);
      for (const reference of references) {
        const source =
          reference.sourcePublicPath ||
          `/${reference.path.split("/public/").at(-1)}`;
        const input = await readFile(
          new URL(`../public${source}`, import.meta.url),
        );
        assert.equal(
          createHash("sha256").update(input).digest("hex"),
          reference.sha256,
        );
        if ((reference.index || reference.imageIndex) === 3)
          assert.equal(
            source,
            byId(scene.skuId).image,
            "scene reference must be this exact primary SKU packshot",
          );
      }
    }
});
test("a seeded-origin flag never overwrites modified fictional ownership", () => {
  const state = initialState();
  state.purchaseHistory = [{ skuId: "ME-003", color: "Ink", size: "S" }];
  const restored = restoreState(state).state;
  assert.equal(restored.purchaseHistoryOrigin, "edited");
  assert.deepEqual(restored.purchaseHistory, state.purchaseHistory);
});

test("history palette guidance uses the validated current colour and keeps the saved owned colour", () => {
  for (const language of ["zh", "en"]) {
    const result = findHistoryGuidance({
      productId: "ME-015",
      history: initialState().purchaseHistory,
      variant: { color: "Ink", size: "L" },
      language,
    });
    assert.ok(result.text.includes("Ink"));
    assert.ok(result.text.includes("Burgundy"));
    assert.ok(!result.text.includes("Terracotta"));
    const invalid = findHistoryGuidance({
      productId: "ME-015",
      history: initialState().purchaseHistory,
      variant: { color: "private-made-up" },
      language,
    });
    assert.ok(invalid.text.includes("Terracotta"));
    assert.ok(!invalid.text.includes("private-made-up"));
  }
});

test("the original ten exact outputs and mappings remain unchanged in the full catalog", async () => {
  const original = JSON.parse(
    await readFile(
      new URL(
        "../public/personalized-scenes/provenance/original-source-manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const merged = JSON.parse(
    await readFile(
      new URL("../public/personalized-scenes/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(original.assets.length, 10);
  for (const asset of original.assets) {
    const current = merged.assets.find(
      (entry) => entry.fileName === asset.fileName,
    );
    assert.deepEqual(current, asset);
    const scenario = curatedScenarios.find(
      (entry) =>
        entry.personaId === asset.personaId &&
        entry.homeId === asset.homeId &&
        entry.room === asset.roomId,
    );
    const entry = scenario.products.find(
      (entry) => entry.skuId === asset.primarySku,
    );
    assert.equal(entry.file, asset.fileName);
    assert.equal(entry.type, asset.sceneType);
    assert.equal(entry.color, byId(asset.primarySku).color);
  }
});

test("the independent visual review covers the exact 56 published output hashes", async () => {
  const merged = JSON.parse(
    await readFile(
      new URL("../public/personalized-scenes/manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const reviewData = await readFile(
    new URL(
      `../public/personalized-scenes/${merged.independentReview.fileName}`,
      import.meta.url,
    ),
  );
  assert.equal(
    createHash("sha256").update(reviewData).digest("hex"),
    merged.independentReview.sha256,
  );
  const review = JSON.parse(reviewData);
  assert.equal(review.assets.length, 56);
  assert.equal(new Set(review.assets.map((entry) => entry.fileName)).size, 56);
  assert.ok(
    review.assets.every(
      (entry) => entry.status === "pass" && entry.review.startsWith("pass: "),
    ),
  );
  for (const asset of merged.assets) {
    assert.equal(
      review.assets.find((entry) => entry.fileName === asset.fileName).sha256,
      asset.output.sha256,
    );
    assert.ok(Object.values(asset.claims).every((value) => value === false));
  }
  assert.equal(merged.fitVerified, false);
  assert.equal(merged.roomScaleVerified, false);
});
