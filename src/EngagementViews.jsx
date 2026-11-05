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
  decisionHistory,
  measureProblem,
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

export function OptionsView({ project, onDiscuss }) {
  const notes = project.assessment?.notes || {};
  const ready = Object.values(notes).some(Boolean);
  return <section className="doc" aria-label="Options">
    <header className="doc-head"><h2>Cloud options</h2><p className="muted">Atforma builds this comparison from your diagram and our conversation.</p></header>
    <button className="btn" onClick={() => onDiscuss('Help me compare AWS, Azure, Google Cloud and IBM for this design. Ask one useful question about my priorities, then refine the comparison from my answer. Populate optionAssessment when enough is known. Keep the diagram unchanged.')}>Discuss cloud options</button>
    {!ready && <p className="muted">We’ll clarify what matters to you and explain the tradeoffs here as we go.</p>}
    {['current','aws','azure','gcp','ibm'].filter(id => notes[id]).map(id => <article className="consultation-summary" key={id}>
      <h3>{OPTION_NAMES[id]}</h3><p>{notes[id].replace(/^Atforma proposal — confirm: /,'')}</p>
      <button className="link" onClick={() => onDiscuss(`Explain how ${OPTION_NAMES[id]} fits our design and the main tradeoff. Ask one question to help me decide; keep this as a discussion until I explicitly choose.`)}>Discuss this option</button>
    </article>)}
  </section>;
}

export function DecisionsView({ project, onDiscuss }) {
  const all = project.decisions || [];
  const choices = all.filter(d => !d.subject?.startsWith('design.'));
  const current = choices.filter(d => d.status !== 'Superseded');
  const sketches = all.filter(d => d.subject?.startsWith('design.'));
  const labels = {'platform.cloud':'Cloud provider','cloud.region':'Region','infrastructure.tool':'Infrastructure tool'};
  return <section className="doc" aria-label="Decisions">
    <header className="doc-head"><h2>Choices we’ve made</h2><p className="muted">Atforma records your choices and explains why they fit. You can revisit them in chat.</p></header>
    <button className="btn" onClick={() => onDiscuss('Review our current design and explicit choices. Explain the next choice we need to make and ask me one useful question. Do not treat a sketch or a suggestion as an accepted decision.')}>Discuss the next choice</button>
    {!current.length && <p className="muted">No choices confirmed yet. We’ll work through them together as the design develops.</p>}
    {current.map(d => <article className="consultation-summary" key={d.id}>
      <h3>{labels[d.subject] || d.title}</h3><p>{OPTION_NAMES[d.decision] || d.decision || 'Still being discussed'}</p>
      <small className="muted">{d.status === 'Accepted' ? 'Confirmed in our conversation' : 'Proposed — still to discuss'}</small>
      {d.context && <p>{d.context}</p>}{d.consequences && <p>{d.consequences}</p>}
      <button className="link" onClick={() => onDiscuss(`Let’s revisit our choice about ${labels[d.subject] || d.title}: ${d.decision}. Explain the tradeoff and ask what I would like to change before updating it.`)}>Revisit in chat</button>
      {choices.some(h => h.subject===d.subject && h.status==='Superseded') && <details className="extra"><summary>Earlier choices</summary>{choices.filter(h => h.subject===d.subject && h.status==='Superseded').map(h=><p key={h.id}>{h.decision} {h.reason && `— ${h.reason}`}</p>)}</details>}
    </article>)}
    {!!sketches.length && <details className="extra"><summary>Diagram change history</summary>{sketches.map(d=><p key={d.id}>{d.title} · {d.decision}</p>)}</details>}
  </section>;
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

export function RequirementsView({ project, onDiscuss }) {
  const needs = project.needs || [];
  const names = Object.fromEntries(project.nodes.map(n => [n.id, n.data.label]));
  const requirements = (list) => <ul className="requirements-summary">{list.map(r => <li key={r.id}>
    <p>{r.statement}</p>
    <small className="muted">{r.source === 'agent' ? 'Proposed from the design and conversation' : 'From our conversation'}{r.measure ? ` · ${r.measure.metric} ${r.measure.op} ${r.measure.target}${r.measure.unit || ''}` : ''}{r.links?.length ? ` · ${r.links.map(id => names[id] || 'earlier component').join(', ')}` : ''}</small>
    <button className="link small" onClick={() => onDiscuss(`Let's discuss requirement ${r.id}: ${r.statement}. Help me clarify it with one question and update the working requirement from my answer.`)}>Discuss this further in chat</button>
  </li>)}</ul>;
  return <section className="doc" aria-label="Requirements">
    <header className="doc-head"><h2>Where we’ve reached</h2><p className="muted">A summary of what we’ve established from our board and discussion. Proposed requirements and open questions show what we still need to work through together.</p></header>
    <button className="btn" onClick={() => onDiscuss('Summarise where we have reached from the current board and our discussion. Distinguish what I have confirmed from your proposals and unresolved questions. Then ask ONE useful question to develop the requirements further, and update the summary as we discuss.')}>Let’s discuss more in chat</button>
    {needs.length ? <>{requirements(needs.slice(0,6))}{needs.length > 6 && <details className="extra"><summary>{needs.length-6} more requirements in our summary</summary>{requirements(needs.slice(6))}</details>}</> : <p className="muted">Describe your idea in the chat or add to the diagram. Atforma will develop the requirements with you.</p>}
    {!!project.assumptions?.length && <details className="extra"><summary>Assumptions to check · {project.assumptions.length}</summary><ul>{project.assumptions.map(a => <li key={a.id}>{a.statement}</li>)}</ul></details>}
    {!!project.openQuestions?.filter(q=>q.status==='open').length && <details className="extra"><summary>Questions still open</summary><ul>{project.openQuestions.filter(q=>q.status==='open').map(q=><li key={q.id}><button className="link" onClick={()=>onDiscuss(`Let's resolve this question: ${q.question}`)}>{q.question}</button></li>)}</ul></details>}
  </section>;
}
