# Atforma — local AI stack consultant (atmem.ai)

Atforma helps you design, and eventually deploy, an AI solution that fits your existing systems. You describe what you want in your own words; the architect asks a few easy questions at a time ("not sure" is always fine), sketches a first design, and works through **Discover → Design → Review → Estimate → Deploy** with you. Everything is kept in one project file you can reopen and regenerate outputs from. Runs locally; nothing is deployed.

The architect's know-how lives in [`agent-skills/`](agent-skills): a discovery skill (what to ask, in what order, in plain language, and what to assume when unsure) and workflow skills (knowledge assistant, document processing, prediction, agentic automation). The offline planner and a connected model both use them.

## Start

Prerequisites: Node 22.12+ and Python 3.11+. Current local verification uses Node 26 and Python 3.14.

```sh
npm ci --ignore-scripts
python3 -m venv .venv
.venv/bin/python -m pip install -r server/requirements.txt
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

1. **Discover.** Answer "What would you like to build?" in a sentence. Answer the follow-ups, or press **Not sure**, **Why?** or **Skip**. What you say appears under *What I understand so far* (editable); numbers become usage inputs and statements like "within 5 seconds" become requirements. Press **Sketch it** when offered.
2. **Design.** The board starts at **System**; double-click to open a layer, then a block. *Draft on AWS / Azure / Google Cloud / IBM* proposes alternatives; every applied change is a decision you can revise. Requirements, Options and Decisions sit beside the board.
3. **Review.** Findings grouped by security, reliability, availability, scalability, performance, maintainability and cost, each with its rule and an action. Accept a risk with a reason and an owner. **Test run** runs designs that have sample-data fixtures (predictive-maintenance and analytics templates).
4. **Estimate.** Start with a ROM using visible low/high factors. Refine with detailed cloud charge lines (input/output tokens, compute, requests, storage and transfer), each with quantity, unit, currency, service, region, date and price source. Detailed lines replace the coarse ROM line for that component. Mixed currencies are never summed; stale prices and uncosted components are flagged. Enter one-off consulting/build person-days, rates and scope separately; no prices or effort are invented.
5. **Deploy.** Inspect the diagram-derived resource schedule and engineering gaps. **Download delivery pack** exports the specification, diagram, architecture/deployment document, decisions, estimate JSON, resource schedule, handoff checklist, editable project and Terraform sketch from one snapshot. Change the project and regenerate. A manifest identifies each snapshot, design revision and generation time. Nothing is provisioned.

Use **Undo / Redo** for board changes (Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z). A new board edit clears redo; discovery records and estimates stay intact. **Start over** in the top bar offers to save a project file, or cancel, before clearing the board, chat, requirements, decisions and estimates. The model connection stays. Project boundaries start a separate undo history.

## Project files

**⋯ → Save project file** writes `<name>.atforma.json` (format `atforma.project` 2.2.0): design, discovery, requirements, assumptions, open questions, decisions with history, and options. **Open project file** restores it exactly, upgrades older workbench files, refuses newer major versions, and keeps unknown fields. Files containing anything that looks like a credential are refused on save and open. Schema: [`specs/002-project-model/contracts/project-file.schema.json`](specs/002-project-model/contracts/project-file.schema.json).

## Specifications

Product direction lives in Spec Kit: the [constitution](.specify/memory/constitution.md) and numbered features in [`specs/`](specs/README.md) (discovery, project model, review, estimate, deployment document, AtMem memory, deployment plan, agent runtime). Use `/speckit-specify`, `/speckit-plan`, `/speckit-tasks` and `/speckit-implement` for new features.

## Checks

```sh
npm test
npm run test:server
npm run test:browser  # full journey + delivery scenarios; Chrome on macOS or Playwright Chromium
npm run test:terraform # optional: Terraform 1.7+, provider schema and mock-plan checks only
npm run build
npm run notices
```

`python scripts/live-account-check.py PROVIDER MODEL` is an opt-in live smoke check using the running sidecar; it incurs provider usage. Do not run it automatically in CI.

## Scope and deployment

Local fixture runs are deterministic examples, not cloud tests. Architect model requests are real only when explicitly selected and sent. Cloud inventory discovery, MCP tools, live pricing, provider-native Pulumi resources, real staging tests and deployment remain unimplemented. Pulumi output is a metadata scaffold. Terraform JSON exports native S3 bucket foundations (public-access block, encryption and versioning) for explicitly drawn proposed AWS S3 blocks. Other resources, existing-resource references and every application connection are listed as unfinished; a review gate blocks planning until reviewed and completed. It is not a complete deployable AI application. Imported stack metadata is not a live refresh or a complete round trip.

The browser stores projects locally; there is no workspace account service or cross-device sync. This is a single-user localhost application. See [self-hosting](docs/SELF_HOSTING.md) before deploying the workbench yourself. The browser application and the infrastructure drawn on its canvas have separate deployment lifecycles.

## Provenance and commercialisation

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [the merge manifest](docs/merge-manifest.json), [source audit](docs/SOURCE_AUDIT.md), [local architecture](docs/LOCAL_ARCHITECTURE.md), and [Claude Opus 5.5's design review](docs/CLAUDE_5_5_DESIGN_REVIEW.md). Imported upstream licences are preserved; no vendor branding assets are bundled. Original product code has no public open-source licence grant. The product is not commercially cleared by this preliminary engineering inventory.
