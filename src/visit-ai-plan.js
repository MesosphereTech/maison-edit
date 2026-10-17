import { byId } from "./data.js";
import { buildVisitJourney } from "./visit-journey.js";
import { tryListVariant } from "./try-list.js";

export const initialVisitPreferences = () => ({
  duration: null,
  shoesFirst: false,
  lessWalking: false,
  giftFocus: false,
  stage: "route",
  packagingId: null,
  size: null,
  revision: 1,
});
const has = (text, expression) => expression.test(text);

// One read-only planning state drives all three regions. No inventory, cart,
// reservation, size template or merchant-preparation record is changed here.
export function interpretVisitMessage(
  text,
  previous = initialVisitPreferences(),
) {
  const value = String(text).trim();
  let next = { ...previous },
    understood = false;
  const duration = value.match(
    /(\d{1,3})\s*(?:分钟|分(?:钟)?|mins?\b|minutes?\b)/i,
  );
  if (duration) {
    next.duration = Math.max(15, Math.min(180, Number(duration[1])));
    understood = true;
  }
  if (has(value, /半小时|half an? hour/i)) {
    next.duration = 30;
    understood = true;
  }
  if (has(value, /鞋|shoes?|footwear|loafers?/i)) {
    next.shoesFirst = true;
    next.stage = "route";
    understood = true;
  }
  if (
    has(
      value,
      /少走|电梯|无障碍|走动|less walk|fewer steps|lift|elevator|accessible/i,
    )
  ) {
    next.lessWalking = true;
    next.stage = "route";
    understood = true;
  }
  if (has(value, /礼物|送礼|包装|礼盒|gift|wrapp|packag/i)) {
    next.giftFocus = true;
    next.stage = "gift";
    understood = true;
  }
  if (has(value, /棉带|cotton|kraft/i)) {
    next.packagingId = "recycled-cotton";
    next.giftFocus = true;
    next.stage = "gift";
    understood = true;
  }
  if (has(value, /花意|花枝|botanical|floral/i)) {
    next.packagingId = "floral-accent";
    next.giftFocus = true;
    next.stage = "gift";
    understood = true;
  }
  if (has(value, /缎带|丝带|silk|ivory/i)) {
    next.packagingId = "ivory-silk";
    next.giftFocus = true;
    next.stage = "gift";
    understood = true;
  }
  if (has(value, /穿搭|试穿|上身|outfit|try.?on|fitting/i)) {
    next.stage = "outfit";
    understood = true;
  }
  if (has(value, /地图|路线|行程|map|route|itinerary/i)) {
    next.stage = "route";
    understood = true;
  }
  const size = value.match(
    /(?:我(?:的)?(?:衣服)?(?:尺码)?|my (?:clothing )?size|size)\s*(?:是|为|is|:)?\s*(XS|XL|S|M|L)\b/i,
  );
  if (size && !has(value, /受赠|recipient/i)) {
    next.size = size[1].toUpperCase();
    next.stage = "outfit";
    understood = true;
  }
  if (
    has(
      value,
      /重新规划|恢复完整|重置路线|reset (?:the )?(?:plan|route)|full (?:plan|route)/i,
    )
  ) {
    next = { ...initialVisitPreferences(), revision: previous.revision };
    understood = true;
  }
  if (understood) next.revision = previous.revision + 1;
  return { preferences: next, understood };
}

export function buildAIVisitPlan(
  state,
  preferences = initialVisitPreferences(),
) {
  const base = buildVisitJourney(state);
  let lines = base.lines.map((line) => ({ ...line }));
  if (preferences.size)
    lines = lines.map((line) =>
      line.gift?.isGift || line.fit?.kind !== "clothing"
        ? line
        : {
            ...line,
            fit: {
              ...line.fit,
              displaySize: preferences.size,
              status: line.product.sizes.includes(preferences.size)
                ? "matched"
                : "pending",
            },
          },
    );
  const giftPreview = preferences.giftFocus && !base.giftLines.length;
  if (giftPreview) {
    const product = byId(base.example.giftId),
      gift = {
        isGift: true,
        packagingId: preferences.packagingId || "ivory-silk",
        recipientSize: "",
        includeCard: true,
      };
    lines.push({
      lineId: "visit-planning-gift-preview",
      skuId: product.id,
      ...tryListVariant(product, base.profile, gift),
      color: product.color,
      quantity: 1,
      product,
      gift,
      displayPreparationStatus: "pending",
      planningPreview: true,
    });
  }
  lines = lines.map((line) =>
    line.gift?.isGift && preferences.packagingId
      ? {
          ...line,
          gift: { ...line.gift, packagingId: preferences.packagingId },
        }
      : line,
  );
  const normal = lines.filter((line) => !line.gift?.isGift),
    gifts = lines.filter((line) => line.gift?.isGift);
  const stops = [];
  const add = (id, zh, en, items, minutes, floor) => {
    if (items.length)
      stops.push({
        id,
        zh,
        en,
        items,
        minutes,
        floor,
        counters: [...new Set(items.map((line) => line.product.counter))],
      });
  };
  for (const floor of [4, 3, 2, 1]) {
    add(
      `home-${floor}`,
      "家的一角",
      "A corner of home",
      normal.filter(
        (line) =>
          line.product.category === "home" && line.product.floor === floor,
      ),
      15,
      floor,
    );
    add(
      `wardrobe-${floor}`,
      "私人试衣",
      "Your private fitting",
      normal.filter(
        (line) =>
          ["women", "men"].includes(line.product.category) &&
          line.product.kind !== "shoe" &&
          line.product.floor === floor,
      ),
      20,
      floor,
    );
    add(
      `shoes-${floor}`,
      "鞋履试穿",
      "Find your fit",
      normal.filter(
        (line) => line.product.kind === "shoe" && line.product.floor === floor,
      ),
      10,
      floor,
    );
    add(
      `accessories-${floor}`,
      "配饰点睛",
      "Finishing touches",
      normal.filter(
        (line) =>
          line.product.category === "accessories" &&
          line.product.kind !== "shoe" &&
          line.product.floor === floor,
      ),
      8,
      floor,
    );
  }
  let planned = [...stops],
    omitted = [];
  if (
    preferences.lessWalking ||
    (preferences.duration && preferences.duration <= 30)
  ) {
    omitted = planned.filter((stop) => stop.id.startsWith("home"));
    planned = planned.filter((stop) => !stop.id.startsWith("home"));
    if (!planned.length) {
      planned = [...stops];
      omitted = [];
    }
  }
  if (preferences.shoesFirst)
    planned.sort(
      (a, b) =>
        Number(b.id.startsWith("shoes")) - Number(a.id.startsWith("shoes")) ||
        b.floor - a.floor,
    );
  planned.unshift({
    id: "welcome",
    zh: "中庭迎候",
    en: "Atrium welcome",
    floor: 1,
    counters: ["CONCIERGE"],
    minutes: 5,
    items: [],
  });
  if (gifts.length)
    planned.push({
      id: "gift",
      zh: "礼物与心意",
      en: "The gift salon",
      floor: 1,
      counters: ["GIFT SALON"],
      minutes: 10,
      items: gifts,
    });
  const naturalMinutes = planned.reduce(
    (total, stop) => total + stop.minutes,
    0,
  );
  const totalMinutes = preferences.duration || naturalMinutes;
  const allocated = planned.map((stop) =>
    Math.max(1, Math.floor((stop.minutes * totalMinutes) / naturalMinutes)),
  );
  let remaining = totalMinutes - allocated.reduce((a, b) => a + b, 0);
  for (let i = 0; remaining > 0; i = (i + 1) % allocated.length, remaining--)
    allocated[i]++;
  let offset = 0;
  const start = base.booking?.time?.match(/^(\d{1,2}):(\d{2})$/),
    startMinutes = start ? +start[1] * 60 + +start[2] : 14 * 60 + 30;
  planned = planned.map((stop, index) => {
    const minute = startMinutes + offset;
    offset += allocated[index];
    return {
      ...stop,
      minutes: allocated[index],
      time: `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}`,
    };
  });
  const sizeLabels = [
    ...new Set(
      lines
        .filter((line) => !line.gift?.isGift && line.fit?.kind !== "experience")
        .map((line) => line.fit?.displaySize || line.size),
    ),
  ];
  const sizePending = gifts.some(
    (line) =>
      line.fit?.kind !== "experience" &&
      (!line.gift.recipientSize || line.fit.status === "pending"),
  );
  return {
    ...base,
    lines,
    stops: planned,
    minutes: totalMinutes,
    giftLines: gifts,
    giftPreview,
    omitted,
    sizeLabels,
    sizePending,
    preferences,
    floors: [...new Set(planned.map((stop) => stop.floor))],
    revision: preferences.revision,
  };
}

export function visitPlanReply(
  plan,
  language = "en",
  understood = true,
  initial = false,
) {
  const zh = language === "zh",
    p = plan.preferences;
  const route = plan.stops
    .map((stop) => `${stop.floor}F ${zh ? stop.zh : stop.en}`)
    .join(" → ");
  const lead = initial
    ? zh
      ? "我已先为你排好今天的路线。"
      : "I’ve made a first plan for your visit."
    : !understood
      ? zh
        ? "我可以一起调整用时、先试什么、少走动或礼物安排。告诉我例如「30 分钟，先试鞋」。"
        : "I can adjust your time, first fitting, walking or gifts. Try “30 minutes, shoes first”."
      : zh
        ? "已把你的想法放进这次行程。"
        : "I’ve worked that into your visit.";
  return `${lead}\n${plan.minutes} ${zh ? "分钟" : "minutes"} · ${plan.stops.length} ${zh ? "站" : "stops"}${p.lessWalking ? (zh ? " · 电梯优先，略过家居停留" : " · lifts first, home stop set aside") : ""}${plan.omitted.length && !p.lessWalking ? (zh ? " · 家居留待下次" : " · home stop set aside") : ""}\n${route}${p.shoesFirst && !plan.stops.some((stop) => stop.id.startsWith("shoes")) ? "\n" + (zh ? "当前清单没有鞋履，尚未添加新的鞋款。" : "Your current list has no footwear. No new pair has been added.") : ""}${plan.giftLines.length ? "\n" + (plan.sizePending ? (zh ? "礼物尺码待确认；礼盒只是预览，尚未备货或包装。" : "Gift size still needs confirming. Wrapping is a preview; nothing has been prepared.") : zh ? "已保留礼物厅，包装仍为演示预览。" : "The gift salon is included. Wrapping remains a demo preview.") : ""}`;
}
