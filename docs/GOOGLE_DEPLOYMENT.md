# MAISON ÉDIT · Google AI / Cloud Run deployment

This repository contains a fictional luxury department-store demo, a server-only Gemini adapter, and a multi-stage Cloud Run container. It is **packaged for deployment; it has not been deployed or live-tested against Google**. All backend tests use mocked HTTP responses and require no credentials.

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
