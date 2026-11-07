# Acceptance evidence

- [x] Visible user bubbles and safe formatted architect responses.
- [x] Clipboard image paste, document upload and explicit Send verified in `scripts/chat-browser-check.mjs`.
- [x] Transcript survives browser refresh; names retained without attachment bytes.
- [x] Project-file round trip, unchanged revision, separate projects and 40-turn preservation verified in `tests/conversation.test.mjs`.
- [x] Compact desktop/mobile controls and separate dialog close checked with browser bounding boxes and screenshots.
- [x] Server attachment validation and native transport contracts: 108 server tests passed.
- [x] Actual Codex vision identified the image label and document constraints; see evidence/live-vision.json. This is model evidence, not deployment evidence.

Screenshots and fixture browser results are in evidence/. Real cloud deployment and live vision on other connectors are not claimed.
- [x] Final regression: 188 JavaScript tests, 108 server tests, voice/main journey/delivery browser suites and production build passed. Build retains the existing large-chunk warning.
