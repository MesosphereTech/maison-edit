// Explicit v16 fixture keeps historical scene and ownership regressions stable
// while new-model defaults are covered independently in model-presets.test.mjs.
import { initialState as freshState, switchCuratedCase } from "../src/data.js";
export const initialState = () =>
  switchCuratedCase(freshState(), "warm-everyday");
export const defaultProfile = initialState().profile;
