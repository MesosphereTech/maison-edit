# Independent zero-upload QA

Checked 2026-10-14 against the current MAISON ÉDIT cloud-workspace revision.

**Verdict:** the selectable default experience is usable without personal uploads. All 11 independent preset/browser checks passed, with no uncaught browser errors. The final unit/backend suite passed **66/66**, and the production build succeeded.

## Scope and evidence

Review used Playwright with the existing `@sparticuz/chromium` headless browser and separate loopback Vite ports. All test data was fictional. No user computer, personal photos, credentials, real bookings, purchases or retailer contacts were used. Provider responses in browser and unit tests were synthetic contract fixtures, never evidence of live AI success.

- `scripts/independent-zero-upload-review.mjs`: independent default-selection, privacy, catalog and responsive checks.
- `artifacts/independent-zero-upload-review.json`: final 11/11 results and empty browser-error list.
- `artifacts/independent-final-unit.log`: final 66/66 unit/backend result.
- `artifacts/independent-regression-e2e.log` and `artifacts/independent-regression-guide-retry.log`: independent evidence for all 24 regression scenarios. The full run passed 23; one scenario exceeded its initial navigation deadline while Vite hot updates were active, before its assertions. That scenario passed in an isolated stable-source retry. A separate final full regression run also passed 24/24.
- `artifacts/audit-flow-results.json`: the complementary 24-flow audit, including the replacement zero-upload case.

Run the independent preset review with `node scripts/independent-zero-upload-review.mjs`. Run the regular regression suite with `npm run test:e2e`. Neither requires live provider credentials.

## Verified default-selection matrix

1. Fresh state selects the ordinary adult woman and warm-family home. Actual JPEG references and an illustrative floorplan load; no file-upload input is exposed.
2. All four adult persona photographs load from their exact preset paths, without fallback illustrations. Selections change stored persona ID, sample height and default size, plus visible catalog ranking. The selected persona department leads the product feed, and the first editorial includes that department.
3. All three homes load their original floorplans and reference photographs. Home selection changes palette, preference context and visible catalog order.
4. All nine dedicated living/kitchen/bedroom photographs load. Room changes alter home-piece ranking. Dining and study explicitly reuse the chosen home's living-room reference.
5. Main-page choices persist after reload. Profile-modal drafts can be cancelled without saving.
6. Existing version-one state gains valid preset defaults while preserving valid bag lines, bookings, wishlist, feedback, manual height and usual size.
7. Previously consented local photos remain stored invisibly through migration, preset changes and reload. They are not displayed by the test presets or included in guide payloads. Explicit photo removal remains available in Preferences & data.
8. The CLI consent contract sends selected persona/home/room IDs, bounded shopping context and conversation text. Profile names, manual measurements and legacy image data are absent. Without consent, the guide remains local.
9. An unavailable analysis service disables analysis and clearly states that no live result was produced. A blocked guide response stays labeled local demo.
10. All 28 catalog products remain unique, browseable and individually openable. Product variants, prices and quantities remain catalog-backed.
11. Default controls and profile/home dialogs fit 390- and 320-pixel mobile widths without page-level horizontal overflow. No uncaught browser errors occurred.

## Preserved regression coverage

The regular and complementary suites cover bilingual navigation; search, departments, budgets and pagination; wishlist and whole-edit actions; profile validation; bag variants, integer quantities and aggregate stock; booking acknowledgment, optional sharing, cancellation and persistence; merchant stock/preparation and alternative acceptance; local guide refinements; external-guide consent and fallback; synthetic first-use analysis contracts and cancellation; keyboard focus/escape behavior; corrupt-state recovery; data-reset confirmation; user-initiated ambient audio; and mobile consumer/merchant layouts.

## Issues corrected and rechecked

- Full-body persona images initially cropped the head and legs. Main references, modal previews and preset options now use containment; final screenshots show the full template.
- A verification-only analysis gate prevented the first connection test. Separate `canAttemptGuide` / `canAttemptAnalysis` flags now allow a clearly labeled unverified test, while failed status stays unavailable and refreshes after requests.
- Gemini/local status lacked the provider field required by the new frontend hook. Final status now identifies `gemini` or `demo`; both branches were checked without an external call.
- Ranking tests were updated for the actual category/home/room bonuses. Exact scores, stable ties and the original positive-feedback-only input remain checked. The liked item must improve position; a separate dislike is not introduced to manufacture a passing result.
- README and first-draft documentation now describe selectable fictional defaults and zero uploads rather than the removed upload flow.

## CLI adapter review

Source and synthetic process checks verified a fixed official binary, argument-array spawning with `shell: false`, prompt data on stdin, a read-only ephemeral sandbox, disabled model tools, trusted fixture paths, strict request fields, per-request consent, loopback/Host/origin restrictions, bounded process duration/output, temporary-file cleanup and catalog-canonical product facts. Malformed, oversized, incomplete and unexpected-tool responses were rejected; timeout and read-only failures produced explicit unavailable/demo results. No credentials were read or copied, and no new grants were created by this review. The prose guard is a conservative heuristic, not proof that every generated statement is correct.

The separately recorded real CLI smoke in `artifacts/codex-cli-live-smoke.json` failed at runtime initialization with `runtime_read_only`, before usable model output. No real GPT guide inference or image analysis was received. CLI image generation remains unverified and unavailable. Pre-generated people, rooms and plans are never presented as a newly generated try-on or makeover.

## Final visual evidence

- `artifacts/independent-default-desktop.png`: full-body default person, room photograph, floorplan and selection controls.
- `artifacts/independent-default-mobile.png`: mobile default controls and references.
- `artifacts/independent-home-floorplan.png`: home settings and illustrative plan.
- `artifacts/independent-analysis-unavailable.png`: truthful unavailable-analysis state.
- `artifacts/independent-guide-cli-unavailable.png`: consented synthetic CLI-failure contract with local-demo disclosure.

## Verification limits

This review verifies a local interactive demonstration, not a real retailer integration or live hosted AI backend. The static Sites preview cannot run the cloud-workspace CLI. Docker execution was not tested because a Docker binary is absent. Browser checks do not establish comprehensive accessibility compliance, production security, real inventory, actual fit, measured room dimensions or real-store accessibility. Live model behavior and hosted backend authentication remain unverified.
