# Integration plan

## Implemented first slice

- Provider-neutral graph and catalogues: AWS, Azure, Google Cloud, IBM and generic tools.
- Browser canvas, connections, undo, JSON import/export and local persistence.
- Revision-bound, explicitly accepted guided-demo proposals.
- Graph-based fixture execution, input/output inspection, explicit failed/skipped steps.
- Design → Staging/Test → Production-plan workflow with stale-run invalidation.
- Original icons composed with Lucide; no cloud brand icon packs.

## Next implementation slices

1. Backend identity and per-workspace access control; encrypted credential references; project persistence and audit events. Never put keys into graph data or browser storage.
2. Agent adapter contract: messages, structured tool calls, streaming events, approvals, cancellation, quotas, and accounting. Use direct provider APIs first, then separately scoped Copilot/eligible OAuth adapters. Verify provider integration terms before offering subscription login.
3. Read-only cloud discovery adapters for Azure, AWS, Google Cloud and IBM. Keep observed inventory separate from proposed graph state. Normalise capabilities, not incompatible service contracts.
4. MCP tools through an isolated, allowlisted gateway; selected pinned AWS Labs servers only. Review per-server licences, notices, dependencies, transport, IAM and tool semantics. Add equivalent connectors for other providers; do not claim cloud parity before implementation.
5. Provider-native schema and connection validation, pricing evidence with regions/dates/assumptions, and grounded architectural review.
6. Real staging adapters and isolated runners: explicit test data, deployed resource identity, full execution traces, cost limits, timeouts, cancellation and cleanup. Simulation remains separate from cloud integration evidence.
7. Terraform/provider-native deployment adapters and reviewable change plans. Staging integration tests, human approval, target account verification, rollback/recovery and revision-bound promotion precede production changes.

## Execution semantics

The current runtime follows a directed acyclic graph with one input per non-source node. Invalid structure blocks execution. Each node transforms a payload; failed parents block descendants. Sources, prediction fixtures, explanation templates, policy checks, output assertions and REST fixtures are supported. Mixed-provider designs are allowed but do not establish interoperability. Cycles, merges and real endpoint calls require future typed execution adapters.
