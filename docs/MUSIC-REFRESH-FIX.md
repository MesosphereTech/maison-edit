# Music activation, refresh and playlist fix

## Verified defect

The v17 unlock listener was installed only after an asynchronous autoplay denial, in the document bubble phase. The first trusted interaction could happen before that listener existed. Guided image swaps stop propagation, and keyboard focus traps can prevent default before a bubble listener sees them. In these cases the MP3 loaded and decoded successfully, but the audio stayed paused at time zero.

An untouched v17 checkout reproduced all four regression cases, including a real Chromium autoplay-policy case: successful audio/mpeg requests and readyState 4, paused true, currentTime 0. This was an activation failure, not missing sound assets or a disabled default.

## Scope of the fix

- Arm the trusted-gesture listener at React commit, using capture before setup or guide controls consume the event.
- Handle a first gesture while the initial autoplay attempt is still pending. A request token prevents a later stale rejection from canceling successful playback.
- Disarm synchronously after success or an explicit in-page pause/mute. Touchend/click pairs cannot double-start the recording.
- Keep pending-policy status from being overwritten by a late waiting event.
- On every full page load, start enabled and unmuted at the beginning. Keep the selected recording and positive volume; a saved zero volume returns to the normal 18%. This deliberately replaces the prior cross-refresh pause/mute rule at the user's request.
- Within the current page, explicit pause/mute/zero volume remain respected, including store/visit navigation. The same audio element and recording position continue through navigation.
- Remove the one-recording loop. Actual natural completion advances Atrium → Gallery → Salon → Atrium. An explicit pause never advances; the naturally ended pause event does not erase the active playlist intent.

No audio files, external services, sharing settings, storefront content or AI configuration were changed. Browser policy may still require a genuine interaction; the implementation does not bypass that policy.

## Checks

- Unit policy tests cover per-load defaults, preserved in-page choices, selected-track/volume retention and playlist wrapping.
- Existing music browser tests cover playback, decoding, pause/resume, errors/retry, track selection, keyboard access and mobile layout, updated for the new refresh rule.
- Focused onboarding tests cover delayed autoplay rejection, model/language/entry clicks, swallowed guide clicks, trapped Tab, actual Chromium activation policy, refresh, navigation continuity and actual ended-driven playlist changes.
- Cloud Run packaging validation is an independent fix documented in GOOGLE_DEPLOYMENT.md.

All browser playback checks use actual local MP3 decoding and advancing media time, not toggle state alone. They do not establish physical speaker output or Safari/device-specific behavior.
