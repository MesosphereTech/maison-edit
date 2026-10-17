import test from "node:test";
import assert from "node:assert/strict";
import {
  attentionScore,
  hottestTarget,
  ATTENTION_SETTLE_MS,
  POINTER_INTENT_MS,
  ATTENTION_VISIBLE_RATIO,
  targetVisual,
} from "../src/attention.js";
import {
  acceptConciergeEvent,
  createConciergeSession,
} from "../src/concierge.js";
const viewport = { width: 1440, height: 1000 };
const rect = (left, top, width = 400, height = 600) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});
const element = (id, r) => ({ id, getBoundingClientRect: () => r });
test("attention picks visible-area and viewport-center instead of first DOM card", () => {
  const first = element("first", rect(0, -400)),
    center = element("center", rect(500, 230)),
    edge = element("edge", rect(1020, 230));
  assert.equal(hottestTarget([first, edge, center], viewport, 90), center);
  assert.equal(attentionScore(rect(0, 1100), viewport, 90), -Infinity);
  assert.equal(
    hottestTarget([element("empty", rect(0, 0, 0, 0))], viewport),
    null,
  );
});
test("attention thresholds allow immediate acknowledgment and a short stable reply", () => {
  assert.ok(POINTER_INTENT_MS <= 40);
  assert.equal(
    ATTENTION_SETTLE_MS,
    0,
    "visible content never waits behind a dwell timer",
  );
  assert.equal(ATTENTION_VISIBLE_RATIO, 0.14);
});
test("attention refreshes distinct settled targets after the old proactive budget is exhausted", () => {
  let session = { ...createConciergeSession(), count: 5, lastAt: 1000 };
  for (let index = 0; index < 10; index++) {
    const result = acceptConciergeEvent(
      session,
      {
        type: "attention",
        productId: `ME-00${(index % 2) + 1}`,
        contextKey: "feed",
        attentionToken: index,
      },
      1000 + index * 300,
    );
    assert.equal(result.accepted, true);
    session = result.session;
  }
  assert.equal(
    session.count,
    5,
    "replacing a local hint does not spend conversational popup budget",
  );
  assert.equal(
    acceptConciergeEvent(
      session,
      {
        type: "attention",
        productId: "ME-002",
        contextKey: "feed",
        attentionToken: 9,
      },
      5000,
    ).accepted,
    false,
  );
  assert.equal(
    acceptConciergeEvent(
      session,
      {
        type: "attention",
        productId: "INVALID",
        contextKey: "feed",
        attentionToken: 10,
      },
      5000,
    ).accepted,
    false,
  );
});

test("scrolled-away non-sticky headers cannot extend attention above the viewport", () => {
  assert.equal(attentionScore(rect(20, -800), viewport, -1800), -Infinity);
  assert.equal(
    attentionScore(rect(500, 230), viewport, -1800),
    attentionScore(rect(500, 230), viewport, 0),
  );
});

test("attention measures the visible image rather than a passed card's metadata", () => {
  const image = element("image", rect(200, -650, 400, 600));
  const card = {
    ...element("metadata-only", rect(200, -650, 400, 950)),
    querySelector: () => image,
  };
  assert.equal(targetVisual(card), image);
  assert.equal(hottestTarget([card], viewport, 0), null);
});
