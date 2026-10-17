import React from "react";
import { byId } from "./data.js";
import { GiftSummary } from "./GiftPackaging.jsx";
import { tryListPreparationLabel, tryListSizeLabel } from "./try-list.js";

export default function TryListPreparation({
  state,
  update,
  L,
  onStatus,
  merchant = true,
}) {
  if (!state.cart.length) return null;
  const acknowledge = (line, status) => {
    if (
      status === "ready" &&
      (!["matched", "not-required"].includes(line.fit?.status) ||
        (line.gift?.isGift &&
          !line.gift.recipientSize &&
          line.fit?.kind !== "experience"))
    )
      return;
    const preparation = {
      ...line.preparation,
      status,
      acknowledgedAt: new Date().toISOString(),
    };
    update((current) => ({
      ...current,
      cart: current.cart.map((entry) =>
        entry.lineId === line.lineId ? { ...entry, preparation } : entry,
      ),
    }));
    onStatus?.({
      type: "preparation",
      productId: line.skuId,
      variant: { size: line.size, color: line.color },
      fit: line.fit,
      gift: line.gift,
      preparation,
      value: `${line.lineId}:${status}`,
    });
  };
  return (
    <section
      className="live-try-list"
      data-live-try-list={merchant ? "merchant" : "consumer"}
    >
      <div className="live-try-list-heading">
        <div>
          <p className="eyebrow">
            {L("本地演示 · 清单联动", "LOCAL DEMO · LIVE STORE LIST")}
          </p>
          <h2>
            {L(
              merchant ? "已收到顾客到店清单" : "演示门店备货进度",
              merchant
                ? "Received customer store list"
                : "Demo store preparation",
            )}
          </h2>
          <p>
            {L(
              "加入清单即出现在这里，无需先预约。所有状态只在当前浏览器演示，不会联系真实门店或锁定库存。",
              "New list entries appear before a booking is made. All statuses are local to this browser, with no real store contact or stock reservation.",
            )}
          </p>
        </div>
        <span>
          {state.cart.length} {L("款", "pieces")}
        </span>
      </div>
      {state.cart.map((line) => {
        const item = byId(line.skuId);
        const canPrepare =
          ["matched", "not-required"].includes(line.fit?.status) &&
          !(
            line.gift?.isGift &&
            !line.gift.recipientSize &&
            line.fit?.kind !== "experience"
          );
        return (
          <article
            className="live-try-list-line"
            key={line.lineId}
            data-try-line={line.lineId}
            data-try-sku={line.skuId}
          >
            <img src={item.image} alt="" loading="lazy" />
            <div>
              <strong>{L(item.name, item.en)}</strong>
              <p>
                {item.id} · {tryListSizeLabel(line, L)} · {line.color} ×{" "}
                {line.quantity}
              </p>
              {line.fit?.kind === "shoe" && (
                <small>
                  {L(
                    "鞋码仅为虚构模板咨询参考；目录未声明真实鞋码库存。",
                    "Shoe size is a fictional consultation reference; no catalog shoe-size stock is asserted.",
                  )}
                </small>
              )}
              <GiftSummary value={line.gift} L={L} />
              <p className="try-list-preparation" role="status">
                {tryListPreparationLabel(line, L)}
              </p>
            </div>
            {merchant && (
              <label>
                {L("演示备货状态", "Demo preparation status")}
                <select
                  aria-label={L(
                    `${item.name}清单备货状态`,
                    `${item.en} store-list preparation status`,
                  )}
                  value={line.preparation?.status || "pending"}
                  onChange={(event) => acknowledge(line, event.target.value)}
                >
                  <option value="pending">
                    {L("待门店确认", "Awaiting store confirmation")}
                  </option>
                  <option value="ready" disabled={!canPrepare}>
                    {L("演示门店已备好", "Demo store ready")}
                  </option>
                  <option value="unavailable">
                    {L("暂不可备货", "Unavailable")}
                  </option>
                </select>
                {!canPrepare && (
                  <small>
                    {L(
                      "尺码待确认，仅可咨询，不能宣称已预留。",
                      "Size pending: consultation only, no reserved claim.",
                    )}
                  </small>
                )}
              </label>
            )}
          </article>
        );
      })}
    </section>
  );
}
