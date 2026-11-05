import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
// A stand-in model at the network layer, for this test only: the app itself always uses the user's real model.
import {sketch,extractFacts} from '../src/discovery.mjs';
import {propose,PROVIDERS} from '../src/core.mjs';
fs.mkdirSync('/tmp/forma-qa',{recursive:true});
const browser=await chromium.launch({...(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}),headless:true});
const page=await browser.newPage({viewport:{width:1600,height:1050}});
const external=[];page.on('request',request=>{const url=new URL(request.url());if(['http:','https:'].includes(url.protocol)&&!['127.0.0.1','localhost'].includes(url.hostname))external.push(request.url());});
const errors=[];page.on('pageerror',e=>errors.push(e.message));

const CLOUD={aws:/\baws\b/i,azure:/\bazure\b/i,gcp:/google cloud/i,ibm:/\bibm\b/i};
const calls=[];
await page.route('**/api/session',r=>r.fulfill({json:{token:'test-token',status:'local-sidecar',cloudExecution:false,mcpEnabled:false,providers:{'claude-code':{installed:true,available:true,canSignInFromApp:true,signedIn:true,loginCommand:'claude auth login'}}}}));
// Stand-in project store (test only) with the same bin semantics as the helper.
const store={projects:new Map(),bin:new Map()};
const summary=(id,file,binned)=>({id,name:file.meta.name,updatedAt:file.meta.updatedAt,blocks:file.design.nodes.length,binnedAt:binned?new Date().toISOString():null});
await page.route('**/api/projects/*',async r=>{
  const action=r.request().url().split('/').pop();const b=r.request().postDataJSON()||{};
  if(action==='list')return r.fulfill({json:{projects:[...store.projects].map(([id,f])=>summary(id,f)),bin:[...store.bin].map(([id,f])=>summary(id,f,true)),folder:'~/.atforma'}});
  if(action==='save'){if(store.bin.has(b.id))return r.fulfill({status:409,json:{detail:'in bin'}});store.projects.set(b.id,b.file);return r.fulfill({json:{saved:true}});}
  if(action==='get')return r.fulfill({json:store.projects.get(b.id)});
  if(action==='trash'){store.bin.set(b.id,store.projects.get(b.id));store.projects.delete(b.id);return r.fulfill({json:{binned:true}});}
  if(action==='restore'){store.projects.set(b.id,store.bin.get(b.id));store.bin.delete(b.id);return r.fulfill({json:{restored:true}});}
  if(action==='purge'){store.bin.delete(b.id);return r.fulfill({json:{deleted:true}});}
});
await page.route('**/api/models',r=>r.fulfill({json:{models:[{id:'claude-opus-5-5',name:'Opus 5.5',efforts:['low','medium','high','xhigh','max'],defaultEffort:'medium'},{id:'claude-sonnet-5',name:'Sonnet 5',efforts:['low','medium','high'],defaultEffort:'medium'}]}}));
await page.route('**/api/architect',async r=>{
  const body=r.request().postDataJSON();calls.push(body);
  const msg=body.message,p=body.project,ctx=body.context||[];
  if(/^Connection check/.test(msg))return r.fulfill({json:{message:'Connected and ready.',phase:'Discovery'}});
  const next=(ctx.find(c=>c.id==='next-question')?.text||'').replace(/^Planner's next question \([^)]*\): /,'').replace(/ Beginner wording:.*$/s,'');
  const workflow=ctx.find(c=>c.id==='workflow')?.text.split(': ')[1];
  const said=ctx.filter(c=>c.id.startsWith('brief-')).flatMap(c=>c.text.replace(/^\w+: /,'').split('\n')).filter(l=>!/^Not sure yet/.test(l)).join(' ');
  const cloud=Object.entries(CLOUD).find(([,re])=>re.test(msg))?.[0];
  let proposal=null;
  if(p.domain==='maintenance'&&cloud)proposal=propose(`Predictive maintenance on ${PROVIDERS[cloud].name}`,p);
  else if(workflow&&(!p.nodes.length||cloud||/sketch/i.test(msg)))proposal=sketch({...p,workflow,brief:{application:said},facts:extractFacts(`${said} ${cloud?`we use ${PROVIDERS[cloud].name}`:''}`)});
  r.fulfill({json:{message:`Model reply. ${next?`Next question: ${next}`:''}`.trim(),phase:'Discovery',...(proposal?.next?{proposal:{baseRevision:p.revision,title:proposal.title,body:proposal.body,next:proposal.next}}:{})}});
});
// Stand-in speech recogniser (test only): "hears" a phrase with a typical slip.
await page.addInitScript(()=>{class FakeSR{static available(){return Promise.resolve('available');}start(){setTimeout(()=>{this.onresult?.({results:[[{transcript:'add rang for our company files'}]]});this.onend?.();},80);}stop(){this.onend?.();}}window.webkitSpeechRecognition=FakeSR;window.SpeechRecognition=FakeSR;});
await page.goto('http://127.0.0.1:5174');
await page.evaluate(()=>localStorage.clear());await page.reload();
const nodes=()=>page.locator('.react-flow__node').count();
const crumbs=()=>page.locator('.crumbs').innerText();
const tab=(name)=>page.getByRole('tab',{name:new RegExp(`^${name}`)}).click();
const replies=()=>page.locator('.msg.assistant').count();
const settle=async(before)=>page.waitForFunction(n=>document.querySelectorAll('.msg.assistant').length>n&&!document.querySelector('.msg.working'),before);
const chat=async(text)=>{const before=await replies();await page.getByLabel('Your message').fill(text);await page.keyboard.press('Enter');await settle(before);};
const quick=async(name)=>{const before=await replies();await page.locator('.prompts').getByRole('button',{name,exact:true}).click();await settle(before);};
const connect=async()=>{const d=page.getByRole('dialog');await d.getByRole('heading',{name:'Check your connection'}).waitFor();await d.getByText('✓ Signed in').waitFor();assert.deepEqual(await d.getByLabel('Model').locator('option').allInnerTexts(),['Opus 5.5','Sonnet 5']);await d.getByRole('radio',{name:'Deep',exact:true}).click();await d.getByRole('button',{name:'Check',exact:true}).click();await d.getByText('✓ Works — Claude · Opus 5.5 · Deep').waitFor();await d.getByRole('button',{name:'Continue'}).click();};
const runTest=async()=>{if(!(await page.locator('.runbar').count())){await tab('Review');await page.getByRole('tab',{name:'Test run'}).click();}await page.locator('.run-button').click();};
const brief=(id)=>page.evaluate(k=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).brief?.[k]||'',id);

// START WITH THE CONNECTION: required, tested with one real message, no way around it.
await page.getByRole('dialog').getByRole('heading',{name:'Check your connection'}).waitFor();
assert.equal(await page.getByRole('dialog').innerText().then(t=>t.split(/\s+/).length<75),true);
assert.equal(await page.getByRole('button',{name:'Close dialog'}).count(),0);
await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),1);
assert.equal(await page.getByText(/Local patterns|without a model|demo/i).count(),0);
await connect();
assert.equal(calls.length,1);assert.match(calls[0].message,/^Connection check/);assert.equal(calls[0].effort,'high');assert.equal(calls[0].model,'claude-opus-5-5');
assert.equal(await page.getByRole('dialog').count(),0);
assert.deepEqual(await page.locator('.modes [role=tab]').allInnerTexts(),['Design','Review','Estimate','Deploy']);
assert.equal(await page.locator('.run-button').count(),0);
await page.getByText('Describe your idea in the chat — it takes shape here.',{exact:true}).waitFor();
assert.equal(await page.locator('.composer textarea').count(),1);
assert.equal(await page.getByRole('button',{name:/Add block|template/i}).count(),0);

// YOU WRITE, IT DRAWS: the concept appears at once from the skills; the model refines it.
await chat('An assistant that answers staff questions from our HR policy documents');
assert.equal(calls.at(-1).stage,'design');
assert.ok(calls.at(-1).context.some(c=>c.id==='workflow'&&/knowledge-assistant/.test(c.text)));
await page.locator('.skills .skill',{hasText:'Skill: RAG'}).waitFor();
await page.locator('.signals span',{hasText:'sketched 3 blocks'}).first().waitFor();
assert.deepEqual(await page.locator('.blk strong').allInnerTexts(),['Your documents','AI that answers from them','Chatbot']);
assert.equal(await page.locator('.layer').count(),0);
await page.locator('.skills .skill',{hasText:'Skill: RAG'}).click();
await page.locator('.peek .knows span',{hasText:'permission-aware retrieval'}).waitFor();
// Consultant order: the skill's own questions first, platform choices last.
assert.match(calls.at(-1).context.find(c=>c.id==='next-question').text,/Where do the files live/);
await chat('PDFs on SharePoint, some contain personal data');
assert.match(await brief('data'),/SharePoint/);
await page.locator('.known-bar').click();
await page.locator('.known-list li.known',{hasText:'PDFs on SharePoint'}).waitFor();
await page.locator('.known-bar').click();
await page.locator('.blk',{hasText:'SharePoint & OneDrive files'}).waitFor();
await page.locator('.prompts').getByRole('button',{name:'Why?'}).click();
await page.getByText('Why I ask: It shapes the RAG design.',{exact:false}).waitFor();
await quick('Not sure');
assert.match(await brief('quality'),/^Not sure yet — assumed/);
await quick('Skip');
await chat('about 300 staff, maybe 2000 questions a month');
assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).facts.some(f=>f.name==='requests.per_month'&&f.value===2000)));
await chat('answers within 5 seconds, data must stay in the EU, and guardrails on the answers');
await page.locator('.signals span',{hasText:'+2 requirements'}).waitFor();
await page.screenshot({path:'/tmp/forma-qa/design-talk.png'});
// Every drawn step is undoable; the concept is redrawn on request.
const blocksBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).nodes.length);
await page.getByRole('button',{name:'Undo'}).click();
assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).nodes.length)<=blocksBefore);
for(let i=0;i<4&&!(await page.getByText('Describe your idea in the chat — it takes shape here.',{exact:true}).count());i++)await page.getByRole('button',{name:'Undo'}).click();
await page.getByText('Describe your idea in the chat — it takes shape here.',{exact:true}).waitFor();
assert.match(await brief('data'),/SharePoint/);
await quick('Sketch it →');
await page.locator('.blk').first().waitFor();
// With live drawing off, changes wait as a preview on the board.
await page.getByLabel('Draw as we talk').uncheck();
await chat('Show this on Azure please');
await page.locator('.preview-bar').getByText('First sketch on Azure',{exact:false}).waitFor();
assert.ok(await page.locator('.react-flow__node.preview').count()>0);
await page.locator('.preview-bar').getByRole('button',{name:'Apply'}).click();
await page.getByLabel('Draw as we talk').check();
assert.match(await page.locator('.react-flow__nodes').innerText(),/Microsoft Foundry models[\s\S]*Azure AI Content Safety/);
// REVIEW: provider-neutral rules, grouped, sourced; accept a risk; add a target.
await tab('Review');
await page.getByRole('region',{name:'Review'}).getByText('No blockers',{exact:false}).waitFor();
const monitoring=page.locator('.finding',{hasText:'No monitoring for model quality or drift.'});
assert.match(await monitoring.innerText(),/Atforma rule REL-001 v1\.0\.0/);
assert.equal(await page.locator('.finding',{hasText:'Sensitive data is involved'}).count(),0);
await monitoring.getByRole('button',{name:'Accept risk'}).click();
await monitoring.getByLabel('Why accept').fill('Pilot with 20 users; manual spot checks weekly');
await monitoring.getByLabel('Risk owner').fill('HR lead');
await monitoring.getByRole('button',{name:'Accept',exact:true}).click();
await monitoring.getByText('Accepted by HR lead',{exact:false}).waitFor();
await page.locator('.finding',{hasText:'No availability target.'}).getByRole('button',{name:'Add target'}).click();
await page.getByRole('region',{name:'Requirements'}).waitFor();
assert.equal(await page.getByLabel('Requirement',{exact:true}).count(),3);
// What we know, and the optional use-case qualification, live beside the requirements.
await page.getByRole('region',{name:'Discover'}).getByText('What we know so far').waitFor();
await page.getByRole('region',{name:'Discover'}).locator('summary').click();
await page.getByRole('button',{name:'Add use case'}).click();
await page.getByLabel('Use case',{exact:true}).first().fill('Answer HR policy questions');
await page.getByRole('button',{name:'Pursue',exact:true}).first().click();
await page.getByRole('button',{name:'Add use case'}).click();
await page.getByLabel('Use case',{exact:true}).nth(1).fill('Automate payroll changes');
await page.getByRole('button',{name:'Rule out',exact:true}).nth(1).click();
// ESTIMATE: quantities from the conversation and usage inputs; prices only with a source.
await tab('Estimate');
const est=page.getByRole('region',{name:'Estimate'});
assert.match(await est.locator('.totals').first().innerText(),/Incomplete/);
await est.getByLabel('Tokens per request (in + out)').fill('3000');
await est.getByLabel('Data stored').fill('40');
for(const [component,price] of [['SharePoint & OneDrive files',0.03],['Microsoft Foundry models',0.004],['Azure AI Content Safety',0.75]])await est.getByLabel(`${component} unit price`).fill(String(price));
await est.getByLabel('Microsoft Foundry models price source').fill('https://example.com/pricing');
assert.match(await est.locator('.totals').first().innerText(),/Incomplete/); // Priced ROM lines still leave coverage/provenance gaps.
// 40×0.03 + 6000×0.004 + 2×0.75 = 1.2 + 24 + 1.5
assert.match(await est.locator('.totals').first().innerText(),/USD 26\.7/);
await page.screenshot({path:'/tmp/forma-qa/estimate.png'});
// DEPLOY: readiness, draft steps, document from project data only.
await tab('Deploy');
await page.getByRole('region',{name:'Deploy'}).getByText('No automated review blockers',{exact:true}).waitFor();
let dl=page.waitForEvent('download');
await page.getByRole('button',{name:'Deployment document',exact:true}).click();
let file=await dl;await file.saveAs('/tmp/forma-qa/document.md');let doc=fs.readFileSync('/tmp/forma-qa/document.md','utf8');
for(const text of ['## 1. Summary','## 4. Data flows','## 5. Security controls','## 6. Requirements','## 8. Cost estimate','## 9. Deployment steps','## 12. Open questions','Responds within 5 s','Data stays in EU','Answers within 10 seconds','https://example.com/pricing','USD 26.7','Accepted risk','HR lead','Answer HR policy questions — **Pursue**','Automate payroll changes — **Rule out**','Estimate — not a bill or guarantee.'])assert.ok(doc.includes(text),text);
// A runnable template keeps everything recorded so far.
await tab('Design');await page.getByRole('tab',{name:'Board'}).click();
await page.getByRole('button',{name:'More'}).click();await page.getByRole('menuitem',{name:'Templates'}).click();
await page.getByRole('button',{name:'Predictive maintenance · AWS',exact:false}).click();
await page.locator('.blk').first().waitFor();
assert.equal(await nodes(),11);
await page.locator('.crumbs button',{hasText:'System'}).click();
await page.locator('.layer').first().waitFor();
assert.equal(await nodes(),6);
await page.waitForTimeout(300);await page.locator('.layer',{hasText:'ML pipeline'}).dblclick();
assert.match(await crumbs(),/System[\s\S]*ML pipeline/);
assert.equal(await nodes(),11);
await page.waitForTimeout(300);
await page.locator('.blk',{hasText:'SageMaker Pipelines training'}).dblclick();
await page.getByRole('region',{name:'Block detail'}).waitFor();
await page.getByRole('button',{name:'Back to the board'}).click();
assert.equal(await page.getByRole('region',{name:'Block detail'}).count(),0);
await page.keyboard.press('Escape');
const decisionsBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).decisions.length);
for(const cloud of ['Azure','Google Cloud','IBM'])await chat(`Show this on ${cloud}`);
assert.match(await page.locator('.react-flow__nodes').innerText(),/watsonx/);
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).decisions.length),decisionsBefore+3);
await page.getByRole('tab',{name:/^Decisions/}).click();
await page.getByLabel('Decision owner').first().fill('Matt');
// Options across the four clouds; the recommendation becomes a decision.
await quick('Compare all four clouds');
await page.getByRole('region',{name:'Options'}).waitFor();
for(const [o,v] of [['AWS',[4,4,5,4]],['Azure',[4,3,4,4]],['Google Cloud',[3,3,4,4]],['IBM',[3,4,3,5]]])for(const [i,c] of ['Cost','Risk','Scalability','Security'].entries())await page.getByLabel(`${o} ${c}`).selectOption(String(v[i]));
assert.equal(await page.locator('.options .total .best').innerText(),'4.3');
const adrs=await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).decisions.filter(d=>d.status!=='Superseded').length);
await page.getByRole('button',{name:'Recommend',exact:true}).nth(1).click();
await page.getByRole('region',{name:'Decisions'}).waitFor();
assert.equal(await page.locator('.adr').count(),adrs+1);
assert.match(await page.getByLabel('Decision options').last().inputValue(),/AWS: 4.3/);
// REVIEW → Test run: clearly labelled, sample data only; failures caught where they happen.
await tab('Review');await page.getByRole('tab',{name:'Test run'}).click();
await page.getByText('No AI model is called, nothing touches a cloud account, and it costs nothing.',{exact:false}).waitFor();
assert.equal(await page.locator('.run-button').innerText(),'Test with sample data');
await runTest();
await page.locator('.run-summary.passed').waitFor({timeout:20000});
assert.equal(await page.locator('.step.passed').count(),11);
assert.equal(await page.locator('.build .checks li.ok').count(),4);
await page.getByRole('button',{name:'Panel',exact:true}).click();
assert.equal(await page.locator('.indicator.passed').count(),11);
await page.getByRole('button',{name:'Diagram',exact:true}).click();
for(const [scenario,message] of [['sensor-dropout',/coverage 55%/],['weak-model',/Model precision = 0.72/],['drift',/Drift detected/],['ungrounded',/Guardrail blocked/],['tool-error',/unavailable/]]){
  await page.getByLabel('Test scenario').selectOption(scenario);
  await runTest();
  await page.locator('.run-summary.failed').waitFor({timeout:20000});
  await page.locator('.step.failed').click();
  assert.match(await page.locator('.error-box').innerText(),message);
  await page.keyboard.press('Escape');
}
await page.screenshot({path:'/tmp/forma-qa/test-run.png'});
await page.getByLabel('Test scenario').selectOption('happy');
await runTest();
await page.locator('.run-summary.passed').waitFor({timeout:20000});
// Deliverables: plan, scale gate and the regenerated document.
await tab('Deploy');
await page.getByRole('region',{name:'Deploy'}).locator('details.extra summary').filter({hasText:'Scale gate'}).click();
await page.getByLabel('Adoption evidence').fill('Two planners used it for a week');
await page.getByRole('button',{name:'Production',exact:true}).click();
dl=page.waitForEvent('download');
await page.getByRole('button',{name:'Export production plan',exact:true}).click();
file=await dl;await file.saveAs('/tmp/forma-qa/plan.json');const plan=JSON.parse(fs.readFileSync('/tmp/forma-qa/plan.json','utf8'));
assert.equal(plan.liveDeploymentEnabled,false);assert.equal(plan.simulationPassed,true);assert.ok(plan.pocScope.length>=10);
dl=page.waitForEvent('download');
await page.getByRole('button',{name:'Deployment document',exact:true}).click();
file=await dl;await file.saveAs('/tmp/forma-qa/document-2.md');doc=fs.readFileSync('/tmp/forma-qa/document-2.md','utf8');
for(const text of ['watsonx','| **Weighted** | — | 4.3','```mermaid','**Owner:** Matt','Met (0.84)','Answer HR policy questions'])assert.ok(doc.includes(text),text);
// Persistence: the connection choice and project survive reload.
await page.reload();
assert.equal(await page.getByRole('dialog').count(),0);
await tab('Design');await page.getByRole('tab',{name:/^Decisions/}).click();
assert.equal(await page.locator('.adr').count(),adrs+1);
// 002: requirements, assumptions, open questions; decision revision; project file round trip.
await page.getByRole('tab',{name:'Requirements'}).click();
const req=page.getByRole('region',{name:'Requirements'});
await req.getByRole('button',{name:'Add'}).nth(0).click();
await req.getByLabel('Requirement',{exact:true}).last().fill('Alerts reach planners within 2 seconds');
await req.getByLabel('Metric').last().fill('p95 latency');await req.getByLabel('Target').last().fill('2');await req.getByLabel('Unit').last().fill('s');
await req.getByLabel('Link a component').nth(3).selectOption({label:'watsonx.ai deployment'});
await req.getByRole('button',{name:'Add'}).nth(1).click();
await req.getByLabel('Assumption',{exact:true}).last().fill('500 pumps report every minute');
await req.getByRole('button',{name:'Add'}).nth(2).click();
await req.getByLabel('Question',{exact:true}).last().fill('Which region must data stay in?');
await page.getByRole('tab',{name:/^Decisions/}).click();
const platform=page.locator('.adr').last();
await platform.getByLabel('Decision status').selectOption('Accepted');
await platform.getByRole('button',{name:'Revise'}).click();
assert.ok(await platform.getByRole('button',{name:'Save revision'}).isDisabled());
await platform.getByLabel('Reason for change').fill('Client prefers existing AWS agreement');
await platform.getByRole('button',{name:'Save revision'}).click();
const revised=page.locator('.adr',{hasText:'Client prefers existing AWS agreement'});
await revised.getByText('History · 1 earlier').waitFor();
assert.equal(await page.locator('.adr').count(),adrs+1);
const revisionBefore=await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).revision);
await page.getByRole('button',{name:'More'}).click();
dl=page.waitForEvent('download');
await page.getByRole('menuitem',{name:'Save project file'}).click();
file=await dl;assert.match(file.suggestedFilename(),/\.atforma\.json$/);await file.saveAs('/tmp/forma-qa/project.atforma.json');
const saved=JSON.parse(fs.readFileSync('/tmp/forma-qa/project.atforma.json','utf8'));
assert.equal(saved.format,'atforma.project');assert.equal(saved.formatVersion,'2.2.0');assert.equal(saved.requirements.at(-1).measure.target,2);assert.ok(saved.discovery.facts.length>=2);assert.equal(saved.discovery.workflow,'knowledge-assistant');assert.ok(Object.keys(saved.estimate.prices).length>=3);
await page.evaluate(()=>localStorage.clear());await page.reload();
await connect();
await page.locator('input[type=file]').setInputFiles('/tmp/forma-qa/project.atforma.json');
await page.getByText('Project opened.',{exact:true}).waitFor();
assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')).revision),revisionBefore);
await page.getByRole('tab',{name:'Requirements'}).click();
assert.equal(await page.getByLabel('Requirement',{exact:true}).last().inputValue(),'Alerts reach planners within 2 seconds');
assert.equal(await page.getByLabel('Assumption',{exact:true}).last().inputValue(),'500 pumps report every minute');
await page.getByRole('tab',{name:/^Decisions/}).click();
await page.getByText('History · 1 earlier').first().waitFor();
await page.getByRole('tab',{name:'Board'}).click();await page.waitForTimeout(300);
await page.locator('.blk',{hasText:'watsonx.ai deployment'}).dblclick();
await page.locator('.linked',{hasText:'Alerts reach planners within 2 seconds'}).waitFor();
await page.keyboard.press('Escape');await page.keyboard.press('Escape');
// Pulumi, templates, import, connections, palette.
await tab('Deploy');
await page.getByRole('button',{name:'Pulumi',exact:true}).click();
const zipPromise=page.waitForEvent('download');
await page.getByRole('button',{name:/Export .* Pulumi scaffold/}).click();
assert.match((await zipPromise).suggestedFilename(),/^atforma-.*pulumi.zip$/);
await page.getByLabel('Import Pulumi snapshot').setInputFiles({name:'state.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({deployment:{resources:[{urn:'urn:pulumi:dev::test::gcp:storage/bucket:Bucket::ai-data',type:'gcp:storage/bucket:Bucket',outputs:{secret:'NOT_FOR_CANVAS'}}]}}))});
await page.getByText('1 resource references imported',{exact:true}).waitFor();
await page.getByRole('button',{name:'Close dialog'}).click();
await tab('Design');await page.getByRole('tab',{name:'Board'}).click();
await page.getByRole('button',{name:'More'}).click();await page.getByRole('menuitem',{name:'Templates'}).click();
await page.getByRole('button',{name:'Predictive maintenance · IBM',exact:false}).click();
assert.equal(await nodes(),11);
await page.getByRole('tab',{name:/^Decisions/}).click();
assert.equal(await page.locator('.adr').count(),adrs+1);
await page.getByRole('tab',{name:'Board'}).click();
await page.locator('.model').click();
await page.getByRole('dialog').getByRole('heading',{name:'Connection'}).waitFor();assert.ok(await page.getByRole('radio',{name:'Grok'}).count());await page.getByRole('button',{name:'Close dialog'}).click();
await page.getByRole('button',{name:'More'}).click();
await page.getByRole('menuitem',{name:'Import diagram'}).click();
await page.getByRole('button',{name:'Import as architecture',exact:true}).click();
assert.equal(await nodes(),3);
await tab('Review');await page.getByRole('tab',{name:'Test run'}).click();
await page.getByText("This design is a sketch, so it can't be test-run yet.",{exact:false}).waitFor();
assert.equal(await page.locator('.run-button').count(),0);
await tab('Design');
await page.getByRole('button',{name:'More'}).click();await page.getByRole('menuitem',{name:'Add a block'}).click();
await page.getByLabel('Search blocks').fill('model monitor');
await page.keyboard.press('Enter');
await page.locator('.blk',{hasText:'SageMaker Model Monitor'}).waitFor();
// Board editing: right-click → comment; the model hears about the change next turn.
await tab('Design');await page.getByRole('tab',{name:'Board'}).click();
await page.locator('.react-flow__pane').click({button:'right',position:{x:200,y:200}});
await page.getByRole('menuitem',{name:'Add comment here'}).click();
await page.waitForFunction(()=>document.activeElement?.getAttribute('aria-label')==='Comment');
await page.keyboard.type('Pilot with HR first');
await page.getByRole('button',{name:'Auto-arrange'}).click();await page.locator('.composer textarea').click();
await chat('Take my note into account');
assert.match(calls.at(-1).context.find(c=>c.id==='canvas-changes')?.text||'',/added note “Pilot with HR first”/);
// Select all, delete, undo; clear board, undo.
const total=await nodes();
await page.locator('.react-flow__pane').click({position:{x:300,y:300}});
await page.keyboard.press('ControlOrMeta+a');
await page.locator('.preview-bar',{hasText:`${total} selected`}).waitFor();
await page.locator('.preview-bar').getByRole('button',{name:'Delete'}).click();
assert.equal(await nodes(),0);
await page.getByRole('button',{name:'Undo'}).click();
assert.equal(await nodes(),total);
await page.getByRole('button',{name:'Clear board'}).click();
assert.equal(await nodes(),0);
await page.getByRole('button',{name:'Undo'}).click();
assert.equal(await nodes(),total);
// Projects: autosaved under your account; new, reopen, bin, restore, delete forever.
await page.waitForTimeout(1200);
const firstName=await page.locator('.project-name').inputValue();const firstBlocks=await nodes();
await page.getByRole('button',{name:'Projects'}).first().click();
await page.locator('.project-list li.current',{hasText:'open now'}).waitFor();
await page.getByRole('dialog').getByRole('button',{name:'New project'}).click();
await page.getByRole('dialog').getByRole('button',{name:'Start over without download',exact:true}).click();
assert.equal(await nodes(),0);assert.equal(await page.locator('.project-name').inputValue(),'New project');
await chat('A chatbot for our sales playbooks');
await page.locator('.blk').first().waitFor();await page.waitForTimeout(1200);
await page.getByRole('button',{name:'Projects'}).first().click();
await page.getByRole('dialog').locator('.project-list li',{hasText:firstName}).locator('.open').click();
await page.waitForFunction(n=>document.querySelectorAll('.react-flow__node').length===n,firstBlocks);
assert.equal(await page.locator('.project-name').inputValue(),firstName);
await page.getByRole('button',{name:'Projects'}).first().click();
await page.getByRole('button',{name:/Move A chatbot for our sales playbooks to the bin/}).click();
await page.locator('.bin-list summary',{hasText:'Rubbish bin · 1'}).click();
await page.locator('.bin-list').getByRole('button',{name:'Restore'}).click();
await page.getByRole('dialog').locator('.project-list li',{hasText:'A chatbot for our sales playbooks'}).waitFor();
await page.getByRole('button',{name:/Move A chatbot for our sales playbooks to the bin/}).click();
await page.locator('.bin-list summary').click();
await page.locator('.bin-list').getByRole('button',{name:'Delete',exact:true}).click();
await page.locator('.bin-list').getByRole('button',{name:'Delete forever?'}).click();
assert.equal(store.bin.size,0);assert.ok([...store.projects.values()].some(f=>f.meta.name===firstName));
await page.getByRole('button',{name:'Close dialog'}).click();
// Voice: words land in the box to edit; the model is told it was dictated.
await tab('Design');
await page.getByRole('button',{name:'Speak'}).click();
await page.waitForFunction(()=>document.querySelector('.composer textarea').value.includes('add rang for our company files'));
const beforeVoice=await replies();await page.getByLabel('Your message').focus();await page.keyboard.press('Enter');await settle(beforeVoice);
assert.match(calls.at(-1).message,/^add rang for our company files[\s\S]*Dictated by voice/);
await page.setViewportSize({width:390,height:844});
await tab('Design');
await page.screenshot({path:'/tmp/forma-qa/mobile.png',fullPage:true});
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
await browser.close();console.log('Browser smoke checks passed: required model connection tested first, one chat with the board drawing as you talk (live and preview), quick replies, notes, undo, Review (rules, accepted risk, add target), Estimate (usage + sourced prices), Deploy (readiness, document), Design (drill-down, four-cloud drafts, options, decisions), test run (five failure scenarios, success criteria, scale gate), plan and deployment document, requirements and decision revision, project file save → clear → open, persistence, Pulumi, templates, import, connections, palette and mobile.');
