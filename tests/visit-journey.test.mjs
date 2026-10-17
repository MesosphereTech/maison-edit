import { getPersonaPreset } from "../src/presets.js";
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { initialState, byId } from "../src/data.js";
import { buildVisitJourney, visitExamples } from "../src/visit-journey.js";
import { tryListVariant } from "../src/try-list.js";
const productLine = (id, state, changes = {}) => ({
  lineId: `selected-${id}`,
  skuId: id,
  ...tryListVariant(byId(id), state.profile),
  color: byId(id).color,
  quantity: 1,
  ...changes,
});

test("an empty visit is a populated read-only example, never a silent cart or booking", () => {
  const state = initialState(),
    before = structuredClone(state);
  const journey = buildVisitJourney(state);
  assert.equal(journey.source, "recommended");
  assert.equal(journey.lines.length, 5);
  assert.equal(journey.stops.length, 5);
  assert.equal(journey.minutes, 60);
  assert.equal(journey.stops[0].time, "14:30");
  assert.equal(journey.stops.at(-1).time, "15:20");
  assert.deepEqual(state, before);
  assert.equal(state.cart.length, 0);
  assert.equal(state.bookings.length, 0);
});
test("the four examples use their exact catalog outfit and synthetic size references", () => {
  const state = initialState();
  for (const example of visitExamples) {
    const journey = buildVisitJourney(state, example.id);
    const expected = getPersonaPreset(example.personaId).size;
    assert.deepEqual(
      journey.lines.filter((line) => !line.gift).map((line) => line.skuId),
      [...example.outfitIds, example.homeIdSku],
    );
    for (const line of journey.lines.filter(
      (line) => line.fit.kind === "clothing" && !line.gift,
    ))
      assert.equal(line.fit.displaySize, expected);
    assert.equal(
      journey.lines.find((line) => line.fit.kind === "shoe").fit.displaySize,
      tryListVariant(
        byId(journey.lines.find((line) => line.fit.kind === "shoe").skuId),
        journey.profile,
      ).fit.displaySize,
    );
  }
});
test("changing the example never changes the selected persona or purchase history", () => {
  const state = initialState(),
    before = structuredClone(state);
  buildVisitJourney(state, "quiet-city");
  buildVisitJourney(state, "warm-everyday");
  assert.deepEqual(state, before);
});
test("a shopper list takes priority over recommendations and preserves exact variants", () => {
  const state = initialState();
  state.cart = [
    productLine("ME-012", state, { size: "XL", color: "Ink", quantity: 2 }),
  ];
  const journey = buildVisitJourney(state, "warm-everyday");
  assert.equal(journey.source, "selected");
  assert.equal(journey.lines.length, 1);
  assert.equal(journey.lines[0].size, "XL");
  assert.equal(journey.lines[0].quantity, 2);
  assert.equal(journey.total, byId("ME-012").price * 2);
  assert.deepEqual(
    journey.stops.map((stop) => stop.id),
    ["welcome", "wardrobe"],
  );
  assert.deepEqual(journey.floors, [1, 3]);
});
test("an active booking retains its pieces, timing and merchant status", () => {
  const state = initialState();
  state.cart = [productLine("ME-015", state)];
  state.bookings = [
    {
      id: "ME-TEST",
      status: "confirmed",
      date: "2026-10-20",
      time: "11:15",
      items: [productLine("ME-019", state, { status: "ready" })],
    },
  ];
  const journey = buildVisitJourney(state);
  assert.equal(journey.source, "booking");
  assert.equal(journey.booking.id, "ME-TEST");
  assert.equal(journey.lines[0].skuId, "ME-019");
  assert.equal(journey.ready, 1);
  assert.equal(journey.stops[0].time, "11:15");
  assert.equal(journey.stops[1].time, "11:20");
});
test("cancelled bookings do not override the current list or empty demo", () => {
  const state = initialState();
  state.bookings = [
    { status: "cancelled", items: [productLine("ME-012", state)] },
  ];
  assert.equal(buildVisitJourney(state).source, "recommended");
  state.cart = [productLine("ME-015", state)];
  assert.equal(buildVisitJourney(state).source, "selected");
});
test("an unknown gift-recipient size can never count as prepared", () => {
  const state = initialState();
  const gift = { isGift: true, packagingId: "ivory-silk", recipientSize: "" };
  state.cart = [
    productLine("ME-006", state, {
      ...tryListVariant(byId("ME-006"), state.profile, gift),
      gift,
      preparation: { status: "ready" },
    }),
  ];
  const journey = buildVisitJourney(state);
  assert.equal(journey.ready, 0);
  assert.equal(journey.lines[0].fit.status, "pending");
  assert.equal(journey.giftLines.length, 1);
  assert.deepEqual(
    journey.stops.map((stop) => stop.id),
    ["welcome", "gift"],
  );
});
test("example totals and counters resolve to exact catalog records", () => {
  for (const example of visitExamples) {
    const journey = buildVisitJourney(initialState(), example.id);
    assert.equal(
      journey.total,
      journey.lines.reduce((sum, line) => sum + byId(line.skuId).price, 0),
    );
    assert.equal(journey.ready, journey.lines.length - 1);
    for (const stop of journey.stops)
      for (const line of stop.items) {
        if (stop.id !== "gift") assert.equal(line.product.floor, stop.floor);
        assert.equal(line.product, byId(line.skuId));
      }
    assert.ok(
      existsSync(new URL(`../public${journey.heroImage}`, import.meta.url)),
    );
    for (const line of journey.lines)
      assert.ok(
        existsSync(new URL(`../public${line.product.image}`, import.meta.url)),
      );
  }
});

test("mixed wardrobe floors are separate stops on a descending route", () => {
  const state = initialState();
  state.cart = [
    productLine("ME-015", state),
    productLine("ME-012", state),
    productLine("ME-019", state),
  ];
  const journey = buildVisitJourney(state);
  assert.deepEqual(
    journey.stops.map((stop) => stop.floor),
    [1, 4, 3, 2],
  );
  assert.equal(
    journey.stops.filter((stop) => stop.id.startsWith("wardrobe")).length,
    2,
  );
  for (const stop of journey.stops)
    for (const line of stop.items) assert.equal(line.product.floor, stop.floor);
});

test("a newly accepted booking alternative stays pending despite an older prep object", () => {
  const state = initialState();
  state.bookings = [
    {
      id: "ME-ALT",
      status: "confirmed",
      date: "2026-10-20",
      time: "11:15",
      items: [
        productLine("ME-025", state, {
          status: "pending",
          preparation: { status: "ready" },
        }),
      ],
    },
  ];
  const journey = buildVisitJourney(state);
  assert.equal(journey.ready, 0);
  assert.equal(journey.lines[0].displayPreparationStatus, "pending");
});
