import {
  getPersonaPreset,
  getHomePreset,
  personaPresets,
  homePresets,
} from "./presets.js";
import { sanitizeGiftLine } from "./gift-packaging.js";
import { sanitizeTryListLine } from "./try-list.js";
import { musicPreferences } from "./store-music.js";
import { curatedScenarioFor, curatedScenarios } from "./personalized-scenes.js";
import { demoScenePreview } from "./demo-personalization.js";
export const STORAGE_KEY = "maison-edit-v1";
export const IMAGE = {
  fashion: "/images/editorial-woman.webp",
  home: "/images/editorial-home.webp",
  objects: "/images/editorial-accessories.webp",
  men: "/images/editorial-man.webp",
};
const skuImages = {
  "ME-010": "/images/shirt-cotton.webp",
  "ME-011": "/images/trouser-ink.webp",
  "ME-012": "/images/blazer-ink.webp",
  "ME-013": "/images/shoe-suede.webp",
  "ME-014": "/images/knit-rib.webp",
  "ME-025": "/images/coat-cropped.webp",
  "ME-026": "/images/knit-blue.webp",
  "ME-027": "/images/bag-canvas.webp",
  "ME-028": "/images/throw-chalk.webp",
};
const photoKinds = new Set([
  "blazer",
  "trouser",
  "bag",
  "knit",
  "shirt",
  "dress",
  "coat",
  "lamp",
  "chair",
  "skirt",
  "shoe",
  "jewelry",
  "belt",
  "vase",
  "cushion",
  "table",
  "throw",
  "cup",
  "tray",
]);
const p = (
  id,
  name,
  en,
  brand,
  category,
  price,
  kind,
  color,
  tags,
  floor,
  counter,
  description,
) => ({
  id,
  name,
  en,
  brand,
  category,
  price,
  kind,
  color,
  tags,
  floor,
  counter,
  description,
  // A declared fictional series, never inferred from brand, colour or edit.
  collectionId: ["ME-001", "ME-003"].includes(id) ? "walnut-tailoring" : null,
  collectionZh: ["ME-001", "ME-003"].includes(id) ? "胡桃羊毛剪裁" : null,
  collectionEn: ["ME-001", "ME-003"].includes(id)
    ? "Walnut wool tailoring"
    : null,
  image:
    skuImages[id] || `/images/${kind}.${photoKinds.has(kind) ? "webp" : "svg"}`,
  sizes:
    category === "home"
      ? ["ONE SIZE"]
      : category === "accessories"
        ? ["ONE SIZE"]
        : ["XS", "S", "M", "L", "XL"],
  colors: [...new Set([color, category === "home" ? "Chalk" : "Ink"])],
  stock: 8,
});
export const catalog = [
  p(
    "ME-001",
    "羊毛廓形西装",
    "The sculpted wool blazer",
    "ÉDIT ATELIER",
    "women",
    3280,
    "blazer",
    "Walnut",
    ["quiet", "tailored", "warm"],
    2,
    "A12",
    "有分量的意大利羊毛，松弛的肩线与收腰轮廓。灵感图为原创演示素材，非该 SKU 的实拍。",
  ),
  p(
    "ME-002",
    "真丝垂坠衬衫",
    "The silk column shirt",
    "STUDIO LIGNE",
    "women",
    1680,
    "shirt",
    "Ivory",
    ["quiet", "tailored", "soft"],
    2,
    "A12",
    "轻柔垂坠的真丝触感，宽松廓形。成分、尺码及价格均为示例。",
  ),
  p(
    "ME-003",
    "高腰羊毛长裤",
    "The long-line trouser",
    "ÉDIT ATELIER",
    "women",
    1980,
    "trouser",
    "Walnut",
    ["tailored", "quiet", "warm"],
    2,
    "A12",
    "舒适高腰与直筒裤型，适合从日常到晚间的过渡。",
  ),
  p(
    "ME-004",
    "弧线皮革手袋",
    "The arc leather bag",
    "FORME",
    "accessories",
    2480,
    "bag",
    "Burgundy",
    ["warm", "quiet"],
    1,
    "B06",
    "弧线轮廓与哑光五金。颜色可选，库存为本地演示数据。",
  ),
  p(
    "ME-005",
    "缎面中长裙",
    "The liquid satin skirt",
    "STUDIO LIGNE",
    "women",
    1280,
    "skirt",
    "Champagne",
    ["soft", "quiet"],
    2,
    "A14",
    "偏斜剪裁的流动裙摆，柔和光泽与简约线条。",
  ),
  p(
    "ME-006",
    "羊绒针织衫",
    "The cashmere layer",
    "ÉDIT ATELIER",
    "women",
    2180,
    "knit",
    "Oat",
    ["soft", "quiet", "warm"],
    2,
    "A14",
    "适合层叠搭配的细密针织，轻盈而温暖。",
  ),
  p(
    "ME-007",
    "小牛皮芭蕾鞋",
    "The soft ballet flat",
    "FORME",
    "accessories",
    1480,
    "shoe",
    "Burgundy",
    ["soft", "quiet"],
    1,
    "B08",
    "柔软鞋面与简洁鞋头。实际舒适度需到店试穿。",
  ),
  p(
    "ME-008",
    "雕塑耳饰",
    "The sculptural earring",
    "ATELIER OBJET",
    "accessories",
    680,
    "jewelry",
    "Brass",
    ["artful", "warm"],
    1,
    "B06",
    "轻巧的雕塑线条，镀金色泽为视觉示例。",
  ),
  p(
    "ME-009",
    "丝毛混纺大衣",
    "The city coat",
    "STUDIO LIGNE",
    "women",
    4280,
    "coat",
    "Camel",
    ["tailored", "warm", "quiet"],
    2,
    "A12",
    "适合城市日常的长线条外套，松弛肩部便于叠穿。",
  ),
  p(
    "ME-010",
    "立领棉质衬衫",
    "The cotton poplin shirt",
    "ÉDIT ATELIER",
    "men",
    1380,
    "shirt",
    "Chalk",
    ["tailored", "quiet"],
    3,
    "C02",
    "挺括棉质与克制比例，搭配正式裤装或休闲针织。",
  ),
  p(
    "ME-011",
    "双褶羊毛长裤",
    "The pleated wool trouser",
    "STUDIO LIGNE",
    "men",
    1780,
    "trouser",
    "Ink",
    ["tailored", "quiet"],
    3,
    "C02",
    "双褶结构带来活动空间，裤脚可于到店时讨论。",
  ),
  p(
    "ME-012",
    "精纺羊毛西装",
    "The relaxed wool jacket",
    "ÉDIT ATELIER",
    "men",
    3680,
    "blazer",
    "Ink",
    ["tailored", "quiet"],
    3,
    "C02",
    "轻结构剪裁，适合不拘谨的都市衣橱。",
  ),
  p(
    "ME-013",
    "麂皮便鞋",
    "The suede loafer",
    "FORME",
    "accessories",
    1880,
    "shoe",
    "Walnut",
    ["warm", "tailored"],
    1,
    "B08",
    "柔和棕色与无装饰轮廓。图片为风格示意。",
  ),
  p(
    "ME-014",
    "罗纹轻羊绒衫",
    "The fine-rib knit",
    "STUDIO LIGNE",
    "men",
    1980,
    "knit",
    "Oat",
    ["soft", "quiet"],
    3,
    "C04",
    "轻薄罗纹织纹，舒适贴合而不紧绷。",
  ),
  p(
    "ME-015",
    "亚麻混纺长裙",
    "The linen column dress",
    "ÉDIT ATELIER",
    "women",
    2380,
    "dress",
    "Terracotta",
    ["warm", "soft", "artful"],
    2,
    "A14",
    "自然纹理与简约长裙比例，为日常保留呼吸感。",
  ),
  p(
    "ME-016",
    "窄版皮革腰带",
    "The minimal leather belt",
    "FORME",
    "accessories",
    580,
    "belt",
    "Walnut",
    ["tailored", "quiet"],
    1,
    "B06",
    "窄版线条与小巧金属扣，适合腰线点缀。",
  ),
  p(
    "ME-017",
    "曲线休闲单椅",
    "The sculptural lounge chair",
    "MAISON OBJET",
    "home",
    4980,
    "chair",
    "Terracotta",
    ["artful", "warm", "soft"],
    4,
    "D01",
    "弧形椅背与柔和织物，适合阅读角。尺寸为示例，请实测空间。",
  ),
  p(
    "ME-018",
    "手工陶瓷花器",
    "The hand-formed vessel",
    "MAISON OBJET",
    "home",
    480,
    "vase",
    "Chalk",
    ["artful", "quiet"],
    4,
    "D03",
    "自然起伏的陶瓷表面，为单枝与留白而设计。",
  ),
  p(
    "ME-019",
    "黄铜阅读台灯",
    "The brass reading lamp",
    "ATELIER OBJET",
    "home",
    1280,
    "lamp",
    "Brass",
    ["warm", "quiet"],
    4,
    "D01",
    "细长灯杆与柔和光线。电气规格须以真实商品为准。",
  ),
  p(
    "ME-020",
    "织纹亚麻靠垫",
    "The woven linen cushion",
    "MAISON OBJET",
    "home",
    380,
    "cushion",
    "Oat",
    ["soft", "warm"],
    4,
    "D03",
    "低调织纹与自然色调，让层次更柔和。",
  ),
  p(
    "ME-021",
    "橡木圆边几",
    "The oak side table",
    "MAISON OBJET",
    "home",
    1680,
    "table",
    "Oak",
    ["warm", "quiet"],
    4,
    "D01",
    "圆润边缘与轻巧比例，可置于座椅或床边。",
  ),
  p(
    "ME-022",
    "抽象羊毛毯",
    "The abstract wool throw",
    "STUDIO LIGNE",
    "home",
    780,
    "throw",
    "Blue",
    ["artful", "soft"],
    4,
    "D03",
    "浅蓝色块与柔和织纹，搭在单椅上即可成景。",
  ),
  p(
    "ME-023",
    "瓷器咖啡杯组",
    "The morning porcelain set",
    "MAISON OBJET",
    "home",
    320,
    "cup",
    "Chalk",
    ["quiet", "soft"],
    4,
    "D03",
    "一对用于慢时刻的瓷杯，容量与釉面为示例。",
  ),
  p(
    "ME-024",
    "石材托盘",
    "The travertine tray",
    "ATELIER OBJET",
    "home",
    680,
    "tray",
    "Sand",
    ["warm", "artful"],
    4,
    "D03",
    "用于小物陈列的石材托盘，自然纹理视觉示意。",
  ),
  p(
    "ME-025",
    "短版棉质风衣",
    "The cropped trench",
    "ÉDIT ATELIER",
    "women",
    1780,
    "coat",
    "Oat",
    ["tailored", "quiet"],
    2,
    "A12",
    "短版比例与轻盈面料，适合季节转换。",
  ),
  p(
    "ME-026",
    "细羊毛圆领衫",
    "The everyday wool knit",
    "STUDIO LIGNE",
    "women",
    880,
    "knit",
    "Blue",
    ["soft", "quiet"],
    2,
    "A14",
    "干净圆领与浅蓝色，为中性色搭配带来清新层次。",
  ),
  p(
    "ME-027",
    "帆布日常手袋",
    "The canvas day bag",
    "FORME",
    "accessories",
    780,
    "bag",
    "Oat",
    ["quiet", "soft"],
    1,
    "B06",
    "松弛帆布结构，便于日常随身物品收纳。",
  ),
  p(
    "ME-028",
    "棉麻窗帘样本",
    "The linen curtain sample",
    "MAISON OBJET",
    "home",
    180,
    "throw",
    "Chalk",
    ["soft", "quiet"],
    4,
    "D03",
    "用于配色预览的样本，不代表完整窗帘或安装服务。",
  ),
];
export const lookDefinitions = [
  {
    id: "edit-01",
    type: "look",
    title: "A softer kind of power.",
    zh: "让力量，柔和一点。",
    eyebrow: "THE QUIET TAILORING EDIT",
    ids: ["ME-001", "ME-002", "ME-003", "ME-007", "ME-004"],
    image: "fashion",
    position: "50% 38%",
    tags: ["quiet", "tailored"],
    note: "从一件漂亮的西装开始，为你的一天留出余地。",
    enNote:
      "Start with a beautiful jacket. Leave room for the rest of your day.",
  },
  {
    id: "edit-02",
    type: "room",
    title: "Room to slow down.",
    zh: "给慢下来的时刻，一个位置。",
    eyebrow: "THE LIVING EDIT",
    ids: ["ME-017", "ME-018", "ME-019", "ME-020"],
    image: "home",
    position: "50% 60%",
    tags: ["warm", "artful"],
    note: "陶土色、柔软织物与一点黄铜，把家编选成你的样子。",
    enNote:
      "Terracotta, soft textures and a little brass. A home with your point of view.",
  },
  {
    id: "edit-03",
    type: "look",
    title: "The art of less.",
    zh: "少一点，恰好一点。",
    eyebrow: "AN EVERYDAY RITUAL",
    ids: ["ME-006", "ME-005", "ME-007", "ME-008"],
    image: "fashion",
    position: "65% 60%",
    tags: ["soft", "quiet"],
    note: "柔和的针织与缎面，叠出不费力的日常。",
    enNote: "Soft knitwear and liquid satin, quietly layered for every day.",
  },
  {
    id: "edit-04",
    type: "look",
    title: "A considered arrival.",
    zh: "不经意的，从容。",
    eyebrow: "THE MODERN GENTLEMAN",
    ids: ["ME-012", "ME-010", "ME-011", "ME-013", "ME-016"],
    image: "men",
    position: "45% 45%",
    tags: ["tailored", "quiet"],
    note: "好剪裁与好比例，刚好足够。",
    enNote: "Good tailoring. Considered proportions. Just enough.",
  },
  {
    id: "edit-05",
    type: "objects",
    title: "Objects with a story.",
    zh: "那些，有性格的小物。",
    eyebrow: "SMALL PLEASURES",
    ids: ["ME-004", "ME-008", "ME-016"],
    image: "objects",
    position: "50% 55%",
    tags: ["artful", "warm"],
    note: "以弧线和质感，替你说一点自己的故事。",
    enNote: "Curves and textures that say something of your own.",
  },
  {
    id: "edit-06",
    type: "room",
    title: "The morning, reimagined.",
    zh: "重新编选，一个清晨。",
    eyebrow: "HOME, IN DETAILS",
    ids: ["ME-021", "ME-023", "ME-024", "ME-018"],
    image: "home",
    position: "75% 55%",
    tags: ["quiet", "warm"],
    note: "在小小的日常里，找回属于你的节奏。",
    enNote: "Find your own rhythm in the smallest daily rituals.",
  },
  {
    id: "edit-07",
    type: "look",
    title: "Colour, quietly.",
    zh: "颜色，可以很安静。",
    eyebrow: "A NEW SEASON NOTE",
    ids: ["ME-026", "ME-025", "ME-003", "ME-007", "ME-027"],
    image: "fashion",
    position: "35% 55%",
    tags: ["soft", "quiet"],
    note: "浅蓝与燕麦色，让衣橱焕新也很轻盈。",
    enNote: "Pale blue meets oat. A lighter way to begin again.",
  },
  {
    id: "edit-08",
    type: "room",
    title: "Your favourite corner.",
    zh: "属于你的，那一角。",
    eyebrow: "A PRIVATE RETREAT",
    ids: ["ME-017", "ME-022", "ME-019"],
    image: "home",
    position: "35% 45%",
    tags: ["artful", "soft"],
    note: "一张椅子、一盏灯，让空间容纳片刻独处。",
    enNote: "One chair. One lamp. A small space to simply be.",
  },
];
export const defaultProfile = {
  name: "Alex",
  personaId: "claire-model-32",
  homeId: "warm-family",
  height: 175,
  size: "S",
  budget: 6000,
  styles: ["quiet", "warm"],
  room: "living",
  palette: "warm",
  personaImage: null,
  homeImage: null,
  consent: false,
};
// Ready-made fictional ownership, never inferred from saved or bag items.
// Explicit empty histories from older versions stay empty during migration.
export function demoHistoryForProfile(profile = defaultProfile) {
  const man = getPersonaPreset(profile.personaId).category === "men";
  const templates = {
    "claire-model-32": ["ME-003", "ME-008", "ME-021"],
    "julian-model-34": ["ME-011", "ME-013", "ME-021"],
    "everyday-woman-45": ["ME-003", "ME-007", "ME-019"],
    "relaxed-man-50": ["ME-011", "ME-019"],
  };
  return (templates[profile.personaId] || (man ? ["ME-011", "ME-019"] : ["ME-003", "ME-007", "ME-019"])).map(
    (id) => {
      const item = catalog.find((product) => product.id === id);
      return {
        skuId: id,
        color: item.color,
        size: item.sizes.includes(profile.size) ? profile.size : item.sizes[0],
      };
    },
  );
}
export const initialState = () => ({
  version: 1,
  onboardingStatus: "pending",
  profile: { ...defaultProfile },
  wishlist: [],
  purchaseHistory: demoHistoryForProfile(),
  purchaseHistoryOrigin: "seeded",
  caseSnapshots: {},
  cart: [],
  feedback: {},
  bookings: [],
  inventory: Object.fromEntries(catalog.map((p) => [p.id, p.stock])),
  language: "en",
  soundVolume: 0.18,
  ...musicPreferences(),
});
// A judge can switch the fictional cases without sharing their owned records.
const validCaseHistory = (entries) =>
  Array.isArray(entries)
    ? entries
        .filter(
          (entry, index, all) =>
            entry &&
            catalog.some(
              (item) =>
                item.id === entry.skuId &&
                item.colors.includes(entry.color) &&
                item.sizes.includes(entry.size),
            ) &&
            all.findIndex((value) => value?.skuId === entry.skuId) === index,
        )
        .slice(0, 12)
        .map(({ skuId, color, size }) => ({ skuId, color, size }))
    : [];
export function switchCuratedCase(state, scenarioId) {
  const target = curatedScenarios.find((entry) => entry.id === scenarioId);
  if (!target) return state;
  const current = curatedScenarioFor(state.profile);
  if (current?.id === target.id) return state;
  const snapshots = { ...state.caseSnapshots };
  if (current)
    snapshots[current.id] = {
      profile: { ...state.profile, styles: [...state.profile.styles] },
      purchaseHistory: validCaseHistory(state.purchaseHistory),
      purchaseHistoryOrigin:
        state.purchaseHistoryOrigin === "seeded" ? "seeded" : "edited",
      wishlist: [...state.wishlist],
      cart: [...state.cart],
      feedback: { ...state.feedback },
    };
  const saved = snapshots[target.id];
  const persona = getPersonaPreset(target.personaId),
    home = getHomePreset(target.homeId);
  const profile = saved?.profile
    ? { ...saved.profile }
    : {
        ...state.profile,
        height: persona.height,
        size: persona.size,
        styles: [...persona.styles],
        palette: home.palette,
      };
  Object.assign(profile, {
    personaId: target.personaId,
    homeId: target.homeId,
    room: target.room,
  });
  return {
    ...state,
    profile,
    caseSnapshots: snapshots,
    purchaseHistory: saved
      ? validCaseHistory(saved.purchaseHistory)
      : demoHistoryForProfile(profile),
    purchaseHistoryOrigin:
      saved?.purchaseHistoryOrigin === "edited" ? "edited" : "seeded",
    wishlist:
      saved?.wishlist?.filter((id) => catalog.some((item) => item.id === id)) ||
      [],
    cart: saved?.cart || [],
    feedback: saved?.feedback || {},
  };
}

export const byId = (id) => catalog.find((p) => p.id === id);
export const sumItems = (items) =>
  items.reduce(
    (n, i) => n + (byId(i.skuId)?.price || 0) * (i.quantity || 1),
    0,
  );
export const money = (amount, lang = "zh") =>
  new Intl.NumberFormat(lang === "zh" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(amount);
export const rankProducts = (products, profile, feedback = {}) =>
  [...products].sort(
    (a, b) => score(b, profile, feedback) - score(a, profile, feedback),
  );
export const score = (product, profile, feedback = {}) =>
  product.tags.filter((t) => profile.styles.includes(t)).length * 4 +
  (product.category === getPersonaPreset(profile.personaId).category
    ? 14
    : ["women", "men"].includes(product.category)
      ? -24
      : 0) +
  (product.category === "home" &&
  getHomePreset(profile.homeId).preferredKinds.includes(product.kind)
    ? 3
    : 0) +
  (product.category === "home" &&
  ((profile.room === "kitchen" &&
    ["cup", "tray", "table"].includes(product.kind)) ||
    (profile.room === "bedroom" &&
      ["lamp", "throw", "cushion"].includes(product.kind)))
    ? 4
    : 0) +
  (product.price <= profile.budget ? 2 : -3) +
  (feedback[product.id] === "like"
    ? 8
    : feedback[product.id] === "less"
      ? -20
      : 0);
export function filteredProducts(
  { query = "", category = "all", budget = 10000 },
  profile,
  feedback = {},
) {
  const needle = query.trim().toLowerCase();
  return rankProducts(
    catalog.filter(
      (p) =>
        (category === "all" || p.category === category) &&
        p.price <= budget &&
        feedback[p.id] !== "less" &&
        (!needle ||
          `${p.id} ${p.name} ${p.en} ${p.brand} ${p.kind} ${p.color} ${p.tags.join(" ")}`
            .toLowerCase()
            .includes(needle)),
    ),
    profile,
    feedback,
  );
}
export function buildFeed(filters, profile, feedback = {}) {
  const ranked = filteredProducts(filters, profile, feedback);
  // Full scene coverage must not replace the small curated introduction or
  // override the shopper's ranked, filtered remainder of the catalog.
  const scenario = curatedScenarioFor(profile);
  const featured = scenario
    ? demoScenePreview(scenario).map((scene) => scene.skuId)
    : [];
  const products = [...ranked].sort((a, b) => {
    const department = getPersonaPreset(profile.personaId).category;
    const gift = (item) =>
      ["women", "men"].includes(item.category) && item.category !== department;
    return (
      Number(gift(a)) - Number(gift(b)) ||
      Number(featured.includes(b.id)) - Number(featured.includes(a.id))
    );
  });
  const ids = new Set(products.map((p) => p.id));
  const edits = lookDefinitions
    .map((e) => ({
      ...e,
      ids: e.ids.filter((id) => ids.has(id)),
      giftIdea:
        e.ids.some(
          (id) =>
            ["women", "men"].includes(byId(id).category) &&
            byId(id).category !== getPersonaPreset(profile.personaId).category,
        ) &&
        !e.ids.some(
          (id) =>
            byId(id).category === getPersonaPreset(profile.personaId).category,
        ),
    }))
    .filter((e) => e.ids.length >= 2)
    .sort(
      (a, b) =>
        b.tags.filter((t) => profile.styles.includes(t)).length -
        (b.giftIdea ? 24 : 0) +
        (b.ids.some(
          (id) =>
            byId(id).category === getPersonaPreset(profile.personaId).category,
        )
          ? 6
          : 0) -
        (a.tags.filter((t) => profile.styles.includes(t)).length -
          (a.giftIdea ? 24 : 0) +
          (a.ids.some(
            (id) =>
              byId(id).category ===
              getPersonaPreset(profile.personaId).category,
          )
            ? 6
            : 0)),
    );
  const result = [];
  for (let i = 0; i < products.length; i++) {
    if (i % 3 === 0 && edits.length && !(i === 0 && featured.length))
      result.push(edits.shift());
    result.push({ id: products[i].id, type: "product", product: products[i] });
  }
  return result;
}
export function cheaperAlternative(skuId, inventory = {}) {
  const item = byId(skuId);
  if (!item) return null;
  return (
    catalog
      .filter(
        (p) =>
          p.id !== skuId &&
          p.category === item.category &&
          p.price < item.price &&
          (inventory[p.id] ?? p.stock) > 0,
      )
      .sort((a, b) => b.price - a.price)[0] || null
  );
}
export function makeBooking(cart, form, now = Date.now()) {
  return {
    id: `ME-${now.toString(36).toUpperCase()}`,
    createdAt: new Date(now).toISOString(),
    date: form.date,
    time: form.time,
    name: form.name,
    sharedFields: form.sharedFields,
    items: cart.map((item, i) => ({
      ...sanitizeGiftLine(item),
      lineId: `booking-${now}-${i}`,
      status: ["pending", "ready", "unavailable"].includes(
        item.preparation?.status,
      )
        ? item.preparation.status
        : "pending",
      alternativeId: null,
    })),
    status: "confirmed",
    demo: true,
  };
}
export const styles = [
  { id: "quiet", zh: "极简优雅", en: "Quiet luxury" },
  { id: "tailored", zh: "利落剪裁", en: "Tailored" },
  { id: "soft", zh: "柔和舒适", en: "Soft & relaxed" },
  { id: "warm", zh: "温暖自然", en: "Warm & natural" },
  { id: "artful", zh: "艺术个性", en: "Artful" },
];
export const categories = [
  { id: "all", zh: "为你编选", en: "For you" },
  { id: "women", zh: "女装", en: "Womenswear" },
  { id: "men", zh: "男装", en: "Menswear" },
  { id: "accessories", zh: "配饰", en: "Accessories" },
  { id: "home", zh: "家居", en: "Home & living" },
];

export const skuQuantity = (items, skuId) =>
  items.filter((x) => x.skuId === skuId).reduce((n, x) => n + x.quantity, 0);
export const cartUnavailable = (items, inventory) =>
  [...new Set(items.map((x) => x.skuId))].some(
    (id) => skuQuantity(items, id) > (inventory[id] ?? 0),
  );
export function restoreState(saved) {
  // Keep an explicit saved locale even when other demo data needs recovery.
  const fresh = {
    ...initialState(),
    ...(["zh", "en"].includes(saved?.language)
      ? { language: saved.language }
      : {}),
  };
  if (!saved || saved.version !== 1 || typeof saved !== "object")
    return { state: fresh, recovered: !!saved };
  const validLine = (x) =>
    x &&
    typeof x.lineId === "string" &&
    typeof x.skuId === "string" &&
    byId(x.skuId) &&
    Number.isInteger(x.quantity) &&
    x.quantity > 0 &&
    x.quantity <= 999 &&
    byId(x.skuId).sizes.includes(x.size) &&
    byId(x.skuId).colors.includes(x.color);
  const validBooking = (b) =>
    b &&
    typeof b.id === "string" &&
    typeof b.name === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(b.date) &&
    /^\d{2}:\d{2}$/.test(b.time) &&
    ["confirmed", "cancelled"].includes(b.status) &&
    b.sharedFields &&
    typeof b.sharedFields === "object" &&
    Array.isArray(b.items) &&
    b.items.every(
      (x) =>
        validLine(x) &&
        ["pending", "ready", "unavailable"].includes(x.status) &&
        (!x.alternativeId || byId(x.alternativeId)),
    );
  if (
    !Array.isArray(saved.wishlist) ||
    !saved.wishlist.every((id) => byId(id)) ||
    !Array.isArray(saved.cart) ||
    !saved.cart.every(validLine) ||
    !Array.isArray(saved.bookings) ||
    !saved.bookings.every(validBooking) ||
    !saved.profile ||
    typeof saved.profile !== "object" ||
    !saved.inventory ||
    typeof saved.inventory !== "object" ||
    !saved.feedback ||
    typeof saved.feedback !== "object"
  )
    return { state: fresh, recovered: true };
  const candidate = saved.profile;
  const selectedStyles = Array.isArray(candidate.styles)
    ? [
        ...new Set(
          candidate.styles.filter((id) => styles.some((x) => x.id === id)),
        ),
      ]
    : fresh.profile.styles;
  const image = (value) =>
    typeof value === "string" &&
    /^data:image\/(?:jpeg|png|webp);base64,/.test(value) &&
    value.length < 2500000
      ? value
      : null;
  const consent = candidate.consent === true;
  const profile = {
    ...fresh.profile,
    name:
      typeof candidate.name === "string" && candidate.name.trim()
        ? candidate.name.trim().slice(0, 30)
        : fresh.profile.name,
    height:
      candidate.height === null
        ? null
        : typeof candidate.height === "number" &&
            Number.isFinite(candidate.height) &&
            candidate.height >= 100 &&
            candidate.height <= 220
          ? candidate.height
          : fresh.profile.height,
    size: ["XS", "S", "M", "L", "XL"].includes(candidate.size)
      ? candidate.size
      : fresh.profile.size,
    budget:
      typeof candidate.budget === "number" &&
      Number.isFinite(candidate.budget) &&
      candidate.budget >= 1000 &&
      candidate.budget <= 15000
        ? candidate.budget
        : fresh.profile.budget,
    styles: selectedStyles.length ? selectedStyles : fresh.profile.styles,
    personaId: personaPresets.some((p) => p.id === candidate.personaId)
      ? candidate.personaId
      : fresh.profile.personaId,
    homeId: homePresets.some((p) => p.id === candidate.homeId)
      ? candidate.homeId
      : fresh.profile.homeId,
    room: ["living", "kitchen", "bedroom", "dining", "study"].includes(
      candidate.room,
    )
      ? candidate.room
      : "living",
    palette: ["warm", "blue", "artful"].includes(candidate.palette)
      ? candidate.palette
      : "warm",
    consent,
    personaImage: consent ? image(candidate.personaImage) : null,
    homeImage: consent ? image(candidate.homeImage) : null,
  };
  const inventory = Object.fromEntries(
    catalog.map((p) => [
      p.id,
      Number.isInteger(saved.inventory[p.id]) &&
      saved.inventory[p.id] >= 0 &&
      saved.inventory[p.id] <= 999
        ? saved.inventory[p.id]
        : p.stock,
    ]),
  );
  const feedback = Object.fromEntries(
    Object.entries(saved.feedback).filter(
      ([id, value]) => byId(id) && ["like", "less"].includes(value),
    ),
  );
  const bookings = saved.bookings.map((b) => ({
    ...b,
    items: b.items.map((line) =>
      sanitizeTryListLine(sanitizeGiftLine(line), byId(line.skuId)),
    ),
    sharedFields: Object.fromEntries(
      ["name", "items", "dateTime", "styles", "height", "room"].map((key) => [
        key,
        b.sharedFields[key] === true,
      ]),
    ),
    sharedSnapshot: {
      styles: Array.isArray(b.sharedSnapshot?.styles)
        ? b.sharedSnapshot.styles.filter((id) =>
            styles.some((x) => x.id === id),
          )
        : [],
      height:
        typeof b.sharedSnapshot?.height === "number" &&
        Number.isFinite(b.sharedSnapshot.height)
          ? b.sharedSnapshot.height
          : null,
      room:
        typeof b.sharedSnapshot?.room === "string"
          ? b.sharedSnapshot.room
          : null,
    },
  }));
  const restoredHistory = Array.isArray(saved.purchaseHistory)
    ? saved.purchaseHistory.reduce((entries, entry) => {
        if (
          entry &&
          byId(entry.skuId) &&
          byId(entry.skuId).colors.includes(entry.color) &&
          byId(entry.skuId).sizes.includes(entry.size) &&
          !entries.some((value) => value.skuId === entry.skuId) &&
          entries.length < 12
        )
          entries.push({
            skuId: entry.skuId,
            color: entry.color,
            size: entry.size,
          });
        return entries;
      }, [])
    : demoHistoryForProfile(profile);
  return {
    state: {
      ...fresh,
      // Existing browsers already know the store. Never erase their choices.
      onboardingStatus: ["pending", "completed", "skipped"].includes(
        saved.onboardingStatus,
      )
        ? saved.onboardingStatus
        : "completed",
      profile,
      wishlist: [...new Set(saved.wishlist)],
      purchaseHistoryOrigin: Array.isArray(saved.purchaseHistory)
        ? saved.purchaseHistoryOrigin === "seeded" &&
          JSON.stringify(restoredHistory) ===
            JSON.stringify(demoHistoryForProfile(profile))
          ? "seeded"
          : "edited"
        : "seeded",
      purchaseHistory: restoredHistory,
      caseSnapshots: Object.fromEntries(
        curatedScenarios.flatMap((scenario) => {
          const snapshot = saved.caseSnapshots?.[scenario.id];
          if (!snapshot || typeof snapshot !== "object") return [];
          const persona = getPersonaPreset(scenario.personaId),
            home = getHomePreset(scenario.homeId);
          const raw = snapshot.profile || {};
          const safeProfile = {
            ...profile,
            personaId: scenario.personaId,
            homeId: scenario.homeId,
            room: scenario.room,
            name:
              typeof raw.name === "string" && raw.name.trim()
                ? raw.name.trim().slice(0, 30)
                : profile.name,
            height:
              raw.height === null
                ? null
                : Number.isFinite(raw.height) &&
                    raw.height >= 100 &&
                    raw.height <= 220
                  ? raw.height
                  : persona.height,
            size: ["XS", "S", "M", "L", "XL"].includes(raw.size)
              ? raw.size
              : persona.size,
            budget:
              Number.isFinite(raw.budget) &&
              raw.budget >= 1000 &&
              raw.budget <= 15000
                ? raw.budget
                : profile.budget,
            palette: ["warm", "blue", "artful"].includes(raw.palette)
              ? raw.palette
              : home.palette,
            styles:
              Array.isArray(raw.styles) &&
              raw.styles.some((id) => styles.some((style) => style.id === id))
                ? raw.styles.filter((id) =>
                    styles.some((style) => style.id === id),
                  )
                : [...persona.styles],
          };
          return [
            [
              scenario.id,
              {
                profile: safeProfile,
                purchaseHistory: validCaseHistory(snapshot.purchaseHistory),
                purchaseHistoryOrigin:
                  snapshot.purchaseHistoryOrigin === "seeded"
                    ? "seeded"
                    : "edited",
                wishlist: Array.isArray(snapshot.wishlist)
                  ? snapshot.wishlist.filter(byId)
                  : [],
                cart: Array.isArray(snapshot.cart)
                  ? snapshot.cart
                      .filter(validLine)
                      .map((line) =>
                        sanitizeTryListLine(
                          sanitizeGiftLine(line),
                          byId(line.skuId),
                          safeProfile,
                        ),
                      )
                  : [],
                feedback: Object.fromEntries(
                  Object.entries(snapshot.feedback || {}).filter(
                    ([id, value]) =>
                      byId(id) && ["like", "less"].includes(value),
                  ),
                ),
              },
            ],
          ];
        }),
      ),
      cart: saved.cart.map((line) =>
        sanitizeTryListLine(sanitizeGiftLine(line), byId(line.skuId), profile),
      ),
      bookings,
      inventory,
      feedback,
      language: ["zh", "en"].includes(saved.language)
        ? saved.language
        : fresh.language,
      ...musicPreferences(saved),
      soundVolume:
        typeof saved.soundVolume === "number" &&
        Number.isFinite(saved.soundVolume)
          ? Math.min(0.5, Math.max(0, saved.soundVolume))
          : fresh.soundVolume,
    },
    recovered: false,
  };
}
