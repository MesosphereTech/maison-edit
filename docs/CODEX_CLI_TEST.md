# Optional temporary Codex CLI test bridge

Checked 2026-10-14. This is a cloud-workspace test adapter, separate from the static Sites preview.

## Verified findings

- Installed official CLI: `codex-cli 0.159.2`.
- Official `codex login status`: logged in using ChatGPT. No credential file or token was read, copied or displayed.
- Actual synthetic HTTP guide test reached the CLI process, but initialization failed with `Read-only file system (os error 30)` before model inference. The adapter returned labeled local-demo recommendations, `warning: runtime_read_only`, `invocationAttempted: true`, `externalCall: false`.
- Actual image-input analysis attempt is subject to the same runtime blocker. Selected image inputs are original fictional presets, never user uploads.
- CLI image generation remains unverified and disabled. The scene endpoint returns `generated: false` with `cli_image_generation_unverified`; it never substitutes a pre-generated image as a new live result.
- The backend test suite includes independent input, consent, catalog, status and CLI-failure tests using fake transports. These passing tests do not establish live model success.
- Structured real-smoke evidence is saved in `artifacts/codex-cli-live-smoke.json`. No credentials, CLI transcript or raw reasoning is retained there.

## What the bridge allows

`MAISON_AI_PROVIDER=codex-cli` and `CODEX_CLI_TEST_ENABLED=true` explicitly opt into temporary owner-only testing. The Node server binds loopback; CLI API requests from non-loopback addresses are refused. The fixed official binary is spawned with argument arrays and no shell interpolation. Model selection is fixed to `gpt-6.1-sol` with low reasoning effort. No account entitlement, price or billing behavior is assumed verified.

Each request needs `consent: { openAI: true }`. Only fixed persona/home/room identifiers from `src/presets.js` are accepted. Request-supplied image uploads, image URLs, filesystem paths, command arguments and executable names are rejected.

The guide sends synthetic preset metadata plus eligible fictional catalog records. Analysis attaches only the selected fixed persona JPEG and selected room JPEG. Floorplans are synthetic metadata; SVG diagrams are not claimed to have been visually measured. Dining/study selections use the home's living-room reference and retain the selected room in metadata.

Codex runs with ephemeral sessions, a read-only sandbox, temporary schema/output files and disabled shell, apps/plugins, web search, browser/computer use, subagents, hooks, memories and image generation. Process duration/output size are bounded. Temporary non-auth files are removed after each invocation. Generated prose is checked; product prices and stock are always canonical fictional catalog fields.

## Status and endpoints

- `GET /api/status`: identifies provider/model and synthetic/test-only scope. `configured` means the test adapter was enabled; `usable` remains false until a successful validated real output. `canAttemptGuide` / `canAttemptAnalysis` permit a clearly labeled first connection test without claiming usability. A known runtime failure marks connection blocked and prevents UI retry availability.
- `POST /api/guide`: existing message/context/history/language fields, plus `presetContext: { personaId, homeId, room }` and OpenAI consent. Successful live mode is `codex-cli`; fallback mode is always `demo` with the reason.
- `POST /api/analyze`: personaId/homeId/room/language and OpenAI consent. Successful output has summary, observations, styleTags and recommendedKinds. Blocked output has `analyzed: false` and no invented analysis.
- `POST /api/scene`: truthfully unavailable while image generation is unverified.

## A supported fresh-login route, requiring the owner's approval

The official documentation supports creating a separate empty writable `CODEX_HOME` directory and performing a fresh user-assisted `codex login --device-auth` on a headless machine. This does not reuse or copy the existing credential cache. The owner must open the official generated login link, enter the one-time device code and approve temporary account access. Device-code login must already be allowed by the account/workspace; no security setting is changed automatically. Login and network availability in this sandbox have not been established.

With a successful fresh login, the same temporary `CODEX_HOME` can run the loopback test server and cloud Chromium for genuine browser/guide/image-input tests. At the end, sign out of that temporary CLI login and remove its temporary state as authorized. Do not package credentials into Docker, a repository, static files or a deployed Worker.

## Hosting boundary

The published static Sites preview cannot run a Node child process or reuse a cloud-workspace CLI login. Loopback testing here can establish actual model behavior, but does not make the published preview live. A hosted experience needs a separately authorized secure backend/runtime with supported authentication and access controls. No new key, service account, OAuth grant, paid backend, tunnel or deployment security change was created by this work.

Official references:
- [Non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [CLI command reference](https://learn.chatgpt.com/docs/cli/reference)
- [Authentication and headless device login](https://learn.chatgpt.com/docs/auth)
- [Codex environment locations](https://learn.chatgpt.com/docs/config-file/environment-variables)
