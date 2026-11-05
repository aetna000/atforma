// Requirements derived from the diagram: every component brings the enterprise-grade,
// measurable requirements a design review would expect. Derived ones are regenerated as the
// design changes; once the user edits one it becomes theirs and is never overwritten.
import { roleOf } from "./review.mjs";
import { cleanRequirement } from "./records.mjs";

const fact = (p, name) => [...(p.facts || [])].reverse().find((f) => f.name === name)?.value;
const userNeed = (p, category) => (p.needs || []).find((r) => r.source === "user" && r.category === category);

// rule id → (component, project) → requirement fields
const RULES = {
  data: [
    ["enc", (n) => ({ category: "security", priority: "must", statement: `${n.data.label}: data is encrypted at rest and in transit with company-managed keys`, measure: { metric: "unencrypted stores", op: "<=", target: 0, unit: "" } })],
    ["ret", (n) => ({ category: "compliance", priority: "should", statement: `${n.data.label}: retention and deletion follow the company's records policy`, kind: "nonfunctional" })],
  ],
  ingest: [
    ["fresh", (n) => ({ category: "reliability", priority: "should", statement: `${n.data.label}: changes to source documents are reflected within 24 hours`, measure: { metric: "sync lag", op: "<=", target: 24, unit: "h" } })],
  ],
  index: [
    ["fresh", (n) => ({ category: "reliability", priority: "should", statement: `${n.data.label}: index refreshes within 24 hours of a document change`, measure: { metric: "index lag", op: "<=", target: 24, unit: "h" } })],
    ["rec", (n) => ({ category: "performance", priority: "should", statement: `${n.data.label}: the right passage is in the top 5 results for at least 90% of test questions`, measure: { metric: "recall@5", op: ">=", target: 90, unit: "%" } })],
  ],
  llm: [
    ["lat", (n, p) => {
      const own = userNeed(p, "performance")?.measure;
      return { category: "performance", priority: "must", statement: `${n.data.label}: answers start within ${own?.target ?? 5} ${own?.unit || "s"} at p95`, measure: { metric: "p95 response time", op: "<=", target: own?.target ?? 5, unit: own?.unit || "s" } };
    }],
    ["train", (n) => ({ category: "compliance", priority: "must", statement: `${n.data.label}: prompts and answers are never used to train the provider's models`, kind: "nonfunctional" })],
    ["ground", (n) => ({ category: "other", priority: "must", statement: `${n.data.label}: at least 95% of answers in the evaluation set are supported by cited sources`, measure: { metric: "grounded answers", op: ">=", target: 95, unit: "%" } })],
    ["log", (n) => ({ category: "compliance", priority: "should", statement: `${n.data.label}: usage is logged for audit without storing personal data in logs`, kind: "nonfunctional" })],
  ],
  model: [
    ["perf", (n) => ({ category: "performance", priority: "should", statement: `${n.data.label}: model quality is measured on held-out data before each release`, kind: "nonfunctional" })],
  ],
  guard: [
    ["block", (n) => ({ category: "security", priority: "must", statement: `${n.data.label}: unsafe, off-topic or unauthorised answers are blocked, with fewer than 1% reaching users in red-team tests`, measure: { metric: "unsafe answers passed", op: "<=", target: 1, unit: "%" } })],
  ],
  human: [
    ["approve", (n) => ({ category: "security", priority: "must", statement: `${n.data.label}: every automated action is approved by a named person before it runs`, kind: "functional" })],
  ],
  app: [
    ["avail", (n, p) => {
      const own = userNeed(p, "availability")?.measure;
      return { category: "availability", priority: "must", statement: `${n.data.label}: available ${own?.target ?? 99.5}% of the time each month`, measure: { metric: "monthly availability", op: ">=", target: own?.target ?? 99.5, unit: "%" } };
    }],
    ["sso", (n) => ({ category: "security", priority: "must", statement: `${n.data.label}: people sign in with the company's single sign-on`, kind: "functional" })],
    ["a11y", (n) => ({ category: "maintainability", priority: "should", statement: `${n.data.label}: meets WCAG 2.2 AA`, kind: "nonfunctional" })],
  ],
  monitor: [
    ["review", (n) => ({ category: "maintainability", priority: "should", statement: `${n.data.label}: answer quality is reviewed weekly, with at least 85% rated helpful`, measure: { metric: "helpful answers", op: ">=", target: 85, unit: "%" } })],
  ],
};

// Whole-system requirements that apply as soon as there is a design.
const SYSTEM = [
  ["obs", () => ({ category: "maintainability", priority: "must", statement: "All components send logs and metrics to central monitoring, with alerts to an on-call owner", kind: "nonfunctional" })],
  ["dr", () => ({ category: "reliability", priority: "should", statement: "The service can be restored within 4 hours, losing at most 1 hour of data", measure: { metric: "recovery time", op: "<=", target: 4, unit: "h" } })],
  ["iac", () => ({ category: "maintainability", priority: "should", statement: "Every environment is created from version-controlled infrastructure as code", kind: "nonfunctional" })],
  ["leaver", () => ({ category: "security", priority: "must", statement: "Access is removed within 24 hours when someone leaves the company", measure: { metric: "leaver access removal", op: "<=", target: 24, unit: "h" } })],
];

export function deriveRequirements(project) {
  const nodes = project.nodes.filter((n) => n.data.kind !== "note");
  if (!nodes.length) return [];
  const out = [];
  for (const n of nodes)
    for (const [rule, make] of RULES[roleOf(n)] || [])
      out.push(cleanRequirement({ kind: "nonfunctional", status: "open", ...make(n, project), id: `drv-${rule}-${n.id}`, source: "derived", links: [n.id] }));
  for (const [rule, make] of SYSTEM) out.push(cleanRequirement({ kind: "nonfunctional", status: "open", ...make(project), id: `drv-sys-${rule}`, source: "derived", links: [] }));
  const residency = (project.needs || []).find((r) => r.category === "compliance" && /stays? in/i.test(r.statement));
  const budget = fact(project, "budget.per_month");
  if (budget) out.push(cleanRequirement({ id: "drv-sys-budget", source: "derived", kind: "nonfunctional", category: "cost", priority: "must", statement: `Monthly run cost stays within ${budget.toLocaleString("en")} (stated budget)`, measure: { metric: "monthly run cost", op: "<=", target: budget, unit: "" }, links: [] }));
  if (residency) for (const n of nodes.filter((x) => roleOf(x) === "data" || roleOf(x) === "index")) out.push(cleanRequirement({ id: `drv-res-${n.id}`, source: "derived", kind: "nonfunctional", category: "compliance", priority: "must", statement: `${n.data.label}: ${residency.statement.toLowerCase()}`, links: [n.id] }));
  return out;
}

// Keep the user's own and edited requirements; refresh the derived ones from the diagram.
export function withDerived(project) {
  const derived = deriveRequirements(project);
  const mine = (project.needs || []).filter((r) => r.source !== "derived");
  const editedIds = new Set(mine.map((r) => r.id));
  return { ...project, needs: [...mine, ...derived.filter((r) => !editedIds.has(r.id))] };
}
