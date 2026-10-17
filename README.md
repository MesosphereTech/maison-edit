# MAISON ÉDIT

An original, bilingual luxury department-store concept, built as a complete interactive first draft. Warm porcelain, oxblood type, brass details, a deliberately editorial photographic opening, and a personalized discovery feed for wardrobe and home.

## Run

Node 22 or newer is recommended (built and tested with Node 24).

```sh
npm ci
npm run dev
# http://127.0.0.1:5173
npm run build
npm run preview
```

The development script binds loopback because this cloud sandbox does not expose normal network interface enumeration. For an ordinary machine, `npx vite --host 0.0.0.0` can expose the development server on a trusted local network.

Production server, including the optional secure guide adapter:

```sh
npm run build
npm start
# http://localhost:8080
```

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
- Three real, officially downloaded Suno recordings for private personal, non-commercial testing, with attribution. Default-on playback, track selection, pause/resume, volume, quick mute and honest media-error retry. Browsers that block autoplay wait for the first interaction; saved pause and mute choices are respected. No synthesized fallback.
- Toasts, empty states, reading/loading/error states and reduced-motion handling.
- Secure optional server-only Gemini guide adapter and a temporary, bounded OpenAI GPT CLI test adapter. Both expose truthful availability, require explicit external-sharing consent, ground product facts in the fictional catalog and fall back to local guidance. See `docs/GOOGLE_DEPLOYMENT.md` and `docs/CODEX_CLI_TEST.md`.

## Honest demonstration boundaries

MAISON ÉDIT and its catalog brands are fictional. Prices, stock, floors, counters, product details and visits are synthetic demonstration data. There is no real retailer integration, payment, purchase, reservation, inventory lock or communication with a store.

The included editorial photographs are original pre-generated AI inspiration. They are **not** photographs of distinct real SKUs, photographs of the user, or live generated try-on/room results. Four separately mapped prepared scenes use exact fictional catalog reference images and selected synthetic persona/home references; their SKU mappings do not establish real-product accuracy, fit, manufacturing details or room scale. Original SKU illustrations are clearly labeled concept images. Photoreal concept packshots, where included, likewise represent fictional goods. Concepts can be reused across demo pieces and do not establish unique SKU photography, exact colours or manufacturing details.

No test user uploads are accepted. Default body heights and sizes are illustrative templates, not image-derived measurements. Room photos and floorplans are fictional references. Four separate pre-generated product scenes illustrate two curated combinations: everyday-woman-45 / warm-family living room (ME-015 dress, ME-017 chair), and relaxed-man-50 / compact-city living room (ME-014 knit, ME-021 table). Other combinations retain original product concepts. No scene is generated during browsing. No body measurements, 3D body model, fit guarantee, room measurement, live room restyling or live try-on is performed. Real size and furniture decisions require measurement and verified product specifications.

All profile selections, saved, bag, booking and merchant demo state is local to the current browser under one versioned localStorage key. Default fixture images are static assets, not base64 photographs stored in the profile. It does not sync across devices or users. Clearing site data removes it. A production experience needs authenticated customer and merchant accounts, a database, explicit privacy handling, real scheduling/inventory APIs and authorized integration testing.

The published experience remains a local contextual simulation unless a usable secure backend is discovered or explicitly configured. An endpoint or installed CLI alone does not establish live AI. Live Gemini requires valid owner-supplied server configuration and conversation consent. The temporary GPT CLI adapter uses only trusted fictional preset IDs and catalog data; optional image analysis selects fixed fixture images on the server, never user paths or uploads. Its current live smoke test was blocked during CLI initialization by this runtime’s read-only state, so no real GPT inference or image analysis was produced. The interface distinguishes unverified connection tests, verified replies and unavailable states. Credentials never enter the frontend. Live try-on/room-image generation remains unavailable.

## Test

```sh
npm test
npm run test:backend
npm run test:e2e
```

Core and backend tests make no live Google or OpenAI calls and need no credentials. Provider-contract fixtures are synthetic test responses, not evidence of a real provider connection. Browser tests use Playwright and a locally installed headless shell; an ordinary local Chromium executable can be configured where supported. Tests start their own loopback server and verify the complete zero-upload default-selection matrix, profile persistence and privacy migration, consumer/merchant flows, provider-consent and cancellation behavior, bilingual UI and mobile layouts. Screenshots are generated under `artifacts/` (not published as product assets).

## Deployment

- Static `dist/` works for a private presentation preview; the guide remains an honest local demo unless a secure API is separately configured.
- The multi-stage `Dockerfile` and dependency-free Node server are packaged for Google Cloud Run. Google APIs remain unconfigured and are not live-tested here.
- A Firebase Hosting alternative is described in `docs/GOOGLE_DEPLOYMENT.md`; dynamic requests should go to an authenticated, rate-limited server/Cloud Run service.
- Private preview hosting is distinct from any competition requirement to deploy on Google infrastructure.
- No Google Cloud project, service account, key, billing account or Google deployment has been created. The separate private Sites preview serves the frontend only; Google deployment commands in the documentation are instructions for the owner.

## Files

- `src/App.jsx`: components and all consumer/merchant interactions
- `src/data.js`: structured demo catalog, edit definitions, preset-aware ranking and deterministic helpers
- `src/presets.js`: shared trusted mappings for ten adults, three homes and room/floorplan assets
- `src/personalized-scenes.js`, `PersonalizedScene.jsx`, `SceneScenarios.jsx`: exact prepared-scene mapping, curated choices, truthful fallback and large-image / inset-thumbnail swapping
- `src/StoreMusic.jsx` and `src/store-music.js`: default-on real-recording transport, browser gesture fallback and saved sound preferences
- `public/personalized-scenes/`: four optimized fictional prepared scenes and bounded provenance manifest
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
remain readable. The centered reply composer and yielding product-sheet layout
stay available; the visit page instead reserves inline space for its compact
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
Product opens, saved pieces, selected variants and visit-bag actions retain the
existing conservative conversational budget. A deliberate reply leaves a short
1.2-second quiet gap. Explicit close/minimize remains closed through scrolling,
new attention and delayed replies; only the shopper can reopen it. Pause stops
proactive prompts while leaving deliberate conversation available.

The centered composer and full conversation share one in-memory transcript, current
piece, selected variant and the existing optional provider consent. Visual bubbles
are temporary; the full conversation retains them for the current page session.
New page/product navigation cancels outstanding replies and clears obsolete visual
bubbles. Browsing events never trigger an external provider call. If a user opts
into the disclosed provider connection, a deliberate typed/quick reply may send
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
Other pairings state that same-series is unverified. All fit, stock and real
purchase claims remain outside this demonstration.

History remains local by default. A separate unchecked Gemini consent can share
at most the first eight selected fictional entries, with only catalog ID, color
and size, during a deliberate guide question. Main provider consent is also
required. Deliberate Gemini calls may include a single bounded catalog attention
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
the existing Gemini route only when configured and explicitly consented; passive
product attention never invokes it. Passive hints are omitted from the bounded
provider conversation history so they do not crowd out the shopper’s own turns.

Session likes, exclusions, budget and occasion can shape follow-up answers,
comparisons and optional complements. Current attention takes precedence over
a closed product sheet. Fictional ownership is always read from the current
validated history, including edits and explicit clearing; saved and bag items
never imply ownership. Existing exact variant, collection, catalogue pricing,
stock and transaction safety boundaries stay in effect.

Run `node tests/guide-conversation-e2e.mjs` for the ten-turn Chinese local
conversation evidence and no-provider-request check.


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
