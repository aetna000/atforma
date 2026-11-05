import { cleanRequirement } from './records.mjs';
import { newDecision } from './engagement.mjs';
// Only explicit current user choices become accepted decisions; drawing changes are separate.
export function applyDecisionUpdates(project,updates,message){
 let p=project;
 for(const update of updates||[]){
  if(!update.sourceText || !message.includes(update.sourceText))continue;
  const current=(p.decisions||[]).find(d=>d.subject===update.subject&&d.status==='Accepted');
  if(current?.decision===update.value)continue;
  const next={...newDecision(p),subject:update.subject,title:update.subject,decision:update.value,status:'Accepted',context:`User statement: ${update.sourceText}`,reason:current?`User changed the choice: ${update.sourceText}`:'Chosen in the conversation',supersedes:current?.id||null};
  p={...p,decisions:[...(p.decisions||[]).map(d=>d===current?{...d,status:'Superseded',supersededBy:next.id}:d),next]};
 }
 return p;
}

// Model-authored requirements remain proposals until the user confirms them in chat.
export function applyRequirementDrafts(project, drafts) {
 const nodeIds=new Set(project.nodes.map(n=>n.id));
 const needs=[...(project.needs||[])];
 for(const draft of drafts||[]) {
  if(!/^ai-[A-Za-z0-9-]{1,55}$/.test(draft.id))continue;
  const index=needs.findIndex(r=>r.id===draft.id);
  if(index>=0 && needs[index].source!=='agent')continue;
  const row=cleanRequirement({...draft,source:'agent',status:'open',links:(draft.links||[]).filter(id=>nodeIds.has(id))});
  if(index>=0)needs[index]=row;else needs.push(row);
 }
 return {...project,needs};
}
