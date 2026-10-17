# Continuous catalog browsing

The discovery feed repeats the eligible fictional catalog as the visitor scrolls. Every complete cycle contains each matching product once. Subsequent cycles rotate product ordering deterministically; two-product filters retain their order to avoid adjacent boundary duplicates. A single-result filter honestly repeats that same piece. The repeat behavior is disclosed above the feed.

- Original visit and footer information appears inside the stream after a catalog cycle. Small filtered lists browse at least 18 entries between these pauses. Products continue underneath the pause, with a Continue control.
- Six-entry pages append through IntersectionObserver. A real button also works with keyboard interaction or without IntersectionObserver.
- Only nearby pages retain product DOM. Measured page spacers preserve document height and restore prior occurrences when scrolling back. A focused page can stay pinned for keyboard accessibility.
- Occurrence IDs are unique presentation identities; wishlist, history, stock, variants and visit-bag entries continue to use the original SKU.
- Attention frames, delayed bubbles and source links distinguish occurrences. An earlier occurrence of the same SKU cannot take over the current card's frame or bubble.
- Filters, ranking preferences and feedback restart presentation without clearing the saved list, purchase history or bag. Empty filters do not append or loop.
- Existing product images, prepared-image availability disclosures, onboarding and audio behavior are unchanged. Continue scrolling respects reduced-motion preferences.

Verification:

- `npm test`: catalog cycles, filter safety, small catalogs, unique occurrences, page-window bounds and occurrence-specific source resolution.
- `node tests/endless-feed-e2e.mjs`: three full cycles, footer continuation, DOM bounds, back-scroll geometry, shared saved/bag state, per-occurrence attention, empty filters, keyboard loading and mobile layout.
