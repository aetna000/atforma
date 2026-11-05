# Local integration verification — 2026-11-01

- `npm test`: 26 passing tests, covering five fixture patterns, graph failures, import boundaries, upstream catalogue/templates/parsers/layout/formatter, proposal revisions, Pulumi metadata handling and request projection.
- `npm run test:server`: 16 passing tests, including Host/Origin/token boundaries, credential memory handling, strict proposals, upstream retry behaviour, and local CLI adapter command construction.
- `node scripts/smoke.mjs`: browser checks pass for connected runs, failure propagation and payloads, Google Cloud proposals, tool insertion/failure, local persistence, architecture imports, upstream templates, front-panel indicators/scenario controls, run cancellation, JSON plans, Pulumi scaffold download/snapshot import, connection disclosures, mobile layout, and zero external browser requests during the zero-key smoke flow.
- A scoped axe check of the initial desktop workspace reports no WCAG A/AA violations after correcting contrast. This is not a complete accessibility certification of every dialog and state.
- `npm run build`: passes. React Flow's ignored `use client` directive and a bundle-size advisory are non-fatal build messages.
- `npm audit`: zero reported Node vulnerabilities at verification time. `pip check`: no broken Python requirements. These are not a complete security audit or a Python vulnerability scan.
- Claude Opus 5.5: design consultation completed through the official installed client; exact model confirmed in its returned usage metadata. The resulting brief is in `CLAUDE_5_5_DESIGN_REVIEW.md`.
- Live account requests: Claude Code (`claude-opus-5-5`) and Codex (`default`) returned valid architecture responses. Copilot reached a model but initially rejected an optional-field response schema; the adapter was changed to strict required fields and a live Copilot SDK response then passed the shared response model.
- Verified client versions: Claude Code 2.1.281, Codex CLI 0.166.0, Copilot CLI 1.0.103 (SDK 1.0.28), Gemini CLI 0.46.0.
- Gemini CLI transport starts but reports an authentication requirement on this workstation. It needs the user's official `gemini` sign-in before live use; no successful Gemini account request is claimed.
- Direct API adapters are constructor/import and boundary-tested, not live-tested with private API keys. No customer API keys were supplied or used.
- No cloud workload calls, AWS Labs MCP execution, live pricing, Pulumi CLI command, infrastructure deployment, atmem.ai change or new hosted publication was performed.

The local browser server is intended to remain running for the user's review. The earlier private Sites preview is an older milestone and was not updated by this integration.
