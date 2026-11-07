// Synthetic browser speech + architect transport; never uses microphone, credentials or real memory.
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
const provided = process.env.ATMEM_ARCHITECT_VOICE_TEST_URL;
let server;
let base = provided;
if (!base) {
 const probe=createServer();
 await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
 const port=probe.address().port; await new Promise(resolve=>probe.close(resolve));
 base=`http://127.0.0.1:${port}`;
 server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:new URL('..',import.meta.url),stdio:'ignore'});
}
let browser;
try {
 for(let n=0;n<100;n++){
  if(server && server.exitCode !== null) throw Error('Isolated voice test server exited');
  try {if((await fetch(base)).ok)break;}catch{}
  if(n===99)throw Error('Voice test server did not start');
  await new Promise(r=>setTimeout(r,100));
 }
 browser = await chromium.launch({headless:true});
 const context = await browser.newContext({viewport:{width:1440,height:1000}});
 const page = await context.newPage(); const errors=[], requests=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{
  localStorage.setItem('atforma-connection-v1',JSON.stringify({provider:'claude-code',model:'synthetic-voice-test'}));
  window.__voice={instances:[],spoken:[],cancels:0};
  class Recognition {
   constructor(){window.__voice.instances.push(this);}
   start(){this.onstart?.();}
   abort(){this.aborted=true;this.onend?.();}
   result(text,final=true){const r=[{transcript:text}];r.isFinal=final;this.onresult?.({results:[r]});}
  }
  class Utterance {constructor(text){this.text=text;}}
  Object.defineProperty(window,'SpeechRecognition',{value:Recognition,configurable:true});
  Object.defineProperty(window,'SpeechSynthesisUtterance',{value:Utterance,configurable:true});
  Object.defineProperty(window,'speechSynthesis',{value:{speak:u=>window.__voice.spoken.push(u),cancel:()=>window.__voice.cancels++,getVoices:()=>[]},configurable:true});
 });
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url());
  let body={projects:[],bin:[],folder:'',enabled:false,records:[],preferences:[],skills:[],health:{available:false}};
  if(url.pathname==='/api/session')body={status:'local-sidecar',token:'synthetic-no-provider-access',capabilities:{}};
  if(url.pathname==='/api/architect'){
   const request=route.request().postDataJSON();requests.push(request);
   body={message:'We can design that together. Which cloud do you use?'};
  }
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
 });
 let confirmations=0;
 page.on('dialog',async dialog=>{confirmations++;await dialog.accept();});
 await page.goto(base);await page.getByRole('button',{name:'Start voice conversation',exact:true}).waitFor();
 await page.waitForTimeout(500);
 await page.getByRole('button',{name:'Start voice conversation',exact:true}).click();
 await page.getByText('Listening — pause when you finish to send your message.',{exact:true}).waitFor();
 assert.equal(confirmations,1,'browser speech consent is explicit');
 // Reproduce the reported immediate browser end. It must reconnect visibly.
 await page.evaluate(()=>window.__voice.instances.at(-1).onend());
 await page.getByText('Reconnecting microphone…',{exact:true}).waitFor();
 await page.waitForFunction(()=>window.__voice.instances.length===2);
 await page.evaluate(()=>window.__voice.instances.at(-1).result('Build a document assistant'));
 await page.getByRole('button',{name:'Interrupt and speak',exact:true}).waitFor();
 assert.ok(requests.some(r=>r.message.startsWith('Build a document assistant')&&r.message.includes('Dictated by voice')));
 assert.equal(await page.evaluate(()=>window.__voice.instances.length),2,'capture paused during playback');
 assert.match(await page.evaluate(()=>window.__voice.spoken[0].text),/Which cloud/);
 await page.evaluate(()=>window.__voice.spoken.at(-1).onend());
 await page.waitForFunction(()=>window.__voice.instances.length===3);
 await page.evaluate(()=>window.__voice.instances.at(-1).result('Use Azure in Australia'));
 await page.getByRole('button',{name:'Interrupt and speak',exact:true}).waitFor();
 assert.equal(requests.filter(r=>r.message.startsWith('Use Azure in Australia')).length,1);
 await page.getByRole('button',{name:'Interrupt and speak',exact:true}).click();
 await page.getByText('Listening — pause when you finish to send your message.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Stop voice conversation',exact:true}).click();
 const count=await page.evaluate(()=>window.__voice.instances.length);
 await page.waitForTimeout(1300);
 assert.equal(await page.evaluate(()=>window.__voice.instances.length),count,'stop prevents restart');
 // Permission error persists; it is not hidden behind a short toast.
 await page.getByRole('button',{name:'Start voice conversation',exact:true}).click();
 await page.evaluate(()=>window.__voice.instances.at(-1).onerror({error:'not-allowed'}));
 await page.getByText(/Microphone access is blocked/).waitFor();
 await page.getByRole('button',{name:'Start voice conversation',exact:true}).waitFor();
 assert.equal(confirmations,1,'consent remembered for the same browser context');
 // Starting/stopping during an interim draft must preserve text without sending it.
 await page.getByRole('button',{name:'Start voice conversation',exact:true}).click();
 await page.evaluate(()=>window.__voice.instances.at(-1).result('unfinished draft',false));
 await page.getByRole('button',{name:'Stop voice conversation',exact:true}).click();
 assert.equal(await page.getByLabel('Your message').inputValue(),'unfinished draft');
 assert.equal(requests.filter(r=>r.message.startsWith('unfinished draft')).length,0);
 fs.mkdirSync('/private/tmp/atmem-architect-voice',{recursive:true});
 await page.screenshot({path:'/private/tmp/atmem-architect-voice/desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});
 // Existing workbench has a canvas wider than mobile; verify the new status itself fits.
 const status=page.locator('.voice-status');
 await page.getByLabel('Your message').fill('');
 await page.getByRole('button',{name:'Start voice conversation',exact:true}).click();
 await page.evaluate(()=>window.__voice.instances.at(-1).onerror({error:'network'}));
 await page.getByText(/browser speech service could not connect/).waitFor();
 const box=await status.boundingBox();
 assert.ok(box && box.x>=0 && box.x+box.width<=390,'voice error fits the mobile viewport');
 assert.deepEqual(errors,[]);
 await page.screenshot({path:'/private/tmp/atmem-architect-voice/mobile.png',fullPage:true});
 console.log('Voice UI passed: consent, immediate-end recovery, two turns, real send-path payloads, playback, interrupt, stop, permission error and draft preservation. Speech/model transports were synthetic.');
 await context.close();
} finally {await browser?.close();server?.kill("SIGTERM");}
