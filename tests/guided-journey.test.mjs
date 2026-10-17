import assert from "node:assert/strict";
import test from "node:test";
import {
  JOURNEY_PRODUCT_COUNT,
  journeyEase,
  meaningfulProductRect,
  nextFeedPausePosition,
  recordViewedProduct,
  restoreJourney,
} from "../src/guided-journey.js";
test("eight meaningful distinct SKUs, never rendered occurrences, queue once", () => {
  let p = restoreJourney(null);
  for (let i = 0; i < 7; i++) p = recordViewedProduct(p, `SKU-${i}`, i);
  assert.equal(p.status, "browsing");
  assert.equal(p.seen.length, 7);
  assert.equal(recordViewedProduct(p, "SKU-1", 500), p);
  p = recordViewedProduct(p, "SKU-7", 9);
  assert.equal(p.seen.length, JOURNEY_PRODUCT_COUNT);
  assert.equal(p.status, "pending");
  assert.equal(p.afterPosition, 9);
  assert.equal(recordViewedProduct(p, "SKU-8", 10), p);
  for (const status of ["exited", "completed"])
    assert.equal(
      recordViewedProduct({ ...p, status }, "SKU-9", 12).status,
      status,
    );
});
test("restore deduplicates state and ignores damaged input", () => {
  assert.equal(restoreJourney("{").seen.length, 0);
  assert.deepEqual(
    restoreJourney({ seen: ["A", "A", false, "B"], status: "invented" }).seen,
    ["A", "B"],
  );
  assert.equal(restoreJourney({ status: "exited" }).status, "exited");
  assert.equal(
    restoreJourney({ status: "pending", seen: ["A"] }).status,
    "browsing",
    "damaged pending state cannot invent eight views",
  );
});
test("real pause follows the last viewed position for short and full feeds", () => {
  assert.equal(nextFeedPausePosition(0, 8), null);
  assert.equal(nextFeedPausePosition(28, 9), 28);
  assert.equal(nextFeedPausePosition(28, 28), 57);
  assert.equal(nextFeedPausePosition(3, 7), 18);
  assert.equal(nextFeedPausePosition(3, 18), 37);
});
test("meaningful view excludes hidden, slivers, horizontal clipping and header coverage", () => {
  const viewport = { width: 390, height: 844 };
  const rect = {
    left: 20,
    right: 355,
    top: 110,
    bottom: 430,
    width: 335,
    height: 320,
  };
  assert.equal(meaningfulProductRect(rect, viewport, 80), true);
  assert.equal(
    meaningfulProductRect({ ...rect, top: 800, bottom: 1120 }, viewport, 80),
    false,
  );
  assert.equal(
    meaningfulProductRect({ ...rect, left: -200, right: 135 }, viewport, 80),
    false,
  );
  assert.equal(
    meaningfulProductRect({ ...rect, top: -210, bottom: 110 }, viewport, 80),
    false,
  );
  assert.equal(
    meaningfulProductRect({ ...rect, width: 0 }, viewport, 80),
    false,
  );
});
test("travel begins slowly, accelerates, and docks within bounds", () => {
  assert.equal(journeyEase(-1), 0);
  assert.equal(journeyEase(2), 1);
  assert.ok(
    journeyEase(0.2) - journeyEase(0.1) < journeyEase(0.4) - journeyEase(0.3),
  );
  assert.equal(journeyEase(0.5), 0.5);
});
