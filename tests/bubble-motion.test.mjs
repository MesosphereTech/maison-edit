import test from "node:test";
import assert from "node:assert/strict";
import {
  BUBBLE_EXIT_MS,
  retireBubbles,
  replaceBubble,
  advanceBubbles,
} from "../src/bubble-motion.js";
const bubble = (id = "a") => ({ id, role: "assistant", remaining: 1000 });
test("dismissal retains the outgoing bubble through its opacity/transform exit", () => {
  const original = bubble(),
    retiring = retireBubbles([original], () => true, "dismiss", 100);
  assert.equal(retiring.length, 1);
  assert.equal(retiring[0].exitReason, "dismiss");
  assert.equal(original.retiring, undefined);
  assert.equal(
    advanceBubbles(retiring, { now: 100 + BUBBLE_EXIT_MS - 1 }).length,
    1,
  );
  assert.deepEqual(advanceBubbles(retiring, { now: 100 + BUBBLE_EXIT_MS }), []);
});
test("repeated retirement does not restart disappearance or remove another bubble", () => {
  const first = retireBubbles(
    [bubble(), bubble("b")],
    (b) => b.id === "a",
    "scroll",
    100,
  );
  const twice = retireBubbles(first, (b) => b.id === "a", "dismiss", 200);
  assert.equal(twice[0].exitAt, 100);
  assert.equal(twice[0].exitReason, "scroll");
  assert.equal(twice[1].retiring, undefined);
});
test("new attention updates one persistent surface without an outgoing replacement", () => {
  const replaced = replaceBubble([bubble()], bubble("next"), 100);
  assert.equal(replaced.length, 1);
  assert.equal(replaced[0].id, "next");
  assert.equal(replaced[0].surfaceKey, "concierge-live");
  assert.equal(replaced[0].remaining, Infinity);
  assert.equal(replaced[0].retiring, undefined);
});
test("time and passed source cannot expire the live bubble", () => {
  const current = [bubble()];
  assert.equal(
    advanceBubbles(current, {
      now: 86400000,
      elapsed: 86400000,
      isCurrent: () => false,
    }),
    current,
  );
  assert.equal(current[0].retiring, undefined);
});
test("live copy has no age; an explicit exit completes with a reduced-motion fallback", () => {
  assert.equal(
    advanceBubbles([bubble()], { now: 200, elapsed: 5000, held: true })[0]
      .remaining,
    1000,
  );
  const retired = retireBubbles([bubble()], () => true, "attention", 100);
  assert.deepEqual(advanceBubbles(retired, { now: 500, held: true }), []);
  assert.deepEqual(advanceBubbles(retired, { now: 100, exitMs: 0 }), []);
});
