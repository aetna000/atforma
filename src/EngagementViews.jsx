// Consultant views: Discover (qualify), Options and Decisions (design), Build card.
import React from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  BRIEF_FIELDS,
  CRITERIA,
  GATE,
  LEVELS,
  OPTIONS,
  STATUSES,
  VERDICTS,
  defaultAssessment,
  newDecision,
  optionScore,
} from "./engagement.mjs";
import { OPTION_NAMES } from "./pack.mjs";
import {
  CATEGORIES,
  OPS,
  PRIORITIES,
  REQUIREMENT_STATUSES,
  decisionHistory,
  measureProblem,
  newAssumption,
  newQuestion,
  newRequirement,
  reviseDecision,
} from "./records.mjs";

const area = (props) => <textarea rows={2} {...props} />;

// One understood topic: read as text; edit only when asked.
function Known({ topic, value, onSave }) {
  const [editing, setEditing] = React.useState(false);
  return (
    <div className={`known-item ${topic.state}`}>
      <dt>
        {topic.label}
        {topic.state === "assumed" && <em> · assumed</em>}
        {!editing && (
          <button className="link small" aria-label={`Edit ${topic.label}`} onClick={() => setEditing(true)}>
            Edit
          </button>
        )}
      </dt>
      {editing ? (
        <dd>
          <textarea autoFocus rows={2} aria-label={topic.label} defaultValue={value} onBlur={(e) => (onSave(e.target.value), setEditing(false))} />
        </dd>
      ) : (
        <dd>{value}</dd>
      )}
    </div>
  );
}

// What we've understood from the chat, as a small card on the board.
export function DiscoverView({ project, onChange, topics, open = true, onToggle }) {
  const brief = project.brief || {};
  const useCases = project.useCases || [];
  const setCase = (i, patch) =>
    onChange({ ...project, useCases: useCases.map((u, j) => (j === i ? { ...u, ...patch } : u)) });
  const facts = (project.facts || []).filter((f) => f.name !== "cloud.preference" && f.name !== "data.sensitive");
  const heard = topics.filter((t) => t.state !== "open");
  if (!open) return null;
  return (
    <section className="notes-card" aria-label="Discover">
      <div className="doc-sub">
        <h3>What we know so far</h3>
      </div>
      {heard.length > 0 && (
        <>
          <p className="muted small">Your words — edit anything.</p>
          {facts.length > 0 && (
            <div className="facts">
              {facts.map((f) => (
                <span key={f.id} className={`chip ${f.conflictsWith ? "missing" : ""}`} title={`${f.text} (${f.madeAt})`}>
                  {typeof f.value === "number" ? f.value.toLocaleString("en") : String(f.value)} {f.unit}
                  <button aria-label={`Forget ${f.unit}`} onClick={() => onChange({ ...project, facts: project.facts.filter((x) => x.id !== f.id) })}>
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <dl className="known">
            {heard.map((t) => (
              <Known
                key={t.id}
                topic={t}
                value={brief[t.id] || ""}
                onSave={(value) => onChange({ ...project, brief: { ...brief, [t.id]: value } })}
              />
            ))}
          </dl>
          <p className="muted small">
            Still to cover, whenever you're ready:{" "}
            {topics.filter((t) => t.state === "open").map((t) => t.label.toLowerCase()).join(", ") || "nothing — that's everything for now."}
          </p>
        </>
      )}
      <details className="extra">
        <summary>Comparing ideas? Qualify use cases</summary>
        <div className="cases compact">
          {useCases.map((u, i) => (
            <div key={u.id} className={`case verdict-${u.verdict.replace(" ", "-").toLowerCase()}`}>
              <input aria-label="Use case" placeholder="Idea" value={u.title} onChange={(e) => setCase(i, { title: e.target.value })} />
              <div className="seg verdicts">
                {VERDICTS.map((v) => (
                  <button key={v} className={u.verdict === v ? "on" : ""} onClick={() => setCase(i, { verdict: v })}>
                    {v}
                  </button>
                ))}
              </div>
              <button className="icon" aria-label="Remove use case" onClick={() => onChange({ ...project, useCases: useCases.filter((_, j) => j !== i) })}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
          <button
            className="link small"
            onClick={() =>
              onChange({
                ...project,
                useCases: [...useCases, { id: `uc-${Date.now()}`, title: "", value: "Medium", risk: "Medium", fit: "Medium", verdict: "Park", reason: "" }],
              })
            }
          >
            + Add use case
          </button>
        </div>
      </details>
    </section>
  );
}

export function OptionsView({ project, onChange, onShowDesign, onRecommend }) {
  const a = project.assessment || defaultAssessment();
  const set = (patch) => onChange({ ...project, assessment: { ...a, ...patch } });
  const best = OPTIONS.map((o) => [o, optionScore(a, o)])
    .filter(([, s]) => s != null)
    .sort((x, y) => y[1] - x[1])[0]?.[0];
  return (
    <section className="doc" aria-label="Options">
      <header className="doc-head">
        <h2>Cloud options</h2>
        <p className="muted">Score 1–5, higher is better. Your judgement, not vendor quotes.</p>
      </header>
      <div className="options-wrap">
        <table className="options">
          <thead>
            <tr>
              <th>Criterion</th>
              <th>Weight</th>
              {OPTIONS.map((o) => (
                <th key={o} className={best === o ? "best" : ""}>
                  {OPTION_NAMES[o]}
                  {o !== "current" && (
                    <button className="link small" onClick={() => onShowDesign(o)}>
                      Show design
                    </button>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CRITERIA.map((c) => (
              <tr key={c.id}>
                <th title={c.hint}>
                  {c.label}
                  <small className="muted">{c.hint}</small>
                </th>
                <td>
                  <select
                    aria-label={`${c.label} weight`}
                    value={a.weights[c.id]}
                    onChange={(e) => set({ weights: { ...a.weights, [c.id]: Number(e.target.value) } })}
                  >
                    {[0, 1, 2, 3, 4, 5].map((w) => (
                      <option key={w} value={w}>
                        ×{w}
                      </option>
                    ))}
                  </select>
                </td>
                {OPTIONS.map((o) => (
                  <td key={o}>
                    <select
                      aria-label={`${OPTION_NAMES[o]} ${c.label}`}
                      value={a.scores[o][c.id] ?? ""}
                      onChange={(e) =>
                        set({
                          scores: { ...a.scores, [o]: { ...a.scores[o], [c.id]: e.target.value ? Number(e.target.value) : null } },
                        })
                      }
                    >
                      <option value="">—</option>
                      {[1, 2, 3, 4, 5].map((v) => (
                        <option key={v} value={v}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
            <tr className="total">
              <th>Weighted</th>
              <td />
              {OPTIONS.map((o) => (
                <td key={o} className={best === o ? "best" : ""}>
                  {optionScore(a, o) ?? "—"}
                </td>
              ))}
            </tr>
            <tr>
              <th>Notes</th>
              <td />
              {OPTIONS.map((o) => (
                <td key={o}>
                  {area({
                    "aria-label": `${OPTION_NAMES[o]} notes`,
                    placeholder: o === "current" ? "How it works today" : "Assumptions, gaps",
                    value: a.notes[o],
                    onChange: (e) => set({ notes: { ...a.notes, [o]: e.target.value } }),
                  })}
                </td>
              ))}
            </tr>
            <tr>
              <th />
              <td />
              {OPTIONS.map((o) => (
                <td key={o}>
                  <button className="btn" disabled={optionScore(a, o) == null} onClick={() => onRecommend(o)}>
                    Recommend
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Revise({ onRevise }) {
  const [open, setOpen] = React.useState(false),
    [reason, setReason] = React.useState("");
  if (!open)
    return (
      <button className="btn ghost" onClick={() => setOpen(true)}>
        Revise
      </button>
    );
  return (
    <div className="revise">
      <input autoFocus aria-label="Reason for change" placeholder="Why is this changing?" value={reason} onChange={(e) => setReason(e.target.value)} />
      <button className="btn primary" disabled={!reason.trim()} onClick={() => onRevise(reason)}>
        Save revision
      </button>
      <button className="btn ghost" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

export function DecisionsView({ project, onChange, onError }) {
  const decisions = project.decisions || [];
  const set = (id, patch) => onChange({ ...project, decisions: decisions.map((d) => (d.id === id ? { ...d, ...patch } : d)) });
  // Superseded records are history: shown under the current decision, never edited.
  const current = decisions.filter((d) => d.status !== "Superseded");
  return (
    <section className="doc" aria-label="Decisions">
      <header className="doc-head row-between">
        <div>
          <h2>Decisions</h2>
          <p className="muted">Each decision has an owner before build begins. Changes are revisions; history is kept.</p>
        </div>
        <button className="btn" onClick={() => onChange({ ...project, decisions: [...decisions, newDecision(project)] })}>
          <Plus size={14} /> New decision
        </button>
      </header>
      {!decisions.length && <p className="muted">Applied proposals and recommendations are recorded here automatically.</p>}
      {current.map((d) => {
        const history = decisionHistory(decisions, d.subject).filter((h) => h.id !== d.id);
        return (
          <article key={d.id} className={`adr status-${d.status.toLowerCase()}`}>
            <div className="adr-head">
              <span className="adr-id">{d.id.toUpperCase()}</span>
              <input aria-label="Decision title" placeholder="Title" value={d.title} onChange={(e) => set(d.id, { title: e.target.value })} />
              <input
                aria-label="Decision owner"
                className={d.owner ? "" : "missing"}
                placeholder="Owner"
                value={d.owner}
                onChange={(e) => set(d.id, { owner: e.target.value })}
              />
              <select aria-label="Decision status" value={d.status} onChange={(e) => set(d.id, { status: e.target.value })}>
                {STATUSES.filter((s) => s !== "Superseded").map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button
                className="icon"
                aria-label="Delete decision"
                disabled={history.length > 0}
                title={history.length ? "Decisions with history can't be deleted" : ""}
                onClick={() => onChange({ ...project, decisions: decisions.filter((x) => x.id !== d.id) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="adr-meta">
              <label className="inline">
                Subject
                <input aria-label="Decision subject" className="mono" value={d.subject} disabled={history.length > 0} onChange={(e) => set(d.id, { subject: e.target.value })} />
              </label>
              {d.reason && <span className="muted small">Changed because: {d.reason}</span>}
              {d.status === "Accepted" && (
                <Revise
                  onRevise={(reason) => {
                    try {
                      onChange(reviseDecision(project, d.id, {}, reason));
                    } catch (error) {
                      onError(error.message);
                    }
                  }}
                />
              )}
            </div>
            <div className="adr-body">
              {["context", "options", "decision", "consequences"].map((k) => (
                <label key={k} className="field">
                  {k[0].toUpperCase() + k.slice(1)}
                  {area({ "aria-label": `Decision ${k}`, value: d[k], onChange: (e) => set(d.id, { [k]: e.target.value }) })}
                </label>
              ))}
            </div>
            {history.length > 0 && (
              <details className="history">
                <summary>History · {history.length} earlier</summary>
                <ol>
                  {history.map((h) => (
                    <li key={h.id}>
                      <span className="adr-id">{h.id.toUpperCase()}</span> {h.date} · {h.decision || h.title}
                      {h.reason && <span className="muted"> — changed because {h.reason}</span>}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </article>
        );
      })}
    </section>
  );
}

export function BuildCard({ project, run, onChange, onOpen, environment, onEnvironment, onPlan, onPulumi, onPack }) {
  const scope = project.nodes.filter((n) => n.data.poc);
  const tested = run && run.revision === project.revision && run.status !== "running";
  const results = Object.fromEntries(
    (tested ? run.steps : []).flatMap((s) => (s.output?.measures || []).map((m) => [m.label, m])),
  );
  const outputs = project.nodes.filter((n) => n.data.measures?.length);
  const gate = project.gate || {};
  const unowned = (project.decisions || []).filter((d) => !d.owner?.trim()).length;
  return (
    <aside className="deploy build" aria-label="Build">
      <h3>Prototype</h3>
      <p className="muted small">
        {scope.length}/{project.nodes.length} blocks in scope · faded blocks are out
      </p>
      <h4>Success criteria</h4>
      {outputs.length ? (
        <ul className="checks">
          {outputs.flatMap((n) =>
            n.data.measures.map((m) => {
              const r = results[m.label];
              return (
                <li key={n.id + m.label} className={r ? (r.pass ? "ok" : "bad") : ""}>
                  <button className="link-plain" onClick={() => onOpen(n.id)}>
                    {m.label} {m.op} {String(m.target)}
                    {r && <span className="muted"> · {String(r.value)}</span>}
                  </button>
                </li>
              );
            }),
          )}
        </ul>
      ) : (
        <p className="muted small">Add measures to the final check block.</p>
      )}
      <h4>Scale gate</h4>
      {GATE.map((g) => (
        <label key={g.id} className="field">
          {g.label}
          {area({
            "aria-label": g.label,
            placeholder: g.hint,
            value: gate[g.id] || "",
            onChange: (e) => onChange({ ...project, gate: { ...gate, [g.id]: e.target.value } }),
          })}
        </label>
      ))}
      {unowned > 0 && <p className="warn-text small">{unowned} decision{unowned > 1 ? "s" : ""} without an owner</p>}
      <div className="seg">
        {["staging", "production"].map((env) => (
          <button key={env} className={environment === env ? "on" : ""} onClick={() => onEnvironment(env)}>
            {env[0].toUpperCase() + env.slice(1)}
          </button>
        ))}
      </div>
      <div className="row">
        <button className="btn" onClick={onPlan}>
          Export {environment} plan
        </button>
        <button className="btn ghost" onClick={onPulumi}>
          Pulumi
        </button>
      </div>
      <button className="btn primary" onClick={onPack}>
        Client pack
      </button>
    </aside>
  );
}

export function MeasuresEditor({ measures = [], disabled, onChange }) {
  const set = (i, patch) => onChange(measures.map((m, j) => (j === i ? { ...m, ...patch } : m)));
  return (
    <div className="measures">
      <h4>Success measures</h4>
      {measures.map((m, i) => (
        <div key={i} className="measure">
          <input aria-label="Measure label" disabled={disabled} value={m.label} onChange={(e) => set(i, { label: e.target.value })} />
          <input aria-label="Measure field" disabled={disabled} className="mono" value={m.path} onChange={(e) => set(i, { path: e.target.value })} />
          <select aria-label="Measure operator" disabled={disabled} value={m.op} onChange={(e) => set(i, { op: e.target.value })}>
            <option>{">="}</option>
            <option>{"<="}</option>
            <option>{"=="}</option>
          </select>
          <input
            aria-label="Measure target"
            disabled={disabled}
            value={String(m.target)}
            onChange={(e) => {
              const v = e.target.value;
              set(i, { target: v === "true" ? true : v === "false" ? false : v !== "" && !isNaN(Number(v)) ? Number(v) : v });
            }}
          />
          <button className="icon" aria-label="Remove measure" disabled={disabled} onClick={() => onChange(measures.filter((_, j) => j !== i))}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
      <button
        className="btn ghost"
        disabled={disabled}
        onClick={() => onChange([...measures, { label: "New measure", path: "status", op: "==", target: "passed" }])}
      >
        <Plus size={13} /> Add measure
      </button>
    </div>
  );
}

function LinkPicker({ project, links, onChange }) {
  const label = (id) => project.nodes.find((n) => n.id === id)?.data.label;
  return (
    <div className="links">
      {links.map((id) => (
        <span key={id} className={`chip ${label(id) ? "" : "missing"}`} title={label(id) ? "" : "Component no longer on the canvas"}>
          {label(id) || "removed component"}
          <button aria-label={`Unlink ${label(id) || id}`} onClick={() => onChange(links.filter((l) => l !== id))}>
            ×
          </button>
        </span>
      ))}
      <select
        aria-label="Link a component"
        value=""
        onChange={(e) => e.target.value && onChange([...links, e.target.value])}
      >
        <option value="">+ link</option>
        {project.nodes
          .filter((n) => !links.includes(n.id))
          .map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.label}
            </option>
          ))}
      </select>
    </div>
  );
}

function RecordList({ title, hint, items, onAdd, render }) {
  return (
    <>
      <div className="doc-sub">
        <h3>
          {title} <span className="muted small">{items.length || ""}</span>
        </h3>
        <button className="btn ghost" onClick={onAdd}>
          <Plus size={14} /> Add
        </button>
      </div>
      {items.length ? <div className="records">{items.map(render)}</div> : <p className="muted small">{hint}</p>}
    </>
  );
}

export function RequirementsView({ project, onChange, topics }) {
  const list = (key) => project[key] || [];
  const set = (key, i, patch) => onChange({ ...project, [key]: list(key).map((r, j) => (j === i ? { ...r, ...patch } : r)) });
  const add = (key, record) => onChange({ ...project, [key]: [...list(key), record] });
  const remove = (key, i) => onChange({ ...project, [key]: list(key).filter((_, j) => j !== i) });
  const del = (key, i, what) => (
    <button className="icon" aria-label={`Remove ${what}`} onClick={() => remove(key, i)}>
      <Trash2 size={14} />
    </button>
  );
  return (
    <section className="doc" aria-label="Requirements">
      <header className="doc-head">
        <h2>Requirements</h2>
        <p className="muted">What it must do, what we're assuming, and what's still open.</p>
      </header>
      {topics && <DiscoverView project={project} topics={topics} onChange={onChange} />}
      <RecordList
        title="Requirements"
        hint="Add functional and non-functional requirements. Give a measurable target where you can."
        items={list("needs")}
        onAdd={() => add("needs", newRequirement())}
        render={(r, i) => {
          const m = r.measure || { metric: "", op: "<=", target: "", unit: "" };
          const setMeasure = (patch) => {
            const next = { ...m, ...patch };
            set("needs", i, { measure: next.metric || next.target !== "" ? next : undefined });
          };
          const problem = r.measure && measureProblem(r.measure);
          return (
            <article key={r.id} className="record">
              <div className="record-row">
                <input aria-label="Requirement" placeholder="e.g. Alerts reach planners within 2 seconds" value={r.statement} onChange={(e) => set("needs", i, { statement: e.target.value })} />
                <select aria-label="Requirement kind" value={r.kind} onChange={(e) => set("needs", i, { kind: e.target.value })}>
                  <option value="functional">Functional</option>
                  <option value="nonfunctional">Non-functional</option>
                </select>
                <select aria-label="Requirement category" value={r.category} onChange={(e) => set("needs", i, { category: e.target.value })}>
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select aria-label="Requirement priority" value={r.priority} onChange={(e) => set("needs", i, { priority: e.target.value })}>
                  {PRIORITIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                <select aria-label="Requirement status" value={r.status} onChange={(e) => set("needs", i, { status: e.target.value })}>
                  {REQUIREMENT_STATUSES.map((c) => <option key={c}>{c}</option>)}
                </select>
                {del("needs", i, "requirement")}
              </div>
              <div className="record-row measure-row">
                <span className="muted small">Measure</span>
                <input aria-label="Metric" placeholder="metric, e.g. p95 latency" value={m.metric} onChange={(e) => setMeasure({ metric: e.target.value })} />
                <select aria-label="Measure comparison" value={m.op} onChange={(e) => setMeasure({ op: e.target.value })}>
                  {OPS.map((o) => <option key={o}>{o}</option>)}
                </select>
                <input
                  aria-label="Target"
                  placeholder="target"
                  value={String(m.target)}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMeasure({ target: v === "true" ? true : v === "false" ? false : v !== "" && !isNaN(Number(v)) ? Number(v) : v });
                  }}
                />
                <input aria-label="Unit" placeholder="unit" value={m.unit} onChange={(e) => setMeasure({ unit: e.target.value })} />
                {problem && <span className="warn-text small">{problem}</span>}
              </div>
              <LinkPicker project={project} links={r.links} onChange={(links) => set("needs", i, { links })} />
            </article>
          );
        }}
      />
      <RecordList
        title="Assumptions"
        hint="What we believe without evidence yet — usage, data volumes, team skills."
        items={list("assumptions")}
        onAdd={() => add("assumptions", newAssumption())}
        render={(a, i) => (
          <article key={a.id} className="record">
            <div className="record-row">
              <input aria-label="Assumption" placeholder="e.g. 500 pumps report every minute" value={a.statement} onChange={(e) => set("assumptions", i, { statement: e.target.value })} />
              <input aria-label="Assumption owner" placeholder="Owner" value={a.owner} onChange={(e) => set("assumptions", i, { owner: e.target.value })} />
              <input aria-label="Stated on" type="date" value={a.madeAt} onChange={(e) => set("assumptions", i, { madeAt: e.target.value })} />
              {del("assumptions", i, "assumption")}
            </div>
            <LinkPicker project={project} links={a.links} onChange={(links) => set("assumptions", i, { links })} />
          </article>
        )}
      />
      <RecordList
        title="Open questions"
        hint="What still needs an answer before this can be built."
        items={list("openQuestions")}
        onAdd={() => add("openQuestions", newQuestion())}
        render={(q, i) => (
          <article key={q.id} className={`record ${q.status}`}>
            <div className="record-row">
              <input aria-label="Question" placeholder="e.g. Which region must data stay in?" value={q.question} onChange={(e) => set("openQuestions", i, { question: e.target.value })} />
              <input aria-label="Question owner" placeholder="Who answers" value={q.owner} onChange={(e) => set("openQuestions", i, { owner: e.target.value })} />
              <select aria-label="Question status" value={q.status} onChange={(e) => set("openQuestions", i, { status: e.target.value })}>
                <option value="open">open</option>
                <option value="answered">answered</option>
              </select>
              {del("openQuestions", i, "question")}
            </div>
            {q.status === "answered" && (
              <input aria-label="Answer" placeholder="Answer" value={q.answer} onChange={(e) => set("openQuestions", i, { answer: e.target.value })} />
            )}
          </article>
        )}
      />
    </section>
  );
}
