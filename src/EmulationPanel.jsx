import React from 'react';
import {emulationFeedback,emulationEvidenceSummary} from './emulation-feedback.mjs';

export function EmulationPanel({project,environment,session,emulation,onDiscuss,discussionBusy=false}){
 const {result,previous,running,run:emulate}=emulation;
 const feedback=emulationFeedback(project,result);
 function saveReport(){
  const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download=`atmem-emulation-r${project.revision}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 const title=result?.status==='passed'?'Local emulation checks passed':result?.status==='blocked'?'Implementation needed before runtime tests':result?.status==='unavailable'?'Emulation unavailable':'Emulation failed';
 return <aside className="emulation-panel" aria-label="Cloud emulation">
  <h3>Emulate, improve, repeat</h3>
  <p>Exercise generated application code with synthetic data and stateful local cloud service emulation. Model answers and authenticated request envelopes are simulated. This does not deploy to a cloud or run Terraform apply.</p>
  <div className="row"><button className="btn primary" onClick={emulate} disabled={running||!session?.token}>{running?'Emulating locally…':'Emulate locally'}</button>{running&&<button className="btn" onClick={()=>emulation.stop()}>Stop waiting</button>}{result?.artifactDigest&&<button className="btn" onClick={saveReport}>Download emulation report</button>}</div>
  {!session?.token&&<p role="status">Connecting to the local test service. Emulation becomes available when the connection is ready.</p>}
  {emulation.retestLimitReached&&<p role="status">Two automatic retests are complete. Review the latest correction, then choose Emulate locally to continue.</p>}
  {previous&&<p role="status"><strong>Design changed — rerun needed.</strong> The previous r{previous.designRevision} result does not validate these files.</p>}
  <label className="small"><input type="checkbox" checked={emulation.coach} onChange={e=>emulation.setCoach(e.target.checked)}/> Let the connected architect explain each result and help with the next step</label>
  <label className="small"><input type="checkbox" checked={emulation.autoRetest} onChange={e=>emulation.setAutoRetest(e.target.checked)}/> Retest applied corrections (up to two automatic rounds)</label>
  {running&&<p role="status">Running an isolated worker for this design. Results will be cleared if the generated files change.</p>}
  {feedback&&onDiscuss&&!running&&<div className="emulation-next"><h4>{feedback.title}</h4><p>{feedback.question}</p><div className="row"><button className="btn primary" disabled={discussionBusy} onClick={()=>onDiscuss(result,'correction')}>{feedback.mode==='correction'?'Propose a correction':feedback.mode==='next-test'?'Plan the next test':'Diagnose with architect'}</button><button className="btn" disabled={discussionBusy} onClick={()=>onDiscuss(result,'question')}>Ask a focused question</button></div><p className="small muted">Corrections use the existing proposal and Draw as we talk controls. Generator and emulator defects remain engineering work.</p></div>}
  {result&&!running&&<div role="status"><h4>{title}</h4><p>{emulationEvidenceSummary(result)}</p><p>{result.message}</p>
   {result.backend&&<p className="muted small">{result.backend} {result.backendVersion} · design r{result.designRevision} · {result.environment} · no cloud operations</p>}
   {!!result.blockers?.length&&<ul>{result.blockers.map((item,i)=><li key={i}>{item}</li>)}</ul>}
   {!!result.checks?.length&&<ul>{result.checks.map((check,i)=><li key={i}><strong>{check.passed?'Passed':'Failed'}:</strong> {check.name}{check.message&&<p>{check.message}</p>}</li>)}</ul>}
   {!!result.capabilities?.length&&<details><summary>What was emulated</summary><ul>{result.capabilities.map((item,i)=><li key={i}>{item.service}: {item.mode}</li>)}</ul></details>}
   {!!result.emulatorPatches?.length&&<details><summary>Emulator compatibility fixes</summary><ul>{result.emulatorPatches.map(item=><li key={item.id}>{item.id}: {item.reason}</li>)}</ul></details>}
   {!!result.limitations?.length&&<details open><summary>Still requires cloud verification</summary><ul>{result.limitations.map((item,i)=><li key={i}>{item}</li>)}</ul></details>}
  </div>}
 </aside>;
}
