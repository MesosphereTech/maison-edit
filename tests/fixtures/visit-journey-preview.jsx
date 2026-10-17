import React from "react";
import { createRoot } from "react-dom/client";
import "../../src/styles.css";
import VisitJourneyShowcase from "../../src/VisitJourneyShowcase.jsx";
import { initialState, byId } from "../../src/data.js";
import { tryListVariant } from "../../src/try-list.js";
const params = new URLSearchParams(location.search);
const state = initialState();
state.language = params.get("language") || "zh";
if (params.get("persona") === "man")
  Object.assign(state.profile, {
    personaId: "relaxed-man-50",
    homeId: "compact-city",
    size: "L",
    room: "living",
  });
if (params.get("selected")) {
  const item = byId(params.get("selected"));
  state.cart = [
    {
      lineId: "qa-selected",
      skuId: item.id,
      ...tryListVariant(item, state.profile),
      quantity: 1,
      color: item.color,
      preparation: { status: "pending" },
    },
  ];
}
window.__visitTestState = state;
const L = (zh, en) => (state.language === "en" ? en : zh);
const action = (name) => () => {
  window.__visitAction = name;
};
createRoot(document.getElementById("root")).render(
  <main>
    <section className="page-section visit-page">
      <VisitJourneyShowcase
        state={state}
        L={L}
        onBook={action("book")}
        onBag={action("bag")}
        onExplore={action("explore")}
        onProduct={(id) => {
          window.__visitAction = `product:${id}`;
        }}
      />
    </section>
  </main>,
);
