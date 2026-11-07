# Guided discovery voice correction plan

Scope: implement FR-008–FR-011 within the existing discovery journey. Keep the
connected model, memory and proposal contracts unchanged; no new paid service,
API credentials, audio storage or runtime dependency.

Use a framework-free, dependency-injected VoiceConversation state machine for
starting/listening/reconnecting/thinking/speaking/off/error. The browser owns
SpeechRecognition and SpeechSynthesis. Final transcripts debounce into the existing
send path; the returned actual model message is spoken in bounded chunks. Pause
capture during playback; explicit interruption returns to listening. Generations
fence late callbacks and every stop cancels timers and capture/playback. Bound
rapid restart attempts and surface permission, network and playback failures.

React supplies the latest send callback via a ref, displays a persistent live status
and accessible Start/Stop/Interrupt controls. Consent explains browser-provider
processing; prefer available on-device recognition and installed local voices.
Typed input and changing projects stop capture. Avoid async capability probing
inside the start click, preserving user activation where browser policy requires it.

Constitution check I–VIII: voice is opt-in and stoppable; real reply only, with
fixture limitations disclosed; existing project is canonical; browser speech is
explicitly consented external processing, not a local-only claim; provider and
browser limits remain visible; memory semantics unchanged; status is accessible;
state transitions and browser journey have regression tests. No sidecar boundary
changes or dependency/notice changes.

Validation: controller tests including stale callbacks and actual React browser
integration with synthetic speech/architect transports; full node suite, sidecar
suite, existing browser journeys and production build. Real microphone/OS audio
and live provider speech quality need an operator check on the running local app.
