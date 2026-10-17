import test from "node:test";
import assert from "node:assert/strict";
import {
  FRAME_MORPH_MS,
  ATTENTION_LAP_MS,
  PARTICLE_FLIGHT_MS,
  ARRIVAL_TEXT_DELAY_MS,
  frameTransform,
  destinationTransform,
} from "../src/attention-motion.js";
test("frame morph uses a translation/scale matrix with no animated layout geometry", () => {
  const source = { left: 90, top: 120, width: 400, height: 600 };
  const destination = { left: 1100, top: 500, width: 200, height: 150 };
  assert.equal(
    frameTransform(source, destination),
    "translate3d(90px, 120px, 0) scale(2, 4)",
  );
  assert.equal(
    destinationTransform(destination),
    "translate3d(1100px, 500px, 0) scale(1, 1)",
  );
  assert.equal(
    FRAME_MORPH_MS,
    620,
    "the source-to-bubble flight remains clearly perceptible",
  );
});

test("decorative connection is short and never adds a text gate", () => {
  assert.ok(ATTENTION_LAP_MS <= 600);
  assert.ok(PARTICLE_FLIGHT_MS <= 450);
  assert.equal(ARRIVAL_TEXT_DELAY_MS, 0);
});
