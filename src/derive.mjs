// Small, grounded working requirements. Unknown targets become conversation topics,
// not invented company policies or a large list of fields for the user to complete.
import { roleOf } from './review.mjs';
import { cleanRequirement } from './records.mjs';
export function deriveRequirements(project) {
  const nodes=project.nodes.filter(n=>n.data.kind!=='note');
  if(!nodes.length)return [];
  const out=nodes.slice(0,8).map(n=>cleanRequirement({id:`drv-function-${n.id}`,source:'agent',kind:'functional',category:'other',priority:'should',status:'open',statement:n.data.description && n.data.description !== n.data.label ? `${n.data.label}: ${n.data.description}` : `Support ${n.data.label.toLowerCase()} as shown in the diagram.`,links:[n.id]}));
  const group=(roles)=>nodes.filter(n=>roles.includes(roleOf(n))).map(n=>n.id);
  const add=(id,category,statement,links)=>{if(links.length)out.push(cleanRequirement({id:`drv-${id}`,source:'agent',kind:'nonfunctional',category,priority:'should',status:'open',statement,links}));};
  add('data-access','security','Agree who can access the data and which content each person is allowed to use.',group(['data','index','llm']));
  add('data-location','compliance','Confirm where source data, model requests and logs may be processed and stored.',group(['data','index','llm']));
  add('answer-quality','other','Agree what makes an answer useful and correct, and how we will check it.',group(['llm','model']));
  add('response-time','performance','Agree acceptable response time and expected demand for the people using this system.',group(['llm','model','app','output']));
  return out;
}
export function withDerived(project){
 const mine=(project.needs||[]).filter(r=>!(r.source==='agent'&&r.id.startsWith('drv-')));
 const excluded=new Set([...(project.extensions?.dismissedRequirements||[]),...mine.map(r=>r.id)]);
 return {...project,needs:[...mine,...deriveRequirements(project).filter(r=>!excluded.has(r.id))].slice(0,300)};
}
