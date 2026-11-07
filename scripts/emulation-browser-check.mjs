// Real emulation HTTP endpoint + real generated code, in an isolated test browser.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {chromium} from '@playwright/test';
import {CLOUD_STORAGE_SCENARIOS} from '../src/cloud-storage-scenarios.mjs';
import {toProjectFile} from '../src/project-file.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'.local/emulation-browser',new Date().toISOString().replaceAll(':','-'));fs.mkdirSync(out,{recursive:true});
// Freeze tested code so concurrent development cannot HMR away an in-flight report.
const source=path.join(out,'source');fs.mkdirSync(source,{recursive:true});
for(const name of ['src','server','scripts','agent-skills','.specify','public','index.html','vite.config.mjs','package.json'])if(fs.existsSync(path.join(root,name)))fs.cpSync(path.join(root,name),path.join(source,name),{recursive:true,filter:p=>!p.split(path.sep).includes('__pycache__')});
for(const name of ['node_modules','.venv','.memory-venv'])if(fs.existsSync(path.join(root,name)))fs.symlinkSync(path.join(root,name),path.join(source,name),'dir');
fs.mkdirSync(path.join(source,'.local'),{recursive:true});fs.symlinkSync(path.join(root,'.local/cloud-emulators'),path.join(source,'.local/cloud-emulators'),'dir');
async function port(){const server=createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const p=server.address().port;await new Promise(r=>server.close(r));return p;}
const ui=await port(),api=await port(),base=`http://127.0.0.1:${ui}`;
const env={PATH:process.env.PATH,HOME:out,ATMEM_ARCHITECT_HOME:path.join(out,'home'),ATMEM_ARCHITECT_PORT:String(ui),ATMEM_ARCHITECT_SIDECAR_PORT:String(api)};
const log=fs.openSync(path.join(out,'services.log'),'a');const children=[];let browser,page;let succeeded=false;const results=[];
function start(bin,args){children.push(spawn(bin,args,{cwd:source,env,stdio:['ignore',log,log]}));}
try{
 start(path.join(root,'.venv/bin/python'),['-m','uvicorn','server.app:app','--host','127.0.0.1','--port',String(api),'--no-access-log']);
 start(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(ui),'--strictPort']);
 for(const url of [base,`http://127.0.0.1:${api}/api/session`])for(let i=0;i<200;i++){try{if((await fetch(url)).ok)break;}catch{}if(i===199)throw Error('Service failed to start');await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({headless:true});page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('response',async r=>{if(r.url().endsWith('/api/emulation/run')){try{fs.appendFileSync(path.join(out,'http-results.jsonl'),JSON.stringify(await r.json())+'\n');}catch{}}});
 await page.addInitScript(()=>localStorage.setItem('atforma-connection-v1',JSON.stringify({provider:'claude-code',model:'default'})));
 await page.route('**/api/session',async route=>{const response=await route.fetch();const body=await response.json();await route.fulfill({json:{...body,providers:{...body.providers,'claude-code':{available:true,signedIn:true}}}});});
 await page.route('**/api/architect',r=>r.fulfill({json:{message:'UI test: no model call.',proposal:null}}));
 await page.route('**/api/memory/**',r=>r.fulfill({json:{status:'disabled'}}));
 await page.goto(base);
 const scenario='07-enterprise-connectors';await page.locator('input[type=file]').setInputFiles(path.join(root,'examples/aws',scenario,'project.atmem-ai-architect.json'));
 await page.getByText('Project opened.',{exact:true}).waitFor();
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Outputs',exact:true}).click();
 const panel=page.getByRole('complementary',{name:'Cloud emulation'});await panel.getByRole('button',{name:'Emulate locally',exact:true}).click();
 await panel.getByRole('heading',{name:'Local emulation checks passed',exact:true}).waitFor({timeout:115000});
 assert.match(await panel.innerText(),/IAM enforcement/);assert.match(await panel.innerText(),/not.*model-quality/);
 const download=page.waitForEvent('download');await panel.getByRole('button',{name:'Download emulation report'}).click();const file=await download;await file.saveAs(path.join(out,'report.json'));
 const report=JSON.parse(fs.readFileSync(path.join(out,'report.json'),'utf8'));assert.equal(report.backend,'moto');assert.equal(report.status,'passed');assert.equal(report.cloudOperations,false);assert.ok(report.emulatorPatches.length);assert.ok(report.fileDigests['main.tf.json']);
 const zipDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download reviewed ZIP',exact:true}).click();await (await zipDownload).saveAs(path.join(out,'delivery.zip'));
 const exported=unzipSync(fs.readFileSync(path.join(out,'delivery.zip')));
 for(const [name,digest] of Object.entries(report.fileDigests)){assert.ok(exported['terraform/'+name],name);assert.equal(createHash('sha256').update(exported['terraform/'+name]).digest('hex'),digest,name);}
 results.push('Emulation report hashes match every Terraform/runtime file in the downloaded delivery ZIP');
 await page.screenshot({path:path.join(out,'emulation.png'),fullPage:true});results.push('Real API emulates emitted connector/RAG code before ZIP download');results.push('Downloadable report includes artifact hashes and unverified boundaries');
 // A different project must not inherit an old emulation pass.
 await page.getByRole('button',{name:'More',exact:true}).click();const chooser=page.waitForEvent('filechooser');await page.getByRole('menuitem',{name:'Open project file',exact:true}).click();await (await chooser).setFiles(path.join(root,'examples/aws/02-document-compute/project.atmem-ai-architect.json'));
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Outputs',exact:true}).click();
 assert.equal(await page.getByRole('heading',{name:'Local emulation checks passed',exact:true}).count(),0);results.push('Changing the project clears old results');assert.deepEqual(errors,[]);
 // A missing explicit permission is corrected through the normal model proposal path.
 const incomplete=structuredClone(CLOUD_STORAGE_SCENARIOS[0].project);delete incomplete.edges[0].access;
 const fixture=path.join(out,'missing-access.atmem-ai-architect.json');fs.writeFileSync(fixture,JSON.stringify(toProjectFile(incomplete)));
 let coachingCalls=0;const testedRevisions=[];
 page.on('response',async r=>{if(r.url().endsWith('/api/emulation/run')){try{testedRevisions.push(await r.json());}catch{}}});
 await page.unroute('**/api/architect');
 await page.route('**/api/architect',route=>{
  const request=route.request().postDataJSON();
  if(request.origin!=='emulation')return route.fulfill({json:{message:'No unrelated change.',proposal:null}});
  coachingCalls++;
  if(request.project.edges[0].access)return route.fulfill({json:{message:'The generated client now passes local checks. The next question is which reviewed principal will be used for a real account plan?',proposal:null}});
  const next=structuredClone(request.project);next.edges[0].access='storage-object-admin';
  return route.fulfill({json:{message:'Your storage and existing caller are already drawn. I can bind the requested upload/read/delete permission without changing either component.',proposal:{title:'Bind the requested storage permission',body:'Use the explicit object CRUD contract already required by this scenario.',baseRevision:request.project.revision,next}}});
 });
 await page.locator('input[type=file]').setInputFiles(fixture);
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3'))?.id==='qualification-azure-storage');
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Emulate & improve',exact:true}).click();
 await page.getByRole('complementary',{name:'Cloud emulation'}).getByRole('button',{name:'Emulate locally',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3'))?.edges[0]?.access==='storage-object-admin',{},{timeout:30000});
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Emulate & improve',exact:true}).click();
 await page.getByRole('heading',{name:'Local emulation checks passed',exact:true}).waitFor({timeout:115000});
 await page.waitForFunction(()=>!document.querySelector('.msg.working'));
 assert.equal(coachingCalls,2);assert.deepEqual(testedRevisions.map(r=>r.status),['blocked','passed']);assert.ok(testedRevisions[1].designRevision>testedRevisions[0].designRevision);
 results.push('Automatic mentor fills missing permission through an undoable proposal, then retests the fresh artifact once');
 await page.screenshot({path:path.join(out,'mentor-correction.png'),fullPage:true});
 await page.keyboard.press('ControlOrMeta+z');
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Emulate & improve',exact:true}).click();
 await page.getByText('Design changed — rerun needed.',{exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Local emulation checks passed',exact:true}).count(),0);
 results.push('Undo invalidates correction evidence without automatically reapplying the correction');
 // A repeatedly revising model must not create an unbounded background loop.
 await page.unroute('**/api/architect');let loopCalls=0;
 await page.route('**/api/architect',route=>{
  const request=route.request().postDataJSON();
  if(request.origin!=='emulation')return route.fulfill({json:{message:'No unrelated change.',proposal:null}});
  loopCalls++;const next=structuredClone(request.project);next.edges[0].access='storage-object-admin';next.nodes[0].data.label=`Storage correction ${loopCalls}`;
  return route.fulfill({json:{message:'Synthetic repeated correction to test the loop bound.',proposal:{title:`Bound test ${loopCalls}`,body:'Fixture only.',baseRevision:request.project.revision,next}}});
 });
 await page.getByRole('complementary',{name:'Cloud emulation'}).getByRole('button',{name:'Emulate locally',exact:true}).click();
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Emulate & improve',exact:true}).click();
 // Applied proposals return to the board; navigate again after the final bounded turn.
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3'))?.nodes[0]?.data.label==='Storage correction 3',{},{timeout:115000});
 await page.getByRole('region',{name:'Architecture journey'}).getByRole('button',{name:'Emulate & improve',exact:true}).click();
 await page.getByText('Two automatic retests are complete. Review the latest correction, then choose Emulate locally to continue.',{exact:true}).waitFor();
 assert.equal(loopCalls,3);assert.equal(testedRevisions.length,5);
 results.push('Repeated model corrections stop after two automatic retests and explain how to continue');
 // Provider exhaustion must explain recovery and preserve both design and local evidence.
 await page.unroute('**/api/architect');
 await page.route('**/api/architect',route=>route.fulfill({status:429,json:{detail:'The selected architect has reached its usage or rate limit. Wait for the provider reset or choose another connected architect. Your design is preserved; no correction was applied.'}}));
 const beforeOutage=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('atforma-workspace-v3'));return {revision:p.revision,nodes:p.nodes,edges:p.edges};});
 await page.getByRole('complementary',{name:'Cloud emulation'}).getByRole('button',{name:'Emulate locally',exact:true}).click();
 await page.locator('.msg').filter({hasText:'The selected architect has reached its usage or rate limit.'}).last().waitFor({timeout:115000});
 const afterOutage=await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('atforma-workspace-v3'));return {revision:p.revision,nodes:p.nodes,edges:p.edges};});
 assert.deepEqual(afterOutage,beforeOutage);
 assert.equal(await page.getByRole('heading',{name:'Local emulation checks passed',exact:true}).count(),1);
 results.push('Provider usage-limit guidance preserves the design and successful local test evidence');
 assert.deepEqual(errors,[]);
 succeeded=true;
 console.log(JSON.stringify({status:'passed',checks:results,evidence:out}));
}catch(error){if(page){fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});}throw error;}finally{await browser?.close();for(const child of children)child.kill('SIGTERM');fs.closeSync(log);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({status:succeeded?'passed':'failed',evidenceKind:'fixture-model-browser-regression',checks:results,cloudOperations:false},null,2)+'\n');}
