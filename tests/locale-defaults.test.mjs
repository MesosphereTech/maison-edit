import test from "node:test";
import assert from "node:assert/strict";
import { initialState, restoreState } from "../src/data.js";

test("fresh and absent-locale visits start in English", () => {
  assert.equal(initialState().language, "en");
  assert.equal(restoreState(null).state.language, "en");
  const saved = initialState();
  delete saved.language;
  assert.equal(restoreState(saved).state.language, "en");
  assert.equal(
    restoreState({ ...saved, language: "unknown" }).state.language,
    "en",
  );
});

test("saved Chinese and English choices survive reloads", () => {
  for (const language of ["zh", "en"]) {
    const saved = { ...initialState(), language };
    const restored = restoreState(JSON.parse(JSON.stringify(saved)));
    assert.equal(restored.state.language, language);
    assert.equal(restored.recovered, false);
  }
});

test("recovering damaged demo data preserves an explicit saved language", () => {
  for (const language of ["zh", "en"]) {
    for (const patch of [{ cart: null }, { version: 2 }]) {
      const restored = restoreState({ ...initialState(), language, ...patch });
      assert.equal(restored.state.language, language);
      assert.equal(restored.recovered, true);
    }
  }
});
