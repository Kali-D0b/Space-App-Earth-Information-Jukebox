// open-source narrator voice: Piper TTS (MIT) + "Norman" voice (public domain, LibriVox)
import { TtsSession } from '@mintplex-labs/piper-tts-web';
const VOICE = 'en_US-norman-medium';
let ss = null, st = 'off', pct = 0, cbs = [], lp = null;
const tell = () => cbs.forEach(f => f(st, pct));
window.PV = {
  get state() { return st; },        // off | loading | ready | failed
  get pct() { return pct; },
  on(f) { cbs.push(f); },
  load() { return lp ||= this.get(); },   // download voice once (browser caches it)
  async get() {
    st = 'loading'; pct = 0; tell();
    try {
      ss = await TtsSession.create({
        voiceId: VOICE,
        wasmPaths: window.PV_PATHS || TtsSession.WASM_LOCATIONS,
        progress: p => { if (p.total && /onnx$/.test(p.url)) { pct = Math.round(p.loaded * 100 / p.total); tell(); } },
      });
      await ss.waitReady;
      st = 'ready'; tell();
    } catch (e) { console.warn('voice failed', e); st = 'failed'; tell(); }
  },
  async wav(text) { return ss.predict(text); }, // text -> wav blob
};
