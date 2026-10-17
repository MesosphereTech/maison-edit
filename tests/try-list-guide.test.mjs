import test from "node:test";
import assert from "node:assert/strict";
import { createTryListGuideReply } from "../src/try-list-guide.js";

test("a try-list submission acknowledges only fictional matching and pending preparation", () => {
  for (const language of ["zh", "en"]) {
    const result = createTryListGuideReply({
      language,
      event: {
        type: "add",
        productId: "ME-001",
        fit: {
          status: "matched",
          source: "fictional-persona",
          matchedSize: "M",
        },
        preparation: { status: "pending" },
      },
    });
    assert.match(result.text, /M/);
    assert.match(result.text, /等待|awaits/);
    assert.match(result.text, /虚构|fictional/);
    assert.equal(result.mode, "demo");
  }
});
test("an unknown gift recipient never inherits buyer size or claims reservation", () => {
  const result = createTryListGuideReply({
    language: "en",
    event: {
      type: "add",
      productId: "ME-001",
      gift: { isGift: true, packagingId: "floral-accent" },
      fit: { status: "pending", source: "recipient" },
    },
  });
  assert.match(result.text, /recipient’s size needs confirmation/);
  assert.match(result.text, /Your own size is not used/);
  assert.match(result.text, /Botanical|botanical/);
  assert.doesNotMatch(result.text, /matches size/);
});
test("only a ready simulated merchant acknowledgement can describe a local reservation", () => {
  const result = createTryListGuideReply({
    language: "en",
    event: {
      type: "preparation",
      productId: "ME-001",
      fit: { status: "matched", matchedSize: "M" },
      preparation: { status: "ready" },
    },
  });
  assert.match(result.text, /reserved for trying in this local simulation/);
  assert.match(result.text, /no real stock was reserved/);
  const gift = createTryListGuideReply({
    language: "en",
    event: {
      type: "preparation",
      productId: "ME-001",
      gift: { isGift: true },
      fit: { status: "pending" },
      preparation: { status: "ready" },
    },
  });
  assert.match(gift.text, /no size is reserved/);
  assert.doesNotMatch(gift.text, /reserved for trying/);
});
test("gift preference changes are honest local choices; unrelated events produce no action acknowledgement", () => {
  assert.match(
    createTryListGuideReply({
      language: "en",
      event: {
        type: "gift",
        productId: "ME-001",
        gift: { isGift: true, packagingId: "ivory-silk" },
      },
    }).text,
    /local demo preferences/,
  );
  assert.equal(
    createTryListGuideReply({
      event: { type: "attention", productId: "ME-001" },
    }),
    null,
  );
  assert.equal(
    createTryListGuideReply({ event: { type: "add", productId: "unknown" } }),
    null,
  );
});

test("the current store-list page reports submitted cart entries without treating legacy likes as preparation", async () => {
  const { createConciergeReply } = await import("../src/concierge.js");
  const empty = createConciergeReply({
    event: { type: "page", page: "try-list" },
    language: "en",
    wishlist: ["ME-001"],
  });
  assert.deepEqual(empty.productIds, []);
  assert.match(empty.text, /store list is empty/);
  assert.match(empty.text, /not submitted automatically/);
  const result = createConciergeReply({
    event: { type: "page", page: "try-list" },
    language: "zh",
    wishlist: ["ME-001"],
    cart: [
      { skuId: "ME-019", quantity: 1, preparation: { status: "pending" } },
    ],
  });
  assert.deepEqual(result.productIds, ["ME-019"]);
  assert.match(result.text, /备货请求等待演示门店确认/);
  assert.doesNotMatch(result.text, /已收藏|选择规格后加入/);
});
