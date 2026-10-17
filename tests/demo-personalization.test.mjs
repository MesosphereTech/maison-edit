import test from "node:test";
import assert from "node:assert/strict";
import { initialState } from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";
import {
  initialDemoScenario,
  confirmedDemoProfile,
  DEMO_COMPOSE_DURATION,
  DEMO_ASSET_DEADLINE,
  DEMO_PREVIEW_SCENE_COUNT,
  DEMO_CRITICAL_SCENE_COUNT,
  demoScenePreview,
} from "../src/demo-personalization.js";

test("only the exact four prepared demo combinations can be confirmed", () => {
  assert.equal(curatedScenarios.length, 4);
  assert.deepEqual(
    curatedScenarios
      .filter((s) => ["warm-everyday", "quiet-city"].includes(s.id))
      .map((entry) => demoScenePreview(entry).map((product) => product.skuId)),
    [
      ["ME-015", "ME-017", "ME-002", "ME-004", "ME-019"],
      ["ME-014", "ME-021", "ME-010", "ME-013", "ME-022"],
    ],
  );
  assert.equal(
    confirmedDemoProfile(initialState().profile, "unprepared"),
    null,
  );
  for (const scenario of curatedScenarios) {
    const profile = confirmedDemoProfile(initialState().profile, scenario.id);
    assert.equal(profile.personaId, scenario.personaId);
    assert.equal(profile.homeId, scenario.homeId);
    assert.equal(profile.room, "living");
  }
});
test("previous supported selection is prefilled and unsupported legacy data has a valid draft", () => {
  const scenario = curatedScenarios[1];
  assert.equal(initialDemoScenario(scenario).id, scenario.id);
  assert.equal(
    initialDemoScenario({
      personaId: "silver-woman-68",
      homeId: "airy-couple",
      room: "bedroom",
    }).id,
    curatedScenarios[0].id,
  );
});
test("choosing test identity preserves independently edited preferences", () => {
  const profile = {
    ...initialState().profile,
    name: "My edit",
    size: "XL",
    height: 186,
    styles: ["artful"],
    budget: 9000,
    palette: "blue",
  };
  const selected = confirmedDemoProfile(profile, curatedScenarios[1].id);
  for (const key of ["name", "size", "height", "styles", "budget", "palette"])
    assert.deepEqual(selected[key], profile[key]);
  assert.notEqual(selected.styles, profile.styles);
  assert.equal(profile.personaId, initialState().profile.personaId);
});
test("actual asset preparation has brief feedback and a bounded deadline", () => {
  assert.ok(DEMO_COMPOSE_DURATION >= 300 && DEMO_COMPOSE_DURATION <= 700);
  assert.ok(
    DEMO_ASSET_DEADLINE >= DEMO_COMPOSE_DURATION && DEMO_ASSET_DEADLINE <= 2500,
  );
});

test("preview and mandatory asset work stay bounded as each scene catalog grows", () => {
  assert.equal(DEMO_PREVIEW_SCENE_COUNT, 5);
  assert.equal(DEMO_CRITICAL_SCENE_COUNT, 2);
  for (const scenario of curatedScenarios) {
    const count = scenario.products.length;
    assert.ok(count >= 5 && count <= 28);
    assert.equal(demoScenePreview(scenario).length, 5);
    assert.deepEqual(demoScenePreview(scenario), scenario.products.slice(0, 5));
    assert.equal(
      scenario.products.length,
      count,
      "preview must not mutate the full registry",
    );
  }
});
