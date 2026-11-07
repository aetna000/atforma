import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VoiceConversation, speechText} from '../src/voice-conversation.mjs';

function setup(overrides = {}) {
  const instances = [], spoken = [], turns = [], states = [], errors = [], drafts = [];
  let time = 0, sequence = 0;
  const timers = new Map();
  class Recognition {
    constructor() { instances.push(this); }
    start() { this.onstart?.(); }
    abort() { this.aborted = true; this.onend?.(); }
    result(text, final = true) {
      const result = [{transcript:text}]; result.isFinal = final;
      this.onresult?.({results:[result]});
    }
    end() { this.onend?.(); }
    error(error) { this.onerror?.({error}); this.onend?.(); }
  }
  class Utterance { constructor(text) { this.text = text; } }
  const synthesis = {cancelled:0, cancel() { this.cancelled++; }, speak(u) { spoken.push(u); }, getVoices:() => []};
  const voice = new VoiceConversation({Recognition, Utterance, synthesis,
    onTurn: async text => { turns.push(text); return 'Which cloud do you use?'; },
    onState:s => states.push(s), onError:e => errors.push(e), onDraft:t => drafts.push(t),
    now:() => time, schedule:(fn, ms) => { const id=++sequence; timers.set(id,{fn,at:time+ms}); return id; },
    cancel:id => timers.delete(id), ...overrides});
  async function tick(ms) {
    const target = time + ms;
    while (true) {
      const due = [...timers].filter(([,v]) => v.at <= target).sort((a,b) => a[1].at-b[1].at)[0];
      if (!due) break;
      time=due[1].at; timers.delete(due[0]); due[1].fn(); await Promise.resolve(); await Promise.resolve();
    }
    time=target; await Promise.resolve(); await Promise.resolve();
  }
  return {voice,instances,spoken,turns,states,errors,drafts,synthesis,tick};
}

test('two spoken turns auto-send, play replies and reopen capture without echo',async()=>{
 const h=setup(); h.voice.start(); const first=h.instances[0];
 first.result('Build a support assistant'); await h.tick(1100);
 assert.deepEqual(h.turns,['Build a support assistant']); assert.equal(first.aborted,true);
 assert.equal(h.voice.phase,'speaking'); assert.equal(h.instances.length,1);
 h.spoken[0].onend(); await h.tick(250); assert.equal(h.instances.length,2);
 h.instances[1].result('We use Azure'); h.instances[1].end(); await h.tick(0);
 assert.deepEqual(h.turns,['Build a support assistant','We use Azure']);
 h.voice.stop();
});
test('unexpected immediate end restarts instead of silently switching off',async()=>{
 const h=setup();h.voice.start();h.instances[0].end();
 assert.equal(h.voice.phase,'reconnecting');await h.tick(1000);
 assert.equal(h.instances.length,2);assert.equal(h.voice.active,true);h.voice.stop();
});
test('repeated immediate endings stop with actionable status rather than a hot loop',async()=>{
 const h=setup();h.voice.start();
 for(const delay of [1000,2000,4000,0]){h.instances.at(-1).end();await h.tick(delay);}
 assert.equal(h.voice.phase,'error');assert.equal(h.instances.length,4);assert.match(h.errors[0],/keeps stopping/);
});
test('interim words stay as draft and never cause a premature send',async()=>{
 const h=setup();h.voice.start();h.instances[0].result('partial thought',false);await h.tick(2000);
 assert.equal(h.turns.length,0);h.instances[0].end();assert.match(h.errors[0],/Review the draft/);
 assert.equal(h.drafts[0],'partial thought');assert.equal(h.turns.length,0);
});
test('additional speech resets silence timer and sends cumulative final only once',async()=>{
 const h=setup();h.voice.start();h.instances[0].result('Use AWS');await h.tick(900);
 h.instances[0].result('Use AWS in Sydney');await h.tick(1099);assert.equal(h.turns.length,0);
 await h.tick(1);assert.deepEqual(h.turns,['Use AWS in Sydney']);h.voice.stop();
});
for(const error of ['not-allowed','service-not-allowed','audio-capture','network','language-not-supported'])
 test(`${error} is visible and not retried`,async()=>{
  const h=setup();h.voice.start();h.instances[0].error(error);await h.tick(10000);
  assert.equal(h.voice.phase,'error');assert.equal(h.errors.length,1);assert.equal(h.instances.length,1);
 });
test('no-speech and end can recover without sending an empty turn',async()=>{
 const h=setup();h.voice.start();h.instances[0].error('no-speech');await h.tick(1000);
 assert.equal(h.instances.length,2);assert.equal(h.turns.length,0);h.voice.stop();
});
test('stop during delayed model reply prevents playback and new recording',async()=>{
 let resolve;const h=setup({onTurn:()=>new Promise(r=>{resolve=r;})});h.voice.start();
 h.instances[0].result('hello');await h.tick(1100);h.voice.stop();resolve('late reply');await h.tick(10000);
 assert.equal(h.spoken.length,0);assert.equal(h.instances.length,1);assert.equal(h.voice.phase,'off');
});
test('stop clears pending send and ignores old browser events',async()=>{
 const h=setup();h.voice.start();const rec=h.instances[0];rec.result('do not send');
 const stale=rec.onresult;h.voice.stop();stale({results:[]});await h.tick(10000);
 assert.equal(h.turns.length,0);assert.equal(h.voice.phase,'off');
});
test('interrupt cancels speech and resumes listening; stale playback cannot reopen microphone',async()=>{
 const h=setup();h.voice.start();h.instances[0].result('hello');await h.tick(1100);
 const old=h.spoken[0];h.voice.interrupt();old.onend();await h.tick(1000);
 assert.equal(h.instances.length,2);assert.equal(h.voice.phase,'listening');h.voice.stop();
});
test('playback failure leaves text available and stops microphone',async()=>{
 const h=setup();h.voice.start();h.instances[0].result('hello');await h.tick(1100);
 h.spoken[0].onerror();assert.equal(h.voice.phase,'error');assert.match(h.errors[0],/full reply is in chat/);
});
test('speech service start exception and missing browser API are reported',()=>{
 const h=setup({Recognition:class {start(){throw Error('denied')} abort(){}}});h.voice.start();assert.equal(h.voice.phase,'error');
 const missing=setup({Recognition:null});missing.voice.start();assert.match(missing.errors[0],/not supported/);
});
test('failed architect response never speaks a fake answer or reopens recording',async()=>{
 const h=setup({onTurn:async()=>undefined});h.voice.start();h.instances[0].result('hello');await h.tick(1100);
 assert.equal(h.voice.phase,'error');assert.equal(h.spoken.length,0);assert.equal(h.instances.length,1);
});
test('markdown and code blocks are made speakable while chat retains full content',()=>{
 assert.equal(speechText('## Hello **there** [docs](https://example.org)\n```js\nsecretCode();\n```'),'Hello there docs\n Code is available in the chat.');
});
