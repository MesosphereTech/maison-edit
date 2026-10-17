import { byId } from "./data.js";
import { tryListVariant, isTryOnPiece } from "./try-list.js";
import { giftPackagingOptions, normalizeGift } from "./gift-packaging.js";

// Explicit local interactions are acknowledged independently of passive-hint
// throttling. These lines never turn a submission into a real reservation.
export function createTryListGuideReply({ event = {}, language = "zh" }) {
  const item = byId(event.productId);
  if (!item || !["add", "gift", "preparation"].includes(event.type))
    return null;
  const t = (zh, en) => (language === "en" ? en : zh);
  const name = t(item.name, item.en);
  const gift = normalizeGift(event.gift);
  const fit =
    event.fit ||
    event.variant?.fit ||
    (gift ? tryListVariant(item, {}, gift).fit : {});
  const size = fit.matchedSize || fit.displaySize;
  const packaging = giftPackagingOptions.find(
    (option) => option.id === gift?.packagingId,
  );
  const giftLine = gift
    ? t(
        `礼赠已选择${packaging.zh}${gift.includeCard ? "与祝福卡" : ""}。`,
        `Your gift includes the ${packaging.en.toLowerCase()} concept${gift.includeCard ? " and a gift card" : ""}. `,
      )
    : "";
  const fitLine = gift
    ? fit.status === "not-required"
      ? t(
          "这件礼物无需服装尺码，包装偏好已记录。",
          "This gift needs no clothing size; its wrapping preference is recorded. ",
        )
      : fit.status === "matched" && fit.source === "recipient" && size
        ? t(
            `受赠人规格记为 ${size}，不会沿用你的尺码。`,
            `The recipient’s selected size is ${size}; your own size is not used. `,
          )
        : t(
            "受赠人尺码待到店确认，不会沿用你的尺码，也尚未按尺码预留。",
            "The recipient’s size needs confirmation at the store. Your own size is not used and no size is reserved. ",
          )
    : fit.status === "matched" && size
      ? t(
          `已按当前虚构人物档案匹配 ${size}，无需在商品页选码。`,
          `The current fictional profile matches size ${size}; no product-page size selection is needed. `,
        )
      : fit.status === "not-required"
        ? t(
            "这件无需服装尺码，已记录体验规格。",
            "This piece needs no clothing size; its experience specification is recorded. ",
          )
        : t(
            "当前档案无法可靠匹配规格，已标为待门店确认。",
            "The current profile cannot reliably match a size; store confirmation is needed. ",
          );
  let text;
  if (event.type === "gift") {
    text = gift
      ? t(`「${name}」已切换为礼赠。`, `${name} is now selected as a gift. `) +
        giftLine +
        fitLine +
        t(
          "可以补充送给谁、什么场合，或留一张祝福卡。这些仅是本地演示偏好。",
          "You can add the recipient, occasion or a gift-card message. These are local demo preferences only.",
        )
      : t(
          `「${name}」已切回自用，后续按你的当前虚构档案匹配体验规格。`,
          `${name} is back to personal use. Future try-list additions use your current fictional profile.`,
        );
  } else if (event.type === "preparation") {
    const status = event.preparation?.status;
    text =
      status === "ready"
        ? gift && !["matched", "not-required"].includes(fit.status)
          ? t(
              `演示门店已收到「${name}」的礼赠咨询。`,
              `The demo store has acknowledged the gift consultation for ${name}. `,
            ) +
            giftLine +
            fitLine
          : t(
              `演示门店已确认「${name}」的备货，${size ? `${size} ` : ""}已在本地模拟中预留供到店尝试。`,
              `The demo store has confirmed preparation for ${name}${size ? ` in ${size}` : ""}, reserved for trying in this local simulation. `,
            ) + giftLine
        : status === "unavailable"
          ? t(
              `演示门店暂时无法准备「${name}」，可以在清单里继续查看替代选择。`,
              `The demo store cannot currently prepare ${name}. Check the try list for alternatives.`,
            )
          : t(
              `「${name}」的本地备货请求已更新，等待演示门店确认。`,
              `The local preparation request for ${name} has been updated and awaits demo-store confirmation.`,
            );
    text += t(
      "没有联系真实门店或锁定真实库存。",
      " No real store was contacted and no real stock was reserved.",
    );
  } else {
    text =
      t(
        `「${name}」已加入${isTryOnPiece(item) ? "到店试穿" : "到店体验"}清单。`,
        `${name} is on your store ${isTryOnPiece(item) ? "try-on" : "experience"} list. `,
      ) +
      fitLine +
      giftLine +
      t(
        "已提交本地演示备货请求，等待演示门店确认；尚未真实留货。",
        "A local demo preparation request has been submitted and awaits demo-store confirmation; no real stock is reserved.",
      );
  }
  return {
    role: "assistant",
    mode: "demo",
    text,
    visualText: text,
    productIds: [],
    quickReplies: [{ id: "booking", label: t("查看到店安排", "Plan a visit") }],
    source: { productId: item.id },
    interaction: event.type,
  };
}
