// The score, generated with Web Audio like everything else (no files). Two layers:
//  calm      stage 1-2: a slow pad in D minor and a far-off piano, now and then
//  suspense  after the backup code (stage 3): a heartbeat pulse, a minor-second drone that
//            breathes, a high thin shimmer
//  reveal    the suspense layer, harder and faster, for S9
// The interlude and the login are silent. Changes glide; the code acceptance gets a riser.
// Notes are scheduled a little ahead on the audio clock by a short timer.

import { audioEngine, isMuted, subThud, type Engine } from "./sfx";

export type MusicMode = "off" | "calm" | "suspense" | "reveal";

type Score = {
  calm: GainNode;
  tense: GainNode;
  reverb: ConvolverNode;
  timer: ReturnType<typeof setInterval>;
  nextPad: number;
  nextNote: number;
  nextBeat: number;
  chord: number;
};

let score: Score | null = null;
let mode: MusicMode = "off";

const LEVEL: Record<MusicMode, [number, number]> = {
  off: [0, 0],
  calm: [1, 0],
  suspense: [0, 1],
  reveal: [0, 1.35],
};
const BPM: Record<MusicMode, number> = { off: 0, calm: 0, suspense: 64, reveal: 80 };
const AHEAD_S = 0.4;
const PAD_S = 8;

// Dm9 · Bbmaj7 · Gm9 · Asus4, voiced low (Hz)
const CHORDS = [
  [146.83, 174.61, 220, 329.63],
  [116.54, 146.83, 174.61, 220],
  [98, 116.54, 146.83, 220],
  [110, 146.83, 164.81, 220],
];
// the far piano: D minor pentatonic, up high
const NOTES = [440, 523.25, 587.33, 659.25, 698.46, 880];

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function impulse(ctx: AudioContext, seconds: number) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

function pad(e: Readonly<Engine>, s: Score, at: number) {
  const chord = CHORDS[s.chord % CHORDS.length];
  s.chord += 1;
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.018, at + 3);
  g.gain.setValueAtTime(0.018, at + PAD_S - 1);
  g.gain.linearRampToValueAtTime(0, at + PAD_S + 3);
  lp.connect(g);
  g.connect(s.calm);
  g.connect(s.reverb);
  chord.forEach((f) =>
    [-4, 4].forEach((cents) => {
      const o = e.ctx.createOscillator();
      o.type = "triangle";
      o.frequency.value = f;
      o.detune.value = cents;
      o.connect(lp);
      o.start(at);
      o.stop(at + PAD_S + 3.1);
    }),
  );
}

function piano(e: Readonly<Engine>, s: Score, at: number) {
  const f = NOTES[Math.floor(Math.random() * NOTES.length)];
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.03, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 2.8);
  const p = e.ctx.createStereoPanner();
  p.pan.value = rand(-0.6, 0.6);
  g.connect(p);
  p.connect(s.calm);
  p.connect(s.reverb);
  [1, 2, 3].forEach((k, i) => {
    const o = e.ctx.createOscillator();
    o.frequency.value = f * k;
    const pg = e.ctx.createGain();
    pg.gain.value = [1, 0.25, 0.08][i];
    o.connect(pg).connect(g);
    o.start(at);
    o.stop(at + 2.9);
  });
}

/** A heartbeat: two low thumps, the second softer. */
function beat(e: Readonly<Engine>, s: Score, at: number) {
  [0, 0.24].forEach((dt, i) => {
    const o = e.ctx.createOscillator();
    o.frequency.setValueAtTime(64, at + dt);
    o.frequency.exponentialRampToValueAtTime(38, at + dt + 0.25);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, at + dt);
    g.gain.linearRampToValueAtTime(i ? 0.14 : 0.2, at + dt + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dt + 0.32);
    o.connect(g).connect(s.tense);
    o.start(at + dt);
    o.stop(at + dt + 0.35);
  });
  // a dry tick between beats, like a clock in another room
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  const hp = e.ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const tg = e.ctx.createGain();
  const t = at + 60 / BPM[mode] / 2;
  tg.gain.setValueAtTime(0, t);
  tg.gain.linearRampToValueAtTime(0.012, t + 0.002);
  tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(hp).connect(tg).connect(s.tense);
  src.start(t, rand(0, 0.4), 0.05);
}

/** The suspense bed: a minor second low down that breathes, and a thin high shimmer. */
function tensionBed(e: Readonly<Engine>, s: Score) {
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 420;
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = e.ctx.createGain();
  depth.gain.value = 260;
  lfo.connect(depth).connect(lp.frequency);
  lfo.start();
  const g = e.ctx.createGain();
  g.gain.value = 0.05;
  [55, 58.27, 110.2].forEach((f) => {
    const o = e.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
  });
  lp.connect(g).connect(s.tense);
  const shimmer = e.ctx.createGain();
  shimmer.gain.value = 0.006;
  const trem = e.ctx.createOscillator();
  trem.frequency.value = 5.3;
  const tremDepth = e.ctx.createGain();
  tremDepth.gain.value = 0.004;
  trem.connect(tremDepth).connect(shimmer.gain);
  trem.start();
  [1760, 1864.66].forEach((f) => {
    const o = e.ctx.createOscillator();
    o.frequency.value = f;
    o.connect(shimmer);
    o.start();
  });
  shimmer.connect(s.tense);
  shimmer.connect(s.reverb);
}

function start(e: Readonly<Engine>): Score {
  const calm = e.ctx.createGain();
  const tense = e.ctx.createGain();
  calm.gain.value = 0;
  tense.gain.value = 0;
  const reverb = e.ctx.createConvolver();
  reverb.buffer = impulse(e.ctx, 3.2);
  const wet = e.ctx.createGain();
  wet.gain.value = 0.5;
  calm.connect(e.master);
  tense.connect(e.master);
  reverb.connect(wet).connect(e.master);
  const now = e.ctx.currentTime;
  const s: Score = { calm, tense, reverb, timer: 0 as never, nextPad: now + 0.2, nextNote: now + 3, nextBeat: now + 0.5, chord: 0 };
  tensionBed(e, s);
  s.timer = setInterval(() => {
    const until = e.ctx.currentTime + AHEAD_S;
    if (isMuted() || mode === "off") {
      // keep the clocks moving so nothing piles up when the sound comes back
      s.nextPad = Math.max(s.nextPad, until);
      s.nextNote = Math.max(s.nextNote, until);
      s.nextBeat = Math.max(s.nextBeat, until);
      return;
    }
    if (mode === "calm") {
      while (s.nextPad < until) {
        pad(e, s, s.nextPad);
        s.nextPad += PAD_S;
      }
      while (s.nextNote < until) {
        piano(e, s, s.nextNote);
        s.nextNote += rand(3.5, 8);
      }
    } else {
      s.nextPad = Math.max(s.nextPad, until);
      s.nextNote = Math.max(s.nextNote, until);
      while (s.nextBeat < until) {
        beat(e, s, s.nextBeat);
        s.nextBeat += 60 / BPM[mode];
      }
    }
  }, 120);
  return s;
}

/** Sets the layer; glides over a few seconds. Does nothing before audio is unlocked. */
export function music(next: MusicMode) {
  const e = audioEngine();
  if (!e) return;
  if (!score) score = start(e);
  mode = next;
  const [calm, tense] = LEVEL[next];
  const now = e.ctx.currentTime;
  score.calm.gain.setTargetAtTime(calm, now, next === "calm" ? 1.5 : 0.6);
  score.tense.gain.setTargetAtTime(tense, now, 1.2);
}

/** The code is accepted: a rising sweep of air and a climbing tone, cut by a thump. */
export function riser(seconds = 2.6) {
  const e = audioEngine();
  if (!e || isMuted()) return;
  const now = e.ctx.currentTime;
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2;
  bp.frequency.setValueAtTime(300, now);
  bp.frequency.exponentialRampToValueAtTime(5000, now + seconds);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.09, now + seconds * 0.9);
  g.gain.linearRampToValueAtTime(0, now + seconds);
  src.connect(bp).connect(g).connect(e.master);
  src.start(now);
  src.stop(now + seconds + 0.05);
  const o = e.ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(55, now);
  o.frequency.exponentialRampToValueAtTime(220, now + seconds);
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 700;
  const og = e.ctx.createGain();
  og.gain.setValueAtTime(0, now);
  og.gain.linearRampToValueAtTime(0.05, now + seconds * 0.9);
  og.gain.linearRampToValueAtTime(0, now + seconds);
  o.connect(lp).connect(og).connect(e.master);
  o.start(now);
  o.stop(now + seconds + 0.05);
  setTimeout(() => subThud(1), seconds * 1000);
}
