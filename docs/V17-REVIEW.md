# V17 review: the visit planning desk

## Interaction and layout

The previous visit editorial hero is replaced by a single, responsive workspace:

1. A compact visit summary at the top left: time, stops, pieces, first stop, fictional size reference and gift note.
2. The planning conversation below it: retained history, keyboard-scrollable log, quick choices and one composer.
3. One full-height visual stage at the right: a freshly calculated SVG floor route, pre-generated fitting reference with item/size notes, or gift-packaging concepts.

Mobile follows the same numbered hierarchy without page overflow. The global floating guide and its input do not duplicate the integrated conversation on this page. Global manual-minimize state is preserved; the workspace has its own collapse state.

The planner is a pure, read-only projection of the current selected pieces or active demo booking, with a populated fictional case when the list is empty. It does not add products, change merchant preparation, make a reservation or contact a store. A gift added while planning is a clearly scoped planning preview. Unknown recipient sizes remain pending.

Time, shoes-first, fewer-walking, gift and wrapping requests update the summary, actual stop order/timing, map and conversation together. Outfit/recipient sizing remain separate. A per-persona browser-session plan/history survives leaving and returning to the visit; clearing all demo data clears these sessions too. Actual API consent is never saved.

## Honest AI and image behavior

The default implementation is a local, scenario-driven planning demo, clearly labelled as such. The route is dynamically drawn from the same plan state. Fitting, people, rooms and packaging images are pre-generated references; a size change never claims to redraw a person or render a live try-on.

The existing configured guide backend remains available behind a separate, explicit opt-in. It receives the current input, catalog IDs and synthetic route context, without purchase history or profile data. A live reply identifies its actual provider mode. There are no credentials in this release and no actual provider requests were needed for validation.

No real booking, stock, payment or merchant-contact integration is introduced.

## Language

Fresh, missing-locale and invalid-locale visits start in English. Existing valid English or Chinese choices are retained, including during recovery of other damaged demo data. English/Chinese switches work in onboarding as well as the store header, and persist across reloads. Historical conversation turns retain their original language; newly created copy follows the current language.

## Fictional model cases

Claire (32) and Julian (34) are the first two selectable fictional adult model cases. The previous everyday-woman and relaxed-man cases remain available. Two neutral full-body identity portraits and seven catalog-referenced outfit scenes were generated and visually reviewed; compressed production assets add approximately 1.3 MB.

Claire has thirteen mapped fashion pieces across five unique outfit scenes; Julian has seven mapped pieces across two unique outfit scenes. Other pieces use original catalog concepts with explicit fallback copy. Existing home scenes featuring older people are not reassigned to these new models. The references and S/L clothing or EU 39/43 shoe sizes are declared synthetic templates, never measurements inferred from a photograph.

## Guided discovery

See [the dedicated guide review](v17-guided-journey.md) for required, real-click swap guidance and the eight-distinct-product visit journey. Automatic travel reveals an existing burgundy/architecture call to action. Arriving at it never counts as clicking it.

## Validation

Unmapped clothing colours and home-only lists show the original catalog concept with an explicit unavailable/no-clothing note, never an unrelated person or architectural image labelled as a fitting.

The current dedicated workspace browser suite covers 1440, 390 and 320 pixel widths, responsive composition, no duplicate guide, coupled plan/packaging/size updates, unique map-stop positions, keyboard stage navigation and chat history, independent collapse, returning-plan persistence, unmodified cart/bookings, global companion state, and English/Chinese copy. Model/reference scenarios are checked separately across every current case.

The music regression suite covers fourteen real local-audio playback, permission, persistence, retry, keyboard and responsive cases. Backend tests verify provider contracts, unavailable modes, privacy bounds and same-origin Worker behavior. The build validator verifies the deployable same-origin Worker and unconfigured status with zero provider calls.

The old monolithic `tests/e2e.mjs` and pre-workspace visit screenshots assert superseded interfaces such as manual clothing size buttons, “Visit bag”, a default Chinese recovery state and a floating visit-page guide. They are historical coverage, not the acceptance suite for this revision. The current dedicated try-list, gift, locale, guided-journey and workspace tests cover their replacement contracts. Do not report that old monolith as passed.

### Current acceptance commands

- `npm test`
- `npm run build` and `npm run test:build`
- `npm run test:visit-workspace`
- `npm run test:visit-fallbacks`
- `npm run test:four-cases`
- `npm run test:locale`
- `npm run test:journey`
- `npm run test:guide-queue`
- `npm run test:music`

## Release scope

This review describes the source candidate. Publication and audience are unchanged until the existing Site owner completes a separate source synchronization and deployment. The existing Site identity is retained in `.openai/hosting.json`.
