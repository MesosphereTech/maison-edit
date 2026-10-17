# Hands-on guide and eight-piece journey

The image lesson belongs to the first visible card with two successfully loaded, exact-match image assets. Its actual inset button must be clicked, or activated with Enter/Space, to advance. It does not simulate a swap or open a product. The surrounding backdrop and page scrolling cannot advance it. The explicit exit and Escape leave the guide without marking the lesson complete. Failed or unavailable images never create a blocking lesson.

After the lesson, shoppers may browse freely or choose the existing try-list/review tour. Browsing progress counts distinct catalog SKUs after at least 550 ms of substantial, unobscured image exposure and a short scrolling settle. Rendered-but-offscreen cards, repeat occurrences of a SKU, modal reading, focused editors, unfinished conversation drafts, and tour-driven scrolling do not increase the count.

At eight distinct views, the next existing editorial visit pause is materialized and pinned in the virtual feed. Open product sheets, dialogs, guide conversations, drafts, and active try-list/review steps retain ownership. When safe, one controlled animation accelerates toward that pause and docks against the live CTA after neighboring page measurements settle. Reduced-motion users get an immediate reposition with geometry settling, rather than a long animation. A wheel, touch, pointer, or scrolling-key interruption during travel exits the guide; Escape also exits.

Arrival highlights and focuses the actual “Plan your visit” button. It remains a required real interaction, with an accessible keyboard path and explicit exit. Arrival, backdrop clicks, and elapsed time never complete the step. Clicking the real button uses its existing navigation; the guide never fabricates a booking, reservation, order, or target click.

Progress and terminal states are tab-scoped and isolated by curated case ID, with persona/home/room as the fallback. Returning to an exited or completed case does not replay the guide. `restartGuidedCase(id, {resetSwapTutorial: true})` explicitly replays that case. `resetAllGuidedCases()` is wired to confirmed deletion of local demo data. Neither browsing progress nor travel changes shopping state.

## Verification

- `node --test tests/guided-journey.test.mjs`
- `node tests/guided-journey-e2e.mjs` for actual eight-piece browser journeys at 1440, 390 and 320 px, normal and reduced motion
- `node tests/guide-queue-exits-e2e.mjs` for queued blockers, interruptions, per-case terminals, explicit resets and unavailable assets
- Screenshots and machine-readable results: `artifacts/v17-guide-*` and `artifacts/v17-guided-journey-e2e.json`

All guide copy uses the existing English/Chinese language switch.
