import React from "react";
import { curatedScenarios, curatedScenarioFor } from "./personalized-scenes.js";
import { confirmedDemoProfile } from "./demo-personalization.js";

export function scenarioProfile(profile, scenario) {
  return confirmedDemoProfile(profile, scenario.id);
}
export default function SceneScenarios({ profile, L, onChange }) {
  const selected = curatedScenarioFor(profile);
  return (
    <div className="scene-scenario-picker">
      <div
        className="scene-scenarios"
        aria-label={L("预先生成的场景组合", "Prepared scene combinations")}
      >
        {curatedScenarios.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            aria-pressed={selected?.id === scenario.id}
            data-scene-scenario={scenario.id}
            onClick={() => onChange(scenarioProfile(profile, scenario))}
          >
            <strong>{L(scenario.zh, scenario.en)}</strong>
            <small>{L(scenario.noteZh, scenario.noteEn)}</small>
            <small>
              {L(
                `${scenario.products.length} 张预先生成的商品场景`,
                `${scenario.products.length} prepared product scenes`,
              )}
            </small>
          </button>
        ))}
      </div>
      <p className="scene-availability">
        {selected
          ? L(
              `这组的 ${selected.products.length} 件指定单品提供搭配效果与商品图，点击右上角小图即可互换。其他颜色或暂不可用的场景显示商品概念图。`,
              `${selected.products.length} specified pieces show a styled scene and product image. Click the top-right thumbnail to swap them. Other colours or unavailable scenes show product concepts.`,
            )
          : L(
              "请选择上方一组已开放的测试数据。",
              "Choose an available test set above.",
            )}
      </p>
    </div>
  );
}
