import React, { useEffect, useId, useState } from "react";
import {
  defaultGift,
  giftOccasions,
  giftPackagingOptions,
  giftSummary,
  normalizeGift,
} from "./gift-packaging.js";
import "./gift-packaging.css";

function PackagingImage({ option, L }) {
  const [failed, setFailed] = React.useState(false);
  return (
    <span
      className={`gift-packaging-visual gift-visual-${option.id} ${failed ? "is-fallback" : ""}`}
    >
      {!failed && (
        <img
          src={option.image}
          alt={L(option.detailZh, option.detailEn)}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <span className="gift-box-concept" aria-hidden="true">
          <i />
        </span>
      )}
    </span>
  );
}

export function GiftPackagingEditor({
  value,
  onChange,
  L,
  compact = false,
  sizes = [],
}) {
  const id = useId();
  const normalized = normalizeGift(value);
  // Keep spaces while the shopper types. Bound and trim only at persistence.
  const gift = normalized
    ? {
        ...normalized,
        recipient:
          typeof value.recipient === "string"
            ? value.recipient.slice(0, 40)
            : "",
        cardMessage:
          typeof value.cardMessage === "string"
            ? value.cardMessage.slice(0, 160)
            : "",
      }
    : null;
  const [recipientDraft, setRecipientDraft] = useState(gift?.recipient || "");
  const [messageDraft, setMessageDraft] = useState(gift?.cardMessage || "");
  const gifting = Boolean(gift);
  useEffect(() => {
    setRecipientDraft(gift?.recipient || "");
    setMessageDraft(gift?.cardMessage || "");
  }, [gifting]);
  const newGift = () => ({
    ...defaultGift(),
    recipientSize: sizes.length === 1 ? sizes[0] : "",
  });
  const patch = (change) =>
    onChange(normalizeGift({ ...(gift || defaultGift()), ...change }));
  return (
    <section
      className={`gift-editor ${compact ? "is-compact" : ""}`}
      aria-label={L("礼赠与包装偏好", "Gifting and packaging preferences")}
    >
      <div className="gift-editor-heading">
        <span className="gift-symbol" aria-hidden="true">
          ✧
        </span>
        <div>
          <p className="gift-eyebrow">THE ART OF GIVING</p>
          <h3>
            {L("为自己，也为心意。", "A little thought, beautifully wrapped.")}
          </h3>
        </div>
      </div>
      <fieldset className="gift-intent">
        <legend className="gift-sr-only">
          {L("这件单品的用途", "Who is this piece for?")}
        </legend>
        {[false, true].map((isGift) => (
          <label
            className={Boolean(gift) === isGift ? "is-selected" : ""}
            key={String(isGift)}
          >
            <input
              type="radio"
              name={`${id}-intent`}
              checked={Boolean(gift) === isGift}
              onChange={() => onChange(isGift ? newGift() : null)}
            />
            <span>
              {isGift
                ? L("作为礼物", "Give as a gift")
                : L("为自己挑选", "For myself")}
            </span>
          </label>
        ))}
      </fieldset>
      {gift && (
        <div className="gift-details">
          <p className="gift-help">
            {L(
              "不必只为自己挑选。选择包装，把心意一起记入到店清单。",
              "Choose for someone you care about, then save a wrapping idea with your visit bag.",
            )}
          </p>
          <fieldset className="gift-packaging-options">
            <legend>{L("挑一种包装心意", "Choose a wrapping idea")}</legend>
            <div className="gift-packaging-grid">
              {giftPackagingOptions.map((option) => (
                <label
                  className={`gift-packaging-option ${gift.packagingId === option.id ? "is-selected" : ""}`}
                  key={option.id}
                >
                  <input
                    type="radio"
                    name={`${id}-packaging`}
                    value={option.id}
                    checked={gift.packagingId === option.id}
                    onChange={() => patch({ packagingId: option.id })}
                  />
                  <PackagingImage option={option} L={L} />
                  <span className="gift-packaging-name">
                    {L(option.zh, option.en)}
                  </span>
                  <span className="gift-packaging-description">
                    {L(option.detailZh, option.detailEn)}
                  </span>
                  <span className="gift-packaging-check" aria-hidden="true">
                    {gift.packagingId === option.id ? "✓" : ""}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="gift-context-fields">
            <label>
              {L("送给谁（选填）", "Recipient (optional)")}
              <input
                type="text"
                maxLength={40}
                value={recipientDraft}
                placeholder={L("例如：朋友", "e.g. a friend")}
                onChange={(event) => {
                  setRecipientDraft(event.target.value);
                  onChange({ ...gift, recipient: event.target.value });
                }}
              />
            </label>
            <label>
              {L("什么时刻（选填）", "Occasion (optional)")}
              <select
                value={gift.occasion}
                onChange={(event) => patch({ occasion: event.target.value })}
              >
                <option value="">{L("留待决定", "Decide later")}</option>
                {giftOccasions.map((occasion) => (
                  <option value={occasion.id} key={occasion.id}>
                    {L(occasion.zh, occasion.en)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {sizes.length > 1 && (
            <label className="gift-recipient-size">
              {L("受赠人尺码（选填）", "Recipient size (optional)")}
              <select
                value={gift.recipientSize}
                onChange={(event) =>
                  patch({ recipientSize: event.target.value })
                }
              >
                <option value="">{L("待到店确认", "Confirm at store")}</option>
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>
                {L(
                  "这是受赠人的演示规格，不沿用你的个人档案。",
                  "For the recipient. Your own profile size is not used.",
                )}
              </span>
            </label>
          )}
          <label className="gift-card-toggle">
            <input
              type="checkbox"
              checked={gift.includeCard}
              onChange={(event) => {
                if (!event.target.checked) setMessageDraft("");
                patch({ includeCard: event.target.checked });
              }}
            />
            <span>{L("附一张祝福卡", "Include a little gift card")}</span>
            <span aria-hidden="true">♡</span>
          </label>
          {gift.includeCard && (
            <label className="gift-card-message">
              {L("写下祝福（选填）", "Your message (optional)")}
              <textarea
                maxLength={160}
                rows={3}
                value={messageDraft}
                placeholder={L(
                  "愿这份小小心意，陪你度过美好的一天。",
                  "A little something to make your day.",
                )}
                onChange={(event) => {
                  setMessageDraft(event.target.value);
                  onChange({ ...gift, cardMessage: event.target.value });
                }}
              />
              <span>{messageDraft.length}/160</span>
            </label>
          )}
          <p className="gift-demo-note">
            {L(
              "包装图片为概念示意，仅保存本地演示偏好。没有真实包装服务、订单或收费；受赠人的尺码需另行确认。",
              "Concept wrapping only. Preferences stay in this local demo. No real wrapping service, order or charge. Confirm the recipient’s size separately.",
            )}
          </p>
        </div>
      )}
    </section>
  );
}

export function GiftSummary({ value, L, showMessage = true }) {
  const gift = normalizeGift(value);
  if (!gift) return null;
  return (
    <div className="gift-summary" data-gift-packaging={gift.packagingId}>
      <span className="gift-summary-symbol" aria-hidden="true">
        ✧
      </span>
      <div>
        <p>{giftSummary(gift, L)}</p>
        {showMessage && gift.includeCard && gift.cardMessage && (
          <p className="gift-summary-message">
            {L("祝福", "Message")}: {gift.cardMessage}
          </p>
        )}
        <span className="gift-summary-demo">
          {L(
            "本地礼赠偏好 · 非真实包装服务",
            "Local gift preference · concept service only",
          )}
        </span>
      </div>
    </div>
  );
}
