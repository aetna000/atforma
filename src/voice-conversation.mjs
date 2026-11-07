// Browser-owned speech transport. No raw audio is saved or sent to the sidecar.
export function speechText(text) {
  return String(text).replace(/```[\s\S]*?```/g, ' Code is available in the chat. ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, 'link in the chat')
    .replace(/[*_#`]/g, '').trim();
}

export class VoiceConversation {
  constructor({ Recognition, synthesis, Utterance, onTurn, onDraft = () => {}, onState = () => {},
    onError = () => {}, local = false, lang = 'en-US', pauseMs = 1100,
    schedule = (fn, ms) => setTimeout(fn, ms), cancel = id => clearTimeout(id), now = Date.now }) {
    Object.assign(this, { Recognition, synthesis, Utterance, onTurn, onDraft, onState, onError,
      local, lang, pauseMs, schedule, cancel, now });
    this.active = false;
    this.epoch = 0;
    this.timers = new Set();
  }
  state(value) { this.phase = value; this.onState(value); }
  later(fn, ms) {
    const token = this.epoch;
    const timer = this.schedule(() => {
      this.timers.delete(timer);
      if (this.active && token === this.epoch) fn();
    }, ms);
    this.timers.add(timer);
    return timer;
  }
  clear(timer) { if (timer != null) { this.cancel(timer); this.timers.delete(timer); } }
  start() {
    if (this.active) return;
    if (!this.Recognition || !this.synthesis || !this.Utterance) {
      this.fail('Voice conversation is not supported in this browser. You can still type your message.');
      return;
    }
    this.active = true;
    this.epoch++;
    this.rapidEnds = 0;
    this.listen();
  }
  detach() {
    const rec = this.rec;
    this.rec = null;
    if (rec) {
      rec.onresult = rec.onerror = rec.onend = rec.onstart = null;
      try { rec.abort(); } catch {}
    }
  }
  stop() {
    this.active = false;
    this.epoch++;
    for (const timer of this.timers) this.cancel(timer);
    this.timers.clear();
    this.detach();
    this.synthesis?.cancel();
    this.state('off');
  }
  fail(message) {
    this.stop();
    this.state('error');
    this.onError(message);
  }
  listen() {
    if (!this.active) return;
    let rec;
    try { rec = new this.Recognition(); } catch {
      this.fail('Could not open the microphone. Check browser permissions and try again.'); return;
    }
    this.rec = rec;
    const current = () => this.active && this.rec === rec;
    let final = '', interim = '', turnTimer = null;
    const started = this.now();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    if (this.local) rec.processLocally = true;
    this.state('starting');
    rec.onstart = () => { if (current()) this.state('listening'); };
    const submit = () => {
      if (!current() || !final.trim()) return;
      const text = final.trim();
      this.clear(turnTimer);
      this.detach(); // Disable capture before the architect speaks: never transcribe its reply.
      this.rapidEnds = 0;
      void this.turn(text);
    };
    rec.onresult = (event) => {
      if (!current()) return;
      final = ''; interim = '';
      for (const result of Array.from(event.results)) {
        if (result.isFinal) final += result[0].transcript + ' ';
        else interim += result[0].transcript + ' ';
      }
      this.clear(turnTimer);
      this.onDraft((final + interim).trim());
      if (final.trim() && !interim.trim()) turnTimer = this.later(submit, this.pauseMs);
    };
    rec.onerror = (event) => {
      if (!current() || event.error === 'no-speech') return;
      const errors = {
        'not-allowed': 'Microphone access is blocked. Allow the microphone for this site in your browser settings, then start voice again.',
        'service-not-allowed': 'Your browser blocked its speech service. Enable speech recognition or use a browser that supports it.',
        'audio-capture': 'No microphone is available. Check your microphone and system input settings.',
        network: 'The browser speech service could not connect. Check your network or browser speech settings. Your draft is still in the message box.',
        'language-not-supported': 'English speech recognition is unavailable. Enable or install an English language pack in your browser.',
      };
      this.fail(errors[event.error] || 'Speech recognition was interrupted. Your draft is still in the message box; start voice again or send it as text.');
    };
    rec.onend = () => {
      if (!current()) return;
      if (final.trim()) { submit(); return; }
      this.clear(turnTimer);
      this.rec = null;
      // Browsers end recognition even with continuous=true. Restart, but never spin.
      this.rapidEnds = this.now() - started < 1500 ? this.rapidEnds + 1 : 0;
      if (interim.trim() || this.rapidEnds > 3) {
        this.fail(interim.trim()
          ? 'The speech service stopped before confirming your words. Review the draft and send it, or start voice again.'
          : 'The speech service keeps stopping. Check microphone permissions and browser speech settings, then try again.');
        return;
      }
      this.state('reconnecting');
      this.later(() => this.listen(), Math.min(500 * 2 ** this.rapidEnds, 4000));
    };
    try { rec.start(); } catch {
      this.fail('Could not start speech recognition. Allow microphone access and start voice again.');
    }
  }
  async turn(text) {
    const token = this.epoch;
    this.state('thinking');
    try {
      const reply = await this.onTurn(text);
      if (!this.active || token !== this.epoch) return;
      if (typeof reply !== 'string' || !reply.trim()) {
        this.fail('The architect could not reply. Check the connection in chat, then start voice again.'); return;
      }
      this.speak(reply);
    } catch {
      if (this.active && token === this.epoch)
        this.fail('The architect could not reply. Check the connection in chat, then start voice again.');
    }
  }
  speak(text) {
    const chunks = speechText(text).match(/.{1,220}(?:\s|$)|\S{1,220}/g) || [];
    const token = this.epoch;
    this.state('speaking');
    const next = () => {
      if (!this.active || token !== this.epoch) return;
      const chunk = chunks.shift();
      if (!chunk) { this.later(() => this.listen(), 250); return; }
      const utterance = new this.Utterance(chunk.trim());
      utterance.lang = this.lang;
      const voices = this.synthesis.getVoices?.() || [];
      const voice = voices.find(v => v.localService && v.lang.startsWith('en'));
      if (voice) utterance.voice = voice;
      this.utterance = utterance; // Keep a strong reference until completion.
      let settled = false;
      const timer = this.later(() => {
        if (!settled) this.fail('Spoken playback stalled. The full reply is in chat. Start voice again to continue.');
      }, 45000);
      utterance.onend = () => {
        if (settled) return;
        settled = true; this.clear(timer); next();
      };
      utterance.onerror = () => {
        if (settled || !this.active || token !== this.epoch) return;
        settled = true; this.clear(timer);
        this.fail('Spoken playback was blocked or interrupted. The full reply is in chat. Start voice again to continue.');
      };
      try { this.synthesis.speak(utterance); } catch { utterance.onerror(); }
    };
    next();
  }
  interrupt() {
    if (!this.active || this.phase !== 'speaking') return;
    for (const timer of this.timers) this.cancel(timer);
    this.timers.clear();
    this.epoch++;
    this.synthesis.cancel();
    this.listen();
  }
}
