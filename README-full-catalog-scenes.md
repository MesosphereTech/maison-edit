# Full prepared-scene catalog

Two fictional person/home/living-room combinations each cover all 28 catalog
SKUs in their primary catalog colour: 56 real, independently decoded WebP
scene files. Each registry entry binds its exact person, home, living room,
SKU, scene type and colour. Unsupported colours and combinations do not reuse
another scene. Image failures keep the original product concept.

The original five mappings for each combination retain their order, colours,
filenames and exact image bytes. They also remain the compact onboarding
preview. Only its first two scene files gate the short preparation sequence;
the other three preview images and catalog scenes load lazily. A failed lazy
preview displays the product concept with an explicit unavailable label.
The full scene count is shown without rendering a 28-image setup wall.

Women's garments in the city man's scenario, and selected menswear in the warm
woman's scenario, are shown on hangers or as separate products where appropriate.
Accessible descriptions use neutral person/product wording rather than implying
that every pictured garment is being worn. The curtain SKU is a small material
sample, not a full installed curtain. These are synthetic illustrations, not
verified fit, physical product photography, body measurements or room scale.

## Provenance

`public/personalized-scenes/manifest.json` contains the 56 output hashes,
dimensions, byte counts, review statuses, synthetic-data disclosures and exact
coverage. Its `sourceManifests` preserve the original manifest plus both catalog
expansion manifests under `public/personalized-scenes/provenance/` with hashes.
New asset entries include prompts and hashed persona, room and exact SKU colour
packshot references. Independent visual-review hashes are recorded alongside
those source snapshots.

## Verification

- `npm test`: exact coverage, output bytes/hash provenance, original mappings,
  colour/profile fallbacks and capped onboarding helper
- `node tests/full-catalog-scenes-e2e.mjs`: all 56 actual scenes decoded in the
  browser, each visible inset click target, keyboard swaps, isolated open action,
  unsupported-colour fallback, two-file critical gate, lazy-preview failure and
  bounded initial desktop/mobile viewport scene downloads
- `npm run test:scenes`: detailed original ten scene/thumbnail animation,
  history, fallbacks and responsive interaction coverage
- `node tests/onboarding-e2e.mjs`: cancellation, mandatory per-visit entry,
  selection, persistence, focus, failed critical asset and responsive coverage
- `npm run build && npm run test:build`: production Worker build and local
  synthetic transport verification, without a provider call or publication

Scene generation is complete before registry publication. Browsing and scene
loading make no image-generation, video-generation or guide-provider calls.
