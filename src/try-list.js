import { getPersonaPreset } from "./presets.js";

// Declared synthetic shoe templates, never measurements inferred from a photo.
const fictionalShoeSizes = {
  "claire-model-32": "EU 39",
  "julian-model-34": "EU 43",
  "everyday-woman-45": "EU 38",
  "relaxed-man-50": "EU 42",
  "soft-woman-60": "EU 38",
  "tall-man-35": "EU 44",
  "elegant-woman-28": "EU 39",
  "curvy-woman-38": "EU 39",
  "petite-woman-32": "EU 36",
};
export const isTryOnPiece = (item) =>
  Boolean(
    item && (["women", "men"].includes(item.category) || item.kind === "shoe"),
  );
export function tryListRecipientSizes(item) {
  return item.kind === "shoe"
    ? Array.from({ length: 11 }, (_, index) => `EU ${index + 36}`)
    : item.sizes;
}
export function tryListVariant(item, profile = {}, gift = null) {
  const persona = getPersonaPreset(profile.personaId);
  const kind =
    item.kind === "shoe"
      ? "shoe"
      : isTryOnPiece(item)
        ? "clothing"
        : "experience";
  const baseSize = item.sizes[0];
  if (gift?.isGift) {
    if (kind === "experience")
      return {
        size: baseSize,
        fit: {
          status: "not-required",
          source: "recipient",
          kind,
          displaySize: "ONE SIZE",
        },
      };
    const recipientSize = tryListRecipientSizes(item).includes(
      gift.recipientSize,
    )
      ? gift.recipientSize
      : null;
    return {
      size: item.sizes.includes(recipientSize) ? recipientSize : baseSize,
      fit: {
        status: recipientSize ? "matched" : "pending",
        source: "recipient",
        kind,
        ...(recipientSize
          ? { matchedSize: recipientSize, displaySize: recipientSize }
          : {}),
      },
    };
  }
  if (kind === "experience")
    return {
      size: baseSize,
      fit: {
        status: "not-required",
        source: "experience",
        kind,
        displaySize: "ONE SIZE",
      },
    };
  const displaySize =
    kind === "shoe"
      ? fictionalShoeSizes[persona.id] ||
        (persona.category === "men" ? "EU 42" : "EU 38")
      : profile.size || persona.size;
  return {
    size: item.sizes.includes(displaySize) ? displaySize : baseSize,
    fit: {
      status:
        kind === "shoe" || item.sizes.includes(displaySize)
          ? "matched"
          : "pending",
      source: "fictional-persona",
      personaId: persona.id,
      kind,
      matchedSize: displaySize,
      displaySize,
    },
  };
}
export function tryListSizeLabel(line, L) {
  if (!line.gift?.isGift && line.fit?.status === "pending")
    return L(
      `模板尺码 ${line.fit.displaySize || line.size} · 待门店确认`,
      `Template size ${line.fit.displaySize || line.size} · confirm at store`,
    );
  if (line.gift?.isGift && line.fit?.kind !== "experience") {
    if (!line.gift.recipientSize || line.fit?.status === "pending")
      return L("受赠人尺码待到店确认", "Recipient size: confirm at store");
    return L(
      `受赠人尺码 ${line.fit?.displaySize || line.gift.recipientSize}`,
      `Recipient size ${line.fit?.displaySize || line.gift.recipientSize}`,
    );
  }
  if (line.fit?.kind === "experience")
    return L("到店体验 · 无需尺码", "Store experience · no size needed");
  if (line.fit?.kind === "shoe")
    return L(
      `${line.fit.displaySize} · 虚构鞋码模板`,
      `${line.fit.displaySize} · fictional shoe template`,
    );
  return line.fit?.displaySize || line.size;
}
export function tryListPreparationLabel(line, L) {
  const status = line.preparation?.status || "pending";
  if (status === "unavailable")
    return L("演示门店反馈：暂不可备货", "Demo store: unavailable");
  if (!line.gift?.isGift && line.fit?.status === "pending")
    return L(
      "已提交演示咨询 · 匹配尺码待确认",
      "Demo consultation submitted · matched size pending",
    );
  if (
    line.fit?.status === "pending" ||
    (line.gift?.isGift &&
      !line.gift.recipientSize &&
      line.fit?.kind !== "experience")
  )
    return L(
      "已提交演示咨询 · 受赠人尺码待确认",
      "Demo consultation submitted · recipient size pending",
    );
  if (status === "ready")
    return L(
      "演示门店已确认备好 · 非真实留货",
      "Demo store confirmed ready · no real reservation",
    );
  return L(
    "已提交演示备货 · 待门店确认",
    "Demo preparation submitted · awaiting store confirmation",
  );
}

// Storage migration never upgrades an old like, an unverified old size, or
// arbitrary fit text to a submitted/matched/ready reservation claim.
export function sanitizeTryListLine(line, item, profile = null) {
  if (!item) return line;
  if (!line.fit && !line.preparation) return { ...line };
  const rawFit = line.fit;
  const expected = tryListVariant(
    item,
    profile || { personaId: rawFit?.personaId, size: line.size },
    line.gift,
  );
  const validSource = line.gift?.isGift
    ? rawFit?.source === "recipient"
    : expected.fit.kind === "experience"
      ? rawFit?.source === "experience"
      : rawFit?.source === "fictional-persona" &&
        rawFit.personaId === expected.fit.personaId;
  const validFit = Boolean(
    rawFit &&
    validSource &&
    rawFit.kind === expected.fit.kind &&
    rawFit.status === expected.fit.status &&
    (rawFit.displaySize || null) === (expected.fit.displaySize || null) &&
    line.size === expected.size,
  );
  const fit = validFit
    ? expected.fit
    : {
        status: "pending",
        source: line.gift?.isGift ? "recipient" : "legacy",
        kind: expected.fit.kind,
        ...(line.gift?.isGift
          ? {}
          : { displaySize: item.kind === "shoe" ? "ONE SIZE" : line.size }),
      };
  const timestamp = (value) =>
    typeof value === "string" &&
    value.length <= 30 &&
    Number.isFinite(Date.parse(value))
      ? value
      : null;
  const acknowledgedAt = timestamp(line.preparation?.acknowledgedAt);
  const rawStatus = line.preparation?.status;
  const status =
    validFit &&
    ["matched", "not-required"].includes(fit.status) &&
    rawStatus === "ready" &&
    acknowledgedAt
      ? "ready"
      : validFit && rawStatus === "unavailable"
        ? "unavailable"
        : "pending";
  return {
    ...line,
    fit,
    ...(line.status !== undefined && fit.status === "pending"
      ? { status: "pending" }
      : {}),
    preparation: {
      status,
      ...(timestamp(line.preparation?.submittedAt)
        ? { submittedAt: timestamp(line.preparation.submittedAt) }
        : {}),
      ...(status === "ready" ? { acknowledgedAt } : {}),
    },
  };
}
