import { byId } from "./data.js";
import { getPersonaPreset } from "./presets.js";
import { personalizedSceneFor } from "./personalized-scenes.js";
import { tryListVariant } from "./try-list.js";

// Read-only presentation fixtures. These never enter the shopper's bag,
// purchase history, bookings, stock or merchant preparation state.
export const visitExamples = [
  {
    id: "claire-city-edit",
    personaId: "claire-model-32",
    homeId: "warm-family",
    zh: "Claire 的城市衣橱",
    en: "Claire’s city edit",
    titleZh: "柔和暖色，从容一日。",
    titleEn: "Warm tones. An effortless day.",
    noteZh: "亚麻长裙、酒红配饰与宁静居家灵感，再选一份温暖心意。",
    noteEn:
      "Linen, burgundy accents and quiet home inspiration, with a thoughtful gift.",
    outfit: "/personalized-scenes/v17-claire-dress.webp",
    outfitIds: ["ME-015", "ME-004", "ME-007"],
    homeIdSku: "ME-017",
    giftId: "ME-014",
  },
  {
    id: "julian-city-edit",
    personaId: "julian-model-34",
    homeId: "compact-city",
    zh: "Julian 的从容衣橱",
    en: "Julian’s considered edit",
    titleZh: "舒适层搭，慢享城市。",
    titleEn: "Easy layers. A considered city day.",
    noteZh: "细罗纹针织、羊毛长裤与麂皮便鞋，为城市一日添一份从容。",
    noteEn:
      "Fine-rib knitwear, wool trousers and suede loafers for an easier city day.",
    outfit: "/personalized-scenes/v17-julian-knit.webp",
    outfitIds: ["ME-014", "ME-011", "ME-013", "ME-027"],
    homeIdSku: "ME-021",
    giftId: "ME-006",
  },

  {
    id: "warm-everyday",
    personaId: "everyday-woman-45",
    homeId: "warm-family",
    zh: "温暖日常",
    en: "A warmer everyday",
    titleZh: "一袭暖色，一室从容。",
    titleEn: "Warm tones. A little room to breathe.",
    noteZh: "亚麻长裙、酒红配饰与阅读角，再为重要的人挑一份心意。",
    noteEn:
      "A linen dress, burgundy accents, a reading corner and a thoughtful gift.",
    outfit: "/outfit-scenes/woman-dress-dinner-v1.webp",
    outfitIds: ["ME-015", "ME-004", "ME-007"],
    homeIdSku: "ME-017",
    giftId: "ME-006",
  },
  {
    id: "quiet-city",
    personaId: "relaxed-man-50",
    homeId: "compact-city",
    zh: "城市慢生活",
    en: "A quieter city life",
    titleZh: "轻松一身，慢享日常。",
    titleEn: "Easy layers. A slower afternoon.",
    noteZh: "细罗纹针织、羊毛长裤与麂皮便鞋，把城市生活过得舒适一些。",
    noteEn:
      "Fine-rib knitwear, wool trousers and suede loafers for an easier city day.",
    outfit: "/outfit-scenes/man-knit-cafe-v1.webp",
    outfitIds: ["ME-014", "ME-011", "ME-013", "ME-027"],
    homeIdSku: "ME-021",
    giftId: "ME-006",
  },
];

export function visitExampleFor(profile = {}) {
  return (
    visitExamples.find((entry) => entry.personaId === profile.personaId) ||
    visitExamples.find(
      (entry) =>
        getPersonaPreset(entry.personaId).category ===
        getPersonaPreset(profile.personaId).category,
    ) ||
    visitExamples[0]
  );
}

export function buildVisitJourney(state, exampleId) {
  const example =
    visitExamples.find((entry) => entry.id === exampleId) ||
    visitExampleFor(state.profile);
  const booking = state.bookings.find(
    (entry) =>
      entry.status !== "cancelled" &&
      entry.items?.some((line) => byId(line.skuId)),
  );
  const selected = state.cart.filter((line) => byId(line.skuId));
  const source = booking
    ? "booking"
    : selected.length
      ? "selected"
      : "recommended";
  const profile =
    source === "recommended"
      ? {
          ...state.profile,
          personaId: example.personaId,
          homeId: example.homeId,
          room: "living",
          size: getPersonaPreset(example.personaId).size,
        }
      : state.profile;
  const ids = [...example.outfitIds, example.homeIdSku, example.giftId];
  const fixtureLines = () =>
    ids.map((skuId, index) => {
      const item = byId(skuId);
      const gift =
        skuId === example.giftId
          ? {
              isGift: true,
              packagingId: "ivory-silk",
              recipient: "",
              recipientSize: "",
              occasion: "thanks",
              includeCard: true,
              cardMessage: "",
            }
          : null;
      return {
        lineId: `visit-example-${example.id}-${index}`,
        skuId,
        ...tryListVariant(item, profile, gift),
        color: item.color,
        quantity: 1,
        ...(gift ? { gift } : {}),
        // Explicitly fictional display states, never written to storage.
        preparation: { status: gift ? "pending" : "ready" },
      };
    });
  const lines = (
    booking ? booking.items : selected.length ? selected : fixtureLines()
  )
    .filter((line) => byId(line.skuId))
    .map((line) => ({
      ...line,
      product: byId(line.skuId),
      displayPreparationStatus: booking
        ? line.status || "pending"
        : line.preparation?.status || line.status || "pending",
    }));
  const normal = lines.filter((line) => !line.gift?.isGift);
  const gifts = lines.filter((line) => line.gift?.isGift);
  const groups = [
    {
      id: "wardrobe",
      kinds: ["women", "men"],
      zh: "私人试衣",
      en: "Your private fitting",
      minutes: 20,
      noteZh: "对比轮廓与触感，留下真正喜欢的。",
      noteEn: "Compare silhouettes and feel. Keep only what you love.",
    },
    {
      id: "accessories",
      kinds: ["accessories"],
      zh: "配饰点睛",
      en: "The finishing touches",
      minutes: 10,
      noteZh: "试穿鞋履，近看皮革与细节。",
      noteEn: "Try the shoes. Get closer to the leather and details.",
    },
    {
      id: "home",
      kinds: ["home"],
      zh: "家的一角",
      en: "A corner of home",
      minutes: 15,
      noteZh: "坐下来，触摸材质，让日常有一点不同。",
      noteEn: "Take a seat, explore the materials, imagine your everyday.",
    },
  ]
    .flatMap((group) => {
      const candidates = normal.filter((line) =>
        group.kinds.includes(line.product.category),
      );
      const floors = [...new Set(candidates.map((line) => line.product.floor))];
      return floors.map((floor) => {
        const items = candidates.filter((line) => line.product.floor === floor);
        return {
          ...group,
          id: floors.length > 1 ? `${group.id}-${floor}` : group.id,
          items,
          floor,
          counters: [...new Set(items.map((line) => line.product.counter))],
        };
      });
    })
    // One ascent, then a gentle descent ending at the ground-floor gift salon.
    .sort((a, b) => b.floor - a.floor);
  const stops = [
    {
      id: "welcome",
      zh: "礼宾迎候",
      en: "A personal welcome",
      floor: 1,
      counters: ["CONCIERGE"],
      minutes: 5,
      items: [],
      noteZh: "从中央中庭开始，先说说今天想找到什么。",
      noteEn:
        "Begin in the central atrium. Tell your concierge what brought you in.",
    },
    ...groups,
    ...(gifts.length
      ? [
          {
            id: "gift",
            zh: "礼物与心意",
            en: "Wrapped with care",
            floor: 1,
            counters: ["GIFT SALON"],
            minutes: 10,
            items: gifts,
            noteZh: "核对礼物细节，再看礼盒、缎带与祝福卡。",
            noteEn:
              "Review the gift details, then explore a box, ribbon and gift card.",
          },
        ]
      : []),
  ];
  let offset = 0;
  const start = booking?.time?.match(/^(\d{1,2}):(\d{2})$/);
  const startMinutes = start
    ? Number(start[1]) * 60 + Number(start[2])
    : 14 * 60 + 30;
  for (const stop of stops) {
    const time = startMinutes + offset;
    stop.time = `${String(Math.floor(time / 60) % 24).padStart(2, "0")}:${String(time % 60).padStart(2, "0")}`;
    offset += stop.minutes;
  }
  const ready = lines.filter((line) => {
    if (
      line.gift?.isGift &&
      !line.gift.recipientSize &&
      line.fit?.kind !== "experience"
    )
      return false;
    return line.displayPreparationStatus === "ready";
  }).length;
  const firstWear = normal.find((line) =>
    ["women", "men"].includes(line.product.category),
  );
  const scene =
    firstWear &&
    personalizedSceneFor(firstWear.skuId, profile, firstWear.color);
  return {
    source,
    booking,
    example,
    profile,
    lines,
    stops,
    ready,
    minutes: offset,
    floors: [...new Set(stops.map((stop) => stop.floor))].sort(),
    total: lines.reduce(
      (sum, line) => sum + line.product.price * line.quantity,
      0,
    ),
    giftLines: gifts,
    heroImage:
      source === "recommended"
        ? example.outfit
        : scene?.src || "/images/architecture-hero.webp",
    persona: getPersonaPreset(profile.personaId),
  };
}
