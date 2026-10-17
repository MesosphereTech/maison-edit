import { initialState } from "./legacy-warm-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { byId, restoreState, makeBooking } from "../src/data.js";
import {
  tryListVariant,
  tryListSizeLabel,
  tryListPreparationLabel,
  sanitizeTryListLine,
  isTryOnPiece,
} from "../src/try-list.js";
const en = (_zh, text) => text;
const woman = initialState().profile;
const man = { ...woman, personaId: "relaxed-man-50", size: "L" };
const line = (id, profile = woman, extra = {}) => ({
  lineId: `test-${id}`,
  skuId: id,
  color: byId(id).color,
  quantity: 1,
  ...tryListVariant(byId(id), profile, extra.gift),
  preparation: { status: "pending", submittedAt: "2026-10-16T05:00:00.000Z" },
  ...extra,
});

test("self clothing matches the selected fictional profile and preserves a valid edited size", () => {
  assert.equal(tryListVariant(byId("ME-001"), woman).size, "M");
  assert.equal(tryListVariant(byId("ME-012"), man).size, "L");
  assert.equal(
    tryListVariant(byId("ME-001"), { ...woman, size: "XL" }).size,
    "XL",
  );
  assert.equal(
    tryListVariant(byId("ME-001"), { personaId: woman.personaId }).size,
    "M",
  );
});
test("shoe templates stay distinct from catalog size and carry a fictional qualifier", () => {
  const shoe = line("ME-007");
  assert.equal(shoe.size, "ONE SIZE");
  assert.equal(shoe.fit.displaySize, "EU 38");
  assert.match(tryListSizeLabel(shoe, en), /fictional shoe template/);
  assert.equal(tryListVariant(byId("ME-013"), man).fit.displaySize, "EU 42");
});
test("unsupported clothing size remains pending rather than substituting a matched claim", () => {
  const variant = tryListVariant({ ...byId("ME-001"), sizes: ["XS"] }, woman);
  assert.equal(variant.size, "XS");
  assert.equal(variant.fit.status, "pending");
  assert.match(
    tryListPreparationLabel({ ...variant }, en),
    /matched size pending/,
  );
});
test("unknown gift recipient never borrows buyer size or claims a size reservation", () => {
  const gift = { isGift: true, recipientSize: "" };
  const variant = tryListVariant(
    byId("ME-001"),
    { ...woman, size: "XL" },
    gift,
  );
  assert.equal(variant.size, "XS");
  assert.equal(variant.fit.status, "pending");
  assert.equal(variant.fit.source, "recipient");
  assert.match(
    tryListSizeLabel({ ...variant, gift }, en),
    /Recipient size: confirm at store/,
  );
  assert.doesNotMatch(tryListSizeLabel({ ...variant, gift }, en), /XS|XL/);
  assert.match(
    tryListPreparationLabel(
      { ...variant, gift, preparation: { status: "ready" } },
      en,
    ),
    /recipient size pending/,
  );
  assert.doesNotMatch(
    tryListPreparationLabel(
      { ...variant, gift, preparation: { status: "ready" } },
      en,
    ),
    /confirmed ready/,
  );
});
test("known recipient clothing and shoe sizes are independent from the buyer", () => {
  const clothing = tryListVariant(byId("ME-001"), man, {
    isGift: true,
    recipientSize: "S",
  });
  assert.equal(clothing.size, "S");
  assert.equal(clothing.fit.displaySize, "S");
  const shoe = tryListVariant(byId("ME-007"), man, {
    isGift: true,
    recipientSize: "EU 37",
  });
  assert.equal(shoe.size, "ONE SIZE");
  assert.equal(shoe.fit.displaySize, "EU 37");
});
test("non-apparel uses an experience list and no clothing-size claim", () => {
  const item = line("ME-017");
  assert.equal(isTryOnPiece(byId("ME-017")), false);
  assert.equal(isTryOnPiece(byId("ME-007")), true);
  assert.equal(item.fit.status, "not-required");
  assert.match(tryListSizeLabel(item, en), /no size needed/);
});
test("legacy likes and cart remain separate from owned history and submission", () => {
  const state = initialState();
  const history = structuredClone(state.purchaseHistory);
  state.wishlist = ["ME-001"];
  const restored = restoreState(state).state;
  assert.deepEqual(restored.wishlist, ["ME-001"]);
  assert.deepEqual(restored.cart, []);
  assert.deepEqual(restored.purchaseHistory, history);
  const legacy = {
    lineId: "old",
    skuId: "ME-001",
    size: "S",
    color: "Walnut",
    quantity: 1,
  };
  const kept = sanitizeTryListLine(legacy, byId(legacy.skuId), woman);
  assert.deepEqual(kept, legacy);
  assert.match(
    tryListPreparationLabel(kept, en),
    /awaiting store confirmation/,
  );
});
test("malformed saved fit text and arbitrary preparation state cannot masquerade as ready", () => {
  const state = initialState();
  const bad = line("ME-001", woman, {
    fit: {
      status: "matched",
      source: "fictional-persona",
      personaId: woman.personaId,
      kind: "clothing",
      displaySize: "fabricated reserved size",
    },
    preparation: {
      status: "ready",
      acknowledgedAt: "2026-10-16T05:01:00.000Z",
    },
  });
  state.cart = [bad];
  const restored = restoreState(state).state;
  assert.equal(restored.cart[0].fit.status, "pending");
  assert.equal(restored.cart[0].preparation.status, "pending");
  assert.doesNotMatch(
    JSON.stringify(restored.cart[0]),
    /fabricated reserved size/,
  );
  const arbitrary = sanitizeTryListLine(
    line("ME-001", woman, { preparation: { status: "instantly-reserved" } }),
    byId("ME-001"),
    woman,
  );
  assert.equal(arbitrary.preparation.status, "pending");
});
test("a valid explicit merchant acknowledgement survives restore and booking", () => {
  const ready = line("ME-001", woman, {
    preparation: {
      status: "ready",
      submittedAt: "2026-10-16T05:00:00.000Z",
      acknowledgedAt: "2026-10-16T05:01:00.000Z",
    },
  });
  const state = initialState();
  state.cart = [ready];
  assert.equal(restoreState(state).state.cart[0].preparation.status, "ready");
  const booking = makeBooking([ready], {
    date: "2026-10-17",
    time: "11:00",
    name: "Alex",
    sharedFields: {},
  });
  assert.equal(booking.items[0].status, "ready");
  assert.equal(booking.items[0].fit.displaySize, "M");
});

test("restored booked pending gifts cannot retain a Ready badge", () => {
  const gift = { isGift: true, recipientSize: "" };
  const pending = line("ME-001", woman, { gift });
  const booking = makeBooking([pending], {
    date: "2026-10-17",
    time: "11:00",
    name: "Alex",
    sharedFields: {},
  });
  booking.items[0].status = "ready";
  booking.items[0].preparation = {
    status: "ready",
    acknowledgedAt: "2026-10-16T05:01:00.000Z",
  };
  const state = initialState();
  state.bookings = [booking];
  const restored = restoreState(state).state.bookings[0].items[0];
  assert.equal(restored.fit.status, "pending");
  assert.equal(restored.status, "pending");
  assert.equal(restored.preparation.status, "pending");
});
test("booked matched preparation keeps its original persona across case changes", () => {
  const ready = line("ME-001", woman, {
    preparation: {
      status: "ready",
      acknowledgedAt: "2026-10-16T05:01:00.000Z",
    },
  });
  const booking = makeBooking([ready], {
    date: "2026-10-17",
    time: "11:00",
    name: "Alex",
    sharedFields: {},
  });
  const state = initialState();
  state.profile = man;
  state.bookings = [booking];
  const restored = restoreState(state).state.bookings[0].items[0];
  assert.equal(restored.fit.personaId, woman.personaId);
  assert.equal(restored.fit.displaySize, "M");
  assert.equal(restored.preparation.status, "ready");
});
