import React from "react";
import { createRoot } from "react-dom/client";
import PersonalizedScene from "../../src/PersonalizedScene.jsx";
import { byId, defaultProfile } from "../../src/data.js";
import "../../src/styles.css";

const root = createRoot(document.getElementById("root"));
window.sceneOpenCount = 0;
window.renderSceneFixture = ({
  sku = "ME-015",
  profile = defaultProfile,
  color,
} = {}) => {
  const item = { ...byId(sku), ...(color ? { color } : {}) };
  root.render(
    <main
      style={{ width: "min(540px, calc(100vw - 32px))", margin: "24px auto" }}
    >
      <div className="product-visual">
        <PersonalizedScene
          item={item}
          profile={profile}
          L={(_zh, en) => en}
          onOpen={() => window.sceneOpenCount++}
        />
        <button className="save-button" aria-label="Save piece">
          ♡
        </button>
      </div>
    </main>,
  );
};
window.renderSceneFixture();
