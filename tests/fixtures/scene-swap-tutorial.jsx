import React from "react";
import { createRoot } from "react-dom/client";
import PersonalizedScene, {
  resetSceneSwapTutorial,
} from "../../src/PersonalizedScene.jsx";
import OutfitLinks from "../../src/OutfitLinks.jsx";
import { byId, initialState } from "../../src/data.js";
import { curatedScenarios } from "../../src/personalized-scenes.js";
import "../../src/styles.css";

const root = createRoot(document.getElementById("root"));
window.sceneOpenCount = 0;
window.resetSceneSwapTutorial = resetSceneSwapTutorial;
window.renderSceneTutorialFixture = ({
  caseId = "warm-everyday",
  language = "en",
  sku = "ME-015",
  twoScenes = false,
  gift = null,
  color,
} = {}) => {
  const scenario = curatedScenarios.find((entry) => entry.id === caseId);
  const state = initialState();
  state.profile = {
    ...state.profile,
    personaId: scenario.personaId,
    homeId: scenario.homeId,
    room: scenario.room,
  };
  const L = (zh, en) => (language === "zh" ? zh : en);
  const render = (productId, offscreen = false) => {
    const item = { ...byId(productId), ...(color ? { color } : {}) };
    return (
      <div
        key={productId}
        data-fixture-location={offscreen ? "offscreen" : "visible"}
        className="product-visual"
        style={
          offscreen
            ? {
                position: "absolute",
                top: 1800,
                width: "min(540px, calc(100vw - 32px))",
              }
            : undefined
        }
      >
        <PersonalizedScene
          item={item}
          profile={state.profile}
          gift={gift}
          L={L}
          onOpen={() => window.sceneOpenCount++}
        />
        <OutfitLinks
          item={item}
          state={state}
          gift={gift}
          L={L}
          onProduct={() => window.sceneOpenCount++}
        />
        <button className="save-button" aria-label="Save piece">
          Save
        </button>
      </div>
    );
  };
  root.render(
    <main
      style={{ width: "min(540px, calc(100vw - 32px))", margin: "24px auto" }}
    >
      {twoScenes && render("ME-017", true)}
      {render(sku)}
    </main>,
  );
};
window.renderSceneTutorialFixture();
