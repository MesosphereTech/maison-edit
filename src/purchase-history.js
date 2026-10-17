import { catalog, byId, lookDefinitions, money } from "./data.js";
import { personaPresets } from "./presets.js";

const MAX_HISTORY_ITEMS = 12;
const defaultEntry = (skuId) => {
  const item = byId(skuId);
  return {
    skuId: item.id,
    color: item.color,
    size: item.sizes.includes("M") ? "M" : item.sizes[0],
  };
};

// These are fictional, selectable fixtures, never imported account purchases.
export const purchaseHistoryPresets = [
  {
    id: "women",
    zh: "女装衣橱示例",
    en: "Women’s wardrobe",
    items: ["ME-003", "ME-006", "ME-007"].map(defaultEntry),
  },
  {
    id: "men",
    zh: "男装衣橱示例",
    en: "Men’s wardrobe",
    items: ["ME-010", "ME-011", "ME-013"].map(defaultEntry),
  },
  {
    id: "home",
    zh: "家居收藏示例",
    en: "Home collection",
    items: ["ME-017", "ME-018", "ME-023"].map(defaultEntry),
  },
];

/** Keep only explicit, valid catalog variants. Do not invent missing ownership. */
export function sanitizePurchaseHistory(raw) {
  if (!Array.isArray(raw)) return [];
  const result = [];
  const seen = new Set();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const item = typeof entry.skuId === "string" && byId(entry.skuId);
    if (
      !item ||
      seen.has(item.id) ||
      !item.colors.includes(entry.color) ||
      !item.sizes.includes(entry.size)
    )
      continue;
    result.push({ skuId: item.id, color: entry.color, size: entry.size });
    seen.add(item.id);
    if (result.length === MAX_HISTORY_ITEMS) break;
  }
  return result;
}

const complementaryKinds = [
  ["blazer", "shirt"],
  ["blazer", "knit"],
  ["blazer", "trouser"],
  ["blazer", "skirt"],
  ["blazer", "dress"],
  ["blazer", "coat"],
  ["shirt", "trouser"],
  ["shirt", "skirt"],
  ["shirt", "coat"],
  ["knit", "trouser"],
  ["knit", "skirt"],
  ["knit", "coat"],
  ["coat", "trouser"],
  ["coat", "skirt"],
  ["coat", "dress"],
  ...["blazer", "shirt", "knit", "trouser", "skirt", "dress", "coat"].flatMap(
    (kind) => ["bag", "shoe", "jewelry"].map((other) => [kind, other]),
  ),
  ["belt", "trouser"],
  ["belt", "dress"],
  ["belt", "shirt"],
  ["bag", "shoe"],
  ["bag", "jewelry"],
  ["bag", "belt"],
  ["chair", "lamp"],
  ["chair", "table"],
  ["chair", "cushion"],
  ["chair", "throw"],
  ["chair", "vase"],
  ["table", "lamp"],
  ["table", "vase"],
  ["table", "cup"],
  ["table", "tray"],
  ["cushion", "throw"],
  ["cup", "tray"],
  ["vase", "tray"],
];

const departmentsMatch = (a, b) => {
  if (a.category === "home" || b.category === "home")
    return a.category === "home" && b.category === "home";
  return !(
    [a.category, b.category].includes("women") &&
    [a.category, b.category].includes("men")
  );
};

const sameSeries = (a, b) =>
  typeof a.collectionId === "string" &&
  a.collectionId.trim().length > 0 &&
  typeof b.collectionId === "string" &&
  a.collectionId === b.collectionId;

const sharedTags = (a, b) => a.tags.filter((tag) => b.tags.includes(tag));
const sharedEdit = (a, b) =>
  lookDefinitions.some(
    (edit) => edit.ids.includes(a.id) && edit.ids.includes(b.id),
  );

const pairingScore = (a, b) => {
  if (a.id === b.id || !departmentsMatch(a, b)) return 0;
  // ME-028 is a curtain colour sample, not a blanket to drape over a chair.
  if (a.id === "ME-028" || b.id === "ME-028") return 0;
  const complementary = complementaryKinds.some(
    ([one, two]) =>
      (a.kind === one && b.kind === two) || (a.kind === two && b.kind === one),
  );
  if (!complementary) return 0;
  const tags = sharedTags(a, b);
  const editorial = sharedEdit(a, b);
  if (!tags.length && !editorial && !sameSeries(a, b)) return 0;
  return tags.length * 3 + (editorial ? 7 : 0) + (sameSeries(a, b) ? 12 : 0);
};

/** Explicit shopping department or selected fictional persona, never image inference. */
export function clothingDepartmentFor(profile = {}) {
  for (const value of [profile.department, profile.category])
    if (["women", "men"].includes(value)) return value;
  return (
    personaPresets.find((persona) => persona.id === profile.personaId)
      ?.category || null
  );
}

export function isOppositeClothingDepartment(itemOrId, profile = {}) {
  const item = typeof itemOrId === "string" ? byId(itemOrId) : itemOrId;
  const department = clothingDepartmentFor(profile);
  return Boolean(
    item &&
    department &&
    ["women", "men"].includes(item.category) &&
    item.category !== department,
  );
}

const outfitSlot = (item) => {
  if (["shirt", "knit"].includes(item.kind)) return "top";
  if (["trouser", "skirt"].includes(item.kind)) return "bottom";
  if (["coat", "blazer"].includes(item.kind)) return "outerwear";
  if (item.kind === "dress") return "onePiece";
  if (item.kind === "shoe") return "shoes";
  if (["bag", "jewelry", "belt"].includes(item.kind)) return "accessory";
  return null;
};

const outfitReasons = {
  top: [
    "用柔和或清晰的上装接住下装比例",
    "A top balances the proportions above the bottom",
  ],
  bottom: ["用下装延续整体线条", "The bottom continues the outfit’s line"],
  shoes: [
    "用鞋履收住裤脚或裙摆的轮廓",
    "Shoes finish the trouser or skirt silhouette",
  ],
  accessory: [
    "只留一件配饰作为收尾",
    "One accessory supplies a finishing accent",
  ],
  onePiece: [
    "连衣裙一件承担上装与下装的轮廓",
    "The dress supplies the top-and-bottom silhouette in one piece",
  ],
  outerwear: [
    "外套提供结构，内层保持简洁",
    "Outerwear supplies structure over simple layers",
  ],
};

/**
 * A catalog-grounded styling proposal, independent of any composed scene image.
 * Ownership is derived only from valid CURRENT history, never saved/bag/session.
 * Owned substitutes win their slot; optional new pieces share one total budget.
 * Complete means all styling slots exist, never a claim of fit or availability.
 */
export function buildCatalogOutfit({
  productId,
  history,
  profile = {},
  variant = {},
  budget = Infinity,
  inventory = {},
  excludedProductIds = [],
  excludedKinds = [],
  excludedNewKinds = [],
  avoidedColors = [],
  preferredProductIds = [],
  language = "zh",
} = {}) {
  const viewed = byId(productId);
  if (!viewed || viewed.category === "home" || !outfitSlot(viewed)) return null;
  const entries = sanitizePurchaseHistory(history);
  const owned = new Map(entries.map((entry) => [entry.skuId, entry]));
  const en = language === "en";
  const department = ["women", "men"].includes(viewed.category)
    ? viewed.category
    : clothingDepartmentFor(profile);
  const ceiling =
    budget === Infinity
      ? Infinity
      : typeof budget === "number" && Number.isFinite(budget) && budget >= 0
        ? budget
        : 0;
  const available = (item) => {
    const count = Object.hasOwn(inventory, item.id)
      ? inventory[item.id]
      : item.stock;
    return Number.isInteger(count) && count > 0;
  };
  const eligible = (item) =>
    item.category !== "home" &&
    (!department ||
      item.category === department ||
      item.category === "accessories") &&
    !excludedProductIds.includes(item.id) &&
    !excludedKinds.includes(item.kind) &&
    (owned.has(item.id) ||
      (!excludedNewKinds.includes(item.kind) && available(item))) &&
    !avoidedColors.includes(
      owned.get(item.id)?.color ||
        (item.id === viewed.id && viewed.colors.includes(variant.color)
          ? variant.color
          : item.color),
    );
  const selectedColor = viewed.colors.includes(variant.color)
    ? variant.color
    : viewed.color;
  const selectedSize = viewed.sizes.includes(variant.size)
    ? variant.size
    : viewed.sizes.includes(profile.size)
      ? profile.size
      : viewed.sizes[0];
  const viewedEntry = owned.get(viewed.id);
  const components = [
    {
      slot: outfitSlot(viewed),
      productId: viewed.id,
      source: viewedEntry ? "owned" : "viewed",
      color: viewedEntry?.color || selectedColor,
      size: viewedEntry?.size || selectedSize,
      reason: outfitReasons[outfitSlot(viewed)][en ? 1 : 0],
    },
  ];
  const viewedSelectable =
    viewedEntry ||
    (eligible(viewed) &&
      !avoidedColors.includes(selectedColor) &&
      viewed.price <= ceiling);
  let remaining = viewedEntry
    ? ceiling
    : viewedSelectable
      ? ceiling - viewed.price
      : 0;
  const newIds = viewedEntry || !viewedSelectable ? [] : [viewed.id];
  const required =
    viewed.kind === "dress"
      ? ["onePiece", "shoes", "accessory"]
      : ["top", "bottom", "shoes", "accessory"];
  for (const slot of required) {
    if (components.some((component) => component.slot === slot)) continue;
    const score = (item) =>
      Math.max(
        ...components.map((component) =>
          pairingScore(byId(component.productId), item),
        ),
      );
    const candidates = catalog.filter(
      (item) =>
        item.id !== viewed.id &&
        outfitSlot(item) === slot &&
        eligible(item) &&
        score(item) > 0 &&
        (owned.has(item.id) || (viewedSelectable && item.price <= remaining)),
    );
    candidates.sort(
      (a, b) =>
        Number(owned.has(b.id)) - Number(owned.has(a.id)) ||
        Number(preferredProductIds.includes(b.id)) -
          Number(preferredProductIds.includes(a.id)) ||
        score(b) - score(a) ||
        a.price - b.price ||
        a.id.localeCompare(b.id),
    );
    const item = candidates[0];
    if (!item) continue;
    const existing = owned.get(item.id);
    components.push({
      slot,
      productId: item.id,
      source: existing ? "owned" : "catalog",
      color: existing?.color || item.color,
      size:
        existing?.size ||
        (item.sizes.includes(profile.size) ? profile.size : item.sizes[0]),
      reason: outfitReasons[slot][en ? 1 : 0],
      relationship: sameSeries(viewed, item) ? "same-series" : "pairing",
    });
    if (!existing) {
      newIds.push(item.id);
      remaining -= item.price;
    }
  }
  const order = [
    "outerwear",
    "top",
    "bottom",
    "onePiece",
    "shoes",
    "accessory",
  ];
  components.sort((a, b) => order.indexOf(a.slot) - order.indexOf(b.slot));
  return {
    department,
    purpose: isOppositeClothingDepartment(viewed, profile) ? "gift" : "self",
    components,
    complete: required.every((slot) =>
      components.some((component) => component.slot === slot),
    ),
    missingSlots: required.filter(
      (slot) => !components.some((component) => component.slot === slot),
    ),
    productIds: newIds,
    ownedProductIds: components
      .filter((component) => component.source === "owned")
      .map((component) => component.productId),
    newItemsTotal: newIds.reduce((total, id) => total + byId(id).price, 0),
    budgetScope: "suggested-new-items-total",
    status: "demo-styling-proposal",
  };
}

const tagNames = {
  quiet: ["克制", "quiet"],
  tailored: ["利落剪裁", "tailored"],
  warm: ["温暖", "warm"],
  soft: ["柔和", "soft"],
  artful: ["艺术感", "artful"],
};

/**
 * Grounded local guidance only. productIds contains optional NEW complements,
 * never an owned SKU or the viewed SKU. ownedProductIds always comes from the
 * sanitized fictional history. This function never reads an account or receipt.
 */
export function findHistoryGuidance({
  productId,
  history,
  variant,
  budget,
  language = "zh",
} = {}) {
  const viewed = byId(productId);
  const entries = sanitizePurchaseHistory(history);
  if (!viewed || !entries.length) return null;
  const en = language === "en";
  const t = (zh, english) => (en ? english : zh);
  const name = (item) => (en ? item.en : item.name);
  const duplicate = entries.find((entry) => entry.skuId === viewed.id);
  if (duplicate)
    return {
      text: t(
        `购买记录中已有「${name(viewed)}」（${duplicate.color} · ${duplicate.size}），这是同一 SKU；先确认是否需要重复选购，换色或换码也仍是同款。`,
        `Your history already includes ${name(viewed)} (${duplicate.color} · ${duplicate.size}). This is the same SKU, even in another colour or size. Check before buying it again.`,
      ),
      visualText: t(
        `「${name(viewed)}」记录中已有同款 · 检查重复`,
        `${name(viewed)} · in your history, check duplicate`,
      ),
      productIds: [],
      ownedProductIds: [viewed.id],
      duplicate: true,
      relationship: "duplicate",
    };

  const owned = entries
    .map((entry) => ({ entry, item: byId(entry.skuId) }))
    .map((value) => ({ ...value, score: pairingScore(viewed, value.item) }))
    .filter(
      (value) =>
        value.score > 0 ||
        (departmentsMatch(viewed, value.item) &&
          sameSeries(viewed, value.item)),
    )
    .sort((a, b) => b.score - a.score)[0];
  if (!owned) return null;

  const ceiling =
    budget === undefined
      ? Infinity
      : typeof budget === "number" && Number.isFinite(budget) && budget >= 0
        ? budget
        : 0;
  const ownedIds = new Set(entries.map((entry) => entry.skuId));
  const candidates =
    viewed.price > ceiling
      ? []
      : catalog
          .filter(
            (item) =>
              item.id !== viewed.id &&
              !ownedIds.has(item.id) &&
              item.price <= ceiling &&
              item.stock > 0,
          )
          .map((item) => ({
            item,
            score: pairingScore(item, owned.item) + pairingScore(item, viewed),
            ownedScore: pairingScore(item, owned.item),
            viewedScore: pairingScore(item, viewed),
          }))
          .filter((value) => value.ownedScore > 0 && value.viewedScore > 0)
          .sort((a, b) => b.score - a.score || a.item.price - b.item.price);
  const suggestion = candidates[0]?.item;
  const series = sameSeries(viewed, owned.item);
  const tags = sharedTags(viewed, owned.item);
  const style = tags.length && tagNames[tags[0]]?.[en ? 1 : 0];
  const rationale = style
    ? t(`共同的${style}风格`, `their shared ${style} styling`)
    : t("协调的搭配风格", "their coordinated styling");
  const seriesLabel = en ? viewed.collectionEn : viewed.collectionZh;
  const viewedColor = viewed.colors.includes(variant?.color)
    ? variant.color
    : viewed.color;
  const sameColor = viewedColor === owned.entry.color;
  const colorText = sameColor
    ? t(
        `两件同为 ${viewedColor}，可以试试协调的同色搭配。`,
        `Both pieces are ${viewedColor}, creating a coordinated tonal palette.`,
      )
    : t(
        `可以将 ${owned.entry.color} 与 ${viewedColor} 搭配，看看喜欢哪种层次。`,
        `The palette pairs ${owned.entry.color} with ${viewedColor} for a layered look.`,
      );
  const relationshipText = series
    ? t(
        `两件同属${seriesLabel ? `「${seriesLabel}」` : ""}。`,
        `Both belong to the collection${seriesLabel ? ` “${seriesLabel}”` : ""}.`,
      )
    : t(
        "可以从轮廓与配色出发，把它们组合起来。",
        "Explore how their shapes and colours work together.",
      );
  const pairingText =
    owned.score > 0
      ? t(
          `可把正在看的「${name(viewed)}」与它搭配，依据是互补品类与${rationale}。`,
          `Pair the viewed ${name(viewed)} with it: complementary pieces with ${rationale}.`,
        )
      : "";
  const optionText =
    viewed.price > ceiling
      ? t(
          "正在看的单品超过预算，暂不建议新增购买。",
          "The viewed item exceeds your budget; no extra purchase suggested.",
        )
      : suggestion
        ? t(
            `若还想补充，可选「${name(suggestion)}」（${money(suggestion.price, language)}）；无需为了搭配再购买。`,
            `Optional complement: ${name(suggestion)} (${money(suggestion.price, language)}). Another purchase isn’t necessary.`,
          )
        : t(
            "先用已有单品搭配，预算内暂无合适的新增建议。",
            "Start with the existing piece; no extra complement suggested within budget.",
          );

  return {
    text: [
      t(
        `购买记录中选有「${name(owned.item)}」（${owned.entry.color} · ${owned.entry.size}）。`,
        `Your history lists ${name(owned.item)} (${owned.entry.color} · ${owned.entry.size}).`,
      ),
      pairingText,
      colorText,
      relationshipText,
      optionText,
    ]
      .filter(Boolean)
      .join(en ? " " : ""),
    visualText: series
      ? t(
          `「${name(viewed)}」与已有「${name(owned.item)}」· 同系列搭配`,
          `${name(viewed)} + ${name(owned.item)} · collection pairing`,
        )
      : t(
          `「${name(viewed)}」搭配已有「${name(owned.item)}」· 互补搭配`,
          `${name(viewed)} + ${name(owned.item)} · complementary pairing`,
        ),
    productIds: suggestion ? [suggestion.id] : [],
    ownedProductIds: [owned.item.id],
    duplicate: false,
    relationship: series ? "same-series" : "pairing",
  };
}
