# Prepared guide-dialogue bank

This module is a bilingual, AI-authored **local simulation** for the fictional MAISON ÉDIT demo. It makes no model request. Display `guideDialogueProvenance.label[language]` persistently near the guide; show `disclosure[language]` on opening or when the user asks. Do not repeat the full disclaimer in every bubble, and do not label a scripted response as Gemini/live AI.

## Files and exports

`src/guide-dialogue-bank.js` is standalone. It imports existing catalog, preset, history-sanitizer and prepared-scene helpers without modifying them.

- `dialogueBank`: 28 exact SKU keys. Each has `browsing.{initial,dwell,revisit,click}`, `followUps.{pairing,consider}`, `companions[]`, `compareId`. Every utterance is `{ zh, en }`: 112 browsing lines + 56 follow-ups, 336 authored language variants.
- `createGuideDialogueReply(args)`: pure renderer plus conversational context bridge; main integration entry.
- `detectGuideIntent(message)`: deterministic local intent classification, not an LLM.
- `resolveGuideVariant(itemOrId, suppliedVariant, profile)`: catalog-valid fallback, explicit/invalid flags.
- `declaredGuideRelationship(one, two)`: `duplicate`, `same-series`, `pairing` or `unverified`. The sole collection authority is equal nonempty catalog `collectionId`.
- `curatedDialogueScenarios`: eight cross-department turns for each of the two exact curated preset combinations.
- `renderCuratedGuideTurn(scenarioId, turnId, args)`: returns null if current persona/home/room no longer matches the scenario.
- `guideSessionSummary(session, language)`: at most 500 characters of explicitly parsed conversational shopping preferences for the existing consented provider request. It never includes photos, body measurements or ownership data.
- `guideDialogueProvenance`: truthful local-mode label/disclosure.

## Input

```js
const result = createGuideDialogueReply({
  message: "和我已有的怎么搭？", // omit for proactive browsing
  event: { type: "attention", productId: "ME-001", attentionKind: "viewport" },
  productId: "ME-001",
  variant: { color: "Walnut", size: "M" },
  session: previousSession,
  language: "zh", // 'en' selects English
  profile: currentState.profile,
  filters: currentFilters,
  history: currentState.purchaseHistory, // explicit [] must stay []
  purchaseHistory: currentState.purchaseHistory, // alias; history wins if supplied
  wishlist: currentState.wishlist,
  cart: currentState.cart,
  feedback: currentState.feedback,
  inventory: currentState.inventory,
});
```

Optional inputs: `intent`, `compareProductId`, `budget`, `contextProductId`. UI intent aliases `outfit`, `room`, `complement`, `details`, `alternative(s)`, `booking`, `history` are understood. Internal intents also cover compare, budget, occasion, warmminimal, homepalette, ownedpairing, avoidduplicate, dislike, color, size, consider and series.

Recognized browsing types include attention, dwell, revisit, product_open/click/product_view. Variant changes include variant and variant_change. Existing actual save/add feedback should remain wired to successfully committed UI actions; this renderer does not save, add, book or change external state.

## Output and UI responsibility

The familiar reply fields are `role`, `text`, `visualText`, `mode: 'demo'`, `productIds`, `ownedProductIds`, `relationship` and `quickReplies`. Additional fields:

- `source: 'ai-authored-script'`, `provider: null`: provenance, not a provider response.
- `contextProductId`: the currently discussed SKU even if it is owned/unavailable/over budget.
- `suggestedProductIds`: identical to productIds; excludes owned, unavailable, disfavoured and over-budget recommendations. Context and ownership are separate fields, so a duplicate does not become an upsell tile.
- `selectedVariant`, `invalidVariant`: available on variant answers; do not display invalid supplied values as real options.
- `newItemsTotal`, `budgetScope`: explicit optional new-purchase total. The existing UI filter is a **per-item** budget. For a multi-item suggestion the renderer conservatively keeps the optional new-item sum within that same number; the text labels the optional set total separately, not as the UI filter definition. Existing pieces add zero new spending. Comparing two prices never implies buying both.
- `session`: pass forward after accepting a reply. It contains currentProductId/previousProductId, lastSuggestionIds/lastComparedProductIds/lastIntent, browsingCounts, occasion, skippedProductIds, likedProductIds, excludedKinds, excludedNewKinds, avoidedColors and turn. It does **not** cache history/profile/budget/variants. Always pass CURRENT state separately.
- `nextFilters`, `profilePatch`: proposals only for explicit text intents. The existing UI applies them and reranks visibly. Manual current filters/profile always beat session state. Clearing filters does not erase preferences or history.
- `sessionSummary`: bounded output from guideSessionSummary. If a real provider is configured, prepend this only within the existing user-consented conversation request. Preserve truthful provider status independently.
- `visitPlan`: lines from actual current bag contents only, with exact SKU/variant/quantity/floor/counter, grouped floor route, CNY total, and `status: 'demo-unconfirmed'`. An empty bag receives next steps rather than an inferred checklist from a viewed product. Derived default variants are marked `needsVariantConfirmation`; do not silently submit them as confirmed choices.

Quick IDs: outfit, room, color, compare, alternative, occasion, history, booking, view, details. They describe choices, not automatic actions. The integration owns navigation and any bag/booking mutation.

## Context, grounding and cadence

1. Use current attention or an open product modal as the product target. A closed modal's stale selected SKU should not override attention. Exact names/SKUs can establish a new target; compare questions use the current target plus an explicitly named second product.
2. Keep the existing attention event acceptance, pause, mute, cooldown and stale-request guards. A returned session alone does not authorize another hint. Incremented deterministic per-SKU browsingCounts produce initial → dwell → revisit wording across accepted attention events; actual product_open/click uses click copy. Do not create popups/timers to exhaust the bank.
3. Current explicit history is sanitized on every call. An empty or edited history removes old owned references immediately. Favorites/bag entries never prove ownership. Specific owned names, colours and sizes come only from current valid history entries.
4. Owned-pairing rules use supported complementary kinds plus editorial links. A matching scene, brand, colour or tag does not establish ownership, fit or a shared collection. ME-022 throw is not linked to an owned ME-019 lamp merely because a room scene exists.
5. Only ME-001 and ME-003 currently share the explicitly declared Walnut wool tailoring demo series. Other relationships are styling suggestions; compact history copy explicitly says same-series unverified.
6. Product facts come from current data.js, not frozen editorial text. The four browsing/two follow-up lines avoid fixed prices and selectable-colour assertions. No brand history, real inventory, in-store preparation, fit, ergonomic, cleaning or technical performance guarantees are invented.
7. Actual scene eligibility comes from personalizedSceneFor(exact current SKU/profile/colour). No corresponding scene means no generated fit/room preview claim. Prepared scenes are not live generation or real-room measurement.
8. ME-028 remains a curtain colour SAMPLE, regardless of its generic throw kind. It is not a blanket, finished curtain, installation service or substitute for another textile. It is excluded from owned-pairing and same-type budget alternatives for throws.
9. Shoe and belt ONE SIZE values are generic demo options; the guide calls out absent real shoe sizes/belt lengths. Home ONE SIZE is not a room-fit result. No age/height/persona image is used to determine fit.
10. Skip/colour/kind exclusions are conversational, caller-controlled memory. Do not claim permanent preferences were saved unless the UI actually saved them. Rendering does not transmit personal data or create a real appointment.

## Curated conversation previews

- warm-everyday: everyday-woman-45 + warm-family + living. Starts from ME-015 dress, uses only current wardrobe history, then ME-017 chair and actual current owned home complements. Ends with a size/colour/floor checklist when asked.
- quiet-city: relaxed-man-50 + compact-city + living. Starts from ME-014 rib knit and current trousers/shoes, then ME-021 side table with compact circulation and current palette. Checks the ME-019 lamp duplicate by present history, never a hard-coded claim.

Every turn re-renders against the latest state, including a cleared purchase history, changed palette, lower budget, variant change or depleted demo inventory. User-role scenario prompts are illustrative scripts, never messages the real user actually said. Do not inject these into the real transcript as user-authored statements.

## Validation

`node --check src/guide-dialogue-bank.js`

`node --test tests/guide-context.test.mjs`

The integration worker owns the contract tests and final build/browser validation. No network/provider smoke test is implied by these local checks.
