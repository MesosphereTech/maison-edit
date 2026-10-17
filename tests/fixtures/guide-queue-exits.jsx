import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import GuidedDemo, {
  restartGuidedCase,
  resetAllGuidedCases,
} from "../../src/GuidedDemo.jsx";
import EndlessEditorialFeed from "../../src/EndlessEditorialFeed.jsx";
import PersonalizedScene, {
  sceneSwapTutorialStatus,
} from "../../src/PersonalizedScene.jsx";
import { initialState, catalog, byId } from "../../src/data.js";
import {
  curatedScenarioFor,
  curatedScenarios,
} from "../../src/personalized-scenes.js";
import {
  journeyKey,
  JOURNEY_REQUEST_EVENT,
  JOURNEY_RELEASE_EVENT,
} from "../../src/guided-journey.js";
import "../../src/styles.css";
import "../../src/revision-personalization.css";
const root = createRoot(document.getElementById("root"));
const L = (_zh, en) => en;
let generation = 0;
window.fixtureRequests = [];
window.fixtureReleases = 0;
window.fixtureVisits = 0;
window.addEventListener(JOURNEY_REQUEST_EVENT, (event) =>
  window.fixtureRequests.push({ ...event.detail }),
);
window.addEventListener(JOURNEY_RELEASE_EVENT, () => window.fixtureReleases++);
const stateFor = (name = "warm-everyday") => {
  const state = initialState();
  if (name === "generic-a") state.profile.room = "fixture-study";
  if (name === "generic-b") state.profile.room = "fixture-dining";
  const scenario = curatedScenarios.find((entry) => entry.id === name);
  if (scenario)
    Object.assign(state.profile, {
      personaId: scenario.personaId,
      homeId: scenario.homeId,
      room: scenario.room,
    });
  return state;
};
const idFor = (state) =>
  curatedScenarioFor(state.profile)?.id ||
  `${state.profile.personaId}:${state.profile.homeId}:${state.profile.room}`;
window.fixtureCaseId = (name = "warm-everyday") => idFor(stateFor(name));
window.fixtureStatus = (name = "warm-everyday") => {
  const id = window.fixtureCaseId(name);
  return {
    id,
    guide: sessionStorage.getItem(`maison-edit-guided-case:${id}`),
    journey: JSON.parse(sessionStorage.getItem(journeyKey(id)) || "null"),
    swap: sceneSwapTutorialStatus(id),
  };
};
window.restartGuidedCase = restartGuidedCase;
window.resetAllGuidedCases = resetAllGuidedCases;
function Fixture({ config }) {
  const [blocker, setBlocker] = useState(config.blocker || "none");
  const state = stateFor(config.caseName);
  const caseId = idFor(state);
  window.fixtureSetBlocker = setBlocker;
  useEffect(() => {
    if (blocker === "editor")
      document.querySelector(".subtitle-composer textarea")?.focus();
  }, [blocker]);
  const sceneProduct = curatedScenarioFor(state.profile)?.products[0];
  const sceneItem = {
    ...byId(sceneProduct?.skuId || "ME-015"),
    ...(sceneProduct ? { color: sceneProduct.color } : {}),
    ...(config.original === "missing"
      ? { image: "/fixture-missing-original.webp" }
      : {}),
    ...(config.scene === "missing-mapping"
      ? { color: "fixture-unknown-colour" }
      : {}),
  };
  return (
    <>
      <style>{`html{scroll-behavior:auto}body{margin:0}.fixture-tools{position:fixed;top:0;right:0;z-index:3000;background:white;padding:8px}.fixture-feed{max-width:1000px;margin:auto;padding-top:110px}.fixture-feed .product-visual{height:270px;background:#e2d7c9}.fixture-feed .product-card{min-height:340px}.fixture-feed .feed-pause{min-height:440px;padding:120px 30px;background:#e6ded2}.fixture-scene{width:min(520px,calc(100vw - 40px));margin:130px auto 120px}.fixture-overlay{position:fixed;inset:20%;z-index:5000;background:white;box-shadow:0 0 0 100vmax #0007;padding:30px}.fixture-editor{position:fixed;top:15px;left:20px;z-index:6000}.fixture-editor textarea{width:220px;height:60px}`}</style>
      <header
        className="site-header"
        style={{
          height: 70,
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
          background: "#faf8f3",
        }}
      >
        Guide regression fixture
      </header>
      <div className="fixture-tools">
        <button data-fixture-safe onClick={() => setBlocker("none")}>
          Clear blocker
        </button>
        <button data-fixture-blur>Neutral focus</button>
      </div>
      {["editor", "draft"].includes(blocker) && (
        <div className="fixture-editor subtitle-composer">
          <textarea
            autoFocus={["editor", "draft"].includes(blocker)}
            aria-label="Unfinished concierge message"
            defaultValue={blocker === "draft" ? "An unfinished draft" : ""}
          />
        </div>
      )}
      {blocker === "overlay" && (
        <div
          className="fixture-overlay overlay"
          role="dialog"
          aria-label="Independent dialog"
        >
          <p>Independent dialog remains open.</p>
          <button onClick={() => setBlocker("none")}>
            Close independent dialog
          </button>
        </div>
      )}
      {blocker === "product" && (
        <div
          className="fixture-overlay overlay product-detail"
          role="dialog"
          aria-label="Open product"
        >
          <p>Product detail remains open.</p>
          <button autoFocus onClick={() => setBlocker("none")}>
            Close product
          </button>
        </div>
      )}
      {config.includeScene && (
        <div className="fixture-scene product-visual">
          <PersonalizedScene
            item={sceneItem}
            profile={state.profile}
            L={L}
            onOpen={() => setBlocker("product")}
          />
        </div>
      )}
      <main className="fixture-feed">
        <EndlessEditorialFeed
          feed={catalog
            .slice(0, 12)
            .map((product) => ({ type: "product", product }))}
          L={L}
          renderEntry={(entry) => (
            <article
              className="product-card"
              data-concierge-product={entry.product.id}
              data-feed-position={entry.position}
            >
              <div className="product-visual">
                <span>{entry.product.en}</span>
              </div>
              <p>{entry.product.id}</p>
            </article>
          )}
          renderPause={(entry) => (
            <section className="feed-pause" data-feed-position={entry.position}>
              <h2>A considered visit</h2>
              <button
                data-tour-action="plan-visit"
                onClick={() => window.fixtureVisits++}
              >
                Plan your visit
              </button>
            </section>
          )}
        />
      </main>
      <GuidedDemo
        key={config.guideKey || caseId}
        active
        browsing
        suspended={blocker === "suspended"}
        state={state}
        modal={blocker === "product" ? "product" : null}
        L={L}
        onProduct={() => setBlocker("product")}
        onCloseProduct={() => setBlocker("none")}
      />
    </>
  );
}
window.mountGuideFixture = (config = {}) => {
  const state = stateFor(config.caseName);
  const id = idFor(state);
  if (config.clearStorage) sessionStorage.clear();
  if (config.seedPending) {
    sessionStorage.setItem(
      journeyKey(id),
      JSON.stringify({
        seen: catalog.slice(0, 8).map((product) => product.id),
        afterPosition: 7,
        status: "pending",
      }),
    );
    sessionStorage.setItem(
      `maison-edit-scene-swap-tutorial:v2:${id}`,
      "swapped",
    );
  }
  if (config.seedBrowsing)
    sessionStorage.setItem(
      `maison-edit-scene-swap-tutorial:v2:${id}`,
      "swapped",
    );
  root.render(
    <Fixture
      key={config.preserveMount ? "preserved" : ++generation}
      config={config}
    />,
  );
};
window.mountGuideFixture();
