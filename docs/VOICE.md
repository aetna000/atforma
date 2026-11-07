# Voice conversation: implementation and verification

7 November 2026; source baseline `661324c`, development branch `fix/voice-conversation`.
No application version bump or package release is part of this correction.

The old microphone only dictated into the composer. Its recognition `onend`
unconditionally switched off listening; there was no automatic submission,
spoken reply or next-turn capture. The new browser-owned conversation controller
implements that turn-taking loop through the existing architect request path.

- Explicit Start and browser speech-processing consent; use the normal browser
  microphone permission. On-device recognition is preferred when already available.
- Confirmed transcripts send after a 1.1-second pause or normal service end. Interim
  words remain an editable draft. No user text is sent merely because capture failed.
- Normal recognition endings restart with bounded backoff. Repeated immediate
  endings and permission/device/network problems show persistent actionable status.
- Actual architect reply text is spoken in chunks. Capture is disabled during the
  request and playback; Interrupt and speak cancels playback and reopens capture.
- Stop cancels pending capture/send/restart/playback. Generation fences prevent
  late callbacks/results from restarting voice. Typing, replacing projects and
  unmount also stop voice. A turn already submitted can still complete in chat.
- Speech/provider support is browser-dependent. The browser may send audio and
  playback text to its provider. No raw audio is stored by the app or sent to the
  sidecar. Confirmed transcripts follow existing chat/memory rules. No new paid
  speech API, dependency, model account or public deployment was introduced.
- This is spoken turn-taking, not simultaneous full-duplex speech. Interruption
  uses an explicit button. Acoustic quality, OS permissions, device selection and
  browser-provider availability need a real microphone/speaker check.

## Evidence

- `npm test`: 128 passing tests, including 18 voice-controller tests. They cover
  two turns, ended/no-speech recovery, repeated endings, partial drafts, debounce,
  permission/device/network errors, stop/stale events, late model replies,
  interruption, playback failure, unsupported APIs and speakable text.
- `npm run test:server`: 45 passing tests. No sidecar contract changed.
- `npm run test:voice`: passed against an isolated frontend with synthetic browser
  speech and architect transports. The real React composer/send path produced two
  distinct requests, spoke returned reply text, resumed capture, interrupted and
  stopped correctly, preserved drafts and displayed permission/network errors.
  Consent was required once. Mobile error text fits a 390px viewport; desktop and
  mobile screenshots were inspected. No physical audio/provider invocation claimed.
- Existing isolated real-AtMem browser journey passed: discovery, diagram,
  requirements, clouds, memory/history/forget, save/reset and mobile. Its model and
  prices are fixtures. Two stale branding expectations (header control and light
  theme colour) were aligned with the already released interface.
- Production build passed. Existing React Flow directive and bundle-size
  advisories remain non-fatal. `git diff --check` passed.

The combined browser gate also runs the independent delivery/export journey.
Its mobile Outputs overflow result is recorded separately below; do not conflate
that result with the voice journey or claim a green combined browser gate.

Confirmed pre-existing blocker: `scripts/delivery-smoke.mjs:100` asserts no mobile
horizontal overflow in Outputs. Both the changed tree and an isolated detached
checkout of unchanged `661324c` fail that same assertion (`true !== false`). The
baseline used the same fixture scenario against its own frontend (port 5199),
with an isolated Vite cache and React deduplication. The earlier baseline startup
with shared dependency cache failed before the UI loaded and was not used as
regression evidence. No assertion was removed or skipped. Combined browser gate
remains red for this existing Outputs layout issue; no all-green/merge claim.

Local test logs/screenshots: `/private/tmp/architect-voice-*.log` and
`/private/tmp/atmem-architect-voice/`. These are temporary operator evidence, not
bundled production assets. The real service at port 5174 was not stopped/restarted;
source changes are served by its existing Vite development process. Refresh the
page, start voice and allow microphone access to check real hardware/browser speech.
