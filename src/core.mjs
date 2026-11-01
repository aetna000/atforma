import {UPSTREAM_DESCRIPTIONS} from './upstream-catalog.mjs';
export const PROVIDERS = {
  aws: {name:'AWS', color:'#d48b25', letter:'a'},
  azure: {name:'Azure', color:'#2687d5', letter:'A'},
  gcp: {name:'Google Cloud', color:'#44956b', letter:'G'},
  ibm: {name:'IBM', color:'#6b6cce', letter:'ibm'},
  tools: {name:'Tools & data', color:'#7b879b', letter:'⌘'},
};
export const STAGES = ['Discovery','Architecture','Evaluation','Review'];
export const CATALOG = [
 ['tools','source','Customer dataset','Sample input records','database'],
 ['tools','predict','Prediction service','Existing analytics endpoint','model'],
 ['tools','agent','AI assistant','Explain results with context','agent'],
 ['tools','guard','Approval & policy','Check access before output','shield'],
 ['tools','output','Response & assertions','Verify the end-to-end result','output'],
 ['tools','tool','REST API','Connect a business tool','tool'],
 ['tools','source','PostgreSQL','Relational data source','database'],
 ['aws','agent','Amazon Bedrock','Generative AI application layer','agent'],
 ['aws','predict','SageMaker AI','Predictive model endpoint','model'],
 ['aws','source','Amazon S3','Object storage source','database'],
 ['aws','tool','AWS Lambda','Serverless integration','tool'],
 ['aws','guard','IAM policy','Identity & access boundary','shield'],
 ['azure','agent','Microsoft Foundry','Generative AI application layer','agent'],
 ['azure','predict','Azure Machine Learning','Predictive model endpoint','model'],
 ['azure','source','Azure SQL','Relational data source','database'],
 ['azure','tool','Azure Functions','Serverless integration','tool'],
 ['azure','guard','Microsoft Entra ID','Identity & access boundary','shield'],
 ['gcp','agent','Gemini on Google Cloud','Generative AI application layer','agent'],
 ['gcp','predict','Vertex AI endpoint','Predictive model endpoint','model'],
 ['gcp','source','BigQuery','Analytics data source','database'],
 ['gcp','tool','Cloud Run','Application integration','tool'],
 ['gcp','guard','Cloud IAM','Identity & access boundary','shield'],
 ['ibm','agent','watsonx.ai','Generative AI application layer','agent'],
 ['ibm','predict','watsonx model deployment','Predictive model endpoint','model'],
 ['ibm','source','IBM Db2','Relational data source','database'],
 ['ibm','tool','watsonx Orchestrate','Business tool orchestration','tool'],
 ['ibm','guard','IBM Cloud IAM','Identity & access boundary','shield'],
].map(([provider,kind,label,description,icon],i)=>({id:`component-${i}`,provider,kind,label,description:UPSTREAM_DESCRIPTIONS[label]||description,icon}));
const labels={tools:['Customer dataset','Prediction service','AI assistant','Approval & policy','Response & assertions'],aws:['Amazon S3','SageMaker AI','Amazon Bedrock','IAM policy','Response & assertions'],azure:['Azure SQL','Azure Machine Learning','Microsoft Foundry','Microsoft Entra ID','Response & assertions'],gcp:['BigQuery','Vertex AI endpoint','Gemini on Google Cloud','Cloud IAM','Response & assertions'],ibm:['IBM Db2','watsonx model deployment','watsonx.ai','IBM Cloud IAM','Response & assertions']};
export function template(provider='azure') {
  const kinds=['source','predict','agent','guard','output'];
  const positions=[{x:65,y:170},{x:355,y:170},{x:645,y:170},{x:645,y:395},{x:355,y:395}];
  return {version:1,revision:1,name:'Predictive analytics → AI assistant',provider,
    nodes:kinds.map((kind,i)=>({id:`block-${i}`,type:'resource',position:positions[i],data:{label:labels[provider][i],kind,inputPosition:i===3?'top':i===4?'right':'left',outputPosition:i===2?'bottom':i===3?'left':'right',provider:i===4?'tools':provider,description:['Read sample customer signals','Call an existing prediction model','Explain the prediction with evidence','Enforce access and output policy','Check response and evidence'][i],config:{region:'To be selected',classification:'Internal',timeout:5000},origin:'proposed'}})),
    edges:kinds.slice(1).map((_,i)=>({id:`wire-${i}`,source:`block-${i}`,target:`block-${i+1}`,type:'smoothstep',label:['records','prediction','draft response','approved result'][i],animated:false})),
    requirements:'Help an analyst understand a churn prediction. Retain the existing prediction service; require evidence and authorised access.'};
}
export function checkProject(p) {
  const issues=[];const ids=new Set(p.nodes.map(n=>n.id));
  if(!p.nodes.length) issues.push({level:'error',text:'Add a source and connect an end-to-end flow.'});
  if(!p.nodes.some(n=>n.data.kind==='source')) issues.push({level:'error',text:'A data source is required.'});
  if(!p.nodes.some(n=>n.data.kind==='output')) issues.push({level:'error',text:'Add a response block to verify the result.'});
  for(const e of p.edges) if(!ids.has(e.source)||!ids.has(e.target)) issues.push({level:'error',text:'A connection points to a missing block.'});
  for(const n of p.nodes) {
    if(!p.edges.some(e=>e.source===n.id||e.target===n.id)) issues.push({level:'error',nodeId:n.id,text:`${n.data.label} is disconnected.`});
    if(n.data.kind!=='source'&&!p.edges.some(e=>e.target===n.id)) issues.push({level:'error',nodeId:n.id,text:`${n.data.label} has no input.`});
    if(n.data.kind==='source'&&p.edges.some(e=>e.target===n.id)) issues.push({level:'error',nodeId:n.id,text:`${n.data.label} is a source and cannot accept an input.`});
    if(p.edges.filter(e=>e.target===n.id).length>1) issues.push({level:'error',nodeId:n.id,text:`${n.data.label}: multiple inputs need a merge block (not available in this MVP).`});
    if(n.data.kind!=='output'&&!p.edges.some(e=>e.source===n.id)) issues.push({level:'error',nodeId:n.id,text:`${n.data.label} has no downstream result.`});
  }
  try{orderProject(p);}catch{issues.push({level:'error',text:'The flow contains a cycle. This MVP supports directed flows.'});}
  const guards=new Set(p.nodes.filter(n=>n.data.kind==='guard').map(n=>n.id));
  function unguarded(id,visited=new Set()) {if(guards.has(id))return false;if(visited.has(id))return false;visited.add(id);const n=p.nodes.find(n=>n.id===id);if(n?.data.kind==='source')return true;return p.edges.filter(e=>e.target===id).some(e=>unguarded(e.source,new Set(visited)));}
  if(p.nodes.filter(n=>n.data.kind==='output').some(n=>unguarded(n.id)))issues.push({level:'error',text:'Every source-to-response path must pass through an access policy block.'});
  issues.push({level:'info',text:'Cloud resources are design components. Runs use local fixtures; no cloud APIs are called.'});
  return issues;
}
export function orderProject(p) {
  const remaining=new Set(p.nodes.map(n=>n.id)), result=[];
  while(remaining.size){const next=p.nodes.filter(n=>remaining.has(n.id)&&!p.edges.some(e=>e.target===n.id&&remaining.has(e.source)));if(!next.length)throw Error('cycle');for(const n of next){result.push(n);remaining.delete(n.id);}}
  return result;
}
export function executeBlock(n,input,scenario='happy') {
  const kind=n.data.kind;
  if(kind==='source')return {customer_id:'sample-1042',usage_drop:scenario==='missing'?null:0.42,support_tickets:3,authorised:scenario!=='denied',source:'local-fixture'};
  if(!input)throw Error('No input payload received.');
  if(kind==='predict') {if(typeof input.usage_drop!=='number')throw Error('Schema check failed: usage_drop must be a number.');return {...input,churn_probability:Number(Math.min(1,0.2+input.usage_drop+input.support_tickets*0.06).toFixed(2)),model:'deterministic-test-fixture'};}
  if(kind==='agent') {if(typeof input.churn_probability!=='number')throw Error('Agent needs a prediction. Connect the prediction service first.');return {...input,answer:`Customer ${input.customer_id} has a simulated churn score of ${Math.round(input.churn_probability*100)}%. The fixture uses a ${Math.round(input.usage_drop*100)}% usage drop and ${input.support_tickets} support tickets. This is a test explanation, not a causal conclusion.`,evidence:['fixture.usage_drop','fixture.support_tickets'],generated_by:'local-template (no LLM call)'};}
  if(kind==='guard'){if(!input.authorised)throw Error('Access denied: this fixture does not authorise the request.');return {...input,policy:'passed'};}
  if(kind==='output'){if(input.policy!=='passed')throw Error('Assertion failed: access policy must pass.');if(!input.answer||!input.evidence?.length)throw Error('Assertion failed: response and supporting evidence are required.');return {answer:input.answer,evidence:input.evidence,assertions:{response_present:true,evidence_present:true,access_approved:true},status:'passed'};}
  if(scenario==='tool-error')throw Error('Simulated tool failure: upstream API unavailable.');
  return {...input,tool_result:'Local tool fixture succeeded'};
}
export function validateImport(p) {
  if(!p||p.version!==1||!Number.isInteger(p.revision)||p.revision<1||typeof p.name!=='string'||!Array.isArray(p.nodes)||!Array.isArray(p.edges)||p.nodes.length>100||p.edges.length>300)throw Error('Unsupported or oversized project file.');
  const ids=new Set();
  for(const n of p.nodes){if(typeof n.id!=='string'||ids.has(n.id)||!n.data||!Object.hasOwn(PROVIDERS,n.data.provider)||!['source','predict','agent','guard','output','tool'].includes(n.data.kind)||typeof n.data.label!=='string'||!Number.isFinite(n.position?.x)||!Number.isFinite(n.position?.y))throw Error('Invalid component in project.');ids.add(n.id);}
  const edgeIds=new Set();for(const e of p.edges){if(typeof e.id!=='string'||edgeIds.has(e.id)||!ids.has(e.source)||!ids.has(e.target)||e.source===e.target)throw Error('Invalid connection in project.');edgeIds.add(e.id);}
  return {...p,nodes:p.nodes.map(n=>({id:n.id,type:'resource',position:n.position,data:{inputPosition:['left','right','top','bottom'].includes(n.data.inputPosition)?n.data.inputPosition:'left',outputPosition:['left','right','top','bottom'].includes(n.data.outputPosition)?n.data.outputPosition:'right',label:n.data.label.slice(0,150),provider:n.data.provider,kind:n.data.kind,description:String(n.data.description||'').slice(0,500),config:{region:String(n.data.config?.region||'To be selected').slice(0,100),classification:String(n.data.config?.classification||'Internal').slice(0,100),timeout:5000},origin:'proposed'}})),edges:p.edges.map(e=>({id:e.id,source:e.source,target:e.target,type:'smoothstep',label:String(e.label||'data').slice(0,80)}))};
}
export function propose(message,p) {
  const text=message.toLowerCase();const provider=text.includes('azure')?'azure':/google|gcp/.test(text)?'gcp':/ibm|watson/.test(text)?'ibm':/aws|bedrock|sagemaker/.test(text)?'aws':null;
  if(provider)return {baseRevision:p.revision,title:`Explore a ${PROVIDERS[provider].name} architecture`,body:`Replace the canvas with an illustrative ${PROVIDERS[provider].name} pattern: data → prediction → assistant → policy → response. This is a design alternative, not a validated service integration.`,next:template(provider)};
  if(/tool|api/.test(text)){const next=structuredClone(p);const target=next.nodes.find(n=>n.data.kind==='agent');if(!target)return {body:'Add an assistant block first, then I can insert a tool before it.'};const id=`tool-${crypto.randomUUID()}`;next.nodes.push({id,type:'resource',position:{x:645,y:-40},data:{kind:'tool',provider:'tools',label:'Business API',description:'A local fixture for a business tool',config:{region:'Local fixture',classification:'Internal',timeout:5000},origin:'proposed'}});const incoming=next.edges.find(e=>e.target===target.id);if(incoming){next.edges=next.edges.filter(e=>e.id!==incoming.id);next.edges.push({id:`${id}-in`,source:incoming.source,target:id,type:'smoothstep',label:'request'});}next.edges.push({id:`${id}-out`,source:id,target:target.id,type:'smoothstep',label:'tool context'});return {baseRevision:p.revision,title:'Connect a business tool',body:'Insert a REST API fixture before the assistant. In Staging / Test, choose “Tool unavailable” to see the failure propagate.',next};}
  if(/review|risk|secur|valid/.test(text))return {body:`Local review: ${checkProject(p).filter(i=>i.level==='error').length} structural issues. Before real deployment, verify identity, network boundaries, data residency, endpoint contracts, and model evaluation. Cloud documentation and pricing are not connected in this MVP.`};
  if(/test|run|fail/.test(text))return {body:'Open Staging / Test and run a sample. Try “Missing input field” or “Access denied”. Click any executed block to inspect its input, output and error. Add a business API to test tool failures.'};
  return {body:'I’m the guided demo assistant; I use local patterns, not a live language model. I can draft an AWS, Azure, Google Cloud or IBM example, add a business API, review the flow, or explain testing. Choose a provider or try “Add a business API”. Your canvas can combine providers manually.'};
}
export function makePlan(p,run,environment) {
  const tested=run?.status==='passed'&&run.revision===p.revision;
  return {kind:'architecture-plan-only',environment,project:p.name,revision:p.revision,generatedAt:new Date().toISOString(),simulationPassed:tested,liveDeploymentEnabled:false,blocks:p.nodes.map(n=>({id:n.id,...n.data})),connections:p.edges,blockers:[...(!tested?['Pass a simulation against the current revision.']:[]),'Connect a cloud account and select target regions.','Implement and verify provider-specific deployment adapters.','Review IAM, networking, secrets, data residency and costs.','Obtain staging integration-test results before production.'],note:'This is not executable infrastructure code or evidence of a deployed environment.'};
}
