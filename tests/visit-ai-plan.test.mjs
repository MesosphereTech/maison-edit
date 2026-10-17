import test from "node:test";
import assert from "node:assert/strict";
import { initialState, byId } from "../src/data.js";
import { tryListVariant } from "../src/try-list.js";
import {
  initialVisitPreferences,
  interpretVisitMessage,
  buildAIVisitPlan,
  visitPlanReply,
} from "../src/visit-ai-plan.js";
test("entry plans every region from the current list, without changing shopping state", () => {
  const state = initialState(),
    before = structuredClone(state),
    plan = buildAIVisitPlan(state);
  assert.ok(plan.stops.length > 2);
  assert.ok(plan.sizeLabels.length);
  assert.equal(
    plan.stops.reduce((a, b) => a + b.minutes, 0),
    plan.minutes,
  );
  assert.deepEqual(state, before);
  assert.match(visitPlanReply(plan, "en", true, true), /first plan/);
});
test("time, shoes-first and fewer-walking compose and change the actual route", () => {
  let prefs = initialVisitPreferences();
  for (const message of ["30 minutes", "shoes first", "less walking"])
    prefs = interpretVisitMessage(message, prefs).preferences;
  const plan = buildAIVisitPlan(initialState(), prefs);
  assert.equal(plan.minutes, 30);
  assert.equal(
    plan.stops.reduce((a, b) => a + b.minutes, 0),
    30,
  );
  assert.match(plan.stops[1].id, /shoes/);
  assert.ok(plan.omitted.every((x) => x.id.startsWith("home")));
  assert.equal(plan.preferences.lessWalking, true);
  assert.equal(plan.revision, 4);
});
test("gift and wrapping choices update only the planner and never assume a recipient size", () => {
  const state = initialState(),
    item = byId("ME-015");
  state.cart = [
    {
      lineId: "one",
      skuId: item.id,
      ...tryListVariant(item, state.profile),
      quantity: 1,
      color: item.color,
    },
  ];
  const before = structuredClone(state),
    prefs = interpretVisitMessage("a gift with cotton wrapping").preferences,
    plan = buildAIVisitPlan(state, prefs);
  assert.equal(plan.giftPreview, true);
  assert.equal(plan.stops.at(-1).id, "gift");
  assert.equal(plan.giftLines[0].gift.packagingId, "recycled-cotton");
  assert.equal(plan.sizePending, true);
  assert.deepEqual(state, before);
  assert.equal(plan.giftLines[0].fit.status, "pending");
});
test("unknown instructions do not invent changes, sizes remain separate from recipient", () => {
  const p = initialVisitPreferences();
  assert.deepEqual(interpretVisitMessage("hello", p).preferences, p);
  const next = interpretVisitMessage("my size is XL", p).preferences;
  assert.equal(next.size, "XL");
  const plan = buildAIVisitPlan(initialState(), next);
  assert.ok(
    plan.lines
      .filter((x) => !x.gift && x.fit.kind === "clothing")
      .every((x) => x.fit.displaySize === "XL"),
  );
  assert.ok(plan.giftLines.every((x) => !x.gift.recipientSize));
});
test("reset restores the full route and does not mutate an active booking", () => {
  const state = initialState(),
    before = structuredClone(state);
  const altered = interpretVisitMessage("30 minutes less walking").preferences;
  const reset = interpretVisitMessage("reset plan", altered).preferences;
  assert.equal(reset.duration, null);
  assert.equal(reset.lessWalking, false);
  assert.equal(
    buildAIVisitPlan(state, reset).stops.length,
    buildAIVisitPlan(state).stops.length,
  );
  assert.deepEqual(state, before);
});
