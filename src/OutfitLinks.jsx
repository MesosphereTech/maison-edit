import React, { useId } from "react";
import { byId } from "./data.js";
import { outfitSceneFor } from "./outfit-scenes.js";
import { giftSceneContext } from "./gift-scenes.js";
import "./compact-outfit.css";

export default function OutfitLinks({
  item,
  state,
  L,
  onProduct,
  gift = null,
}) {
  const disclosureId = useId();
  const displayProfile =
    giftSceneContext(item, state.profile, gift)?.profile || state.profile;
  const scene = outfitSceneFor(item.id, displayProfile, item.color);
  if (!scene) return null;
  return (
    <div
      className="outfit-components outfit-components--compact"
      data-outfit-id={scene.id}
      role="group"
      aria-label={L(
        `画面中的搭配：${scene.sceneZh}`,
        `In this outfit: ${scene.sceneEn}`,
      )}
      aria-describedby={disclosureId}
    >
      <div className="outfit-component-list">
        {scene.products
          .filter((entry) => entry.skuId !== item.id)
          .map((entry) => {
            const product = byId(entry.skuId);
            if (!product) return null;
            const isOwned = state.purchaseHistory.some(
              (record) =>
                record.skuId === product.id && record.color === entry.color,
            );
            const label = L(
              `查看搭配单品：${product.name} · ${entry.color}${isOwned ? " · 记录已有，可复用" : ""}`,
              `View outfit piece: ${product.en} · ${entry.color}${isOwned ? " · Owned, available to reuse" : ""}`,
            );
            return (
              <button
                key={product.id}
                type="button"
                data-outfit-product={product.id}
                data-outfit-owned={isOwned ? "true" : "false"}
                onClick={() => onProduct(product.id)}
                aria-label={label}
                title={label}
              >
                <span className="outfit-component-thumb">
                  <img src={product.image} alt="" loading="lazy" />
                  {isOwned && (
                    <span className="outfit-owned-mark" aria-hidden="true">
                      <svg viewBox="0 0 12 12" fill="none">
                        <path d="m2.5 6 2.3 2.3L9.5 3.5" />
                      </svg>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
      </div>
      <small id={disclosureId} className="outfit-disclosure">
        {L(
          "预先生成的虚构穿搭示意，非实拍或合身保证。勾选标记表示记录已有。",
          "Prepared synthetic styling concept. No product-photography or fit guarantee. A checkmark indicates an owned piece.",
        )}
      </small>
    </div>
  );
}
