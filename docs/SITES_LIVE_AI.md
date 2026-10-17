# MAISON ÉDIT: real Gemini connection

Checked 2026-10-15. The published Site is still the private static version. No live Gemini request, credential configuration, new account permission, billing setup or Google deployment was performed while preparing this adapter.

## Recommended next step

Use Gemini for the shopping concierge. This aligns the AI provider with the competition's Google-AI direction. There are two hosting options:

1. **Fast private test on the current Sites URL:** add the Worker API to this existing Site, keep its owner-only access, configure a server-only Gemini secret, publish, then verify a genuine consented response. Sites hosting itself does not satisfy a separate Google Cloud Run/Firebase hosting requirement.
2. **Competition deployment:** use the existing `Dockerfile` and Node server on Cloud Run, with the key supplied by Google Secret Manager. The owner must select the Google Cloud project, region and runtime identity and approve any costs or permissions. See `GOOGLE_DEPLOYMENT.md`.

The temporary Codex CLI adapter is limited to cloud-workspace loopback tests. A successful CLI login would not make the hosted Site live. Sites' sign-in authenticates visitors; it does not automatically grant their ChatGPT-plan inference. OpenAI's current plan-usage preview documents open-source/locally hosted apps and directs remotely hosted apps to an interest form.

## Secure owner entry for Sites

After approving the Gemini connection:

1. Open [Sites in ChatGPT](https://chatgpt.com/sites).
2. Find **MAISON ÉDIT**, open **More actions**, then **Settings**.
3. In the hosted environment configuration, enter the existing approved key as `GEMINI_API_KEY` and mark it **secret**. Enter it only in that settings screen, never in chat, a file or frontend code.
4. Add `GEMINI_MODEL` with the non-secret value `gemini-3.5-flash-lite`. Google's current model catalog and structured-output guide list it as supported. `gemini-3.8-flash` is another currently documented choice. Actual project availability, quota and billing remain unverified until an authorized live call succeeds.
5. Leave image generation disabled for this first connection. Only the guide is being connected; no microphone, photo uploads, visual body analysis, live virtual try-on or measured room reconstruction is enabled.
6. Save the settings and tell the assistant they are saved. Redeployment is required for the new hosted environment revision to apply.

No key value is needed by the assistant. An existing server-side key can incur provider usage charges. The private Site audience and the API's visitor-identity checks should remain in place.

## Prepared implementation

- `server/google-ai.mjs` is shared by Node and Workers. It uses Web standard byte decoding, streaming responses, fetch and abort handling; it has no Node imports or `Buffer` dependency.
- `server/worker.mjs` is a self-contained Worker entry point after bundling. It serves the current frontend from Sites' `ASSETS` binding and implements `/api/status`, `/api/health`, `/api/guide`, `/api/scene` and an explicitly unavailable `/api/analyze`.
- Worker API requests require Sites-supplied authenticated visitor identity, same-origin browser requests, bounded JSON bodies and existing per-isolate request/concurrency limits. Identity headers are trusted only behind the Sites dispatcher. Do not expose this handler directly on another public host.
- Keys are read only from server runtime bindings and never returned. Google calls use a fixed official host and a header key; redirects are denied. Missing configuration/consent and provider failures retain explicitly labeled local-demo output.
- `configured` means configuration is present. `connection: unverified` and `usable: false` remain until a completed, validated provider response. Connection evidence is per-isolate and can reset after a Worker restart. It is not a durable service-health record.
- Per-isolate limits are twenty HTTP API requests per minute, sixty eligible provider attempts per UTC day, and four concurrent requests. Text generation uses at most 1,024 output tokens with no retries or fan-out. Counters reset when the Worker isolate is replaced, so these are demo guardrails, not distributed quota enforcement or a monetary spending cap. Public live-AI access requires a reviewed authentication/abuse/budget plan before changing the Site audience.

## Production and review builds

Run from the repository:

```sh
node --test tests/backend*.test.mjs
npm run build
npm run test:build
npm run build:review
```

The production build writes `dist/client/index.html` and frontend assets, a bundled `dist/server/index.js` ESM Worker, and `dist/.openai/hosting.json`. The optional review build writes the same shape into a temporary directory and leaves `dist/` unchanged. Neither build uploads anything, configures credentials or calls Google.

The source manifest has now been migrated to Worker hosting, preserving its exact `project_id`. `npm run build` emits this Worker-plus-client shape under `dist/`; `npm run test:build` dry-checks the compiled Worker and assets without credentials or provider calls. The production Node server serves `dist/client`, so the same source still supports Cloud Run. Keep source, the pushed commit and the packaged archive aligned through the supported Sites source workflow. A new Site is unnecessary. Audience settings remain unchanged.

## Actual acceptance test after approved setup

1. Publish the reviewed Worker build with the new hosted environment revision; verify deployment success.
2. In the signed-in private Site, check `/api/status`: it should name Gemini and the selected model, but must remain unverified before inference.
3. Submit a non-sensitive styling query through the visible concierge after its Google-sharing consent. The transmitted information is the query, bounded recent conversation, language, category, budget, style preferences, selected fictional SKU IDs, one inferred attention event and a curated fictional catalog. Up to eight fictional owned-item records are included only when the separate, unchecked-by-default fictional-history sharing control is enabled; the server rejects nonempty history without that separate consent. Only canonical SKU IDs, colors and sizes are accepted. No purchase dates, paid amounts, receipts or identities are accepted. The attention event is a local viewport/action heuristic, not eye tracking. Avoid sensitive information in the query.
4. Require the actual HTTP response to show `mode: gemini`, `externalCall: true`, the selected model and validated canonical catalog recommendations. A local demo fallback, an installed CLI, configuration status or a mocked test is not a live-connection success.
5. Verify the UI identifies the successful reply as live Gemini output and labels any fallback honestly. Prices, stock and visits remain fictional demonstration data.

No live acceptance result exists yet. Offline tests only establish handler and provider-contract behavior.

## Official sources

- [Sites runtime, settings and environment values](https://learn.chatgpt.com/docs/sites?surface=web)
- [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models)
- [Gemini GenerateContent structured-output contract](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Cloud Run Secret Manager configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets)
- [ChatGPT plan-usage scope](https://developers.openai.com/siwc/token-sharing-open-source)
