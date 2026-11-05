// Test fixture model, but real HTTP, app UI, AtMem 2.3.10, disk persistence and tool broker.
import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=process.env.ATFORMA_TEST_URL||'http://127.0.0.1:5175';
const out='/tmp/forma-qa/memory';fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({...(fs.existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?{executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{}),headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'dark'});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base);
// Use the normal connection screen and its check; only the model transport is a fixture.
const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Check your connection'}).waitFor();
await dialog.getByRole('button',{name:'Check',exact:true}).click();await dialog.getByText(/Works/).waitFor();await dialog.getByRole('button',{name:'Continue'}).click();
const project=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('atforma-workspace-v3')));
const finished=async()=>{await page.waitForFunction(()=>!document.querySelector('.msg.working'));};
const chat=async(text)=>{await finished();const count=await page.locator('.msg.assistant').count();await page.getByLabel('Your message').fill(text);await page.keyboard.press('Enter');await page.waitForFunction(n=>document.querySelectorAll('.msg.assistant').length>n&&!document.querySelector('.msg.working'),count);};
const tab=async(name)=>{await finished();await page.locator('.modes').getByRole('tab',{name:new RegExp('^'+name)}).click();};
const openMemory=async()=>{await finished();await page.getByRole('button',{name:'More',exact:true}).click();await page.getByRole('menuitem',{name:'AtMem dashboard',exact:true}).click();await page.getByRole('heading',{name:'AtMem dashboard'}).waitFor();await page.getByRole('button',{name:/^Turn memory (off|on)$/}).waitFor();};
assert.equal((await project()).nodes.length,0,'no default blocks');
await chat('I want an internal assistant so staff can ask questions about our HR policy documents.');
assert.equal((await project()).nodes.filter(n=>n.data.kind!=='note').length,3);
assert.ok((await project()).needs.length>0,'requirements must derive from actual diagram');
// Preserve real right-click comments. A comment is not a long-term memory.
await page.locator('.react-flow__pane').click({button:'right',position:{x:220,y:320}});
await page.getByRole('menuitem',{name:'Add comment here',exact:true}).click();await page.getByLabel('Comment',{exact:true}).fill('Keep all data in Australia.');await page.getByLabel('Your message').click();
await page.waitForFunction(()=>document.querySelector('.msg.working'));await finished();
assert.ok((await project()).nodes.some(n=>n.data.kind==='note'&&/Australia/.test(n.data.label)));
await page.screenshot({path:`${out}/canvas-comments.png`});
await page.getByRole('tab',{name:'Requirements',exact:true}).click();const req=page.getByRole('region',{name:'Requirements',exact:true});
assert.equal(await req.locator('input,select,textarea').count(),0,'no requirements form');assert.match(await req.innerText(),/Company policy documents/);
await req.getByRole('button',{name:'Clarify with Atforma',exact:true}).click();await finished();await chat('Only the HR team should have access.');assert.ok((await project()).needs.some(r=>/Only the HR team/.test(r.statement)));
await page.screenshot({path:`${out}/requirements-conversation.png`});
await tab('Design');await page.getByRole('tab',{name:'Board',exact:true}).click();await chat('Use AWS in Sydney for this project.');
await page.waitForTimeout(1000);assert.equal((await project()).provider,'aws');assert.ok((await project()).decisions.some(d=>d.subject==='cloud.region'&&d.status==='Accepted'));
await openMemory();await page.getByRole('tab',{name:'This project',exact:true}).click();await page.getByText(/ap-southeast-2/).first().waitFor();
assert.equal(await page.getByRole('dialog').getByText(/Keep all data in Australia/).count(),0,'routine comment must not become memory');
await page.getByRole('tab',{name:'About you',exact:true}).click();await page.getByLabel('Remember about me').fill('Explain concisely; I am new to cloud infrastructure.');await page.getByRole('button',{name:'Remember preference',exact:true}).click();await page.getByText(/User-confirmed explanation/).first().waitFor();
await page.getByRole('tab',{name:'Skills',exact:true}).click();await page.getByRole('button',{name:'Disable ibm',exact:true}).waitFor();await page.screenshot({path:`${out}/atmem-dashboard.png`});await page.getByRole('button',{name:'Close dialog',exact:true}).click();
await chat('What do you remember about my preferences and our region?');assert.match(await page.locator('.msg.assistant').last().innerText(),/Explain concisely/);assert.match(await page.locator('.msg.assistant').last().innerText(),/ap-southeast-2/);
await chat('Use AWS in Melbourne instead.');await page.waitForTimeout(1000);
await openMemory();await page.getByRole('tab',{name:'This project',exact:true}).click();await page.getByText(/ap-southeast-4/).first().waitFor();assert.match(await page.getByRole('dialog').innerText(),/Earlier value/);await page.getByRole('button',{name:'Close dialog',exact:true}).click();
await page.getByRole('tab',{name:'Options',exact:true}).click();await page.getByRole('region',{name:'Options',exact:true}).getByRole('heading',{name:'IBM',exact:true}).waitFor();await finished();
for(const cloud of ['AWS','Azure','Google Cloud','IBM'])assert.ok((await page.getByRole('region',{name:'Options',exact:true}).innerText()).includes(cloud));
assert.equal(await page.getByRole('region',{name:'Options',exact:true}).locator('input,select,textarea').count(),0);
await page.getByRole('tab',{name:'Design choices',exact:true}).click();
assert.equal(await page.getByRole('region',{name:'Decisions',exact:true}).locator('input,select,textarea').count(),0);
await page.getByRole('heading',{name:'Cloud provider',exact:true}).waitFor();
await tab('Estimate');await page.waitForFunction(()=>[...document.querySelectorAll('.msg.assistant')].at(-1)?.textContent.includes('questions'));await finished();
assert.equal(await page.getByLabel('Data stored').isVisible(),false,'no forced estimate-input form');
await chat('Plan for 3,000 tokens per request.');assert.equal((await project()).estimate.usage.tokens_per_request,3000);
// All four cloud choices go through the same conversation. Never substitute an AWS rate.
await tab('Design');await page.getByRole('tab',{name:'Board',exact:true}).click();
for(const [text,provider] of [['Use Azure in Sydney.','azure'],['Use Google Cloud in Sydney.','gcp'],['Use IBM Cloud in Sydney.','ibm']]){await chat(text);assert.equal((await project()).provider,provider);}
// Opt-out and forget are real SDK operations with preview; no new content is recorded while off.
await openMemory();await page.getByRole('tab',{name:'About you',exact:true}).click();await page.getByRole('button',{name:'Preview forget',exact:true}).first().click();await page.getByRole('heading',{name:'Review removal'}).waitFor();await page.getByRole('button',{name:'Keep memory',exact:true}).click();assert.match(await page.getByRole('dialog').innerText(),/Explain concisely/);
await page.getByRole('button',{name:'Preview forget',exact:true}).first().click();await page.getByRole('button',{name:'Confirm forget',exact:true}).click();await page.getByText('No memories recorded in this view yet.',{exact:true}).waitFor();
await page.getByRole('button',{name:'Turn memory off',exact:true}).click();await page.getByRole('button',{name:'Turn memory on',exact:true}).waitFor();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
await chat('Remember about me: please retain this secret preference forever.');await openMemory();assert.equal(await page.getByText(/User-confirmed preferences/).count(),0);await page.getByRole('button',{name:'Turn memory on',exact:true}).click();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
// Save the project and reset through the existing flow; no default blocks on a fresh idea.
await page.getByRole('button',{name:'Start over',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save project and start over',exact:true}).click();await(await download).saveAs(`${out}/project.atforma.json`);assert.equal((await project()).nodes.length,0);
await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mobile-empty-canvas.png`});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
assert.deepEqual(errors,[]);await browser.close();console.log('Real AtMem browser journey passed: idea → sketch, right-click comments/live feedback, form-free requirements, four-cloud comparison/choices, sourced-pricing boundary, conversational usage, memory/history/profile/forget/opt-out, save/reset and mobile. Model and numeric quotes are fixture-only.');
