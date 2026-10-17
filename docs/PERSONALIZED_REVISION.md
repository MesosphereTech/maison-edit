# Contextual outfits and hands-on demo

This revision keeps the existing two fictional case combinations and all 56
primary-colour product/room scenes. It adds seven reference-guided synthetic
full outfits across city arcades, courtyards, cafés, dinner and autumn streets.
All 13 gender-matched clothing SKUs have an anchor outfit. Scene-to-product
links are limited to visually reviewed pictured components. Uncertain earrings
and the knit look's covered belt remain suggestions in provenance only.

`docs/outfit-provenance-v1.json` records output/input hashes,
exact pictured and suggested SKU colours, prompts, dimensions and review notes.
The seven outfit WebPs total 1,584,958 bytes. These are fictional styling images,
not physical-product photography, body measurements or a fit guarantee.

The lower Change case button cycles only the two supported combinations.
Each case separately retains its edited purchase history, favorites, visit bag,
feedback and profile preferences. A case switch resets filters and the current
conversation, without reloading the page. Explicitly empty purchase history
stays empty when returning to a case. Men's personalized lists rank womenswear
below their own clothing, accessories and home pieces; explicit womenswear
filters remain available and the cards label opposite-department gift ideas.

The first image-swap explanation is dismissible and remembered in browser
storage. A separate three-step hands-on tour follows real favorite, visit-bag
and visit-planning clicks. It does not fabricate clicks, place orders or submit
appointments. Exit guide and Escape leave the shopper's real demo choices intact.
Case switching can restart the tour for the selected case.

The companion has one persistent live surface, with a product-anchored contour
lap and a small glyph-free pixel trail. Its text fades in by short phrases;
reduced motion reveals it immediately. Clicking a product image yields its
reading surface at half opacity and searches for a real blank region; scrolling
restores its centered reading position. The composer stays lower-center.

## Verification commands

- `npm test`: pure catalog, backend, ownership/outfit, provenance and motion checks
- `npm run build && npm run test:build`: production Worker build and transport
- `node tests/revision-personalization-e2e.mjs`: built desktop/mobile tour,
  independent case history, actual action variants and image interactions
- `node tests/persistent-bubble-e2e.mjs`: 1440/390/320 motion, 24-hour lifetime,
  interrupted phrase reveal, blank-region placement and reduced-motion checks
- `node tests/persistent-bubble-app-e2e.mjs`: real catalog-to-sheet continuity

The guide remains a labeled local demo unless a real provider is configured.
No image/guide provider calls are performed while browsing this prepared catalog.
