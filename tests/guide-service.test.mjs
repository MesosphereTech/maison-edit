import assert from "node:assert/strict";
import test from "node:test";
import { guideFailure, browsingPrompt } from "../src/guide-service.js";

test("quota errors stay visible and distinct from generated or local advice", () => {
  assert.match(guideFailure("review_daily_limit", "zh"), /今日评审体验.*明天/);
  assert.match(guideFailure("review_busy", "en"), /other visitors/);
  assert.match(guideFailure("provider_rate_limited", "zh"), /AI 额度.*频繁/);
  assert.match(guideFailure("rate_limited", "en"), /quota.*frequent/);
  assert.doesNotMatch(guideFailure("provider_timeout", "en"), /quota|local demo/i);
  assert.match(guideFailure("no_catalog_matches", "en"), /filters/);
});

test("browsing prompts request contextual prose without transactional promises", () => {
  assert.match(browsingPrompt("zh"), /正在看的.*避免重复/);
  assert.match(browsingPrompt("en"), /piece I am looking at/);
  assert.match(browsingPrompt("en"), /without prices, stock, sizing or transactions/);
});
