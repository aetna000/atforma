import { estimate, consultingEstimate } from "./estimate.mjs";
import { resourcePlan } from "./resources.mjs";

export function toAgentProject(p) {
  return {
    version: 1,
    revision: p.revision,
    name: p.name.slice(0, 200),
    provider: p.provider || "tools",
    ...(p.domain ? { domain: p.domain } : {}),
    requirements: String(p.requirements || "").slice(0, 8000),
    nodes: p.nodes.map((n) => ({
      id: n.id,
      type: "resource",
      position: n.position,
      data: {
        label: n.data.label,
        kind: n.data.kind,
        provider: n.data.provider,
        description: String(n.data.description || "").slice(0, 1000),
        config: {
          region: n.data.config?.region || "To be selected",
          classification: ["Public", "Internal", "Confidential"].includes(
            n.data.config?.classification,
          )
            ? n.data.config.classification
            : "Internal",
          timeout: 5000,
        },
        inputPosition: n.data.inputPosition || "left",
        outputPosition: n.data.outputPosition || "right",
        origin: String(n.data.origin || "proposed").slice(0, 100),
        ...(n.data.service ? { service: n.data.service } : {}),
        ...(n.data.category ? { category: n.data.category } : {}),
        ...(n.data.poc ? { poc: true } : {}),
        ...(n.data.role ? { role: n.data.role } : {}),
        ...(n.data.measures?.length ? { measures: n.data.measures } : {}),
      },
    })),
    edges: p.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "smoothstep",
      label: String(e.label || "data").slice(0, 150),
    })),
  };
}
// Read-only records for the architect: it may only change them through a proposal.
export function agentContext(p) {
  const item = (type, id, text) => ({ type, id: String(id).slice(0, 60), text: String(text).slice(0, 1000) });
  const measure = (m) => (m ? ` [${m.metric} ${m.op} ${m.target}${m.unit || ""}]` : "");
  const costs = estimate(p), work = consultingEstimate(p), resources = resourcePlan(p);
  return [
    item("discovery", "estimate-summary", `Current estimate stage: ${costs.maturity}. Monthly cloud subtotal ${costs.expected ?? "unknown"} ${costs.currency || "currency unresolved"}; range ${costs.low ?? "?"}–${costs.high ?? "?"}; ${costs.gaps.length} worksheet gaps. One-off consulting/build subtotal ${work.expected ?? "unknown"} ${work.currency}; ${work.complete ? "all phases entered" : "incomplete"}. Values are user inputs, not provider quotes. UI: Estimate for charges/effort; Deploy for the downloadable delivery pack and Terraform sketch.`),
    ...costs.gaps.slice(0, 5).map((g, i) => item("question", `cost-gap-${i}`, g)),
    item("discovery", "infrastructure-coverage", `${resources.rows.length} diagram components; ${resources.gaps.length} infrastructure/integration gaps. Native Terraform coverage is AWS S3 foundations only. Deployment is not connected.`),
    ...(p.needs || []).map((r) => item("requirement", r.id, `${r.priority} ${r.kind} ${r.category}: ${r.statement}${measure(r.measure)} (${r.status})`)),
    ...(p.assumptions || []).map((a) => item("assumption", a.id, `${a.statement} (stated ${a.madeAt})`)),
    ...(p.openQuestions || []).filter((q) => q.status === "open").map((q) => item("question", q.id, q.question)),
    ...(p.decisions || [])
      .filter((d) => d.status !== "Superseded")
      .map((d) => item("decision", d.id, `${d.subject} — ${d.title}: ${d.decision} (${d.status}${d.owner ? `, owner ${d.owner}` : ""})`)),
    ...(p.lastAsked?.question ? [item("discovery", "next-question", `Planner's next question (${p.lastAsked.topic}): ${p.lastAsked.question} Beginner wording: ${p.lastAsked.beginner || ""}`)] : []),
    ...Object.entries(p.brief || {})
      .filter(([, v]) => String(v).trim())
      .map(([k, v]) => item("discovery", `brief-${k}`, `${k}: ${v}`)),
    ...(p.workflow ? [item("discovery", "workflow", `Detected workflow: ${p.workflow}`)] : []),
  ].slice(0, 300);
}
export async function discoverLocalAgent() {
  const response = await fetch("/api/session", {
    signal: AbortSignal.timeout(3000),
  });
  if (!response.ok) throw Error("Local sidecar unavailable");
  const session = await response.json();
  if (!session.token || session.status !== "local-sidecar")
    throw Error("Invalid local sidecar response");
  return session;
}
// Plain reasons instead of status codes or validation dumps.
export function explain(status, detail) {
  if (typeof detail === "string") return detail;
  if (status === 401) return "Atforma's helper restarted, so this page lost its session. Reload the page.";
  if (status === 422 && Array.isArray(detail) && detail.length) {
    const d = detail[0];
    const where = (d.loc || []).filter((x) => x !== "body").join(" → ");
    return `Part of our request didn't fit (${where || "request"}: ${d.msg}). Reload the page; if it keeps happening, tell us what you were doing.`;
  }
  if (status === 409) return "Still working on your last message — give it a moment.";
  if (status >= 500) return "The model didn't answer. Let's check the connection.";
  return "Something went wrong talking to the model. Let's check the connection.";
}
export async function requestArchitect({
  session,
  connection,
  message,
  project,
  history,
  stage = "discover",
  extra = [],
  signal,
}) {
  const response = await fetch("/api/architect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${session.token}`,
    },
    body: JSON.stringify({
      provider: connection.provider,
      model: connection.model,
      ...(connection.effort ? { effort: connection.effort } : {}),
      message,
      project: toAgentProject(project),
      stage,
      context: [...agentContext(project), ...extra].slice(0, 300),
      history: history
        .slice(-12)
        .map((m) => ({ role: m.role, text: m.text.slice(0, 12000) })),
    }),
    signal,
  });
  const result = await response.json();
  if (!response.ok) throw Error(explain(response.status, result.detail));
  return result;
}

// Projects saved by Atforma's helper under the user's account on this computer.
export async function projects(session, action, body = {}) {
  const response = await fetch(`/api/projects/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.token}` },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(typeof result.detail === "string" ? result.detail : "Couldn't reach your saved projects.");
  return result;
}
