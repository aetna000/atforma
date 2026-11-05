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
