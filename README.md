# Forma — AI Architecture Workbench

A high-level, LabVIEW-inspired architecture MVP for AWS, Azure, Google Cloud, IBM, and generic tools. Connect components, run local fixtures, inspect payloads and failures, and prepare staging or production plans.

## Run locally

```sh
npm ci --ignore-scripts
npm run dev
```

Open the printed local URL. `npm test` checks dataflow, failure handling, import boundaries and revision gates. `npm run build` produces `dist/`.

## Try it

1. Run the default Azure flow in **Staging / Test**.
2. Select an executed block and inspect input/output payloads.
3. Choose **Missing input field** or **Access denied**, then run again.
4. Ask the guided assistant to **Add a business API**, apply its proposal, and test **Tool unavailable**.
5. Explore another provider, or mix library blocks manually. Connect output ports to input ports.
6. Export/import your project, undo edits, export a review brief, or export a production plan.

## Scope

Runs use deterministic local fixtures, not cloud services or a language model. Timings measure local simulation including an intentional visual delay, not cloud latency. The guided chat recognises provider templates, API insertion, review and test requests; it is not an LLM. Model OAuth/API keys, cloud accounts, MCP execution, pricing, deployment and real integration tests are planned. Connection settings collect no credentials. Production exports are descriptive JSON, not executable IaC. Configuration fields are design metadata only.

Projects persist in browser localStorage and can be exported as JSON. No backend, cross-device sync, accounts or multi-user isolation is implemented. Use illustrative data only.

## Open-source provenance

See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), [the source audit](docs/SOURCE_AUDIT.md), and [the integration plan](docs/INTEGRATION_PLAN.md). Six AWS/Azure catalogue descriptions are adapted from OpenArchFlow. The AWS architect workflow informs the design; AWS Labs MCP servers are described in a planned connector manifest, not bundled or running. This is selective integration, not a wholesale merge of three applications.

Original product code has no public open-source licence grant at this stage. Third-party material retains its own licences. A dependency notice inventory is generated from installed packages and shipped under `public/licenses/`. Commercial release remains subject to the unresolved items in the audit.
