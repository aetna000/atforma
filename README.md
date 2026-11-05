# Atforma — local AI stack consultant (atmem.ai)

Atforma helps you design, and eventually deploy, an AI solution that fits your existing systems. You describe what you want in your own words; the architect asks a few easy questions at a time ("not sure" is always fine), sketches a first design, and leads you through **Sketch and document → Cloud options → Country and concrete service architecture → Review → Estimate → Delivery draft**. Everything is kept in one project file you can reopen and regenerate outputs from. Runs locally; nothing is deployed.

The architect's know-how lives in [`agent-skills/`](agent-skills): a discovery skill (what to ask, in what order, in plain language, and what to assume when unsure) and workflow skills (knowledge assistant, document processing, prediction, agentic automation). The connected model uses them alongside a small reviewed specialist registry for architecture, security, FinOps, DevOps and all four clouds.

## Start

Prerequisites: Node 22.12+ and Python 3.11+. Current local verification uses Node 26 and Python 3.14.

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
npm run setup:memory
npm run local
```

On Windows use `.venv\\Scripts\\python.exe` for installation. The launcher selects the virtualenv executable for the operating system. Windows execution has not been browser-tested.

Open **http://127.0.0.1:5174**. The sidecar binds to **127.0.0.1:8766**. `npm run dev` runs the zero-key frontend alone; model access needs the sidecar.

## Choose an architect

In **Connections**, choose Local patterns, an official account client, or a model API key. Local patterns work without keys. Install/sign in to the desired official client once:

```sh
claude auth login
codex login
copilot login
gemini
```

Use only commands for providers you want. Atforma uses their supported native authentication; it does not extract tokens or implement a generic subscription OAuth proxy. Installation and subscription do not guarantee a particular model is available. Choose `default` for a native client's default model or enter an accessible model ID.

For API access, enter a Claude/OpenAI/Gemini key in the local dialog (sidecar memory only), or supply `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` or `GEMINI_API_KEY` to the sidecar environment. Do not put keys in project data or source control. API billing is separate from account subscriptions. Bedrock is an optional explicit `ATFORMA_ENABLE_BEDROCK=1` + AWS SDK configuration path.

## Try it

1. **Describe your idea in chat.** The connected architect draws a first sketch and asks one useful question at a time. Answer in your own words. No default blocks are inserted by the local UI.
2. **Work on the diagram together.** Add blocks and right-click comments; with **Draw as we talk** enabled, semantic edits are sent to the architect after a short pause. Routine moves do not trigger a consultation. Requirements are a short read-only working summary derived from the current design, with **Discuss** and **Clarify with Atforma** continuing in chat. Your answers update the working requirements. Opening **Options** asks for a provisional comparison of the current approach, AWS, Azure, Google Cloud and IBM; scores are architectural judgements, not price quotes.
3. **Review.** Findings grouped by security, reliability, availability, scalability, performance, maintainability and cost, each with its rule and an action. Accept a risk with a reason and an owner. **Test run** runs designs that have sample-data fixtures (predictive-maintenance and analytics templates).
4. **Estimate.** The architect asks about the largest missing usage or scope assumption in chat. Supported storage list prices are retrieved for the explicit provider/region; the summary shows costs and gaps. Optional worksheet inputs and sources are available in a collapsed inspector. Start with a ROM using stated low/high factors. Refine with detailed cloud charge lines (input/output tokens, compute, requests, storage and transfer), each with quantity, unit, currency, service, region, date and price source. Detailed lines replace the coarse ROM line for that component. Mixed currencies are never summed; stale prices and uncosted components are flagged. Enter one-off consulting/build person-days, rates and scope separately; no prices or effort are invented.
5. **Delivery draft.** Inspect the diagram-derived resource schedule and engineering gaps. **Download delivery pack** exports the specification, diagram, architecture/deployment document, decisions, estimate JSON, resource schedule, handoff checklist, editable project and Terraform sketch from one snapshot. Change the project and regenerate. A manifest identifies each snapshot, design revision and generation time. Nothing is provisioned.

Use **Undo / Redo** for board changes (Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z). A new board edit clears redo; discovery records and estimates stay intact. **Start over** in the top bar offers to save a project file, or cancel, before clearing the board, chat, requirements, decisions and estimates. The model connection stays. Project boundaries start a separate undo history.

## AtMem

Open **⋯ → AtMem dashboard** for About you, This project, Skills and Activity. This is Atforma's scoped dashboard over the real AtMem 2.3.10 SDK, not the separate upstream operator dashboard. AtMem uses its own `.memory-venv` because its crypto dependencies differ from the model SDK environment. App-owned memory is stored under `~/.atforma/memory` (or `ATFORMA_HOME/memory`); the existing `~/.atmem` store is untouched.

Only explicit reusable preferences, accepted project decisions, explicitly authored must-have requirements and budget limits qualify for personal/project memory. Drafts, block positions, canvas comments and routine turns are excluded. You can explicitly say **Remember about me: …**, inspect current/earlier values, preview forgetting, and turn memory off per project. Durable pending updates retry after an outage; content entered while opted out is not replayed. An unavailable memory runtime leaves the architect working from the current project.

The specialist registry is hash checked, has per-skill enable/disable controls, and stores reviewed guidance in a separate AtMem knowledge scope. Pinned upstream skills and their licences are preserved as reference-only assets. The app's bounded broker exposes memory lookup, project read, skill lookup and supported storage price lookup. It has no deployment or shell tool. Per-turn expandable receipts show the context Atforma supplied; they cannot attest to a native client's hidden internal prompt.

Current automated storage pricing covers AWS S3 Standard and Azure Blob Hot LRS in an exact supported region/tier. Google Cloud Catalog lookup needs `GOOGLE_CLOUD_BILLING_API_KEY`; IBM needs an exact sourced quote. Missing rates remain explicit gaps. These are storage lines, not a complete infrastructure estimate, and rates are never borrowed across providers.

## Project files

**⋯ → Save project file** writes `<name>.atforma.json` (format `atforma.project` 2.2.0): design, discovery, requirements, assumptions, open questions, decisions with history, and options. **Open project file** restores it exactly, upgrades older workbench files, refuses newer major versions, and keeps unknown fields. Files containing anything that looks like a credential are refused on save and open. Schema: [`specs/002-project-model/contracts/project-file.schema.json`](specs/002-project-model/contracts/project-file.schema.json).

## Specifications

Product direction lives in Spec Kit: the [constitution](.specify/memory/constitution.md) and numbered features in [`specs/`](specs/README.md) (discovery, project model, review, estimate, deployment document, AtMem memory, deployment plan, agent runtime). Use `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` for new features.

## Checks

```sh
npm test
npm run test:server
npm run test:browser  # isolated real AtMem journey + delivery scenarios; model and quote fixtures
npm run test:terraform # optional: Terraform 1.7+, provider schema and mock-plan checks only
npm run build
npm run notices
```

`python scripts/live-account-check.py PROVIDER MODEL` is an opt-in live smoke check using the running sidecar; it incurs provider usage. Do not run it automatically in CI.

## Scope and deployment

Local fixture runs are deterministic examples, not cloud tests. Architect model requests are real only when explicitly selected and sent. Cloud inventory discovery, executable MCP integrations, full service pricing coverage, provider-native Pulumi resources, real staging tests and deployment remain unimplemented. Pulumi output is a metadata scaffold. Terraform JSON exports native S3 bucket foundations (public-access block, encryption and versioning) for explicitly drawn proposed AWS S3 blocks. Other resources, existing-resource references and every application connection are listed as unfinished; a review gate blocks planning until reviewed and completed. It is not a complete deployable AI application. Imported stack metadata is not a live refresh or a complete round trip.

The browser stores projects locally; there is no workspace account service or cross-device sync. This is a single-user localhost application. See [self-hosting](docs/SELF_HOSTING.md) before deploying the workbench yourself. The browser application and the infrastructure drawn on its canvas have separate deployment lifecycles.

## Provenance and commercialisation

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [the merge manifest](docs/merge-manifest.json), [source audit](docs/SOURCE_AUDIT.md), [local architecture](docs/LOCAL_ARCHITECTURE.md), and [Claude Opus 5.5's design review](docs/CLAUDE_5_5_DESIGN_REVIEW.md). Imported upstream licences are preserved; no vendor branding assets are bundled. Original product code has no public open-source licence grant. The product is not commercially cleared by this preliminary engineering inventory.

Options and Design choices are read-only conversational outputs. The architect receives the active view, authors structured requirement proposals from the chat and graph, and refreshes cloud comparisons as answers arrive. Confirmed requirements are preserved; diagram revisions are retained separately from actual choices.

Requirements have stable REQ numbers, retained across document revisions and project saves. Early proposals are collected under **Suggestions still to discuss**. Each requirement includes its rationale and basis when available, with **Explain why we need this** continuing the interview. The local fallback proposes only access and data-location considerations for relevant diagram components; it no longer creates a requirement for every block.

Use **Comment or request a change**, or select requirement text and right-click **Comment on selected text**. **Suggest a revision** saves the feedback and asks Atforma for new wording. The current document remains unchanged while you inspect current/proposed text and choose **Apply this revision** or **Keep current wording**. **Save for later** leaves feedback pending. Applied and dismissed suggestions are kept in Feedback history. Comments and proposals survive save/open; stale suggestions cannot overwrite a newer requirement. Document reviews do not apply board, estimate or cloud-choice updates.

## Guided progression

A new project shows the design workspace. The journey strip above the board stays visible with chat open or closed: **Sketch & document → Cloud options → Country & region → Cloud architecture**. It highlights the current stage and gives the next action. Sketch and requirements evolve together; **Continue to cloud options** acknowledges a working scope from either the board or document. The architect compares actual service combinations across AWS, Azure, Google Cloud and IBM. **Preview service architecture** draws an alternative as a pending preview; it does not select a cloud or overwrite the current board.

Click any reached stage in the journey strip to revisit it. Use **Choose AWS & continue →** (or the equivalent Azure, Google Cloud or IBM action) to select a provider and return to the guided conversation. Revisiting Cloud options shows the selected provider and **Continue with [provider] →**; you can choose another provider there. After the cloud choice, Atforma asks about country/residency and refines the board into named services, placement and labelled interactions. Review appears after the user continues with that service design. Estimate follows the risk discussion; Delivery draft follows the cost discussion. These checkpoints acknowledge working drafts, including open risks and cost gaps; they are not claims of verified cloud compatibility or permission to deploy. Revising scope or service architecture reopens the relevant earlier step. Progress is stored in the project file.

See [guided journey implementation and validation](docs/GUIDED_JOURNEY.md). `python -m scripts.live-guided-check codex` is an opt-in real account check using synthetic data; it incurs model usage and never deploys resources.
