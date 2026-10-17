import test from "node:test";
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { byId, initialState, makeBooking, restoreState } from "../src/data.js";
import {
  defaultGift,
  giftPackagingOptions,
  giftSummary,
  normalizeGift,
  sameGiftPreferences,
  sanitizeGiftLine,
} from "../src/gift-packaging.js";
import { giftSceneContext } from "../src/gift-scenes.js";
import { outfitSceneFor } from "../src/outfit-scenes.js";
import { personalizedSceneFor } from "../src/personalized-scenes.js";
import { tryListVariant, tryListSizeLabel } from "../src/try-list.js";
const en = (_, english) => english;
const line = () => ({
  lineId: "gift-test",
  skuId: "ME-001",
  size: "M",
  color: "Walnut",
  quantity: 1,
});

test("gifting is always explicit; unowned and legacy lines remain self-use", () => {
  for (const value of [
    null,
    undefined,
    {},
    { isGift: false },
    { isGift: "true" },
  ])
    assert.equal(normalizeGift(value), null);
  assert.deepEqual(sanitizeGiftLine(line()), line());
  assert.deepEqual(
    sanitizeGiftLine({ ...line(), gift: { isGift: false } }),
    line(),
  );
  assert.equal(sameGiftPreferences(undefined, null), true);
  assert.equal(sameGiftPreferences(undefined, defaultGift()), false);
});

test("gift preferences are bounded, known options and no fabricated size", () => {
  const gift = normalizeGift({
    isGift: true,
    packagingId: "unknown",
    recipient: `  ${"r".repeat(80)}  `,
    recipientSize: "invented",
    occasion: "unknown",
    includeCard: true,
    cardMessage: "a".repeat(200),
  });
  assert.equal(gift.packagingId, "ivory-silk");
  assert.equal(gift.recipient.length, 40);
  assert.equal(gift.recipientSize, "");
  assert.equal(gift.occasion, "");
  assert.equal(gift.cardMessage.length, 160);
  assert.equal(normalizeGift({ ...gift, includeCard: false }).cardMessage, "");
  assert.equal(
    normalizeGift({ ...gift, recipientSize: "EU 42" }).recipientSize,
    "EU 42",
  );
  assert.equal(
    normalizeGift({ ...gift, recipientSize: "EU 77" }).recipientSize,
    "",
  );
});

test("distinct recipients, wrapping or card notes never merge with each other", () => {
  const gift = defaultGift();
  assert.ok(sameGiftPreferences(gift, structuredClone(gift)));
  for (const patch of [
    { recipient: "Alex" },
    { packagingId: "floral-accent" },
    { recipientSize: "L" },
    { occasion: "birthday" },
    { includeCard: true, cardMessage: "Happy birthday" },
  ])
    assert.equal(sameGiftPreferences(gift, { ...gift, ...patch }), false);
});

test("all wrapping concepts exist locally and summaries identify local gift preferences", async () => {
  for (const option of giftPackagingOptions)
    await access(new URL(`../public${option.image}`, import.meta.url));
  assert.equal(giftSummary(null, en), "");
  const summary = giftSummary(
    {
      ...defaultGift(),
      recipient: "a friend",
      occasion: "birthday",
      includeCard: true,
    },
    en,
  );
  assert.match(
    summary,
    /Gift.*Silk-ribbon box.*For a friend.*Birthday.*confirm at store.*With a gift card/,
  );
});

test("gift metadata survives booking, restoration and scenario persistence without buyer-size inference", () => {
  const state = initialState();
  const gift = {
    ...defaultGift(),
    recipient: "a friend",
    includeCard: true,
    cardMessage: "A little joy",
  };
  const variant = tryListVariant(byId("ME-001"), state.profile, gift);
  state.cart = [
    { ...line(), ...variant, gift, preparation: { status: "pending" } },
  ];
  assert.match(tryListSizeLabel(state.cart[0], en), /confirm at store/);
  assert.equal(variant.fit.source, "recipient");
  assert.equal(variant.fit.status, "pending");
  const restored = restoreState(JSON.parse(JSON.stringify(state)));
  assert.equal(restored.recovered, false);
  assert.deepEqual(restored.state.cart[0].gift, gift);
  const booking = makeBooking(
    state.cart,
    {
      date: "2030-01-01",
      time: "11:00",
      name: "Demo",
      sharedFields: { items: true },
    },
    1234,
  );
  assert.deepEqual(booking.items[0].gift, gift);
  assert.notEqual(booking.items[0].gift, state.cart[0].gift);
  state.bookings = [booking];
  assert.deepEqual(restoreState(state).state.bookings[0].items[0].gift, gift);
  assert.deepEqual(
    sanitizeGiftLine({
      ...line(),
      fit: variant.fit,
      preparation: { status: "ready" },
    }).preparation,
    { status: "ready" },
  );
});

test("gift model preview matches the product department and never mutates the shopper", () => {
  const state = initialState();
  const snapshot = structuredClone(state.profile);
  assert.equal(giftSceneContext(byId("ME-001"), state.profile), null);
  const context = giftSceneContext(byId("ME-012"), state.profile);
  assert.equal(
    context.explicitGift,
    false,
    "gift idea is not consent to gift metadata",
  );
  assert.equal(context.profile.personaId, "julian-model-34");
  const scene = outfitSceneFor("ME-012", context.profile, "Ink");
  assert.ok(scene && scene.src.includes("julian-tailoring"));
  const explicit = giftSceneContext(byId("ME-001"), state.profile, {
    ...defaultGift(),
    packagingId: "floral-accent",
  });
  assert.equal(explicit.explicitGift, true);
  assert.equal(explicit.packaging.id, "floral-accent");
  assert.equal(
    giftSceneContext(byId("ME-019"), state.profile, defaultGift()),
    null,
  );
  assert.deepEqual(state.profile, snapshot);
  assert.equal(outfitSceneFor("ME-012", context.profile, "Chalk"), null);
  assert.equal(
    personalizedSceneFor("ME-012", context.profile, "Chalk"),
    null,
    "unsupported colours have no invented model match",
  );
});
