import React, { useId, useState } from "react";
import { catalog, byId } from "./data.js";
import {
  purchaseHistoryPresets,
  sanitizePurchaseHistory,
} from "./purchase-history.js";

export default function PurchaseHistory({
  L = (zh) => zh,
  history,
  onChange,
  onProduct,
}) {
  const id = useId();
  const [selectedId, setSelectedId] = useState("");
  const items = sanitizePurchaseHistory(history);
  const ownedIds = new Set(items.map((entry) => entry.skuId));
  const available = catalog.filter((item) => !ownedIds.has(item.id));
  const addId = available.some((item) => item.id === selectedId)
    ? selectedId
    : available[0]?.id || "";
  const change = (next) => onChange?.(sanitizePurchaseHistory(next));
  const name = (item) => L(item.name, item.en);
  const updateVariant = (skuId, field, value) =>
    change(
      items.map((entry) =>
        entry.skuId === skuId ? { ...entry, [field]: value } : entry,
      ),
    );
  const addItem = () => {
    const item = byId(addId);
    if (!item || items.length >= 12 || ownedIds.has(item.id)) return;
    change([
      ...items,
      {
        skuId: item.id,
        color: item.color,
        size: item.sizes.includes("M") ? "M" : item.sizes[0],
      },
    ]);
  };

  return (
    <section className="purchase-history" aria-labelledby={`${id}-heading`}>
      <div className="purchase-history-heading">
        <div>
          <span className="eyebrow">
            {L("仅限本地虚构演示", "FICTIONAL LOCAL DEMO")}
          </span>
          <h3 id={`${id}-heading`}>
            {L("虚构购买记录", "Fictional purchase history")}
          </h3>
        </div>
        <span className="purchase-history-count" aria-live="polite">
          {items.length} / 12
        </span>
      </div>
      <p className="purchase-history-note">
        {L(
          "已为新演示准备了几件假设拥有的单品，可随时修改或清空。导购会据此演示搭配、配色和同款提醒；清空后不会自动恢复。记录只在此浏览器。",
          "New demos start with a few fictional owned pieces. Edit or clear them at any time for pairing, palette and duplicate reminders; cleared history stays empty. These examples stay in this browser.",
        )}
      </p>
      <div
        className="purchase-history-presets"
        aria-label={L("选择虚构记录示例", "Choose a fictional history preset")}
      >
        {purchaseHistoryPresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="purchase-history-preset"
            aria-pressed={
              JSON.stringify(items) === JSON.stringify(preset.items)
            }
            onClick={() => change(preset.items)}
          >
            {L(preset.zh, preset.en)}
          </button>
        ))}
      </div>
      <div className="purchase-history-add">
        <label htmlFor={`${id}-catalog`}>
          {L("添加假设已拥有的单品", "Add a fictional owned item")}
        </label>
        <div className="purchase-history-add-controls">
          <select
            id={`${id}-catalog`}
            value={addId}
            onChange={(event) => setSelectedId(event.target.value)}
            disabled={!available.length || items.length >= 12}
          >
            {[
              ["women", L("女装", "Women")],
              ["men", L("男装", "Men")],
              ["accessories", L("配饰", "Accessories")],
              ["home", L("家居", "Home")],
            ].map(([category, label]) => (
              <optgroup key={category} label={label}>
                {available
                  .filter((item) => item.category === category)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {name(item)} · {item.id}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={addItem}
            disabled={!addId || items.length >= 12}
          >
            {L("添加", "Add")}
          </button>
        </div>
      </div>
      {items.length ? (
        <ul className="purchase-history-list">
          {items.map((entry) => {
            const item = byId(entry.skuId);
            return (
              <li key={item.id} className="purchase-history-item">
                <img
                  className="purchase-history-thumbnail"
                  src={item.image}
                  alt=""
                  loading="lazy"
                />
                <div className="purchase-history-item-main">
                  {onProduct ? (
                    <button
                      type="button"
                      className="purchase-history-name"
                      onClick={() => onProduct(item.id)}
                      aria-label={L(
                        `查看目录单品：${item.name}`,
                        `View catalog item: ${item.en}`,
                      )}
                    >
                      {name(item)}
                    </button>
                  ) : (
                    <strong className="purchase-history-name">
                      {name(item)}
                    </strong>
                  )}
                  <span className="purchase-history-sku">
                    {item.id} · {L("假设已拥有", "Fictional owned item")}
                  </span>
                  <div className="purchase-history-variants">
                    <div className="purchase-history-variant">
                      <label htmlFor={`${id}-${item.id}-color`}>
                        {L("颜色", "Colour")}
                      </label>
                      <select
                        id={`${id}-${item.id}-color`}
                        value={entry.color}
                        onChange={(event) =>
                          updateVariant(item.id, "color", event.target.value)
                        }
                      >
                        {item.colors.map((color) => (
                          <option key={color} value={color}>
                            {color}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="purchase-history-variant">
                      <label htmlFor={`${id}-${item.id}-size`}>
                        {L("尺码", "Size")}
                      </label>
                      <select
                        id={`${id}-${item.id}-size`}
                        value={entry.size}
                        onChange={(event) =>
                          updateVariant(item.id, "size", event.target.value)
                        }
                      >
                        {item.sizes.map((size) => (
                          <option key={size} value={size}>
                            {size}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="purchase-history-remove"
                  aria-label={L(
                    `从虚构记录移除${item.name}`,
                    `Remove ${item.en} from fictional history`,
                  )}
                  onClick={() =>
                    change(items.filter((value) => value.skuId !== item.id))
                  }
                >
                  {L("移除", "Remove")}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="purchase-history-empty">
          {L(
            "暂无虚构记录。选择一个示例或添加单品。",
            "No fictional history yet. Choose a preset or add an item.",
          )}
        </p>
      )}
      <div className="purchase-history-actions">
        <button
          type="button"
          disabled={!items.length}
          onClick={() => change([])}
        >
          {L("清空 / 重置虚构记录", "Clear / reset fictional history")}
        </button>
        <small>
          {L("无真实账户或凭证接入", "No real account or receipts connected")}
        </small>
      </div>
    </section>
  );
}
