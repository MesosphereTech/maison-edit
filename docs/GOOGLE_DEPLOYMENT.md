# MAISON ÉDIT · Google AI / Cloud Run deployment

## Public judging release — October 18, 2026

The owner explicitly approved public publication and synchronization of the ten additional review-source files. The original 33-file private GitHub synchronization is commit `851984b136417c194000a5950c499fd3855d4584`. The repository remains private; publication affects only the separate judging service. Music arrangements were confirmed handled by the owner, and the original media/provenance remain unchanged.

- Public service: `maison-edit-review`, project `gen-lang-client-0176200551`, region `asia-east1`.
- Public URL: https://maison-edit-review-904021583303.asia-east1.run.app (canonical https://maison-edit-review-zerxou757a-de.a.run.app).
- Ready revision: `maison-edit-review-00001-6n8`, serving 100% of traffic; Cloud Build `12d9f390-058e-4213-8ee3-a878bdf12d10`.
- Only the review service has `allUsers:roles/run.invoker`. The original service has no public binding, is still revision `maison-edit-private-00007-sns`, and returns unauthenticated 403.
- Request-based CPU billing, 1 CPU/512 MiB, min zero/max one instance at both service/revision scopes, concurrency four, 60-second timeout, startup CPU boost off, image generation disabled.
- Existing runtime identity and `GEMINI_API_KEY=maison-edit-gemini-api-key:1` secret reference, with `GEMINI_MODEL=gemini-3.5-flash-lite`. No key payload was read, downloaded or added to Git. No new key, project-level role or billing-tier upgrade was created.
- `PUBLIC_REVIEW_MODE=true`: 12 AI requests per minute, 200 per review day (midnight Asia/Shanghai), two concurrent AI requests, collectively per server process. Restart resets counters. These are safeguards, not durable quotas or a financial cap. The existing USD 5 project alert budget still covers the project; free/billed usage has not been independently verified.

Verification: unauthenticated root, compiled CSS/JS assets, `/api/health` and `/api/status` returned 200. Status reported the configured public limits. MP3 byte range returned 206 with the correct 32 bytes. A new browser with no Google login or Authorization header loaded the actual public URL, showed instant prewritten browsing with zero provider requests, and sent one real styling question. Its response returned HTTP 200, `mode: "gemini"`, `externalCall: true`, model `gemini-3.5-flash-lite`, no warning; the paragraph was found verbatim in the conversation. It suggested fluid textures and lighter hues to soften the wool blazer. History collapsed to one bubble and minimization generated no further calls. No provider response was mocked for this live check.

Offline checks before publication: 252 tests, production build, staged Node runtime, focused desktop/mobile guide suites, and daily-limit feedback passed. Mocked local HTTP tests prove a daily rejection prevents another provider request. The full general legacy browser suite remains a separately recorded limitation below.

## Private source synchronization review — October 18, 2026

At review time the GitHub API confirmed `MesosphereTech/maison-edit` remains private, and authenticated `git ls-remote` confirmed main is still `e2e0bb6e367a5b38c00f7cc69265fbfb249fded9`. No commit or push was performed before the owner's requested review. Current frontend source and Gemini adapter match the source snapshot used for revision `maison-edit-private-00007-sns`; public media have no Git changes. The synchronization preparation adds documentation and ignore-rule hardening, explicitly includes build devDependencies in the Dockerfile, and clarifies the existing missing-manifest native build path.

A candidate snapshot contained 351 repository files and no Git metadata, `.openai`, environment key files, existing `node_modules` or build output. Common credential-format scanning of 212 text files found no matches, and the candidate filename check found no private configuration/credential files. Ignore checks cover `.openai/hosting.json`, environment files, service-account files, certificates and local test artifacts; `.env.example` remains an empty, non-secret template. Credential stores and Secret Manager payloads were not read. This check is scoped to candidate files, not a claim about every historical Git object.

Using Node 22.23.3, an independent empty npm cache and empty npm user/global configuration, the clean snapshot passed locked installation, native frontend build, 247 tests and actual staged-runtime verification. No provider was called. Initial npm transfers reset; two packages were downloaded afresh from the official registry, checked against lockfile SHA-512 integrity, and added only to that independent cache before retrying installation. No dependency directory or pre-existing user cache was copied. Full local Docker verification stopped during package download with `ECONNRESET`; it did not fail on a missing hosting manifest and is not being reported as a successful fresh Docker rebuild. The previously successful Cloud Build remains separate historical evidence. TLS checks and security extensions were unchanged.

## Current interaction policy — October 18, 2026

The owner requested immediate prewritten browsing guidance after finding browsing-triggered Gemini too slow. Product focus, inspection and variant changes now stay local and make no provider requests, including in sessions that previously used AI. Local copy appears immediately without progressive reveal. Product inspection highlights the existing SKU-specific editorial introduction and try-on considerations, rather than just the compact history-pairing label.

Sending a typed message or a question shortcut automatically routes to the configured Gemini backend. A visible notice explains this at the composer before sending; no separate provider-toggle step is needed. Separately approved owned-history sharing remains optional. The previous browsing-generation policy recorded below is historical. Quota/error messages, private hosting and server-only secret handling are unchanged.

The product sheet reserves a fixed guide rail on the right for desktop/tablet and a separate bottom band on phone layouts. The guide remains opaque and readable while scrolling the independently scrollable product sheet. History expansion and whole-window minimize remain separate. Minimize still cancels work and suppresses all new dialogue events. Local mock-provider browser tests verify immediate prewritten text, zero browsing calls even with prior AI consent, automatic typed chat, history retention, quota errors and cancellation, plus guide/product non-overlap at desktop and mobile widths. The 247 application tests, bilingual locale browser suite and staged Node runtime checks passed.

Current cloud validation: build `c3b260f0-acd2-4f9c-8119-1d4f985cd406` deployed private revision `maison-edit-private-00007-sns`. The authenticated preview showed instant preset copy with zero browsing provider requests. Sending one typed styling question automatically returned HTTP 200, `mode: "gemini"`, `externalCall: true`, model `gemini-3.5-flash-lite`; its returned paragraph was displayed verbatim in the transcript. History collapse and minimize passed in the real browser. No synthetic provider response was used for this one live check. Runtime identity, pinned Secret Manager reference, 1 CPU/512 MiB, zero minimum/one maximum instance and local proxy origin remain unchanged.

## Local handover update — October 17, 2026

The private repository main was verified at `e2e0bb6e367a5b38c00f7cc69265fbfb249fded9` (346 tracked files). The local fixes preserve the storefront, bilingual content and v18 playback policy.

- Native Node / Cloud Run builds now work without the missing account-specific `.openai/hosting.json`. `npm run build` produces `dist/client` when that manifest is absent; supplying a real Sites manifest retains the original Worker build. The Dockerfile no longer copies a nonexistent manifest.
- `npm run test:build` validates the actual native build using the existing isolated Node runtime test when building for Cloud Run.
- The Node server now supports HTTP byte ranges, including bounded and suffix requests, so actual MP3 seeking and end-of-recording playback work in the production server as well as Vite.
- Windows backend fixtures use directory junctions for path-escape checks without requiring elevated symlink privileges. Focused locale/music browser suites accept an existing Windows Chrome through `E2E_CHROMIUM_PATH`, without Linux-only launch flags.
- `.gcloudignore` excludes Git metadata, environment files, dependency folders, local build/test artifacts and Sites account configuration from source uploads. `.env.example` remains a safe template.

An authenticated Google project-list API call succeeded on this machine; this supersedes the older preparation-environment tooling notes below. Firebase project enumeration returned HTTP 403, so Firebase access is **not verified**. The owner subsequently approved deployment to the existing project `gen-lang-client-0176200551`, region `asia-east1`, private access and the cost/permission scope below.

The full Node 22 container is now deployed as `maison-edit-private`. Its private URL is `https://maison-edit-private-904021583303.asia-east1.run.app`; the alternative canonical URL is `https://maison-edit-private-zerxou757a-de.a.run.app`. Both require Cloud Run IAM authentication. The first successful Cloud Build was `c1a4aef8-bc04-423d-8482-e881025ac3eb`, completing in about 50 seconds. The current verified revision is `maison-edit-private-00007-sns`.

Verified cloud configuration: request-based CPU billing, 1 CPU / 512 MiB, zero minimum and one maximum instance at service and revision scope, concurrency four, 60-second request timeout. `maison-edit-runtime` has no project-level role and only Secret Accessor on `maison-edit-gemini-api-key`. Separate `maison-edit-builder` has Cloud Run Builder; it has not been granted Secret Accessor. Existing shared identities were not changed. A new USD 5 monthly alert-only budget covers this project, at 50%, 90% and 100%; the pre-existing USD 20 budget was preserved. Actual billed totals have not yet been verified and billing reporting can lag.

The owner has saved Secret Manager version `1`, now pinned as `GEMINI_API_KEY` in revision `maison-edit-private-00003-spb`. `GEMINI_MODEL=gemini-3.5-flash-lite` is configured. The key value has not been read, downloaded, logged or copied into the repository by the agent. Image generation remains disabled. The original test question reached Google but was rejected with HTTP 400, and the app truthfully fell back to demo mode.

Server-only metadata diagnostics confirmed the key and selected model were accessible (both HTTP 200). A single controlled diagnostic of the same test question identified `INVALID_ARGUMENT` at `generation_config.response_format.text.mime_type`. Google's `TextResponseFormat.mimeType` requires the enum `APPLICATION_JSON`, not the HTTP MIME string `application/json`. The source and transport-contract assertion have been corrected; all 245 tests pass. The temporary diagnostic job was deleted after completion. No Gemini billing upgrade or new key was created by the agent.

The corrected image was built by `dae9cbd6-65bd-4362-9a9c-279fc939c07c` in nine seconds. Because the full source upload stalled before starting a build, that upload was cancelled. The successful update used the already verified complete application image pinned at `sha256:1c7d21af818f14cd0ac58cda0d0ac108e4c59f5eae5e7d3debd3ea4a79924fc4` and replaced only `/app/server/google-ai.mjs`; all frontend files, images, music, Node 22 runtime and other backend files were inherited unchanged. The normal repository Dockerfile also includes the source correction for future full builds.

**Real Gemini verification succeeded against the deployed `/api/guide`: HTTP 200, `mode: "gemini"`, `externalCall: true`, `model: "gemini-3.5-flash-lite"`, no warning, and canonical product IDs `ME-001`, `ME-002`, `ME-003`.** The one approved question asked for a quiet, tailored gallery-opening outfit. The live answer suggested a structured wool blazer, matching long-line trousers and a soft ivory silk shirt. The earlier original request and one diagnostic of that same question were rejected with HTTP 400 before the successful corrected request; these failed attempts are not counted as successful live answers. No different test question or image-generation request was sent. Actual billed totals / whether usage fell within the owner's free quota have not been independently verified; do not infer a zero bill from a successful call or from possession of an API key.

Google's official authenticated proxy currently exposes the private cloud version only at `http://127.0.0.1:8081`. `GUIDE_ALLOWED_ORIGIN` permits precisely that origin for browser API requests; Cloud Run IAM remains required. For future sessions, use `gcloud run services proxy maison-edit-private --project=gen-lang-client-0176200551 --region=asia-east1 --port=8081` from an authenticated CLI. This machine's SDK is currently invoked through Python because its normal Windows launcher is absent.

Local verification after the fixes: `npm test` passed 245/245 (including the backend tests), `npm run test:backend` passed 56/56, frontend build and actual staged-runtime validation passed, locale/browser checks passed, and the music plus music-onboarding suites passed 14/14 each. The local production preview listens only on `127.0.0.1:8080`; `/api/health` is healthy, `/api/guide` truthfully returns `mode: "demo", externalCall: false, warning: "not_configured"`, and MP3 range requests return 206 with correct bytes.

Cloud verification: unauthenticated requests return 403 and no public IAM binding exists; authenticated `/`, `/api/health` and `/api/status` return 200; an MP3 byte-range request returns the correct 32 bytes with 206. The authenticated local cloud proxy accepts browser-origin guide requests and returns truthful `mode: "demo", externalCall: false` without consent/key. The existing locale browser suite passed against the actual cloud deployment, covering fresh English, Chinese/English persistence, product, store list, visit and merchant demonstrations.

Remaining validation: the older general `test:e2e` suite passed only 4/24; its failures include obsolete controls and the superseded cross-refresh pause expectation, and all remaining failures have not been individually resolved. Passing the newer focused suites does not establish a clean full browser suite. The local Docker attempt failed during an npm network reset; the same complete Dockerfile subsequently built successfully in Google Cloud Build. Public release, music licensing and actual billed totals remain separate checks. Repository changes remain local and have not been pushed to GitHub.

Approved scope: one **private** Cloud Run service serving both frontend and Node API, request-based billing, 1 CPU / 512 MiB, minimum zero and maximum one instance, concurrency four and a 60-second timeout; USD 5 monthly alerts, an initial build budget of USD 1 and one Gemini test question with a USD 0.10 allowance. Keep image generation disabled. Cloud Run scaling limits and ordinary alert-only budgets do not constitute a hard Gemini spending cap. Public access, any expanded permission or spend scope requires a new owner decision.

Use a dedicated runtime service account with access only to the approved Secret Manager secret. The owner enters the Gemini key directly in the official Secret Manager console; the service receives a pinned secret version as `GEMINI_API_KEY`. `GEMINI_MODEL` is a non-secret server setting, selected from the current official structured-output model catalog and verified only after cost approval. No key should be downloaded for the local preview.

Do not claim a live connection from health metadata: the approved real test must return `mode: "gemini"`, `externalCall: true` and the selected model. Public access and music licensing remain separate owner decisions.

This repository contains a fictional luxury department-store demo, a server-only Gemini adapter, and a multi-stage Cloud Run container. The complete application is **privately deployed on Cloud Run, with one successful real Gemini question verified**. Automated backend tests still use mocked HTTP responses and require no credentials; the separate owner-approved live check is recorded above. The preparation instructions below remain reference procedures; the verified current state is recorded above.

Customer copy update (October 17): customer-facing Chinese/English preset subtitles, purchase-history pairings, concierge replies and try-list guidance no longer include internal collection-verification or catalog-provenance audit notes. Unconfirmed collection relationships are described as complementary styling without claiming a shared collection. The per-message AI prose audit footer was removed, and the server prompt keeps verification instructions internal. Catalog validation and demo/consent boundaries remain in place. Validation: 245 application tests, 56 backend tests, production build/runtime check and 224 bilingual preset-output combinations passed. This update did not send another Gemini question.
Live guide interaction update: the owner has now authorized ordinary typed and browsing-triggered Gemini use, superseding the earlier one-question-only test scope and rejecting the proposed ten-request visit cap. This does not authorize a Gemini billing-tier upgrade, and the account's free-tier/billing status has not been independently established. Browser sharing consent remains explicit, is visible in the subtitle panel and persists only for the browser session. A stable product focus waits 1.2 seconds before generation and repeated identical consecutive product contexts are deduplicated. There is no ten-turn or thirty-second client cap. Quota/rate-limit responses are visibly distinguished from advice and stop automatic retries until an explicit retry or consent reset. Provider failure no longer substitutes prewritten advice in the live chat. Browsing-generated text participates in subsequent conversation context without forwarding separately unapproved owned-item history.

History expand/collapse now stays inside the conversation surface and returns to exactly one bubble. Whole-window minimize is separate, cancels pending work, ignores late replies and suppresses all new dialogue events while minimized. The pause control has been removed. Desktop and 390px browser regressions use synthetic responses (no provider calls) and cover typed/automatic routing, consent, conversational context, both collapse levels, HTTP/provider quota responses and cancellation. Application tests: 247/247; local bilingual browser and staged-runtime checks passed.

Cloud verification of the live-guide update (October 18, local time): build `cea0f244-4a5e-44fc-a003-694a2e482367` deployed revision `maison-edit-private-00006-zw9`. One actual browsing-triggered request from the authenticated local proxy returned HTTP 200, `mode: "gemini"`, `externalCall: true` and `model: "gemini-3.5-flash-lite"`. The returned wool-blazer styling paragraph was found verbatim in the expanded browser transcript. Collapsing returned to one bubble; moving the guide to the side produced no further requests. This live browser check used no synthetic provider response, and did not read the secret payload. The separate desktop/mobile regression tests use synthetic responses and establish interaction behavior rather than real model connectivity.

## Architecture and honest modes

```text
Browser / Vite React frontend
  ├── editorial images + local demo catalog / local browser shopping state
  └── explicitly consented POST /api/guide
          ↓
     Node 22 server (server/index.mjs, serves dist/client)
          ├── authoritative fictional SKU catalog (src/data.js)
          └── Google Gemini GenerateContent REST API
```

- `mode: "gemini"` means the server received and validated a Gemini response from a live request. It does **not** imply real retail prices, live inventory, real bookings, or transactions.
- `mode: "demo", externalCall: false` is a deterministic, local catalog guide. With no API key, no valid configured text model, or no browser consent, Google is not called.
- `mode: "demo", externalCall: true` means a Google request was attempted but rejected, timed out, failed, or produced unsafe/malformed recommendations. The warning identifies the fallback reason without exposing provider messages or credentials.
- Prices and stock in the structured `products` response always come from the fictional server catalog. Unknown, out-of-budget, wrong-category and duplicate SKU recommendations are rejected. The model is instructed to provide qualitative styling guidance; conservative English/Chinese filters reject numeric, currency, availability, sizing, floor, delivery, payment, booking and actual-fit language. **These heuristic text filters do not prove that all generated prose is factually grounded.** Treat AI styling prose as suggestions, not verified product provenance, material specifications or commercial promises. The response includes a prose disclosure.
- `/api/status` and `/api/health` report configuration, not successful live connectivity. No status endpoint makes a Google request.
- Editorial imagery already included in the site is pre-generated inspiration. It must not be labeled live generation, a SKU photo or virtual try-on.

## Local check with no credentials

From the project folder, with Node 22 installed:

```bash
npm ci
npm run test:backend
VITE_GUIDE_ENDPOINT=/api/guide npm run build
PORT=8080 node server/index.mjs
```

Visit `http://localhost:8080`. This is a fully browsable, no-key demo. Setting the relative Vite endpoint lets the consented guide use the server on the same origin. Without the endpoint, the frontend's local demo mode remains usable.

```bash
curl http://localhost:8080/api/health
curl -X POST http://localhost:8080/api/guide \
  -H 'content-type: application/json' \
  -d '{"message":"A quiet gallery-opening look","language":"en","context":{"category":"women","budget":5000,"styleTags":["quiet"],"selectedProductIds":[]},"consent":{"googleAI":false}}'
```

The guide response is `mode: "demo"` with `externalCall: false`. This command sends no personal information or photographs and makes no Google API request in an unconfigured environment.

## Runtime configuration

| Variable | Purpose / default |
|---|---|
| `PORT` | HTTP port, default `8080`; Cloud Run supplies it |
| `GEMINI_API_KEY` | Server-only credential supplied securely by the owner; never a `VITE_` variable |
| `GEMINI_MODEL` | Required explicit text model supporting GenerateContent structured JSON output; no stale hardcoded default |
| `GEMINI_TIMEOUT_MS` | Guide timeout, default `15000`, clamped to `10…30000` ms |
| `GUIDE_ALLOWED_ORIGIN` | Optional exact extra browser origin, e.g. `http://localhost:5173`; default same-origin only |
| `ENABLE_IMAGE_GENERATION` | Literal `true` enables the optional text-only scene route; disabled by default |
| `GEMINI_IMAGE_MODEL` | Separate explicitly chosen native Google image model; no default |
| `VITE_GUIDE_ENDPOINT` | Build-time browser URL; container build sets `/api/guide` |

**Model availability changes.** Before enabling live mode, choose a model available to the owner's Google project and check its documented structured-output capability. The adapter uses the official GenerateContent REST `generationConfig.responseFormat.text` schema. Do not assume an older example model is available to a new account. See [Google's model catalog](https://ai.google.dev/gemini-api/docs/models) and [structured-output REST examples](https://ai.google.dev/gemini-api/docs/generate-content/structured-output).

Provide credentials through process environment injection or Google Secret Manager. Do not commit keys, paste keys in chat, embed them in frontend code, set them as Vite variables, or put key values in build arguments. `.dockerignore` excludes environment files. This work did not inspect existing credentials, create a key, accept billing terms or run a billable generation request.

## Cloud Run: deploy the safe no-key demo first

Prerequisites are an owner-selected Google Cloud project with billing and required Cloud Run / Cloud Build permissions already approved, an installed authenticated Google Cloud CLI, and an existing project/region. **The commands below are instructions for the owner, not commands that were executed.** Building and hosting can incur Google Cloud charges.

Substitute the project ID and region you intend to use:

```bash
export PROJECT_ID="YOUR_PROJECT_ID"
export REGION="YOUR_REGION"
export SERVICE="maison-edit-demo"

gcloud run deploy "$SERVICE" \
  --source . \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --port 8080 \
  --memory 512Mi \
  --cpu 1 \
  --concurrency 4 \
  --min-instances 0 \
  --max-instances 1 \
  --timeout 60 \
  --no-allow-unauthenticated
```

The supplied Dockerfile runs the shared build, whose output includes the Vite frontend in `dist/client` and a separate Sites Worker artifact in `dist/server`. Cloud Run uses the native Node server, **not** the Sites Worker. The runtime stage copies the complete shared `src` dependency graph because the authoritative catalog imports shared helpers. It runs as a non-root user, contains no credentials and needs no runtime npm dependencies. The server binds to `0.0.0.0:$PORT`, serves `dist/client`, and exposes `/api/health` for a health check, following the [Cloud Run container requirements](https://docs.cloud.google.com/run/docs/configuring/services/containers). Leave `MAISON_AI_PROVIDER` unset for this Gemini deployment; the optional `codex-cli` bridge is a loopback-only development test and is not a Cloud Run provider.

This deployment starts private and uses no Gemini credential. Only choose public access after reviewing who should see the demo. If the owner explicitly wants a public **no-key** showcase, replace `--no-allow-unauthenticated` with `--allow-unauthenticated`. That changes audience/access and should be an intentional owner decision. Publicly enabling paid Gemini endpoints needs additional authentication, abuse protection and a spending plan.

For a local container build without Google Cloud:

```bash
docker build -t maison-edit-demo .
docker run --rm -p 8080:8080 maison-edit-demo
```

The backend suite includes an isolated staged-runtime test with no `node_modules`, no keys and no external API calls. It checks the Docker runtime copy rules, imports the native Node server with the complete catalog dependency graph, and checks `/` and `/api/health` over loopback. This is **not** an actual Docker/container build. Docker is not installed in the preparation workspace, so an actual container build remains to be verified in Google Cloud Build or another approved Docker environment. Do not pass an API key at build time.

### Cloud Shell upload path: no public repository required

If the owner uses Google Cloud Console, the source can be uploaded directly to Google Cloud Shell instead of published to a public Git repository. In the owner's signed-in console, select the intended existing project, activate Cloud Shell, and use **More → Upload** to upload the reviewed source archive to the Cloud Shell home directory. Extract it into a new directory, change into the project folder, confirm `gcloud config get-value project` matches the approved project ID, then run the deployment command above. Google documents [Cloud Shell uploads](https://docs.cloud.google.com/shell/docs/uploading-and-downloading-files) and [source deployments](https://docs.cloud.google.com/run/docs/deploying-source-code). Review the archive before upload: exclude credentials, environment files, `.git`, `node_modules`, prior builds and unrelated private files. Include all project source files, `package.json`, `package-lock.json`, `Dockerfile`, `.dockerignore`, and the existing `.openai/hosting.json` required by the current shared build.

At preparation time on October 17, dot's cloud browser returned **“Site Unavailable / Unable to access this site”** for both the Cloud Run console route and the Google Cloud Console root. No Google sign-in, account, project or billing state was reached. The workspace also has no `gcloud`, `firebase` or `docker` executables. This is a verified access/tooling blocker, not evidence that the owner lacks a Google account, project or billing. The owner can independently open Google Cloud Console and report only the selected project ID; signing in there does not sign in dot's blocked browser. No credentials should be sent in chat.

### Where the owner enters the API key

The key belongs in **Google Cloud Console → Secret Manager → Create secret → Secret value**. The owner enters the value themselves; do not send it through chat or include it in a source archive. Use an existing approved secret if one already exists. A suggested new secret name, if separately approved, is `maison-gemini-api-key`. Record only the name and pinned version number for deployment, never the value. See Google's [Secret Manager console quickstart](https://docs.cloud.google.com/secret-manager/docs/create-secret-quickstart).

The Cloud Run service references that secret as the runtime environment variable `GEMINI_API_KEY`. `GEMINI_MODEL` is a separate non-secret setting containing the owner's available structured-output model code. In the console, this is configured in the service's container variables/secrets settings; the equivalent CLI flags are shown below. Creating a key, entering/storing credentials, granting persistent access, enabling billing and accepting relevant agreements remain explicit owner steps or separately confirmed actions.

## Enable Gemini only after reviewing data sharing and costs

Live guide requests transmit the typed shopping message, up to eight short history entries, language, department, per-item budget, style tags, selected demo SKU IDs and a curated fictional catalog to Google. The browser must obtain explicit consent before sending. Profile name, height, body measurements, address, browser-uploaded photographs and room photographs are not accepted by the API. Avoid entering sensitive personal information in shopping messages.

Use an **existing**, owner-approved Secret Manager secret with a pinned version and an existing dedicated runtime service account that already has access to that secret. The deployment command references the secret name; it never includes its value. Secret Manager permission changes or creation of credentials are separate security decisions and are not performed by this demo.

```bash
export GEMINI_MODEL="YOUR_AVAILABLE_STRUCTURED_OUTPUT_MODEL"
export RUNTIME_SERVICE_ACCOUNT="YOUR_EXISTING_SERVICE_ACCOUNT_EMAIL"
export GEMINI_SECRET_NAME="YOUR_EXISTING_SECRET_NAME"
export GEMINI_SECRET_VERSION="YOUR_PINNED_SECRET_VERSION"

gcloud run services update "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --service-account "$RUNTIME_SERVICE_ACCOUNT" \
  --set-env-vars "GEMINI_MODEL=$GEMINI_MODEL,GEMINI_TIMEOUT_MS=15000" \
  --set-secrets "GEMINI_API_KEY=$GEMINI_SECRET_NAME:$GEMINI_SECRET_VERSION"
```

Replace all placeholders first. The adapter only accepts a `gemini-…` model code, not a URL, so the key cannot be redirected to another host. See Google's [Cloud Run secrets guidance](https://docs.cloud.google.com/run/docs/configuring/services/secrets) and [GenerateContent API reference](https://ai.google.dev/api/generate-content).

To establish live connectivity, an authorized owner can submit a non-sensitive shopping query with the consent checkbox enabled, then inspect the response for `mode: "gemini"`, `externalCall: true`, and the chosen model. This is a real, potentially billable API call. Offline tests cannot prove quota, billing, model entitlement, or Google service availability.

## Optional scene images

`POST /api/scene` is a text-only adapter. It does not accept image uploads, image URLs, body measurements or a real-person reference. It produces an editorial concept, **not** virtual try-on, an accurate product photo or room-fit verification. It requires `ENABLE_IMAGE_GENERATION=true`, a key, an explicitly configured allowed native image model, and `consent.googleAI=true`.

The current adapter allowlist includes the model codes documented in Google's [native image-generation guide](https://ai.google.dev/gemini-api/docs/generate-content/image-generation): `gemini-2.5-flash-image`, `gemini-3.1-flash-image`, `gemini-3.1-flash-lite-image`, `gemini-3-pro-image`, and `gemini-nano-banana-2.1`. Availability and account entitlement must still be checked by the owner. The model catalog notes that some earlier models are restricted for new projects. Configuring an arbitrary model does not claim image support.

```json
{
  "prompt": "A serene reading corner in terracotta and brass",
  "productIds": ["ME-017", "ME-019"],
  "consent": {"googleAI": true}
}
```

Success returns a final Google image payload with bounded size, a permitted MIME type and matching file signature in `image.dataUrl`, with `generated: true`, `mode: "gemini"`, and a concept disclosure. Thought-image parts are excluded. Missing configuration, missing consent, unsupported model, timeout, blocked output or malformed image returns `mode: "unavailable", generated: false`; no placeholder image is passed off as a generated result. Keep the site's pre-generated editorial fallback labeled accurately. No scene API request was run while implementing this demo.

The image request uses `generationConfig.imageConfig.aspectRatio: "4:5"`, a string field explicitly documented in the API reference. Google's current REST examples and API reference disagree on string versus enum spellings inside the newer `responseFormat.image.aspectRatio`; the adapter avoids that ambiguity. Offline tests verify request structure but cannot establish live model compatibility.

## API contract

- `GET /api/health` or `/healthz`: health plus safe configuration metadata.
- `GET /api/status`: safe AI configuration metadata; no connectivity probe.
- `POST /api/guide`: `{message, language?, context?, history?, consent?}`. `context` may contain only `language`, `category` / `department`, `budget`, `occasion`, `styleTags`, and `selectedProductIds`. History entries use `{role: "user"|"assistant", text}`.
- Guide response: `{mode, externalCall, source:"demo_catalog", reply, productIds, reasons:[{productId,text}], products:[{productId,name,en,price,currency:"CNY",stock,inventorySource:"demo_catalog"}], warning?, model?}`.
- `POST /api/scene`: `{prompt, productIds?, consent?}`; returns an explicitly unavailable result or a validated image payload.

Validation limits: 16 KB request bodies, 1,200-character shopping messages, eight history entries at 600 characters each, 100-character occasion, eight selected SKU IDs, four scene SKU IDs, and 600-character scene prompts. No arbitrary extra fields. Provider JSON is bounded to 128 KB for guides and 8 MB for image responses, with a 4 MB decoded image ceiling. Keys are sent in a header to a fixed official Google host; redirects are denied. Server logs do not include requests, images, provider error bodies or credentials.

The example server limits requests per socket address to 20/minute and four concurrent requests per process. **These are demo guardrails, not production authentication or a distributed quota system.** Cloud Run instances and proxies complicate per-IP limits. For public live AI, use a reviewed authentication boundary, production rate limits, budget alerts, spend monitoring and API quotas. Cloud Run `--max-instances=1` bounds compute scaling but does not cap Gemini charges.

## Verify before a competition submission

1. Run `npm run test:backend`, the complete app tests, and `npm run build`.
2. Start the production Node server and test the actual built app on `/` plus `/api/health`.
3. Confirm the frontend clearly distinguishes local demo and Gemini response modes.
4. Verify all appointment/inventory/checkout state remains labeled fictional demonstration.
5. If using live Google AI, obtain consent, use a project-available structured-output model, and verify a real response once with a non-sensitive prompt under the owner's cost authorization.
6. Check real submission requirements independently. Deployment packaging does not establish competition eligibility, proof of Google API usage, a deployed public link, or submission completion.

## Official references checked during implementation

- [Gemini structured outputs and REST schema](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [Gemini GenerateContent API](https://ai.google.dev/api/generate-content)
- [Gemini model catalog](https://ai.google.dev/gemini-api/docs/models)
- [Native image generation](https://ai.google.dev/gemini-api/docs/generate-content/image-generation)
- [Cloud Run container configuration](https://docs.cloud.google.com/run/docs/configuring/services/containers)
- [Cloud Run source/container builds](https://docs.cloud.google.com/run/docs/building/containers)
- [Cloud Run secret configuration](https://docs.cloud.google.com/run/docs/configuring/services/secrets)

Documentation was checked on October 14, 2026. Recheck model names, access, pricing and deployment policies before enabling paid live mode.
