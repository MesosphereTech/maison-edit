// Optional, explicitly selected gift preferences. These are local demo notes only.
export const giftPackagingOptions = [
  {
    id: "ivory-silk",
    zh: "缎带礼盒",
    en: "Silk-ribbon box",
    detailZh: "象牙白礼盒 · 酒红缎带",
    detailEn: "Ivory box · burgundy ribbon",
    image: "/gift-packaging/ivory-silk.webp",
  },
  {
    id: "floral-accent",
    zh: "花意礼盒",
    en: "Botanical keepsake",
    detailZh: "柔色纸盒 · 花枝点缀",
    detailEn: "Soft paper · botanical accent",
    image: "/gift-packaging/floral-accent.webp",
  },
  {
    id: "recycled-cotton",
    zh: "自然棉带礼盒",
    en: "Cotton-ribbon box",
    detailZh: "肌理纸盒 · 天然棉带概念",
    detailEn: "Textured kraft · cotton-ribbon concept",
    image: "/gift-packaging/recycled-cotton.webp",
  },
];

export const giftOccasions = [
  { id: "birthday", zh: "生日", en: "Birthday" },
  { id: "anniversary", zh: "纪念日", en: "Anniversary" },
  { id: "thanks", zh: "表达感谢", en: "Thank you" },
  { id: "celebration", zh: "庆祝时刻", en: "Celebration" },
  { id: "just-because", zh: "日常心意", en: "Just because" },
];
const cleanText = (value, max) =>
  typeof value === "string"
    ? value
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, max)
    : "";

export function normalizeGift(value) {
  if (!value || typeof value !== "object" || value.isGift !== true) return null;
  const includeCard = value.includeCard === true;
  return {
    isGift: true,
    packagingId: giftPackagingOptions.some(
      (option) => option.id === value.packagingId,
    )
      ? value.packagingId
      : giftPackagingOptions[0].id,
    recipient: cleanText(value.recipient, 40),
    recipientSize: /^(?:XS|S|M|L|XL|ONE SIZE|EU (?:3[6-9]|4[0-6]))$/.test(
      value.recipientSize || "",
    )
      ? value.recipientSize
      : "",
    occasion: giftOccasions.some((occasion) => occasion.id === value.occasion)
      ? value.occasion
      : "",
    includeCard,
    cardMessage: includeCard ? cleanText(value.cardMessage, 160) : "",
  };
}

export const defaultGift = () => normalizeGift({ isGift: true });
export const giftPreferenceKey = (value) =>
  JSON.stringify(normalizeGift(value));
export const sameGiftPreferences = (a, b) =>
  giftPreferenceKey(a) === giftPreferenceKey(b);

// Legacy bag lines have no gift field. Keep their schema unchanged when restoring.
export function sanitizeGiftLine(line) {
  if (!Object.prototype.hasOwnProperty.call(line, "gift")) return { ...line };
  const gift = normalizeGift(line.gift);
  const next = { ...line };
  if (gift) next.gift = gift;
  else delete next.gift;
  return next;
}

export function giftSummary(value, L) {
  const gift = normalizeGift(value);
  if (!gift) return "";
  const packaging = giftPackagingOptions.find(
    (option) => option.id === gift.packagingId,
  );
  const occasion = giftOccasions.find((option) => option.id === gift.occasion);
  return [
    L("礼物", "Gift"),
    L(packaging.zh, packaging.en),
    gift.recipient && L(`送给 ${gift.recipient}`, `For ${gift.recipient}`),
    occasion && L(occasion.zh, occasion.en),
    L(
      `受赠人尺码：${gift.recipientSize || "待到店确认"}`,
      `Recipient size: ${gift.recipientSize || "confirm at store"}`,
    ),
    gift.includeCard && L("附祝福卡", "With a gift card"),
  ]
    .filter(Boolean)
    .join(" · ");
}
