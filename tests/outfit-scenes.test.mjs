import { defaultProfile } from "./legacy-warm-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import {
  outfitScenes as allOutfitScenes,
  outfitSceneFor,
} from "../src/outfit-scenes.js";
import { catalog, byId } from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";
const outfitScenes = allOutfitScenes.filter((s) => !s.id.startsWith("v17-"));
const profileFor = (scene) => ({
  ...defaultProfile,
  personaId: scene.personaId,
  homeId: scene.homeId,
  room: "living",
});
const provenance = JSON.parse(
  await readFile(new URL("../docs/outfit-provenance-v1.json", import.meta.url)),
);

test("seven independently generated outfits cover every gender-matched apparel anchor", () => {
  assert.equal(outfitScenes.length, 7);
  assert.equal(provenance.assets.length, 7);
  const apparel = catalog.filter((p) => ["women", "men"].includes(p.category));
  assert.equal(apparel.length, 13);
  const anchors = new Set(outfitScenes.flatMap((scene) => scene.primarySkuIds));
  for (const item of apparel)
    assert.ok(anchors.has(item.id), `${item.id} missing full-outfit scene`);
  for (const scene of outfitScenes) {
    assert.ok(
      curatedScenarios.some(
        (s) => s.personaId === scene.personaId && s.homeId === scene.homeId,
      ),
    );
    const record = provenance.assets.find((a) => a.src === scene.src);
    assert.ok(record);
    assert.deepEqual(
      scene.products,
      record.picturedComponents.map(({ skuId, color }) => ({ skuId, color })),
    );
    assert.deepEqual(scene.primarySkuIds, record.anchorSkuIds);
    assert.ok(
      scene.products.some(({ skuId }) => byId(skuId).kind === "shoe"),
      "complete outfit must show shoes",
    );
    for (const p of scene.products) assert.equal(p.color, byId(p.skuId).color);
    assert.equal(record.reviewStatus, "visually-reviewed");
    assert.equal(record.claims.exactPhysicalProduct, false);
    assert.equal(record.claims.verifiedFit, false);
  }
});
test("outfit bytes and every input reference match recorded provenance", async () => {
  const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
  let total = 0;
  for (const scene of provenance.assets) {
    const bytes = await readFile(
      new URL(`../public${scene.src}`, import.meta.url),
    );
    total += bytes.length;
    assert.equal(hash(bytes), scene.output.sha256);
    assert.equal(bytes.length, scene.output.bytes);
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.equal(
      hash(
        await readFile(
          new URL(`../public${scene.personaReference}`, import.meta.url),
        ),
      ),
      scene.personaReferenceSha256,
    );
    for (const p of [...scene.picturedComponents, ...scene.suggestedComponents])
      assert.equal(
        hash(
          await readFile(
            new URL(`../public${p.catalogImage}`, import.meta.url),
          ),
        ),
        p.referenceSha256,
      );
    assert.equal(
      hash(
        await readFile(
          new URL(
            `../${scene.generationInputs.referenceBoard}`,
            import.meta.url,
          ),
        ),
      ),
      scene.generationInputs.referenceBoardSha256,
    );
  }
  assert.ok(total < 2000000, "seven outfit images should remain under2MB");
});
test("outfit mapping requires exact case, room, SKU and primary colour", () => {
  for (const scene of outfitScenes) {
    const profile = profileFor(scene);
    for (const id of scene.primarySkuIds) {
      const product = byId(id);
      assert.equal(outfitSceneFor(id, profile, product.color)?.src, scene.src);
      assert.equal(outfitSceneFor(id, profile, "unsupported"), null);
      assert.equal(
        outfitSceneFor(id, { ...profile, room: "bedroom" }, product.color),
        null,
      );
      assert.equal(
        outfitSceneFor(id, { ...profile, personaId: "unknown" }, product.color),
        null,
      );
    }
  }
  const man = {
    ...defaultProfile,
    personaId: "relaxed-man-50",
    homeId: "compact-city",
  };
  assert.equal(
    outfitSceneFor("ME-001", man, "Walnut"),
    null,
    "women clothing cannot reuse a man wearing scene",
  );
  assert.equal(
    outfitSceneFor("ME-008", defaultProfile, "Brass"),
    null,
    "uncertain earrings stay suggestions, never pictured links",
  );
  const knit = outfitScenes.find((s) => s.id === "man-knit-cafe");
  assert.ok(
    !knit.products.some((p) => p.skuId === "ME-016"),
    "covered belt is never labeled pictured",
  );
});
