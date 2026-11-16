"use strict";
// The Warming Song
// map = NASA temps, sound = map temp, narrator reads it out

// ---- helpers
const $ = id => document.getElementById(id);
const cl = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lp = (a, b, u) => a + (b - a) * u;
const sm = (a, b, x) => { const u = cl((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const mf = m => 440 * 2 ** ((m - 69) / 12);
const rnd = (a = 1, b = 0) => b + Math.random() * (a - b);
const pick = a => a[Math.random() * a.length | 0];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mix = (a, b, u) => a.map((v, i) => lp(v, b[i], u));
const fmt = v => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(2) + ' °C';
const sayT = v => `${Math.abs(v).toFixed(1)} degrees ${v >= 0 ? 'warmer' : 'cooler'} than the 1951 to 1980 average`;
const noMo = matchMedia('(prefers-reduced-motion: reduce)').matches;
const Y0 = 1880, Y1 = 2023;
const BL = [77, 54, 34, 12, -12, -34, -54, -77]; // band lats, N to S

// ---- data
let YR = {}, maps = false, est = [];
async function load() {
  const F = window.FALLBACK;
  try {
    const r = await fetch('data/timeline.json', { cache: 'no-store' });
    if (!r.ok) throw 0;
    const j = await r.json();
    j.years.forEach(o => YR[o.year] = o);
    maps = j.years.some(o => o.image);
    if ((j.zones_from || '').startsWith('built-in')) est = F.zoneEstimated;
    $('src').innerHTML = `<b>● Live NASA data via backend</b> · SVS 5207 + ${j.temps_from}`;
  } catch {
    for (let y = Y0; y <= Y1; y++) YR[y] = { year: y, anomaly: F.gistemp[y], co2: F.co2[y] ?? null, zones: F.zones[y] };
    est = F.zoneEstimated;
    $('src').innerHTML = `<b>● NASA GISTEMP v4</b> global + zonal means · the data behind <a href="https://svs.gsfc.nasa.gov/5207/" target="_blank" rel="noopener">SVS 5207</a>`;
  }
  for (let y = Y0; y <= Y1; y++) YR[y].zones ||= Array(8).fill(YR[y].anomaly);
  mkFacts(); mkRib();
}
const ez = u => u * u * (3 - 2 * u);
// temp at time t (smooth between years)
const tAt = t => { const y = cl(Math.floor(t), Y0, Y1); return lp(YR[y].anomaly, (YR[y + 1] || YR[y]).anomaly, ez(cl(t - y))); };
// 8 band temps at time t
const zAt = t => { const y = cl(Math.floor(t), Y0, Y1), a = YR[y].zones, b = (YR[y + 1] || YR[y]).zones; return a.map((v, i) => lp(v, b[i], ez(cl(t - y)))); };
// temp at a latitude
function zLat(z, la) {
  if (la >= BL[0]) return z[0];
  if (la <= BL[7]) return z[7];
  for (let i = 0; i < 7; i++) if (la <= BL[i] && la >= BL[i + 1]) return lp(z[i], z[i + 1], (BL[i] - la) / (BL[i] - BL[i + 1]));
  return 0;
}
// dials: all sound comes from these
function dl(t) {
  const h = cl((tAt(t) + .35) / 1.55);
  return {
    h,
    b: cl(1 - h / .86) ** 1.5,               // birds (0 when hot)
    n: (1 - h) ** 1.2,                       // nature
    p: .14 * sm(.08, .3, h) + .86 * sm(.32, .9, h), // pollution
  };
}
const co2 = y => YR[y]?.co2 || (y === 1958 ? 315 : y < 1958 ? lp(291, 314, cl((y - 1880) / 78)) : null);
const avg = (a, b) => { let s = 0, n = 0; for (let y = a; y <= b; y++) if (YR[y]) { s += YR[y].anomaly; n++; } return s / n; };

// auto facts (records, decades)
const FX = {};
function mkFacts() {
  let rec = -9;
  for (let y = Y0; y <= Y1; y++) {
    const a = YR[y].anomaly;
    if (y > 1900 && a > rec) FX[y] = `${y} is the warmest year recorded so far: ${fmt(a)}.`;
    rec = Math.max(rec, a);
    if (y % 10 === 9 && y > 1890 && !FX[y]) FX[y] = `The ${y - 9}s averaged ${fmt(avg(y - 9, y))}.`;
  }
  const z = YR[2020].zones;
  FX[2020] ||= `In 2020 the Arctic band was ${fmt(z[0])}, about ${(z[0] / YR[2020].anomaly).toFixed(1)}× the global average.`;
  FX[Y1] = `Compared with 1880–1900, ${Y1} was about ${(YR[Y1].anomaly - avg(1880, 1900)).toFixed(1)} °C warmer.`;
}

// ---- narrator: open-source Piper voice ("Norman", public domain), browser voice only as backup
let nOn = false, vc = null, pBusy = false, sg = 0, src0 = null;
const SS = 'speechSynthesis' in window;
const talking = () => pBusy || (SS && speechSynthesis.speaking);
const PV2 = () => window.PV && PV.state !== 'failed';  // open voice usable?
// backup: deepest male browser voice
const VS = [/daniel|alex|fred|aaron|arthur|evan|nathan|tom|guy|christopher|eric|davis|uk english male|male/i, /natural|premium|enhanced/i];
const pv = () => { const v = speechSynthesis.getVoices().filter(x => /^en/i.test(x.lang)), sc = x => { const i = VS.findIndex(r => r.test(x.name)); return i < 0 ? 9 : i; }; vc = v.sort((a, b) => sc(a) - sc(b))[0] || null; };
if (SS) { pv(); speechSynthesis.onvoiceschanged = pv; }
const tidy = tx => tx.replace(/\s?°C/g, ' degrees').replace(/CO₂/g, 'C O 2').replace(/ppm/g, 'parts per million').replace(/−/g, 'minus ').replace(/×/g, ' times');
const parts = tx => tidy(tx).split(/(?<=[.!?])\s+/).filter(p => p.trim());
function hush() { sg++; if (src0) { try { src0.stop(); } catch { } src0 = null; } pBusy = false; if (SS) speechSynthesis.cancel(); }
// your own recordings: public/voice/<key>.m4a (or .mp3 / .wav), see the recording script
const VO_DATA = true; // false = skip the data lines (year summaries, records) that have no recording
const REC = {};
async function rec(k) {
  if (k in REC) return REC[k];
  for (const x of ['mp3', 'm4a', 'wav']) {
    try { const r = await fetch(`voice/${k}.${x}`); if (r.ok) return REC[k] = await ac.decodeAudioData(await r.arrayBuffer()); } catch { }
  }
  return REC[k] = null;
}
function say(tx, { cut = true, hold = false, key = null } = {}) {
  if (!nOn || mute) return;
  if (!cut && talking()) return;
  hush();
  if (hold) holdT = Infinity;
  const done = () => { if (hold && holdT === Infinity) holdT = performance.now() + 700; };
  if (key) return sayR(key, tx, hold, done);
  if (!VO_DATA) return done();
  speak(tx, hold, done);
}
// play a recording if there is one, else use the voice
async function sayR(k, tx, hold, done) {
  const my = ++sg; pBusy = true;
  const b = ac && await rec(k);
  if (my !== sg) return;
  if (!b) { pBusy = false; return speak(tx, hold, done); }
  await new Promise(r => { const s2 = ac.createBufferSource(); s2.buffer = b; s2.connect(vg); s2.onended = r; src0 = s2; s2.start(); });
  if (my === sg) { pBusy = false; src0 = null; done(); }
}
function speak(tx, hold, done) {
  if (PV2()) return sayP(parts(tx), hold, done);
  if (!SS) return done();
  const ps = parts(tx);
  ps.forEach((p, i) => { const u = new SpeechSynthesisUtterance(p); if (vc) { u.voice = vc; u.lang = vc.lang; } u.rate = .92; u.pitch = .8; if (i === ps.length - 1) u.onend = u.onerror = done; speechSynthesis.speak(u); });
}
// speak with Piper: make next sentence while this one plays
async function sayP(ps, hold, done) {
  const my = ++sg; pBusy = true;
  if (PV.state !== 'ready') { if (!hold) { pBusy = false; return; } await PV.load(); if (PV.state !== 'ready') { pBusy = false; if (my === sg) { PV2() || say(ps.join(' '), { hold }); } return; } }
  const mk = p => PV.wav(p).then(b => b.arrayBuffer()).then(a => ac.decodeAudioData(a)).catch(() => null);
  let nx = mk(ps[0]);
  for (let i = 0; i < ps.length && my === sg; i++) {
    const buf = await nx; nx = i + 1 < ps.length ? mk(ps[i + 1]) : null;
    if (!buf || my !== sg) continue;
    await new Promise(r => { const s2 = ac.createBufferSource(); s2.buffer = buf; s2.playbackRate.value = .94; s2.connect(vg); s2.onended = r; src0 = s2; s2.start(); });
    if (my === sg) await new Promise(r => setTimeout(r, 180)); // small pause
  }
  if (my === sg) { pBusy = false; src0 = null; done(); }
}
// short spoken summary of a year
function now(y) {
  const D = dl(y + .5);
  const b = D.b > .7 ? 'birds everywhere' : D.b > .4 ? 'fewer birds' : D.b > .15 ? 'only a few birds' : D.b > .03 ? 'one or two birds' : 'no birds at all';
  const p = D.p < .1 ? 'clean air' : D.p < .4 ? 'pollution rising' : D.p < .75 ? 'heavy pollution' : 'thick smog and roaring machines';
  return `${y}. The planet is ${sayT(YR[y].anomaly)}. The Arctic: ${sayT(YR[y].zones[0])}. ${b}, ${p}.`;
}
const nLbl = () => { const st = window.PV ? PV.state : 'off'; $('narrator').querySelector('span').textContent = 'Narrator: ' + (!nOn ? 'off' : st === 'loading' ? `loading voice ${PV.pct || 0}%` : 'on'); };
function setN(on) {
  nOn = on; $('narrator').setAttribute('aria-pressed', on);
  if (on && window.PV) PV.load();
  nLbl();
  if (on) play ? say('Narrator on. ' + now(Math.floor(T)), { hold: true }) : say('Narrator on. Press space to play, N for the next chapter, M to mute, and V to turn me off.', { hold: true, key: 'narrator-on' });
  else { hush(); if (holdT === Infinity) holdT = performance.now() + 400; }
}
addEventListener('load', () => window.PV && PV.on(nLbl));

// ---- sound setup
let ac, mst, dk, mg, rv, bus = {}, bLP, nz, bz, mute = false, an, wv, vg;
const on = { birds: 1, nature: 1, pollution: 1, music: 1, time: 1 };
function aud() {
  if (ac) { ac.resume(); return; }
  ac = new (window.AudioContext || window.webkitAudioContext)();
  const cp = ac.createDynamicsCompressor(); cp.threshold.value = -18; cp.ratio.value = 3.5;
  mst = gn(.95); dk = gn(1); mg = gn(mute ? 0 : 1);   // master, duck (for narrator), mute
  mst.connect(dk); dk.connect(cp); cp.connect(mg); mg.connect(ac.destination);
  vg = gn(1); vg.connect(mg); // narrator voice
  an = ac.createAnalyser(); an.fftSize = 1024; cp.connect(an); wv = new Uint8Array(1024); // for the wave line
  rv = ac.createConvolver(); rv.buffer = imp(3.2); const rg = gn(.3); rv.connect(rg); rg.connect(mst); // reverb
  const send = { birds: .55, nature: .25, pollution: .15, music: .45, time: .3 };
  for (const k in on) { bus[k] = gn(1); bus[k].connect(mst); const s = gn(send[k]); bus[k].connect(s); s.connect(rv); }
  bLP = flt('lowpass', 9000); bLP.connect(bus.birds);
  nz = noise(0); bz = noise(1);
  mkNat(); mkPol(); mkMus();
  nt = ac.currentTime + .1;
}
const gn = v => { const g = ac.createGain(); g.gain.value = v; return g; };
const osc = (f, ty = 'sine') => { const o = ac.createOscillator(); o.type = ty; o.frequency.value = f; return o; };
const flt = (ty, f, q = 1) => { const b = ac.createBiquadFilter(); b.type = ty; b.frequency.value = f; b.Q.value = q; return b; };
const pan = (p, to) => { const s = ac.createStereoPanner(); s.pan.value = cl(p, -1, 1); s.connect(to); return s; };
const sl = (pr, v, t, tc = .6) => pr.setTargetAtTime(v, t, tc); // glide a value
const at = (t, fn) => setTimeout(fn, Math.max(0, (t - ac.currentTime) * 1000)); // run fn when sound plays
// reverb tail
function imp(s) { const n = ac.sampleRate * s, b = ac.createBuffer(2, n, ac.sampleRate); for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < n; i++) d[i] = rnd(1, -1) * (1 - i / n) ** 2.3; } return b; }
// white or brown noise
function noise(br) { const n = ac.sampleRate * 3, b = ac.createBuffer(1, n, ac.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < n; i++) { const w = rnd(1, -1); if (br) { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
// looping noise bed
function bed(br, ty, f, q, to) { const s = ac.createBufferSource(); s.buffer = br ? bz : nz; s.loop = true; const fl = flt(ty, f, q), g = gn(0); s.connect(fl); fl.connect(g); g.connect(to); s.start(); return { g, f: fl }; }
// quick up/down volume
function env(g, t, a, pk, d) { g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(pk, .0002), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
// distortion
function grit(k) { const w = ac.createWaveShaper(), c = new Float32Array(1024); for (let i = 0; i < 1024; i++) c[i] = Math.tanh((i / 1023 * 2 - 1) * k); w.curve = c; return w; }
// one-shot noise burst
function burst(t, ty, f, q, v, a, d, to, off = rnd(2)) { const s = ac.createBufferSource(); s.buffer = nz; const fl = flt(ty, f, q), g = gn(0); env(g, t, a, v, d); s.connect(fl); fl.connect(g); g.connect(to); s.start(t, off, a + d + .05); return fl; }

// ---- birds
function chirp(t, f0, f1, d, v, to, w) {
  const o = osc(f0), g = gn(0), m = osc(rnd(50, 25)), mg2 = gn(f0 * .02 * w);
  o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + d);
  m.connect(mg2); mg2.connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + Math.min(.03, d / 3)); g.gain.exponentialRampToValueAtTime(.0001, t + d);
  o.connect(g); g.connect(to); o.start(t); m.start(t); o.stop(t + d + .03); m.stop(t + d + .03);
}
const SONG = {
  warb: (t, v, o, w) => { for (let i = 0, n = rnd(10, 5); i < n; i++) { const f = 2800 + i * 150 + rnd(150); chirp(t + i * .09, f, f * 1.18, .07, v, o, w); } },
  rob: (t, v, o, w) => { for (let p = 0; p < 3; p++) { const b = rnd(2600, 1900); chirp(t + p * .42, b, b * 1.25, .15, v, o, w); chirp(t + p * .42 + .17, b * 1.2, b * .95, .14, v * .8, o, w); } },
  chk: (t, v, o, w) => { chirp(t, 3700, 3650, .34, v, o, w * .3); chirp(t + .45, 3150, 3100, .4, v * .9, o, w * .3); },
  dov: (t, v, o, w) => { for (const [s, d] of [[0, .4], [.55, .65], [1.35, .35], [1.75, .35]]) chirp(t + s, 540, 470, d, v * 1.3, o, w * .2); },
  pep: (t, v, o, w) => chirp(t, 3000, 3600, .12, v, o, w * .3),
};
function bird(t, D) {
  const k = pick(D.b > .5 ? ['warb', 'rob', 'chk', 'dov', 'pep'] : ['chk', 'dov', 'pep']);
  SONG[k](t, .012 + .07 * D.b, pan(rnd(.9, -.9), bLP), D.b);
  if (!noMo) at(t, addBird);
}

// ---- nature
let wnd, wav, crk, lvs;
function mkNat() {
  const wp = ac.createStereoPanner(); wp.connect(bus.nature);
  const lf = osc(.06), lg = gn(.85); lf.connect(lg); lg.connect(wp.pan); lf.start(); // wind sways L/R
  wnd = bed(0, 'lowpass', 450, .6, wp);
  wav = bed(1, 'lowpass', 900, .5, pan(.35, bus.nature));
  crk = bed(0, 'bandpass', 1900, 1.3, pan(-.45, bus.nature));
  lvs = bed(0, 'highpass', 5200, .7, bus.nature);
}
function crick(t, v) { const p = pan(rnd(.8, -.8), bus.nature), f = rnd(4800, 4300); for (let k = 0; k < 3; k++) { const o = osc(f), g = gn(0), s = t + k * .09; env(g, s, .005, v, .055); o.connect(g); g.connect(p); o.start(s); o.stop(s + .09); } }
function frog(t, v) { const p = pan(rnd(.7, -.7), bus.nature); for (const s of [0, .2]) { const o = osc(300, 'triangle'), f = flt('lowpass', 900), g = gn(0); o.frequency.setValueAtTime(300, t + s); o.frequency.exponentialRampToValueAtTime(200, t + s + .13); env(g, t + s, .01, v, .13); o.connect(f); f.connect(g); g.connect(p); o.start(t + s); o.stop(t + s + .17); } }

// ---- pollution (mid freqs so laptops can play it)
let trf, smg, eng, engG, fac;
function mkPol() {
  trf = bed(0, 'bandpass', 850, .55, pan(.1, bus.pollution));  // traffic
  smg = bed(0, 'bandpass', 3200, .9, pan(-.3, bus.pollution)); // fizz
  const bp = flt('bandpass', 520, .7), gr = grit(4); engG = gn(0);
  gr.connect(bp); bp.connect(engG); engG.connect(pan(-.15, bus.pollution));
  eng = [110, 113, 165, 220].map(f => { const o = osc(f, 'sawtooth'), g = gn(.22); o.connect(g); g.connect(gr); o.start(); return o; }); // engine
  fac = bed(1, 'bandpass', 380, 1.2, pan(.35, bus.pollution)); // factory hum
}
function car(t, v) {
  const s = ac.createBufferSource(); s.buffer = nz; s.loop = true; const f = flt('bandpass', 500, 1.6), g = gn(0);
  f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(1500, t + .7); f.frequency.exponentialRampToValueAtTime(420, t + 1.5);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + .7); g.gain.exponentialRampToValueAtTime(.0001, t + 1.6);
  const p = ac.createStereoPanner(), dr = pick([1, -1]); p.pan.setValueAtTime(-dr, t); p.pan.linearRampToValueAtTime(dr, t + 1.6);
  s.connect(f); f.connect(g); g.connect(p); p.connect(bus.pollution); s.start(t); s.stop(t + 1.7);
}
function horn(t, v) { const p = pan(pick([-.75, .75]), bus.pollution), f = rnd(480, 360), n = Math.random() < .4 ? 3 : 2; for (let k = 0; k < n; k++) for (const r of [1, 1.26]) { const o = osc(f * r, 'square'), l = flt('lowpass', 2200), g = gn(0), s = t + k * .28; env(g, s, .015, v, .2); o.connect(l); l.connect(g); g.connect(p); o.start(s); o.stop(s + .25); } }
function siren(t, v) {
  const o = osc(950, 'triangle'), lf = osc(.55), lg = gn(260), g = gn(0), p = ac.createStereoPanner();
  lf.connect(lg); lg.connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 1); g.gain.setValueAtTime(v, t + 3.5); g.gain.exponentialRampToValueAtTime(.0001, t + 5);
  p.pan.setValueAtTime(-.9, t); p.pan.linearRampToValueAtTime(.9, t + 5);
  o.connect(g); g.connect(p); p.connect(bus.pollution); o.start(t); lf.start(t); o.stop(t + 5.1); lf.stop(t + 5.1);
}
function jack(t, v) { const p = pan(rnd(.7, -.7), bus.pollution); for (let i = 0, n = rnd(32, 18); i < n; i++) burst(t + i * .062, 'bandpass', 1200, 2, v, .002, .035, p); }
function puff(t, v) { const f = burst(t, 'lowpass', 1600, 1, v, .02, .5, pan(rnd(.8, -.8), bus.pollution)); f.frequency.setValueAtTime(1600, t); f.frequency.exponentialRampToValueAtTime(300, t + .45); }
function clank(t, v) { const f = rnd(700, 300), c = osc(f), m = osc(f * 1.41), mg2 = gn(0), g = gn(0); mg2.gain.setValueAtTime(f * 5, t); mg2.gain.exponentialRampToValueAtTime(1, t + .25); env(g, t, .002, v, .3); m.connect(mg2); mg2.connect(c.frequency); c.connect(g); g.connect(pan(rnd(.7, -.7), bus.pollution)); c.start(t); m.start(t); c.stop(t + .35); m.stop(t + .35); }

// ---- music
let pad = [], pLP, pA, beat = 0;
function mkMus() {
  pLP = flt('lowpass', 700); pA = gn(.045); pLP.connect(pA); pA.connect(bus.music);
  for (let i = 0; i < 4; i++) { const s = osc(220, 'triangle'), z = osc(220, 'sawtooth'), gs = gn(1), gz = gn(0); s.connect(gs); z.connect(gz); gs.connect(pLP); gz.connect(pLP); s.start(); z.start(); pad.push({ s, z, gs, gz }); }
}
// scales: calm, minor, tense
const SC = [[0, 2, 4, 7, 9], [0, 2, 3, 7, 8], [0, 1, 3, 6, 7, 10]];
const scl = h => h < .4 ? SC[0] : h < .7 ? SC[1] : SC[2];
const nt2 = (r, s, d) => r + 12 * Math.floor(d / s.length) + s[((d % s.length) + s.length) % s.length];
let cd = 0, pls = 0; // chord degree, sun pulse
function chord(t, h, bar) {
  const s = scl(h), r = 48 + Math.round(h * 12), pr = h < .4 ? [0, 3, 4, 2] : h < .7 ? [0, 4, 3, 5] : [0, 1, 4, 2];
  cd = pr[bar % 4];
  const ns = [nt2(r, s, cd), nt2(r, s, cd + 2), nt2(r, s, cd + 4), nt2(r + 12, s, cd + (h > .7 ? 1 : 2))];
  pad.forEach((p, i) => { const f = mf(ns[i]), dt = (i % 2 ? 1 : -1) * (2 + 24 * h); sl(p.s.frequency, f, t, .5); sl(p.z.frequency, f, t, .5); sl(p.s.detune, dt, t, .5); sl(p.z.detune, -dt, t, .5); sl(p.gs.gain, 1 - .75 * h, t, .8); sl(p.gz.gain, .55 * h, t, .8); });
  at(t, () => pls = Math.max(pls, .6));
}
// music box note
function mbox(t, m, v, h) {
  at(t, () => beat = Math.min(1, Math.max(beat, .35 + v * 9))); // map glow pulse
  const o = osc(mf(m), h > .7 ? 'square' : h > .45 ? 'triangle' : 'sine'), o2 = osc(mf(m) * 4.01), g = gn(0), g2 = gn(0), l = flt('lowpass', 1500 + 5000 * h);
  o.frequency.setValueAtTime(mf(m), t); if (h > .6) o.frequency.linearRampToValueAtTime(mf(m) * (1 + .02 * h), t + .25);
  env(g, t, .004, v, .9 - .55 * h); g2.gain.setValueAtTime(v * .3, t); g2.gain.exponentialRampToValueAtTime(.0001, t + .25);
  o.connect(l); l.connect(g); o2.connect(g2); g.connect(pan(rnd(.4, -.4), bus.music)); g2.connect(bus.music);
  o.start(t); o2.start(t); o.stop(t + 1); o2.stop(t + .3);
}
// melody: a short phrase, repeated, changed every few bars
let ph = null, phB = -99, phH = -1;
function mkPh(h, gr) {
  const p = Array(32).fill(null); let d = cd + 2;
  for (let k = 0; k < 32; k++) {
    if (!gr.includes(k % 16) || Math.random() > .62 + .3 * h) continue;
    const r = Math.random(); d += r < .4 ? 1 : r < .8 ? -1 : r < .92 ? 2 : -2;
    p[k] = d = cl(d, -1, 6);
  }
  p[0] = cd; p[16] = cd + 2; p[28] = null; p[30] = cd;
  return p;
}
function mel(t, h, s, gr) {
  const bar = Math.floor(st / 16);
  if (s === 0 && bar % 2 === 0 && (!ph || bar - phB >= 8 || Math.abs(h - phH) > .12)) { ph = mkPh(h, gr); phB = bar; phH = h; }
  const d = ph && ph[(bar % 2) * 16 + s];
  if (d != null) mbox(t, nt2(57 + Math.round(h * 9), scl(h), d), .05 + .015 * h, h * .85);
}
const tick = (t, v) => burst(t, 'bandpass', 2400, 8, v, .002, .04, pan(.3, bus.music), rnd());
// time whoosh
function whoosh(t, a) {
  const s = ac.createBufferSource(); s.buffer = nz; s.loop = true; const f = flt('bandpass', 300, 1.4), g = gn(0), p = ac.createStereoPanner();
  f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1800, t + .4); f.frequency.exponentialRampToValueAtTime(450, t + 1);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.03 * a, t + .32); g.gain.exponentialRampToValueAtTime(.0001, t + 1.05);
  p.pan.setValueAtTime(-.8, t); p.pan.linearRampToValueAtTime(.8, t + 1);
  s.connect(f); f.connect(g); g.connect(p); p.connect(bus.time); s.start(t); s.stop(t + 1.1);
}

// ---- conductor: every 25ms, set all sound from the map temp
let nt = 0, st = 0, ev = {};
const due = (k, n) => !(ev[k] > n);
function cond() {
  if (!ac || ac.state !== 'running') return;
  const D = dl(T), n = ac.currentTime, P = D.p, h = D.h, r = () => rnd(1.4, .6);
  const six = 60 / (64 + 72 * h) / 4; // 16th note
  if (nt < n) nt = n + .05;
  while (nt < n + .15) { // schedule notes ahead
    const t = nt, s = st % 16;
    if (!s) chord(t, h, Math.floor(st / 16));
    const gr = h < .3 ? [0, 3, 6, 8, 11, 14] : h < .6 ? [0, 3, 4, 6, 8, 11, 12, 14] : h < .85 ? [0, 2, 4, 6, 8, 10, 12, 14] : [...Array(16).keys()];
    mel(t, h, s, gr);
    if (h > .4 && s % (h > .75 ? 2 : 4) === 0) tick(t, .045 * h);
    if (P > .2 && s % 4 === 2 && Math.random() < P * .7) clank(t, .05 * P);
    nt += six; st++;
  }
  // random events
  const g = n + .05;
  if (D.b > .04 && due('b', n)) { bird(g, D); ev.b = n + lp(6, .45, D.b) * r(); }
  if (D.n > .25 && due('c', n)) { crick(g, .016 * D.n); ev.c = n + lp(4, .7, D.n) * r(); }
  if (D.n > .4 && due('f', n)) { frog(g, .045 * D.n); ev.f = n + 3 + rnd(6) / D.n; }
  if (P > .05 && due('car', n)) { car(g, .03 + .12 * P); ev.car = n + lp(7, .55, P) * r(); }
  if (P > .08 && due('pf', n)) { puff(g, .05 + .1 * P); ev.pf = n + lp(5, .6, P) * r(); }
  if (P > .2 && due('hn', n)) { horn(g, .02 + .06 * P); ev.hn = n + lp(10, 1.6, P) * r(); }
  if (P > .4 && due('jk', n)) { jack(g, .03 + .07 * P); ev.jk = n + lp(14, 4, P) * r(); }
  if (P > .6 && due('sr', n)) { siren(g, .02 + .045 * P); ev.sr = n + lp(22, 9, P) * r(); }
  // steady layers
  const gu = .65 + .35 * Math.sin(n * .4) * Math.sin(n * .17); // gusts
  sl(wnd.g.gain, (.05 + .11 * h) * gu, n, .5); sl(wnd.f.frequency, 350 + 700 * h * gu, n, .5);
  sl(wav.g.gain, .16 * D.n * (.55 + .45 * Math.sin(n * .5)), n, .5);
  sl(crk.g.gain, .03 * D.n, n, .8); sl(lvs.g.gain, .012 * D.n * gu, n, .8);
  sl(bLP.frequency, 1800 + 7200 * D.b, n, 1);
  sl(trf.g.gain, .26 * P * (.8 + .2 * Math.sin(n * .9)), n, .6);
  sl(smg.g.gain, .05 * P * (.7 + .3 * Math.sin(n * 3.3)), n, .3);
  sl(fac.g.gain, .5 * P, n, .8); sl(engG.gain, .09 * P, n, .8);
  eng.forEach((o, i) => sl(o.frequency, [110, 113, 165, 220][i] * (1 + .12 * P) + Math.sin(n * (.6 + i * .2)) * 3, n, .25));
  sl(pLP.frequency, 600 + 3600 * h * h, n, .8); sl(pA.gain, .045 - .01 * h, n, .8);
  const tk = nOn && talking();
  sl(dk.gain, epOn ? .7 : 1, n, .4);
  const lv = { birds: tk ? .6 : 1, nature: tk ? .55 : 1, pollution: tk ? .6 : 1.3, music: tk ? 1.15 : 1, time: 1 }; // while talking: music stays, noise drops
  for (const k in bus) sl(bus[k].gain, on[k] ? lv[k] : 0, n, .4);
}
setInterval(cond, 25);

// ---- timeline + story
let T = Y0, play = false, spd = 1, holdT = 0, lastY = Y0 - 1, lastQ = Y0, qi = 0, lastD = -1;
const fill = (s, y) => s.replace('{T}', fmt(YR[y].anomaly).replace(/^\+/, '')).replace('{CO2}', co2(y) ? Math.round(co2(y)) + ' ppm' : 'unknown');
function chap(c) {
  const tx = fill(c.text, c.year), fx = fill(c.fact, c.year);
  $('cardYear').textContent = c.year; $('cardTitle').textContent = c.title; $('cardText').textContent = tx; $('cardFact').textContent = fx;
  $('card').classList.add('show'); hideTo();
  holdT = performance.now() + cl(4500 + (c.text.length + c.fact.length) * 32, 7000, 13000) / Math.max(.75, spd);
  say(`${c.year}. ${c.title}. ${tx} Quick fact: ${fx}`, { hold: true, key: String(c.year) });
}
const hideC = () => $('card').classList.remove('show');
const hideTo = () => $('toast').classList.remove('show');
let toT = 0;
function toast(m, key = null) { hideC(); $('toast').textContent = m; $('toast').classList.add('show'); clearTimeout(toT); toT = setTimeout(hideTo, 5200 / Math.max(.75, spd)); if (nOn && !talking()) say(m, { cut: false, key }); }
function newYr(y) {
  dr = Math.max(dr, .5 + .25 * spd); if (ac) whoosh(ac.currentTime + .02, .8 + .2 * spd);
  const c = STORY.find(c => c.year === y);
  if (c) return chap(c);
  const pn = performance.now();
  if (pn > holdT + 1500) hideC();
  if (pn > holdT) {
    if (FX[y]) { toast(FX[y]); lastQ = y; }
    else if (y - lastQ >= 9) { const i = qi++ % QUICK.length; toast(QUICK[i], 'quick-' + (i + 1)); lastQ = y; }
    else if (nOn && y % 10 === 5 && Math.floor(y / 10) !== lastD && !talking()) { lastD = Math.floor(y / 10); say(now(y), { cut: false }); }
  }
}
// page mood: dawn > dusk > night
let md = 'dawn';
function mood() { const h = dl(T).h, m = h < .45 ? 'dawn' : h < .74 ? 'dusk' : 'night'; if (m !== md) { md = m; document.body.dataset.mood = m; hud(Math.floor(T)); } }
function adv(dt) {
  if (play) {
    const hold = performance.now() < holdT || (nOn && talking());
    T += dt * .8 * spd * (hold ? .06 : 1);
    if (T >= Y1 + .99) { T = Y1 + .99; setP(false); setTimeout(epShow, 1200); }
    $('scrub').value = T;
  }
  const y = Math.floor(T);
  if (y !== lastY && !(play && holdT === Infinity)) { lastY = y; hud(y); if (play) newYr(y); } // wait while narrator finishes
}
const hc = a => { if (Math.abs(a) < .25) return ''; return rgb(md === 'dawn' ? mix(mc(a), [0, 0, 0], .25) : mix(mc(a), [255, 235, 220], .3)); };
function hud(y) {
  const r = YR[y]; if (!r) return;
  $('year').textContent = y;
  $('temp').textContent = fmt(r.anomaly); $('temp').style.color = hc(r.anomaly * 1.4);
  $('arctic').textContent = fmt(r.zones[0]) + (est.includes(y) ? '*' : ''); $('arctic').style.color = hc(r.zones[0]);
  $('co2').textContent = co2(y) ? Math.round(co2(y)) + ' ppm' : '—';
  if (maps) getMap(y);
}
// ending
let epOn = false;
function epShow() {
  $('epText').textContent = `From 1880 to 2023 the map turned from blue to red, CO₂ rose from 291 to ${Math.round(co2(Y1))} ppm, and the song lost its birds.`;
  const e = $('epilogue'); e.hidden = false; requestAnimationFrame(() => e.classList.add('show')); epOn = true; hideC(); hideTo();
  $('replay').focus({ preventScroll: true });
  const fs = [...document.querySelectorAll('.ep-facts li')].map(l => l.textContent.replace(/^\S+\s/, '')).join(' ');
  say(`${$('epTitle').textContent} ${$('epText').textContent} ${fs} We need to act now. ${document.querySelector('.ep-sub').textContent} Facts from NASA Science. All sources are listed at the bottom of the page.`, { key: 'ending' });
}
function epHide() { const e = $('epilogue'); e.classList.remove('show'); epOn = false; setTimeout(() => { if (!epOn) e.hidden = true; }, 1600); hush(); }
function setP(p) { play = p; $('play').setAttribute('aria-pressed', p); $('play').setAttribute('aria-label', p ? 'Pause' : 'Play'); if (p && T >= Y1 + .98) reset(); }
function reset() { if (epOn) epHide(); T = Y0; lastY = Y0 - 1; holdT = 0; lastQ = Y0; lastD = -1; hideC(); hideTo(); $('scrub').value = T; cr = []; }
function jump(t) { T = cl(t, Y0, Y1 + .99); holdT = 0; hideC(); lastY = -1; cr = []; $('scrub').value = T; dr = 1.4; if (ac) whoosh(ac.currentTime + .02, 1.5); if (nOn) say(now(Math.floor(T))); }
function next() { const c = STORY.find(c => c.year > Math.floor(T)); if (!c) return; T = lastY = c.year; cr = []; $('scrub').value = T; dr = 1.4; if (ac) whoosh(ac.currentTime + .02, 1.5); hud(c.year); chap(c); }

// ---- picture
const cv = $('cosmos'), g = cv.getContext('2d'), W = cv.width, H = cv.height;
const MW = 1380, MH = MW / 1.9716, CX = W / 2, CY = H / 2 - 52, MX = CX - MW / 2, MY = CY - MH / 2; // map size + spot
const INK = '#1b2236';
// Robinson projection tables
const RP = [0, .062, .124, .186, .248, .31, .372, .434, .4958, .5571, .6176, .6769, .7346, .7903, .8435, .8936, .9394, .9761, 1];
const RL = [1, .9986, .9954, .99, .9822, .973, .96, .9427, .9216, .8962, .8679, .835, .7986, .7597, .7186, .6732, .6213, .5722, .5322];
const ri = (A, a) => { const i = Math.min(17, Math.floor(a / 5)); return lp(A[i], A[i + 1], (a - i * 5) / 5); };
const pj = (lo, la) => { const a = Math.min(90, Math.abs(la)); return [CX + ri(RL, a) * lo / 180 * MW / 2, CY - Math.sign(la) * ri(RP, a) * MH / 2]; };
// latitude of each map row
const RLAT = new Float32Array(Math.ceil(MH) + 1);
for (let r = 0; r <= MH; r++) { const y = Math.abs(1 - 2 * r / MH); let k = 0; while (k < 17 && RP[k + 1] < y) k++; RLAT[r] = Math.sign(1 - 2 * r / MH) * (k * 5 + 5 * cl((y - RP[k]) / (RP[k + 1] - RP[k]))); }
// map edge
const OL = new Path2D();
for (let la = -90; la <= 90; la += 2) OL[la === -90 ? 'moveTo' : 'lineTo'](...pj(-180, la));
for (let la = 90; la >= -90; la -= 2) OL.lineTo(...pj(180, la));
OL.closePath();
// land outlines from geo-data.js
const LND = new Path2D();
for (const e of GEO.land) {
  const pts = []; let x = 0, y = 0, off = 0, pv2 = null, lo = 1e9, hi = -1e9;
  for (let i = 0; i < e.length; i += 2) {
    x += e[i]; y += e[i + 1]; let o = x / GEO.q;
    if (pv2 !== null) { const d = o + off - pv2; if (d > 180) off -= 360; else if (d < -180) off += 360; }
    o += off; pv2 = o; lo = Math.min(lo, o); hi = Math.max(hi, o); pts.push([o, y / GEO.q]);
  }
  for (const sh of [0, ...(lo < -180 ? [360] : []), ...(hi > 180 ? [-360] : [])]) pts.forEach(([o, a], k) => LND[k ? 'lineTo' : 'moveTo'](...pj(cl(o + sh, -180, 180), a)));
}
// NASA-style colours: blue > white > red
const STP = [[-2, [33, 64, 154]], [-1, [90, 150, 210]], [-.3, [200, 225, 245]], [0, [250, 250, 248]], [.4, [253, 219, 140]], [.9, [244, 140, 70]], [1.5, [214, 47, 39]], [2.4, [128, 10, 30]]];
function mc(a) {
  if (a <= STP[0][0]) return STP[0][1];
  for (let i = 1; i < STP.length; i++) if (a <= STP[i][0]) { const [x0, c0] = STP[i - 1], [x1, c1] = STP[i]; return mix(c0, c1, (a - x0) / (x1 - x0)); }
  return STP[STP.length - 1][1];
}
// backend map images (crossfade)
const imgs = {}; let mC = null, mP = null, mF = 1;
function getMap(y) {
  let k = y; while (k >= Y0 && !YR[k]?.image) k--;
  if (k < Y0 || mC?.y === k) return;
  const im = imgs[k] ||= Object.assign(new Image(), { src: YR[k].image });
  const go = () => { mP = mC; mC = { y: k, im }; mF = 0; };
  im.complete && im.naturalWidth ? go() : (im.onload = go);
}
// scenery
const arr = (n, f) => Array.from({ length: n }, f);
const STR = arr(260, () => ({ x: rnd(W), y: rnd(H), z: rnd(1, .3), p: rnd(6) }));   // stars
const CRL = arr(9, () => ({ o: rnd(180, -180), a: rnd(60, -60), p: rnd(6) }));      // wind curls
const DOT = arr(36, () => ({ x: rnd(W), y: rnd(H), v: rnd(20, 6), r: rnd(2.4, .8), p: rnd(6) })); // sparkles
const CLD = arr(7, (_, i) => ({ x: i * 260 + rnd(120), y: H - 22 - rnd(18), s: rnd(1.1, .7), v: rnd(14, 8) })); // clouds
const SMG = arr(14, (_, i) => ({ x: rnd(W), y: MY + rnd(MH * 1.1), s: rnd(3, 1.2), v: rnd(22, 8), k: i / 14 }));  // smog
let cr = [], dr = 0; // critters, time drift
const BC = [[126, 184, 230], [242, 160, 123], [246, 208, 107], [180, 160, 230]]; // bird colours
function addBird() { if (cr.length >= 70) return; const a = rnd(55, -35); cr.push({ t: 'b', o: -185, a, p: rnd(6), s: rnd(1.4, 1), v: rnd(24, 15), c: pick(BC) }, { t: 'n', o: rnd(-140, -170), a: a + 4, p: 0, s: 1, l: 1 }); }
// sound wave line at top
function wave(h, P) {
  if (!an) return;
  an.getByteTimeDomainData(wv);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [lw, a] of [[7, .12], [2.2, .7]]) {
    g.strokeStyle = rgb(mix([190, 220, 255], [255, 130, 80], h), a * (1 - .5 * P)); g.lineWidth = lw; g.beginPath();
    for (let i = 0; i <= 200; i++) { const x = 160 + (W - 320) * i / 200, v = (wv[Math.floor(i / 200 * 1023)] - 128) / 128; g.lineTo(x, 24 + v * 44 * Math.sin(Math.PI * i / 200)); }
    g.stroke();
  }
  g.restore();
}
// little drawings
function dBird(x, y, s, p, c) {
  g.save(); g.translate(x, y + Math.sin(p * .9) * 3 * s); g.scale(s, s); g.strokeStyle = INK; g.lineWidth = 1.8; g.lineCap = 'round';
  g.fillStyle = rgb(c); g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill(); g.stroke();
  g.fillStyle = '#f2a04a'; g.beginPath(); g.moveTo(9, -2); g.lineTo(15, 0); g.lineTo(9, 2.5); g.fill();
  g.fillStyle = INK; g.beginPath(); g.arc(4, -3, 1.8, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-7, 0); g.quadraticCurveTo(-2, -6 - 7 * Math.sin(p * 2.2), 3, 0); g.stroke();
  g.restore();
}
function dFly(x, y, s, p, hu, al) {
  const f = .25 + .75 * Math.abs(Math.sin(p * 2.4));
  g.save(); g.globalAlpha = al; g.translate(x, y + Math.sin(p) * 2); g.scale(s, s); g.strokeStyle = INK; g.lineWidth = 1.4;
  for (const sd of [-1, 1]) { g.save(); g.scale(sd * f, 1); g.fillStyle = `hsl(${hu},80%,78%)`; g.beginPath(); g.ellipse(6, -5, 7, 6, -.5, 0, 7); g.fill(); g.stroke(); g.fillStyle = `hsl(${hu + 25},75%,72%)`; g.beginPath(); g.ellipse(5, 5, 4.5, 4, .5, 0, 7); g.fill(); g.stroke(); g.restore(); }
  g.fillStyle = INK; g.beginPath(); g.ellipse(0, 0, 1.8, 7, 0, 0, 7); g.fill();
  g.restore();
}
function dLeaf(x, y, s, p, c) { g.save(); g.translate(x, y); g.rotate(Math.sin(p) * .9); g.scale(s, s); g.strokeStyle = INK; g.lineWidth = 1.5; g.fillStyle = c; g.beginPath(); g.moveTo(-10, 0); g.quadraticCurveTo(0, -9, 10, 0); g.quadraticCurveTo(0, 9, -10, 0); g.fill(); g.stroke(); g.restore(); }
function dNote(x, y, a) { g.save(); g.globalAlpha = a; g.fillStyle = g.strokeStyle = '#e8eefc'; g.lineWidth = 2; g.beginPath(); g.ellipse(x, y, 5, 3.6, -.4, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + 4.5, y - 1); g.lineTo(x + 4.5, y - 17); g.quadraticCurveTo(x + 10, y - 14, x + 11, y - 9); g.stroke(); g.restore(); }
function blob(x, y, s, c, a) { g.save(); g.globalAlpha = a; g.fillStyle = c; g.beginPath(); for (const [dx, dy, r] of [[-30, 6, 26], [-6, -10, 34], [26, -2, 28], [48, 10, 20], [8, 14, 26]]) { g.moveTo(x + (dx + r) * s, y + dy * s); g.arc(x + dx * s, y + dy * s, r * s, 0, 7); } g.fill(); g.restore(); }
const grad = (x0, y0, x1, y1, st2) => { const gr = g.createLinearGradient(x0, y0, x1, y1); st2.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };
const rad = (x, y, r0, r1, st2) => { const gr = g.createRadialGradient(x, y, r0, x, y, r1); st2.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; };

// draw one frame
function draw(ms, dt) {
  const D = dl(T), h = D.h, P = D.p, t = ms / 1000;
  dr *= .2 ** dt; pls *= .1 ** dt; beat *= .08 ** dt;
  // sky
  const top = mix(mix([52, 52, 104], [58, 30, 50], h), [36, 22, 16], P * .7);
  g.fillStyle = grad(0, 0, 0, H, [[0, rgb(top)], [1, rgb(mix(mix([18, 18, 44], [16, 8, 12], h), [60, 40, 28], P * .6))]]);
  g.fillRect(0, 0, W, H);
  // stars (streak when time jumps)
  for (const s of STR) {
    s.x -= (3 + 240 * dr) * s.z * dt; if (s.x < -5) { s.x = W + 5; s.y = rnd(H); }
    const a = (.4 + .5 * Math.sin(t * 1.3 + s.p)) * s.z * (1 - .95 * P); if (a <= .02) continue;
    g.fillStyle = g.strokeStyle = `rgba(255,245,220,${a})`;
    if (dr > .15 && !noMo) { g.lineWidth = s.z * 1.5; g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x + 70 * dr * s.z, s.y); g.stroke(); }
    else g.fillRect(s.x, s.y, s.z * 2, s.z * 2);
  }
  // magic: nebula, aurora, sparkles (fade with heat)
  const mg3 = (1 - h) * (1 - P);
  if (mg3 > .02) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [x, y, r, c] of [[W * .2, H * .35, 420, [120, 90, 220]], [W * .82, H * .6, 460, [60, 140, 210]]]) { g.fillStyle = rad(x, y, 0, r, [[0, rgb(c, .16 * mg3)], [1, 'rgba(0,0,0,0)']]); g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let k = 0; k < 3; k++) {
      g.fillStyle = grad(0, 0, 0, 150, [[0, 'rgba(0,0,0,0)'], [.55, rgb(k === 1 ? [160, 120, 255] : [90, 230, 190], .26 * mg3)], [1, 'rgba(0,0,0,0)']]);
      g.beginPath(); g.moveTo(0, 150); for (let x = 0; x <= W; x += 40) g.lineTo(x, 34 + k * 16 + 26 * Math.sin(x / 210 + t * (.18 + k * .07) + k * 2)); g.lineTo(W, 150); g.fill();
    }
    for (const m of DOT) { m.y -= m.v * dt; m.x += Math.sin(t * .6 + m.p) * 6 * dt; if (m.y < -10) { m.y = H + 10; m.x = rnd(W); } g.fillStyle = `rgba(255,240,200,${mg3 * (.35 + .35 * Math.sin(t * 2 + m.p))})`; g.beginPath(); g.arc(m.x, m.y, m.r, 0, 7); g.fill(); }
    g.restore();
  }
  // sun (gets red + big)
  const sr = 34 + 22 * h + 3 * pls, sc = mix([238, 200, 140], [228, 92, 56], h);
  g.fillStyle = rad(70, 90, sr * .5, sr * 3.2, [[0, rgb(sc, .45 * (1 - .5 * P))], [1, 'rgba(255,150,80,0)']]); g.beginPath(); g.arc(70, 90, sr * 3.2, 0, 7); g.fill();
  g.fillStyle = rgb(mix(sc, [120, 70, 50], .6 * P)); g.beginPath(); g.arc(70, 90, sr, 0, 7); g.fill();
  // moon
  const mx = W - 80, my = 86 + Math.sin(t * .4) * 5, cut = new Path2D();
  cut.rect(mx - 40, my - 40, 80, 80); cut.arc(mx + 11, my - 7, 23, 0, 7);
  g.save(); g.clip(cut, 'evenodd'); g.globalAlpha = 1 - .7 * P; g.shadowColor = 'rgba(255,240,200,.6)'; g.shadowBlur = 18 * (1 - P); g.fillStyle = '#fff1cc'; g.beginPath(); g.arc(mx, my, 26, 0, 7); g.fill(); g.restore();
  // map glow (pulses with notes)
  g.save(); g.shadowColor = rgb(mix([110, 170, 255], [255, 120, 60], h), .5 + .4 * beat); g.shadowBlur = 40 + 70 * beat; g.fillStyle = '#0b1226'; g.fill(OL); g.restore();
  // map colours
  g.save(); g.clip(OL);
  if (mC) {
    mF = Math.min(1, mF + dt * .9);
    if (mP && mF < 1) g.drawImage(mP.im, MX, MY, MW, MH);
    g.globalAlpha = mF; g.drawImage(mC.im, MX, MY, MW, MH); g.globalAlpha = 1;
  } else {
    const z = zAt(T);
    for (let r = 0; r < MH; r++) { g.fillStyle = rgb(mc(zLat(z, RLAT[r]))); g.fillRect(MX, MY + r, MW, 1.6); }
    g.fillStyle = 'rgba(255,255,255,.07)'; g.fill(LND, 'evenodd');
  }
  g.strokeStyle = 'rgba(25,30,45,.75)'; g.lineWidth = 1.2; g.stroke(LND);
  // lat lines
  g.strokeStyle = 'rgba(20,30,50,.18)'; g.lineWidth = 1;
  for (let la = -60; la <= 60; la += 30) { g.beginPath(); for (let o = -180; o <= 180; o += 10) g.lineTo(...pj(o, la)); g.stroke(); }
  // wind curls
  const ws = (5 + 24 * h) * (play ? 1 : .4);
  g.strokeStyle = `rgba(255,255,255,${.6 - .35 * P})`; g.lineWidth = 2.2; g.lineCap = 'round';
  for (const w of CRL) {
    w.o += ws * dt; w.p += dt * (1 + 2 * h); if (w.o > 190) { w.o = -190; w.a = rnd(60, -60); }
    const [x, y] = pj(cl(w.o, -180, 180), w.a);
    g.beginPath(); g.moveTo(x - 58, y); g.bezierCurveTo(x - 29, y - 10 * Math.sin(w.p), x - 10, y + 6, x, y); g.arc(x, y - 9, 9, 1.57, 6.17, true); g.stroke();
  }
  // critters: leaves, butterflies, birds, notes
  if (cr.length < 60) {
    if (Math.random() < dt * 2.2 * D.n) cr.push({ t: 'l', o: -185, a: rnd(55, -55), p: rnd(6), s: rnd(1.3, .8) });
    if (Math.random() < dt * 1.3 * D.b) cr.push({ t: 'f', o: rnd(150, -150), a: rnd(45, -45), p: rnd(6), s: rnd(1.3, .9), hu: pick([330, 45, 190, 280]), l: 1 });
  }
  for (let i = cr.length - 1; i >= 0; i--) {
    const k = cr[i]; k.p += dt * 5;
    if (k.t === 'l') { k.o += ws * 1.3 * dt; k.a += Math.sin(k.p * .6) * 6 * dt; }
    else if (k.t === 'b') k.o += k.v * dt;
    else if (k.t === 'f') { k.o += Math.sin(k.p * .3) * 5 * dt; k.a += Math.cos(k.p * .4) * 4 * dt; k.l -= dt * .12; }
    else { k.a += 7 * dt; k.o += 4 * dt; k.l -= dt * .55; }
    if (k.o > 190 || k.l <= 0) { cr.splice(i, 1); continue; }
    const [x, y] = pj(cl(k.o, -180, 180), cl(k.a, -85, 85));
    if (k.t === 'l') dLeaf(x, y, k.s, k.p, rgb(mix([120, 190, 105], [222, 156, 80], h)));
    else if (k.t === 'b') dBird(x, y, k.s, k.p, k.c);
    else if (k.t === 'f') dFly(x, y, k.s * 1.15, k.p, k.hu, Math.min(1, k.l * 3));
    else dNote(x, y, Math.min(1, k.l * 1.5) * .85);
  }
  // heat shimmer
  if (h > .6 && !noMo) { g.strokeStyle = `rgba(255,230,200,${.35 * (h - .6) / .4})`; g.lineWidth = 1.8; for (let k = 0; k < 7; k++) { const y0 = MY + MH * (.18 + k * .11); g.beginPath(); for (let x = MX; x <= MX + MW; x += 16) g.lineTo(x, y0 + Math.sin(x / 40 + t * 2.4 + k) * 3.5); g.stroke(); } }
  g.restore();
  // map edge
  g.strokeStyle = rgb(mix([150, 190, 255], [255, 150, 90], h), .9); g.lineWidth = 2 + 2.5 * beat; g.stroke(OL);
  wave(h, P);
  // smog
  if (P > .02) {
    for (const c of SMG) { if (c.k > P * 1.05) continue; c.x += c.v * dt * (1 + dr * 2); if (c.x > W + 200) { c.x = -200; c.y = MY + rnd(MH * 1.1); } blob(c.x, c.y, c.s, 'rgb(96,82,72)', .14 * P); }
    g.fillStyle = grad(0, H, 0, 0, [[0, `rgba(110,88,66,${.5 * P})`], [.6, `rgba(90,74,60,${.22 * P})`], [1, `rgba(60,50,45,${.1 * P})`]]); g.fillRect(0, 0, W, H);
  }
  // dark edges
  g.fillStyle = rad(CX, CY, MW * .42, MW * .78, [[0, 'rgba(0,0,0,0)'], [1, `rgba(${8 + 20 * h | 0},5,5,${.25 + .55 * h})`]]); g.fillRect(0, 0, W, H);
  // clouds (turn to smog)
  for (const c of CLD) { c.x += c.v * dt * (1 + 2 * dr); if (c.x > W + 160) c.x = -160; blob(c.x, c.y, c.s, rgb(mix([236, 232, 250], [110, 92, 80], P)), .85 - .3 * P); }
  // legend + year
  leg();
  g.font = '500 30px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(245,240,230,.92)'; g.fillText(Math.floor(T), MX + 20, MY + MH - 6);
  g.font = '13px "IBM Plex Mono", monospace'; g.fillStyle = 'rgba(200,210,235,.7)'; g.textAlign = 'center';
  g.fillText(mC ? `NASA SVS 5207 · ${mC.y}` : `colours: NASA GISTEMP v4 zonal means, °C vs 1951–1980${est.includes(Math.floor(T)) ? ' · bands estimated this year*' : ''}`, CX, MY + MH + 84);
  g.textAlign = 'start';
  // meters
  if (fr % 6 === 0) { $('gBirds').style.width = D.b * 100 + '%'; $('gPoll').style.width = P * 100 + '%'; $('gPitch').style.width = 8 + h * 92 + '%'; }
}
// colour scale under map (drawn once)
let lc = null;
function leg() {
  if (!lc) {
    lc = document.createElement('canvas'); lc.width = 420; lc.height = 54; const c = lc.getContext('2d');
    for (let x = 0; x < 360; x++) { c.fillStyle = rgb(mc(-2 + x / 359 * 4)); c.fillRect(30 + x, 18, 1, 12); }
    c.strokeStyle = 'rgba(232,238,252,.5)'; c.strokeRect(30, 18, 360, 12);
    c.font = '12px "IBM Plex Mono", monospace'; c.fillStyle = 'rgba(220,228,248,.85)'; c.textAlign = 'center';
    for (const v of [-2, -1, 0, 1, 2]) { const x = 30 + (v + 2) * 90, s = v > 0 ? '+' : ''; c.fillText(`${s}${v}°C`, x, 46); c.fillText(`${s}${(v * 1.8).toFixed(1)}°F`, x, 12); }
  }
  g.drawImage(lc, CX - 210, MY + MH + 16);
}

// ---- time ribbon
const rb = $('ribbon'), rc = rb.getContext('2d'), RW = rb.width, RH = rb.height;
const rx = y => 20 + (y - Y0) / (Y1 + 1 - Y0) * (RW - 40);
let rbase = null;
function mkRib() {
  rbase = document.createElement('canvas'); rbase.width = RW; rbase.height = RH;
  const b = rbase.getContext('2d'), bw = (RW - 40) / (Y1 + 1 - Y0);
  for (let y = Y0; y <= Y1; y++) { b.fillStyle = rgb(mc(YR[y].anomaly * 1.6)); b.fillRect(rx(y), 16, bw + .6, RH - 38); }
  b.font = '13px "IBM Plex Mono", monospace'; b.fillStyle = 'rgba(160,172,205,.9)';
  for (let y = 1880; y <= 2020; y += 20) b.fillText(y, rx(y) - 16, RH - 3);
  b.fillStyle = '#ff7a45';
  for (const c of STORY) { const x = rx(c.year + .5); b.beginPath(); b.moveTo(x, 13); b.lineTo(x - 5, 4); b.lineTo(x + 5, 4); b.fill(); }
}
function rib() { if (!rbase) return; rc.clearRect(0, 0, RW, RH); rc.drawImage(rbase, 0, 0); const x = rx(T); rc.fillStyle = 'rgba(8,12,26,.72)'; rc.fillRect(x, 16, RW - 20 - x, RH - 38); rc.fillStyle = '#fff'; rc.fillRect(x - 1.5, 10, 3, RH - 26); }
rb.onclick = e => { const r = rb.getBoundingClientRect(); jump(Y0 + ((e.clientX - r.left) / r.width * RW - 20) / (RW - 40) * (Y1 + 1 - Y0)); };

// ---- buttons + keys
const open = () => { aud(); $('startOverlay').classList.add('gone'); };
$('start').onclick = () => { open(); reset(); setP(true); };
$('startNarrated').onclick = () => { open(); setN(true); reset(); setP(true); say('Welcome to The Warming Song. We will fly through a hundred and forty-four years of NASA temperature data. Listen: as the planet warms, the birds grow quiet, the machines grow loud, and the music gets tense. Press space to pause, N for the next chapter, M to mute, and V to turn me off.', { hold: true, key: 'welcome' }); };
$('play').onclick = () => { open(); setP(!play); };
$('restart').onclick = reset;
$('replay').onclick = () => { epHide(); reset(); setP(true); };
$('closeEp').onclick = epHide;
$('next').onclick = () => { open(); next(); };
$('scrub').oninput = e => jump(+e.target.value);
const sb = document.querySelectorAll('[data-speed]');
sb.forEach(b => b.onclick = () => { spd = +b.dataset.speed; sb.forEach(x => x.setAttribute('aria-pressed', x === b)); });
document.querySelectorAll('.layer').forEach(b => b.onclick = () => { const k = b.dataset.layer; on[k] = !on[k]; b.setAttribute('aria-pressed', !!on[k]); });
function tMute() { mute = !mute; $('mute').setAttribute('aria-pressed', mute); $('mute').setAttribute('aria-label', mute ? 'Unmute' : 'Mute'); if (ac) mg.gain.setTargetAtTime(mute ? 0 : 1, ac.currentTime, .12); if (mute) hush(); }
$('mute').onclick = tMute;
$('narrator').onclick = () => { aud(); setN(!nOn); };
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === ' ' && e.target.tagName !== 'BUTTON') { e.preventDefault(); $('play').click(); }
  else if (k === 'arrowright') jump(Math.floor(T) + 1);
  else if (k === 'arrowleft') jump(Math.floor(T) - 1);
  else if (k === 'n') next();
  else if (k === 'm') tMute();
  else if (k === 'v') $('narrator').click();
  else if (k === 'escape' && epOn) epHide();
});

// ---- main loop
let pt = performance.now(), fr = 0;
function loop(ms) {
  requestAnimationFrame(loop);
  const dt = Math.min(.1, (ms - pt) / 1000); pt = ms; fr++;
  try { adv(dt); if (fr % 15 === 0) mood(); draw(ms, dt); rib(); } catch (e) { console.error(e); }
}
load().then(() => { hud(Y0); requestAnimationFrame(loop); });
