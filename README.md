# MAISON ÉDIT

An original, bilingual luxury department-store concept, built as a complete interactive first draft. Warm porcelain, oxblood type, brass details, a deliberately editorial photographic opening, and a personalized discovery feed for wardrobe and home.

## Run

Use Node 22. The Dockerfile uses Node 22 Alpine; the current local checks use Node 22.23.3. A clean checkout needs no `.openai/hosting.json`, `.env` or API key to install, build and run in local demo mode.

```sh
npm ci --include=dev
npm run dev
# http://127.0.0.1:5173
npm run build
npm run preview
```

The development server binds loopback. Vite preview serves only the built frontend; use the production Node server below for the frontend and `/api/*` together. Dependencies are locked by `package-lock.json`; build tools are devDependencies and must be included during installation.

Production server, including the optional secure guide adapter:

```sh
npm run build
npm start
# http://localhost:8080
```

Without the optional Sites manifest, `npm run build` writes the Vite frontend to `dist/client`; `npm start` serves it with the Node API. The build script treats only a missing manifest (`ENOENT`) as the native Node/Cloud Run path. An explicitly present, invalid Sites manifest still produces an error. Docker does not copy `.openai/hosting.json`, and `.dockerignore` excludes the entire private configuration directory. Do not upload a private manifest to make a clean build pass. `npm run test:build` verifies the actual built artifact in a staged Node runtime.

## Implemented end to end

- Responsive Chinese/English experience with an actual interface language dictionary, keyboard support, visible focus, escape-to-close and trapped modal focus.
- Required personalization on each page load, with two supported fictional person/home combinations, inline prepared-scene references and one-click entry after bounded asset loading. Previous choices are prefilled; cart and edited history are preserved.
- A ready-to-use fictional default household, with ten varied adult persona/body templates, three homes, living/kitchen/bedroom references and three illustrative floorplans. Persona, home and room selections immediately change actual catalog ranking and default sizes.
- Personal style, normal size, budget reference, room and palette controls, without requiring any private photographs.
- Zero-upload test flow. No photo-upload control is exposed. The selected ordinary adult is visible in the introduction and preferences; test people and homes are clearly labeled fictional, pre-generated references. Existing consented browser-only photographs from older versions are preserved invisibly and are never sent; users can explicitly remove them in Preferences & data.
- Ranked, structured fictional catalog of 28 SKUs. Editorial looks and home edits are assembled from real catalog records, with coherent per-piece prices and look totals.
- Search, department and per-item budget filters. Progressive, observer-driven feed pagination with an honest seasonal end, plus manual continuation.
- A clearly labeled contextual demonstration guide with prewritten bilingual dialogue and grounded catalogue facts. Budget, department, style, reset and cheaper-alternative actions change the actual feed. Recommended-piece actions add to the visit bag.
- Saved pieces, whole-edit saves, preference feedback, sizes, colours, quantities, indicative totals, and a persistent visit bag.
- Local visit booking with future date/time validation, confirmed item variants, explicit field-sharing choices and a confirmation reference.
- Visit itinerary, pending/ready/alternative preparation states, customer acceptance of merchant-proposed alternatives, cancellation, floor/counter diagram and a textual step-free route alternative.
- Merchant sandbox with searchable catalog, editable local stock, booking preparation states and alternative proposals. Consumer changes reflect the same local state.
- Profile and recommendation resets, photo removal, explicit confirmation before clearing all browser demo data.
- Three real, officially downloaded Suno recordings for private personal, non-commercial testing, with attribution. Default-on playback, track selection, pause/resume, volume, quick mute and honest media-error retry. Browsers that block autoplay wait for the first interaction; pause/mute choices apply during the current visit; a full reload enables music, unmutes it and starts the selected track from the beginning. Tracks advance automatically. No synthesized fallback.
- Toasts, empty states, reading/loading/error states and reduced-motion handling.
- Secure optional server-only Gemini guide adapter and a temporary, bounded OpenAI GPT CLI test adapter. The deployed guide uses Gemini for deliberately sent questions under the sharing notice at the composer; browsing introductions stay local. Quota/connection failures show a clear unavailable notice instead of substituting prewritten text as a live answer. Product facts remain grounded in the fictional catalog. The CLI adapter is an optional local test path and is not the deployed provider. See `docs/GOOGLE_DEPLOYMENT.md` and `docs/CODEX_CLI_TEST.md`.

## Honest demonstration boundaries

MAISON ÉDIT and its catalog brands are fictional. Prices, stock, floors, counters, product details and visits are synthetic demonstration data. There is no real retailer integration, payment, purchase, reservation, inventory lock or communication with a store.

The included editorial photographs are original pre-generated AI inspiration. They are **not** photographs of distinct real SKUs, photographs of the user, or live generated try-on/room results. Four separately mapped prepared scenes use exact fictional catalog reference images and selected synthetic persona/home references; their SKU mappings do not establish real-product accuracy, fit, manufacturing details or room scale. Original SKU illustrations are clearly labeled concept images. Photoreal concept packshots, where included, likewise represent fictional goods. Concepts can be reused across demo pieces and do not establish unique SKU photography, exact colours or manufacturing details.

No test user uploads are accepted. Default body heights and sizes are illustrative templates, not image-derived measurements. Room photos and floorplans are fictional references. Four separate pre-generated product scenes illustrate two curated combinations: everyday-woman-45 / warm-family living room (ME-015 dress, ME-017 chair), and relaxed-man-50 / compact-city living room (ME-014 knit, ME-021 table). Other combinations retain original product concepts. No scene is generated during browsing. No body measurements, 3D body model, fit guarantee, room measurement, live room restyling or live try-on is performed. Real size and furniture decisions require measurement and verified product specifications.

All profile selections, saved, bag, booking and merchant demo state is local to the current browser under one versioned localStorage key. Default fixture images are static assets, not base64 photographs stored in the profile. It does not sync across devices or users. Clearing site data removes it. A production experience needs authenticated customer and merchant accounts, a database, explicit privacy handling, real scheduling/inventory APIs and authorized integration testing.

The full frontend and Node API are deployed on Google Cloud Run as a public judging service and a separate private preview, with real Gemini text guidance verified in a browser. Browsing uses instant prewritten introductions; sending a typed message or a question shortcut automatically requests Gemini after the visible sharing notice. The server receives the key only through Secret Manager. No key is required for a clean local build, and a no-key local server truthfully reports demo availability. Live image generation remains disabled. The optional GPT CLI test adapter is not used by this Cloud Run service; its historical local test limitations are documented separately.

## Test

```sh
npm test
npm run test:backend
npm run test:build
# Focused real-browser regression, using a local browser executable:
# E2E_CHROMIUM_PATH=<path-to-chromium> node tests/live-guide-e2e.mjs
```

Core and backend tests make no live Google or OpenAI calls and need no credentials. Provider-contract fixtures are synthetic test responses, not evidence of a real provider connection. Browser tests use Playwright and a locally installed headless shell; an ordinary local Chromium executable can be configured where supported. Focused suites cover local-first browsing, deliberate AI chat, quota/cancellation behavior, independent history collapse/minimize and non-overlapping product-guide layouts. The latest recorded application run passed 252/252 and the backend subset passed 56/56. Locale, desktop/mobile guide and staged-runtime checks passed. The legacy general `npm run test:e2e` last passed only 4/24, including failures from obsolete controls and superseded playback expectations; it is not currently a passing release gate, and all remaining failures have not been resolved. Screenshots are generated under `artifacts/` (not published as product assets).

## Deployment

Verified on October 18, 2026 (Asia/Shanghai):

| Item | Current state |
| --- | --- |
| Source repository | Private `MesosphereTech/maison-edit` |
| Google project / region | `gen-lang-client-0176200551` / `asia-east1` |
| Public judging service / revision | `maison-edit-review` / `maison-edit-review-00001-6n8` |
| Private preview service / revision | `maison-edit-private` / `maison-edit-private-00007-sns` |
| Public judging URL | https://maison-edit-review-904021583303.asia-east1.run.app |
| Private preview URL | https://maison-edit-private-904021583303.asia-east1.run.app |
| Access | Judging URL: public, no login, HTTP 200. Original preview: private IAM, unauthenticated HTTP 403 |
| Application | Vite frontend and Node 22 API served together |
| Gemini | Real typed browser question verified: HTTP 200, `mode: "gemini"`, `externalCall: true`, model `gemini-3.5-flash-lite` |
| Secrets | Runtime `GEMINI_API_KEY` from Secret Manager; `GEMINI_MODEL` is a server setting; no key in source/frontend/build |
| Resources | Request-based CPU, 1 CPU / 512 MiB, minimum zero / maximum one instance |
| Cost control | USD 5 monthly alert budget; alerts are not a hard spending cap, and free-tier/billed usage has not been independently verified |
| Image generation / Firebase | Live image generation disabled; no Firebase deployment performed |

The authenticated preview on the deployment owner's machine is `http://127.0.0.1:8081/`, provided by Google's official Cloud Run proxy. It is not a public website or a portable link for other machines. An authorized user can start their own proxy:

```sh
gcloud run services proxy maison-edit-private --project=gen-lang-client-0176200551 --region=asia-east1 --port=8081
```

A separate, clean source snapshot passed a fresh locked dependency installation, `npm run build`, all 247 tests and `npm run test:build` without a hosting manifest or credentials. Two interrupted package downloads were retrieved again from the official npm registry and verified against `package-lock.json` integrity. The current local full Docker retry stopped during `npm ci` with `ECONNRESET`; it has not been recorded as a successful fresh Docker rebuild.

The complete Dockerfile previously built successfully in Cloud Build. The current revision was built from the verified complete image plus current frontend/source and Gemini-adapter updates; see `docs/GOOGLE_DEPLOYMENT.md` for build IDs and verification history. The repository Dockerfile is the reproducible full-source path. Static-only hosting does not provide the Node AI backend. Neither source synchronization nor static preview constitutes a new cloud deployment or a public release.

Keep the repository and existing private Cloud Run preview private. The owner approved the separate public judging release and confirmed that music arrangements are handled; original recordings and provenance are retained. Products, inventory and visits remain demonstration data, and deployment does not itself complete a competition submission. No key should be read, exported or committed during source synchronization.

## Public judging release — October 18, 2026

Open **https://maison-edit-review-904021583303.asia-east1.run.app** directly; judges need no Google login or experience code. A fresh, unauthenticated browser loaded the product experience and submitted one real Gemini question. The response returned HTTP 200, `mode: "gemini"`, `externalCall: true`, `model: "gemini-3.5-flash-lite"`, and was displayed verbatim in the transcript. Browsing made no provider requests. History collapse and whole-window minimize also passed in the public browser.

Service `maison-edit-review` is revision `maison-edit-review-00001-6n8`, built by Cloud Build `12d9f390-058e-4213-8ee3-a878bdf12d10`. Only this service has `allUsers:roles/run.invoker`. The original service remains private at revision `maison-edit-private-00007-sns`; its unauthenticated request returned 403. The GitHub repository remains private.

`PUBLIC_REVIEW_MODE=true` enables service-side safeguards: 12 AI requests per minute, 200 per review day (Asia/Shanghai) and two simultaneous AI requests. Rejected requests return 429 before another provider request; browsing stays available and makes no Gemini call. Daily/concurrency feedback is bilingual. These counters are shared within one server process and reset on process restart; they are not durable quotas, authentication or a financial spending cap. Both services use request-based 1 CPU / 512 MiB, zero minimum and one maximum instance each; the existing USD 5 project budget remains an alert, not a hard cap. No billing-tier upgrade or new key was created. Only the existing Secret Manager version reference is injected into the review service; the agent did not read its value.

## Files

- `src/App.jsx`: components and all consumer/merchant interactions
- `src/data.js`: structured demo catalog, edit definitions, preset-aware ranking and deterministic helpers
- `src/presets.js`: shared trusted mappings for ten adults, three homes and room/floorplan assets
- `src/personalized-scenes.js`, `PersonalizedScene.jsx`, `SceneScenarios.jsx`: exact prepared-scene mapping, curated choices, truthful fallback and large-image / inset-thumbnail swapping
- `src/StoreMusic.jsx` and `src/store-music.js`: default-on real-recording transport, browser gesture fallback and saved sound preferences
- `public/personalized-scenes/`: 56 mapped primary-colour prepared scenes, legacy curated anchors and provenance manifests
- `public/music/`: the three officially downloaded private-test Suno MP3s and provenance
- `src/StoreOnboarding.jsx` and `src/store-onboarding.css`: required demo setup, native modal containment, draft defaults and responsive editorial layout
- `src/styles.css`: responsive editorial design and accessible states
- `public/images/`: optimized original editorial assets and product concepts
- `public/test-fixtures/`: 19 original synthetic adult/room photographs, three original illustrative floorplans and provenance manifest
- `scripts/make-concept-assets.py`: reproducible original fallback SVG illustration generator
- `server/`: secure optional Google adapter and production static server
- `tests/`: deterministic core/backend and browser behavior tests
- `docs/GOOGLE_DEPLOYMENT.md`: secure Google/Firebase packaging and deployment plan

All visual assets are original. No Harrods, Galeries Lafayette or other brand photography is included in this app.

## Subtitle concierge

The private guide accompanies browsing through one compact, transparent,
persistent live bubble. New local product hints replace its copy without moving
the bubble surface; elapsed time does not expire it. Full conversation history
remains available. A shopper can explicitly fold the conversation to its single
return control, and scrolling never reopens it. Hover, focus and typed drafts
remain readable. Product inspection reserves a separate, fully readable guide rail on the right
on desktop/tablet and below the product sheet on phones, with its reply composer.
The visit page reserves inline space for its compact
companion and input so the itinerary is never obscured. Reduced motion disables
the decorative entrance and pixel effects.

Catalog attention is estimated locally from click or keyboard focus, 32 ms pointer
intent, then image visibility and viewport position. There is no camera, actual
eye tracking, microphone or inferred gaze. Every newly visible product image
receives an immediate light border cue at 14% visibility. One current visible
piece owns the persistent guide bubble. Its prewritten local copy is readable
immediately, without a dwell timer or animation gate. A 560 ms contour lap and
420 ms pixel handoff decorate that already-readable copy; the bubble surface
stays stable. Reduced motion uses a static border and immediate text.

Attention is measured from the product image rather than the whole card, so a
passed image cannot remain current just because its metadata is visible. Stale
hover timers, superseded event tokens and offscreen passive copy are discarded.
Distinct targets have no old 45-second attention gate or five-message cap.
Product opens immediately refresh the current SKU introduction. Saved pieces,
selected variants and visit-bag actions retain their local contextual behavior. A deliberate reply leaves a short
1.2-second quiet gap. Explicit close/minimize remains closed through scrolling,
new attention and delayed replies; only the shopper can reopen it. There is no pause-AI control. History expansion
returns to one bubble without minimizing the window; the separate minus control
moves the window to its edge launcher and cancels pending replies.

The reply composer and full conversation share one in-memory transcript, current
piece, selected variant and the disclosed deliberate-send transition to Gemini. The compact surface shows the current reply; the full conversation retains
earlier replies for the current page session.
New page/product navigation cancels outstanding replies and clears obsolete visual
bubbles. Browsing events never trigger an external provider call. A deliberate typed/quick reply under the visible sharing notice may send
the conversation, catalog product IDs and selected variant along with the existing
bounded preference/default context. No private photos or microphone are used.

New guide bubbles briefly trace their visible source with a restrained brass
border. Keyboard focus or hover on a bubble keeps that source outlined; focusing
its catalog control links back to the bubble. Dismissal, expiry and navigation
remove the outline. Reduced-motion users receive a static outline without pulsing.
The link prefers the exact product in view and uses an associated editorial look
only when that is the available source.

Matching-piece and colour replies use real fictional catalog records. Visit
buttons open the existing local visit-bag or booking flow, with its unchanged
acknowledgement and field-sharing choices. They do not confirm an appointment.
The voice switch explicitly describes voice as a later, unavailable mode; it does
not fake speech, request a microphone, or establish a provider connection.

Additional browser coverage: `npm run test:concierge` (the same bundled
`@sparticuz/chromium` workflow as the main end-to-end suite).


## Fictional purchase history and attention

The editor offers three selectable fictional wardrobes/collections plus any valid
fictional catalog SKU, up to 12 items. Each entry has only a catalog ID, exact
color and size. Edits are saved with the profile; closing an unsaved draft discards
it. Items can be removed and the history can be cleared/reset. No purchase
account, receipts, photos, dates or amounts paid are imported. Saved pieces and
visit-bag items never establish ownership. New and pre-history demo profiles start with a few explicitly fictional catalog
variants suited to the persona. Existing saved histories, including explicit empty
histories, are preserved. A seeded-origin marker is checked against the actual
unchanged seed before persona changes may update those examples. Editing or
clearing history permanently ends automatic seeding for that profile.

Local history guidance references an explicitly selected fictional owned item,
uses complementary catalog kinds plus shared style tags or curated edits, and
shows optional actionable complements. A SKU already in the selected history
produces a duplicate warning without a new-product upsell. Only ME-001 and
ME-003 currently share a declared fictional catalog collection, Walnut wool
tailoring. Shared brand, color or editorial edit alone never verifies a series.
Other pairings use complementary styling language; internal verification notes are not shown to customers. All fit, stock and real
purchase claims remain outside this demonstration.

History remains local by default. A separate unchecked Gemini consent can share
at most the first eight selected fictional entries, with only catalog ID, color
and size, during a deliberate guide question. The main composer explains what is shared before sending. Deliberate Gemini calls may include a single bounded catalog attention
event; no coordinates, dwell history, timestamps or gaze data are sent. Browsing
hints never invoke an external provider. A configured endpoint and synthetic
provider test are not evidence of verified real inference.

Additional cloud browser evidence: node tests/attention-history-e2e.mjs. This
checks rapid attention changes, old-source cancellation, history editing and
reset/persistence, duplicate and declared-series copy, consent separation,
responsive layouts, and actual frame-to-bubble animation geometry.

## Required personalization and shop

Every fresh page load starts with a clear two-set selection, prefilled from the
previous visit. Only the two prepared fictional person/home/living-room cases
are selectable. There is no upload or skip route. Two inline prepared-scene
references explain what will appear in the store. A single entry button loads
only the two critical scene assets, shows truthful status on the same screen for
at least 450 ms, then enters automatically. There is no second ready/preview page
or simulated multi-stage image-generation sequence. Back and Escape cancel a
pending load; failed assets expose retry and a clearly labeled concept fallback.
Existing per-case cart/history snapshots and edited preferences are preserved.

The setup contains keyboard focus, suspends proactive guide presentation and
keeps the synchronized mute control available. Focused coverage is in
`tests/onboarding-e2e.mjs`, including reload gating, cancellation, failed-asset
retry, supported choices, persistence and responsive Chinese/English layouts.

## Prepared scene browsing and gentle exits

The two supported person/home/living-room combinations are promoted in the
introduction and Preferences. All 28 catalog SKUs have an exact primary-colour
scene for each combination, for 56 prepared files. The original five curated
anchor products per combination stay near the start of eligible feeds. The prepared scene is the large image with the original product image in a
top-right inset. Clicking the inset exchanges the images; keyboard access is
supported. Complete adults and room compositions remain visible. Reduced-motion
users get a still switch. Unsupported combinations,
products, colours and failed image loads keep the original concept with an honest
caption. No placeholder video or live generation claim is presented.

Guide hints name both the viewed product and a specific fictional owned piece.
Expanded history explains the complementary types, shared style, exact saved
colour/size and palette. A shared colour is explicitly distinguished from a
catalog-declared series; only the existing ME-001 / ME-003 collection qualifies.
The separate, unchecked external history consent remains unchanged. Merely
browsing or showing prepared scenes makes no guide or analysis provider call.

Explicit bubble dismissal/minimization retains its outgoing surface through a
360 ms opacity/transform exit, then shows a deliberate reopen control. Retiring
copy is inert; history remains intact. Reduced motion removes the exit promptly.
New visible attention replaces copy on the same live surface. An offscreen passive
source is removed rather than queued, and interrupted pixel routes are canceled.
The click-to-expand transcript remains available without a decorative text gate.

Focused evidence: `npm run test:scenes`, `npm run test:music`,
`node tests/onboarding-e2e.mjs`, `node tests/attention-history-e2e.mjs` and
`node tests/bubble-history-e2e.mjs`. The scene suite covers the original ten scene
files, thumbnail swaps, exact owned-piece guidance, cleared-history persistence,
unsupported/failed-asset fallback, 320–1440 px layouts and actual intermediate
bubble-exit opacity/geometry. `node tests/full-catalog-scenes-e2e.mjs` separately
decodes all 56 actual scenes, verifies each inset click and keyboard target, and
checks bounded desktop/mobile viewport loading. See `README-full-catalog-scenes.md`
for exact coverage and provenance.

## Contextual dialogue simulation

The local guide uses prewritten, AI-authored bilingual product dialogue with
deterministic turn and attention state. It remains labeled as a local contextual
demo. It does not claim a live language-model call. Deliberate questions can use
the configured Gemini route automatically when the shopper deliberately sends
a message under the visible sharing notice; passive
product attention never invokes it. Passive hints are omitted from the bounded
provider conversation history so they do not crowd out the shopper’s own turns.

Session likes, exclusions, budget and occasion can shape follow-up answers,
comparisons and optional complements. Current attention takes precedence over
a closed product sheet. Fictional ownership is always read from the current
validated history, including edits and explicit clearing; saved and bag items
never imply ownership. Existing exact variant, collection, catalogue pricing,
stock and transaction safety boundaries stay in effect.

`node tests/live-guide-e2e.mjs` covers the current local-first browsing and
automatic deliberate-chat transition with synthetic provider responses. Older
local-conversation browser scripts may still assume the superseded provider toggle.


## Immediate feedback and live scene lessons (v16)

The first usable visible scene teaches the real top-right thumbnail swap, with a
small illustrated hand, bilingual instruction and keyboard guidance attached to
the actual product. It never auto-swaps or steals focus. Deliberate close/swap is
remembered per case for the tab; scrolling away, changing SKU or revisiting a
case does not reopen a closed lesson. The optional three-step store-list tour
starts only when requested. Motion-sensitive users receive a still cue.

Your visit now has a populated read-only editorial itinerary even with an empty
list: two labeled curated examples, wardrobe/home/gift stops, exact catalog
pieces, indicative totals and an interactive fictional floor route. Example
pieces never enter the real local list or create a booking automatically. A
selected list or valid local booking takes precedence over examples; existing
saved booking preparation, alternatives and cancellation remain accessible.

Focused evidence: `node tests/immediate-feedback-e2e.mjs`,
`node tests/scene-swap-tutorial-e2e.mjs`, `node tests/onboarding-e2e.mjs`,
`node tests/revision-personalization-e2e.mjs` and the visit-journey suites.
No browsing attention, lesson or itinerary interaction invokes an AI provider.
