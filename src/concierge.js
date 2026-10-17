import { byId, defaultProfile, filteredProducts, money } from "./data.js";
import {
  sanitizePurchaseHistory,
  findHistoryGuidance,
  buildCatalogOutfit,
  isOppositeClothingDepartment,
} from "./purchase-history.js";

const USER_EVENTS = new Set(["product_open", "variant", "save", "add", "page"]);
const MAX_MESSAGES = 5;

// Object keys are sorted so equivalent filter/variant objects share a key.
const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .filter((key) => value[key] !== undefined)
        .map((key) => [key, stableValue(value[key])]),
    );
  return value ?? null;
};

export const conciergeContextKey = (context = {}) =>
  typeof context === "string" ? context : JSON.stringify(stableValue(context));
export const contextKey = conciergeContextKey;

export const createConciergeSession = () => ({
  seen: [],
  lastAt: 0,
  count: 0,
  paused: false,
});

const variantValue = (event) => ({
  ...(event.value && typeof event.value === "object" ? event.value : {}),
  ...event.variant,
  ...(event.color !== undefined ? { color: event.color } : {}),
  ...(event.size !== undefined ? { size: event.size } : {}),
});

const eventKey = (event) =>
  conciergeContextKey([
    event.type,
    event.productId ?? null,
    event.type === "dwell"
      ? null // One dwell message per product and browsing context.
      : event.type === "variant"
        ? variantValue(event)
        : (event.value ?? event.page ?? event.section ?? null),
    event.contextKey ?? "",
  ]);

/**
 * Decide now, without queuing or scheduling a later message. The caller owns
 * pause/minimize/mute and should pass its current context for scheduled dwell.
 * User actions can speak after 10s; passive dwell must leave a 45s quiet gap.
 */
export function acceptConciergeEvent(session, event, now) {
  const reject = () => ({ session, accepted: false });
  if (
    !session ||
    !event ||
    !Number.isFinite(now) ||
    now < 0 ||
    session.paused ||
    (session.count >= MAX_MESSAGES && event.type !== "attention") ||
    (!USER_EVENTS.has(event.type) &&
      !["dwell", "attention"].includes(event.type)) ||
    (!["page", "attention"].includes(event.type) && !byId(event.productId)) ||
    (event.type === "attention" &&
      !byId(event.productId) &&
      !["hero", "visit"].includes(event.section))
  )
    return reject();

  if (
    event.currentContextKey !== undefined &&
    conciergeContextKey(event.contextKey ?? "") !==
      conciergeContextKey(event.currentContextKey)
  )
    return reject();

  // A settled attention change replaces the previous local hint. It has no
  // 45-second gate or five-message cap, and never starts a provider request.
  if (event.type === "attention") {
    const key = conciergeContextKey([
      event.productId || event.section,
      event.contextKey,
      event.attentionToken ?? null,
    ]);
    if (session.attentionKey === key) return reject();
    return { session: { ...session, attentionKey: key }, accepted: true };
  }
  const key = eventKey(event);
  if (session.seen.includes(key)) return reject();
  const cooldown = USER_EVENTS.has(event.type) ? 10_000 : 45_000;
  // count, rather than lastAt truthiness, also handles the first event at t=0.
  if (session.count > 0 && now - session.lastAt < cooldown) return reject();

  return {
    session: {
      ...session,
      seen: [...session.seen, key],
      lastAt: now,
      count: session.count + 1,
    },
    accepted: true,
  };
}

const quickReplies = (home, en, extra = []) => {
  const labels = en
    ? {
        outfit: "Explore an outfit",
        room: "Explore this room",
        color: "Compare colours",
        booking: "Plan a visit",
        add: "Choose for my bag",
        view: "Browse the edit",
      }
    : {
        outfit: "看看搭配",
        room: "看看空间搭配",
        color: "比较颜色",
        booking: "安排到店",
        add: "选入到店袋",
        view: "继续浏览",
      };
  return [...new Set([...extra, home ? "room" : "outfit", "color", "booking"])]
    .slice(0, 4)
    .map((id) => ({ id, label: labels[id] }));
};

const catalogIds = (items = []) =>
  [
    ...new Set(
      (Array.isArray(items) ? items : []).map((item) =>
        typeof item === "string" ? item : item?.skuId,
      ),
    ),
  ].filter((id) => byId(id));

const selectedVariant = (event, item) => {
  const chosen = variantValue(event);
  return [
    item.colors.includes(chosen.color) ? chosen.color : null,
    item.sizes.includes(chosen.size) ? chosen.size : null,
  ].filter(Boolean);
};

const safeProfile = (profile) => ({
  ...defaultProfile,
  ...profile,
  styles: Array.isArray(profile?.styles)
    ? profile.styles
    : defaultProfile.styles,
});

/** Local catalogue copy only. This function never calls AI or claims live stock,
 * garment fit, room measurements, or confirmed store preparation. */
export function createConciergeReply({
  event = {},
  language = "zh",
  profile = defaultProfile,
  filters = {},
  wishlist = [],
  cart = [],
  history,
  purchaseHistory,
  inventory = {},
} = {}) {
  const en = language === "en";
  const t = (zh, english) => (en ? english : zh);
  const name = (item) => (en ? item.en : item.name);
  const price = (item) => money(item.price, en ? "en" : "zh");
  const item = byId(event.productId);
  const currentHistory = sanitizePurchaseHistory(
    history ?? purchaseHistory ?? [],
  );
  const historyIds = new Set(currentHistory.map((entry) => entry.skuId));
  const passive = [
    "attention",
    "product_open",
    "product_view",
    "click",
    "dwell",
    "revisit",
  ].includes(event.type);
  const guidance =
    passive && item
      ? findHistoryGuidance({
          productId: item.id,
          history: currentHistory,
          variant: variantValue(event),
          budget: filters.budget ?? profile.budget,
          language,
        })
      : null;
  const outfit =
    passive && item
      ? buildCatalogOutfit({
          productId: item.id,
          history: currentHistory,
          profile,
          variant: variantValue(event),
          budget: filters.budget ?? profile.budget,
          inventory,
          language,
        })
      : null;
  const giftContext = passive && isOppositeClothingDepartment(item, profile);
  const reply = (text, items = [], extra = [], home = false) => ({
    text: [
      giftContext
        ? t(
            `这是${item.category === "women" ? "女装" : "男装"}选款，可作为可选的礼物灵感，收礼人的尺码与喜好仍需确认。`,
            `This ${item.category === "women" ? "women’s" : "men’s"} clothing piece is an optional gift idea; check the recipient’s size and preferences.`,
          )
        : "",
      text,
      guidance?.text,
    ]
      .filter(Boolean)
      .join(en ? " " : ""),
    productIds: guidance?.duplicate
      ? []
      : catalogIds(items)
          .filter((id) => !historyIds.has(id))
          .slice(0, 3),
    ownedProductIds: [
      ...new Set([
        ...(guidance?.ownedProductIds || []),
        ...(outfit?.ownedProductIds || []),
      ]),
    ],
    ...(outfit ? { outfit } : {}),
    ...(giftContext ? { giftContext: true } : {}),
    quickReplies: quickReplies(home, en, extra),
    mode: "demo",
    provider: null,
  });
  const page = event.page ?? event.value?.page ?? event.value ?? event.section;

  if (event.type === "page" && page === "try-list") {
    const ids = catalogIds(cart);
    const ready = (Array.isArray(cart) ? cart : []).filter(
      (line) =>
        byId(line?.skuId) &&
        line.preparation?.status === "ready" &&
        line.preparation?.acknowledgedAt &&
        ["matched", "not-required"].includes(line.fit?.status),
    ).length;
    return reply(
      ids.length
        ? t(
            `到店清单里有 ${ids.length} 款选款。${ready ? `${ready} 款已获演示门店备好确认，其余请求以清单状态为准。` : "备货请求等待演示门店确认。"}尺码匹配来自虚构档案；礼赠尺码另行确认。这不是购买，也没有真实留货。`,
            `Your store list has ${ids.length} ${ids.length === 1 ? "piece" : "pieces"}. ${ready ? `${ready} received a demo-store ready acknowledgement; check each remaining request in the list.` : "Preparation awaits demo-store confirmation."} Sizes use fictional profiles; gift-recipient sizes are checked separately. This is no purchase or real reservation.`,
          )
        : t(
            "到店清单暂时为空。点击商品的到店试穿或体验按钮，再查看自动匹配与本地演示备货状态。旧版收藏不会自动提交备货。",
            "Your store list is empty. Use a product’s store try-on or experience button, then review its automatic match and local demo preparation. Previous saved pieces are not submitted automatically.",
          ),
      ids,
      [ids.length ? "booking" : "view"],
      ids.some((id) => byId(id).category === "home"),
    );
  }

  if (
    event.type === "page" &&
    (page === "visit" || event.section === "visit")
  ) {
    const ids = catalogIds(cart);
    const lines = Array.isArray(cart)
      ? cart.filter((line) => byId(line?.skuId))
      : [];
    const quantity = lines.reduce(
      (total, line) =>
        total +
        (Number.isInteger(line.quantity) && line.quantity > 0
          ? line.quantity
          : 1),
      0,
    );
    const text = ids.length
      ? t(
          `到店袋里有 ${quantity} 件示例选款。下一步可选择到店时间与愿意分享的信息。`,
          `Your demo bag has ${quantity} ${quantity === 1 ? "piece" : "pieces"}. Choose a visit time and what to share next.`,
        )
      : t(
          "先挑一件想在店里细看的选款，再安排时间。预约与备货状态均为本地演示。",
          "Choose a piece to see in store, then plan a visit. Booking and preparation are local demos.",
        );
    return reply(
      text,
      ids,
      [ids.length ? "booking" : "view"],
      ids.some((id) => byId(id).category === "home"),
    );
  }

  if (event.type === "page" && ["saved", "wishlist"].includes(page)) {
    const ids = catalogIds(wishlist);
    const first = byId(ids[0]);
    return first
      ? reply(
          t(
            `已收藏 ${ids.length} 款。可以从${name(first)}（${price(first)}）开始，选择规格后加入到店袋。`,
            `${ids.length} saved ${ids.length === 1 ? "piece" : "pieces"}. Start with ${name(first)} (${price(first)}), choose its options, then add it to your visit bag.`,
          ),
          ids,
          ["add"],
          first.category === "home",
        )
      : reply(
          t(
            "收藏夹还是一张留白。遇到喜欢的选款，可以先留下，再慢慢搭配。",
            "Your saved edit is empty. Keep a piece you like, then build around it.",
          ),
          [],
          ["view"],
        );
  }

  if (item) {
    const home = item.category === "home";
    const chosen = selectedVariant(event, item);
    const options = `${item.colors.join(" / ")} · ${item.sizes.join(" / ")}`;
    if (event.type === "variant") {
      return reply(
        chosen.length
          ? t(
              `${name(item)}，已选 ${chosen.join(" · ")}，示例价 ${price(item)}。${home ? "可到店核对材质与实际尺寸。" : "实际合身度可留到店里试穿。"}`,
              `${name(item)}: ${chosen.join(" · ")} selected, demo price ${price(item)}. ${home ? "Check materials and dimensions in store." : "Check the fit in store."}`,
            )
          : t(
              `${name(item)}的目录选项：${options}。示例价 ${price(item)}。`,
              `Catalogue options for ${name(item)}: ${options}. Demo price ${price(item)}.`,
            ),
        [item.id],
        [],
        home,
      );
    }
    if (event.type === "save") {
      const removed =
        event.saved === false ||
        event.value === false ||
        event.value?.saved === false;
      return reply(
        removed
          ? t(
              `已从收藏移出${name(item)}。仍可比较 ${item.colors.join(" / ")}，或继续浏览。`,
              `${name(item)} removed from saved pieces. Compare ${item.colors.join(" / ")}, or keep browsing.`,
            )
          : t(
              `已留下${name(item)}，示例价 ${price(item)}。选好颜色与规格后，可加入到店袋，一起安排到店。`,
              `${name(item)} saved, demo price ${price(item)}. Choose its options, add it to your visit bag, then plan a visit.`,
            ),
        [item.id],
        removed ? ["view"] : ["add"],
        home,
      );
    }
    if (event.type === "add") {
      return reply(
        t(
          `${name(item)}${chosen.length ? ` · ${chosen.join(" · ")}` : ""}已加入到店袋，示例价 ${price(item)}。可以安排到店；实际库存与备货仍需门店确认。`,
          `${name(item)}${chosen.length ? ` · ${chosen.join(" · ")}` : ""} is in your visit bag, demo price ${price(item)}. Plan a visit; stock and preparation still need store confirmation.`,
        ),
        [item.id],
        ["booking"],
        home,
      );
    }
    return reply(
      t(
        `${name(item)}，示例价 ${price(item)}。目录颜色 ${item.colors.join(" / ")}；规格 ${item.sizes.join(" / ")}。${home ? "想看看它与空间中的其他选款如何搭配？" : "想从它开始，看看一组搭配？"}`,
        `${name(item)}, demo price ${price(item)}. Catalogue colours: ${item.colors.join(" / ")}; sizes: ${item.sizes.join(" / ")}. ${home ? "Explore a room edit around it?" : "Explore an outfit around it?"}`,
      ),
      [item.id],
      [],
      home,
    );
  }

  const products = filteredProducts(filters, safeProfile(profile));
  const first = products[0];
  return first
    ? reply(
        t(
          `这一页有 ${products.length} 款示例选款。不妨从${name(first)}（${price(first)}）开始，再按颜色或${first.category === "home" ? "空间" : "搭配"}慢慢编选。`,
          `${products.length} demo pieces in this edit. Start with ${name(first)} (${price(first)}), then explore colours or ${first.category === "home" ? "a room edit" : "an outfit"}.`,
        ),
        products.slice(0, 3).map((product) => product.id),
        [],
        first.category === "home",
      )
    : reply(
        t(
          "这一页暂时没有符合筛选的选款。可以放宽预算或分类，再继续编选。",
          "No catalogue pieces match these filters. Try a broader budget or department.",
        ),
        [],
        ["view"],
        filters.category === "home",
      );
}
