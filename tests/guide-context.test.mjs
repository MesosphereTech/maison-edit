import { initialState, defaultProfile } from "./legacy-warm-fixture.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { catalog, byId } from "../src/data.js";
import { curatedScenarios } from "../src/personalized-scenes.js";
import {
  dialogueBank,
  createGuideDialogueReply,
  declaredGuideRelationship,
  renderCuratedGuideTurn,
} from "../src/guide-dialogue-bank.js";

const profile = { ...defaultProfile };
const reply = (args = {}) =>
  createGuideDialogueReply({
    profile,
    filters: { category: "all", budget: 10000 },
    language: "zh",
    ...args,
  });
const history = initialState().purchaseHistory;

test("every catalog SKU has four bilingual browsing lines and two bilingual follow-ups", () => {
  assert.deepEqual(
    Object.keys(dialogueBank).sort(),
    catalog.map((item) => item.id).sort(),
  );
  for (const item of catalog) {
    const entry = dialogueBank[item.id];
    assert.equal(Object.keys(entry.browsing).length, 4);
    assert.equal(Object.keys(entry.followUps).length, 2);
    for (const line of [
      ...Object.values(entry.browsing),
      ...Object.values(entry.followUps),
    ]) {
      assert.ok(line.zh.length > 10 && line.en.length > 15);
      assert.doesNotMatch(line.zh, /保证合身|库存已确认|已经预约成功/);
    }
  }
});

test("browsing hints always identify the current product and remain honest local replies", () => {
  for (const item of catalog)
    for (const language of ["zh", "en"]) {
      const value = reply({
        event: { type: "attention", productId: item.id },
        history,
        language,
      });
      assert.equal(value.mode, "demo");
      assert.notEqual(value.provider, "gemini");
      assert.ok(
        value.text.includes(language === "zh" ? item.name : item.en),
        item.id,
      );
      assert.ok(value.productIds.every((id) => byId(id)));
      assert.ok(
        value.ownedProductIds.every((id) =>
          history.some((line) => line.skuId === id),
        ),
      );
      assert.doesNotMatch(value.text, /live AI|实时.*调用|已经备好|完美合身/i);
    }
});

test("current explicit history edits and clearing override earlier session ownership", () => {
  const first = reply({
    event: { type: "attention", productId: "ME-017" },
    history,
  });
  assert.ok(first.ownedProductIds.includes("ME-019"));
  const edited = [{ skuId: "ME-020", color: "Chalk", size: "ONE SIZE" }];
  const next = reply({
    event: { type: "attention", productId: "ME-017" },
    history: edited,
    session: first.session,
  });
  assert.ok(!next.ownedProductIds.includes("ME-019"));
  const cleared = reply({
    productId: "ME-017",
    message: "和我已有的怎么搭",
    history: [],
    session: next.session,
    wishlist: ["ME-019"],
    cart: [{ skuId: "ME-019", color: "Brass", size: "ONE SIZE", quantity: 1 }],
  });
  assert.deepEqual(cleared.ownedProductIds, []);
  assert.match(cleared.text, /记录.*空|不会.*已有|不会.*买过|不.*虚构.*已有/);
});

test("same-series claims require the exact declared catalog collection", () => {
  assert.equal(declaredGuideRelationship("ME-001", "ME-003"), "same-series");
  for (const id of ["ME-002", "ME-006", "ME-015"])
    assert.notEqual(declaredGuideRelationship("ME-001", id), "same-series");
  const shared = reply({
    productId: "ME-001",
    message: "和记录里的是同系列吗",
    history,
  });
  assert.equal(shared.relationship, "same-series");
  assert.ok(shared.text.includes(byId("ME-003").name));
  const unrelated = reply({
    productId: "ME-015",
    message: "是同系列吗",
    history,
  });
  assert.notEqual(unrelated.relationship, "same-series");
});

test("a duplicate is checked by SKU even when colour or size changes and never upsells", () => {
  const value = reply({
    productId: "ME-019",
    message: "这款我已经有了吗，不要重复买",
    variant: { color: "Chalk", size: "ONE SIZE" },
    history,
  });
  assert.deepEqual(value.productIds, []);
  assert.ok(value.ownedProductIds.includes("ME-019"));
  assert.match(value.text, /同一 SKU|同款|重复/);
  assert.ok(value.text.includes("Brass") && value.text.includes("Chalk"));
});

test("invalid supplied variants are rejected without echoing made-up catalog values", () => {
  const value = reply({
    productId: "ME-001",
    message: "看看颜色和尺码",
    variant: { color: "private-made-up-neon", size: "XXPRIVATE" },
  });
  assert.equal(value.invalidVariant, true);
  assert.doesNotMatch(value.text, /private-made-up-neon|XXPRIVATE/);
  assert.ok(byId("ME-001").colors.includes(value.selectedVariant.color));
  assert.ok(byId("ME-001").sizes.includes(value.selectedVariant.size));
});

test("multi-intent preference and budget are carried into follow-ups without raising the ceiling", () => {
  const first = reply({
    productId: "ME-015",
    message: "我不喜欢 Terracotta，预算 2000 以内",
    history,
  });
  assert.equal(first.nextFilters?.budget, 2000);
  assert.ok(first.session);
  assert.match(first.text, /2[,.]?000/);
  const next = reply({
    message: "还有更低调的替代吗",
    session: first.session,
    filters: first.nextFilters,
    history,
  });
  assert.ok(next.productIds.every((id) => byId(id).price <= 2000));
  assert.ok(
    next.nextFilters?.budget === undefined || next.nextFilters.budget <= 2000,
  );
});

test("revisiting a product varies the dialogue deterministically without random state", () => {
  let session = {};
  const texts = [];
  for (let index = 0; index < 4; index++) {
    const args = {
      event: { type: "attention", productId: "ME-002", attentionToken: index },
      session,
      history: [],
    };
    const value = reply(args);
    assert.deepEqual(value, reply(args));
    texts.push(value.text);
    session = value.session;
  }
  assert.ok(
    new Set(texts).size >= 3,
    "revisits should use the authored variety",
  );
});

test("only current exact curated presets can render a scenario; personal fields are not inferred", () => {
  for (const scenario of curatedScenarios) {
    const current = {
      ...profile,
      personaId: scenario.personaId,
      homeId: scenario.homeId,
      room: scenario.room,
      name: "PRIVATE-NAME",
      height: 999,
    };
    const value = renderCuratedGuideTurn(scenario.id, "welcome", {
      profile: current,
      history,
    });
    assert.ok(value);
    assert.doesNotMatch(value.reply.text, /PRIVATE-NAME|999/);
    assert.equal(
      renderCuratedGuideTurn(scenario.id, "welcome", {
        profile: { ...current, room: "bedroom" },
        history,
      }),
      null,
    );
  }
});

test("demo inventory and manual current budget override previously remembered choices", () => {
  const first = reply({
    productId: "ME-002",
    message: "我喜欢这个，预算 2000",
    history: [],
  });
  const next = reply({
    productId: "ME-002",
    message: "给我一组搭配",
    session: first.session,
    history: [],
    filters: { category: "women", budget: 1000 },
    inventory: { "ME-026": 0, "ME-005": 0 },
  });
  assert.ok(
    next.productIds.every(
      (id) => byId(id).price <= 1000 && !["ME-026", "ME-005"].includes(id),
    ),
  );
});

test("prepared room imagery alone cannot create an owned-piece pairing", () => {
  const value = reply({
    productId: "ME-022",
    message: "和我已有的怎么搭",
    profile: {
      ...profile,
      personaId: "relaxed-man-50",
      homeId: "compact-city",
      room: "living",
    },
    history: [{ skuId: "ME-019", color: "Brass", size: "ONE SIZE" }],
  });
  assert.deepEqual(value.ownedProductIds, []);
  assert.notEqual(value.relationship, "same-series");
});

test("explicit comparison names are both used without claiming their collections match", () => {
  const value = reply({
    productId: "ME-014",
    message: "和立领棉质衬衫比较一下，周末想轻松一点",
    history: [],
    language: "zh",
  });
  assert.ok(value.text.includes(byId("ME-014").name));
  assert.ok(value.text.includes(byId("ME-010").name));
  assert.notEqual(value.relationship, "same-series");
});

test("new explicit preference revisions replace earlier exclusions", () => {
  const first = reply({
    message: "我不喜欢 Terracotta，不要推荐手袋",
    productId: "ME-015",
    history: [],
  });
  const next = reply({
    message: "其实现在可以接受 Terracotta，现在可以推荐手袋",
    session: first.session,
    productId: "ME-015",
    history: [],
  });
  assert.ok(!next.session.avoidedColors.includes("Terracotta"));
  assert.ok(!next.session.excludedKinds.includes("bag"));
});

test("an empty visit bag never becomes a checklist from a merely viewed or declined piece", () => {
  const previous = reply({
    productId: "ME-015",
    message: "我不喜欢 Terracotta，预算 2000 以内",
    history: [],
  });
  const value = reply({
    productId: "ME-015",
    message: "安排到店要怎么做",
    filters: previous.nextFilters,
    session: previous.session,
    cart: [],
    history: [],
  });
  assert.deepEqual(value.productIds, []);
  assert.ok(!value.visitPlan?.lines?.length);
  assert.ok(
    !value.text.includes("Terracotta") && !value.text.includes("2,380"),
  );
  assert.match(value.text, /先选|清单|到店袋/);
});
