// Alle Sounds werden per WebAudio synthetisiert. Keine Dateien, keine Kosten.
let ctx = null;
let master = null;
let musicGain = null;
let musicTimer = null;
let muted = false;

function ensure() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(master);
  return true;
}

export function unlockAudio() {
  if (!ensure()) return;
  if (ctx.state === 'suspended') ctx.resume();
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.8;
  return muted;
}

function noise(dur, { freq = 1200, q = 0.8, gain = 0.5, type = 'bandpass', attack = 0.002 } = {}) {
  const n = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(master);
  src.start(t); src.stop(t + dur);
}

function tone(freqStart, freqEnd, dur, { type = 'sine', gain = 0.4, decay = true } = {}) {
  const o = ctx.createOscillator(); o.type = type;
  const g = ctx.createGain();
  const t = ctx.currentTime;
  o.frequency.setValueAtTime(freqStart, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  g.gain.setValueAtTime(gain, t);
  if (decay) g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + dur + 0.02);
}

export const Sfx = {
  whooshLight() { if (!ensure()) return; noise(0.12, { freq: 2200, q: 0.6, gain: 0.25 }); },
  whooshHeavy() { if (!ensure()) return; noise(0.2, { freq: 900, q: 0.7, gain: 0.35 }); },
  hitLight() { if (!ensure()) return; tone(220, 60, 0.12, { type: 'square', gain: 0.35 }); noise(0.08, { freq: 3000, q: 0.5, gain: 0.3 }); },
  hitHeavy() { if (!ensure()) return; tone(160, 40, 0.22, { type: 'square', gain: 0.5 }); noise(0.16, { freq: 1800, q: 0.5, gain: 0.45 }); tone(80, 30, 0.3, { type: 'sine', gain: 0.5 }); },
  block() { if (!ensure()) return; tone(900, 500, 0.06, { type: 'triangle', gain: 0.25 }); noise(0.05, { freq: 4000, q: 1, gain: 0.15 }); },
  jump() { if (!ensure()) return; noise(0.1, { freq: 600, q: 0.5, gain: 0.12 }); },
  land() { if (!ensure()) return; noise(0.08, { freq: 300, q: 0.6, gain: 0.18, type: 'lowpass' }); },
  dash() { if (!ensure()) return; noise(0.15, { freq: 1500, q: 0.4, gain: 0.2 }); },
  special() { if (!ensure()) return; tone(200, 900, 0.35, { type: 'sawtooth', gain: 0.25 }); noise(0.3, { freq: 2500, q: 0.4, gain: 0.25 }); },
  superFire() { if (!ensure()) return; tone(120, 1400, 0.6, { type: 'sawtooth', gain: 0.35 }); tone(60, 500, 0.6, { type: 'square', gain: 0.25 }); noise(0.5, { freq: 3000, q: 0.3, gain: 0.35 }); },
  projHit() { if (!ensure()) return; tone(500, 90, 0.25, { type: 'sawtooth', gain: 0.35 }); noise(0.2, { freq: 2000, q: 0.5, gain: 0.35 }); },
  ko() { if (!ensure()) return; tone(140, 30, 0.9, { type: 'square', gain: 0.5 }); tone(70, 25, 1.2, { type: 'sine', gain: 0.6 }); noise(0.5, { freq: 800, q: 0.4, gain: 0.5, type: 'lowpass' }); },
  select() { if (!ensure()) return; tone(600, 900, 0.08, { type: 'square', gain: 0.15 }); },
  confirm() { if (!ensure()) return; tone(500, 1000, 0.12, { type: 'square', gain: 0.2 }); setTimeout(() => tone(800, 1400, 0.15, { type: 'square', gain: 0.2 }), 90); },
  back() { if (!ensure()) return; tone(700, 300, 0.12, { type: 'square', gain: 0.15 }); },
  roundBell() { if (!ensure()) return; tone(1200, 1150, 0.5, { type: 'sine', gain: 0.4 }); tone(2400, 2300, 0.4, { type: 'sine', gain: 0.15 }); },
  meterFull() { if (!ensure()) return; tone(400, 1200, 0.25, { type: 'triangle', gain: 0.25 }); },
  timeTick() { if (!ensure()) return; tone(1000, 1000, 0.04, { type: 'square', gain: 0.08 }); },
};

// Dauergeraeusche fuer Wetter (Regen, Wind), gefiltertes Rauschen in Schleife
let ambientSrc = null, ambientGain = null;
export const Ambient = {
  start(kind, vol = 0.3) {
    if (!ensure()) return;
    Ambient.stop();
    const n = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    ambientSrc = ctx.createBufferSource(); ambientSrc.buffer = buf; ambientSrc.loop = true;
    const f = ctx.createBiquadFilter();
    if (kind === 'rain') { f.type = 'bandpass'; f.frequency.value = 2400; f.Q.value = 0.4; }
    else { f.type = 'lowpass'; f.frequency.value = 400; f.Q.value = 0.6; }
    ambientGain = ctx.createGain(); ambientGain.gain.value = 0;
    ambientGain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 1.5);
    ambientSrc.connect(f); f.connect(ambientGain); ambientGain.connect(master);
    ambientSrc.start();
    if (kind === 'wind') {
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
      const lg = ctx.createGain(); lg.gain.value = vol * 0.6;
      lfo.connect(lg); lg.connect(ambientGain.gain); lfo.start();
    }
  },
  stop() {
    if (ambientSrc) { try { ambientSrc.stop(); } catch (e) { /* schon aus */ } ambientSrc = null; }
  },
};

Sfx.thunder = () => { if (!ensure()) return; tone(90, 25, 1.6, { type: 'sawtooth', gain: 0.5 }); noise(1.4, { freq: 250, q: 0.3, gain: 0.7, type: 'lowpass', attack: 0.05 }); };

// Ansager per Sprachsynthese (falls vorhanden), sonst stumm.
export function announce(text, { rate = 0.9, pitch = 0.6 } = {}) {
  try {
    if (!window.speechSynthesis || muted) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US'; u.rate = rate; u.pitch = pitch; u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v => /en[-_]US/i.test(v.lang) && /male|daniel|alex|fred/i.test(v.name)) || voices.find(v => /en[-_]US/i.test(v.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) { /* kein Ansager */ }
}

// Einfacher Musik-Loop (Bass, Kick, Snare, Hi-Hat), prozedural, je Buehne ein anderes Tempo/Tonart.
const SCALES = {
  hinterhof: { bpm: 96, root: 36.7, seq: [0, 0, 3, 0, 5, 0, 3, 2] },
  kasbah: { bpm: 88, root: 43.7, seq: [0, 1, 0, 5, 0, 1, 8, 7] },
  neon: { bpm: 118, root: 38.9, seq: [0, 0, 7, 0, 6, 0, 7, 10] },
  berlin: { bpm: 128, root: 41.2, seq: [0, 0, 7, 0, 10, 0, 7, 5] },
  atlas: { bpm: 112, root: 49, seq: [0, 0, 3, 0, 5, 0, 3, 2] },
  living: { bpm: 100, root: 43.7, seq: [0, 7, 0, 7, 5, 0, 3, 0] },
  rooftop: { bpm: 140, root: 46.2, seq: [0, 0, 0, 10, 0, 0, 8, 7] },
  title: { bpm: 120, root: 41.2, seq: [0, 0, 7, 0, 3, 0, 5, 0] },
};

export function startMusic(stageId) {
  if (!ensure()) return;
  stopMusic();
  const s = SCALES[stageId] || SCALES.title;
  const step = 60 / s.bpm / 2; // Achtel
  let i = 0;
  let next = ctx.currentTime + 0.05;
  const schedule = () => {
    while (next < ctx.currentTime + 0.3) {
      const k = i % 8;
      const t = next;
      // Bass
      const o = ctx.createOscillator(); o.type = 'sawtooth';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 350;
      const g = ctx.createGain();
      o.frequency.value = s.root * Math.pow(2, s.seq[k] / 12) * (k % 4 === 2 ? 2 : 1);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.01, t + step * 0.9);
      o.connect(f); f.connect(g); g.connect(musicGain); o.start(t); o.stop(t + step);
      // Kick auf 1 und 3 (Viertel)
      if (k % 4 === 0) {
        const ko = ctx.createOscillator(); const kg = ctx.createGain();
        ko.frequency.setValueAtTime(150, t); ko.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        kg.gain.setValueAtTime(0.9, t); kg.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
        ko.connect(kg); kg.connect(musicGain); ko.start(t); ko.stop(t + 0.16);
      }
      // Snare auf 2 und 4
      if (k % 4 === 2) {
        const n = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate); const d = n.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1) * (1 - j / d.length);
        const src = ctx.createBufferSource(); src.buffer = n; const sg = ctx.createGain(); sg.gain.value = 0.35;
        const sf = ctx.createBiquadFilter(); sf.type = 'highpass'; sf.frequency.value = 1500;
        src.connect(sf); sf.connect(sg); sg.connect(musicGain); src.start(t);
      }
      // Hi-Hat auf jeder Achtel
      {
        const n = ctx.createBuffer(1, ctx.sampleRate * 0.03, ctx.sampleRate); const d = n.getChannelData(0);
        for (let j = 0; j < d.length; j++) d[j] = (Math.random() * 2 - 1);
        const src = ctx.createBufferSource(); src.buffer = n; const hg = ctx.createGain(); hg.gain.value = k % 2 ? 0.08 : 0.14;
        const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000;
        src.connect(hf); hf.connect(hg); hg.connect(musicGain); src.start(t);
      }
      next += step; i++;
    }
  };
  schedule();
  musicTimer = setInterval(schedule, 100);
}

export function stopMusic() {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
}

export function setMusicVolume(v) { if (musicGain) musicGain.gain.value = v; }
