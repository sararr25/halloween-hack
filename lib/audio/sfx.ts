// Procedural sound design (Web Audio): no files, no network, nothing recorded.
// Rules (docs/desktop.md): rich but never loud, no sudden peaks, a mute toggle.
// Everything goes through one compressor so stacked sounds cannot spike.

type Engine = {
  ctx: AudioContext;
  master: GainNode;
  noise: AudioBuffer;
  drone: GainNode | null;
};

const MUTE_KEY = "recovery.muted";
let engine: Engine | null = null;
let muted = readMuted();
let lastKey = 0;
const listeners = new Set<(m: boolean) => void>();

function readMuted() {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false; // storage blocked: default is sound on
  }
}

/** Must run inside a user gesture (browsers keep audio locked until then). */
export function unlockAudio() {
  if (engine) {
    if (engine.ctx.state === "suspended") void engine.ctx.resume();
    return;
  }
  const ctx = new AudioContext();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24;
  comp.ratio.value = 6;
  const master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.7;
  master.connect(comp).connect(ctx.destination);

  const noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  engine = { ctx, master, noise, drone: null };
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // storage blocked: the choice lasts for this page only
  }
  if (engine) engine.master.gain.setTargetAtTime(value ? 0 : 0.7, engine.ctx.currentTime, 0.05);
  listeners.forEach((fn) => fn(value));
}

export function onMuteChange(fn: (m: boolean) => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function noiseBurst(e: Engine, at: number, dur: number, freq: number, q: number, peak: number, pan = 0) {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.playbackRate.value = rand(0.8, 1.2);
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = q;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(peak, at + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  const p = e.ctx.createStereoPanner();
  p.pan.value = pan;
  src.connect(bp).connect(g).connect(p).connect(e.master);
  src.start(at, rand(0, 0.4), dur + 0.02);
}

/** One key of a mechanical keyboard. Throttled so fast typing stays a patter, not a buzz. */
export function key() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  if (now - lastKey < 0.026) return;
  lastKey = now;
  const pan = rand(-0.25, 0.25);
  noiseBurst(e, now, rand(0.018, 0.032), rand(1900, 3400), 1.4, rand(0.12, 0.2), pan);
  // the key bottoming out
  const o = e.ctx.createOscillator();
  o.frequency.value = rand(120, 170);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.07, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
  o.connect(g).connect(e.master);
  o.start(now);
  o.stop(now + 0.04);
}

/** Digital tear: stepped square wave + filtered static. strength 0..1. */
export function glitch(strength = 0.5) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const dur = 0.06 + 0.16 * strength;
  const o = e.ctx.createOscillator();
  o.type = "square";
  for (let t = 0; t < dur; t += 0.014) o.frequency.setValueAtTime(rand(90, 1400), now + t);
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2400;
  const g = e.ctx.createGain();
  const peak = 0.035 + 0.06 * strength;
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(peak, now + 0.004);
  for (let t = 0.02; t < dur; t += 0.03) g.gain.setValueAtTime(Math.random() < 0.3 ? 0 : peak, now + t); // drop-outs
  g.gain.linearRampToValueAtTime(0, now + dur);
  const p = e.ctx.createStereoPanner();
  p.pan.value = rand(-0.6, 0.6);
  o.connect(lp).connect(g).connect(p).connect(e.master);
  o.start(now);
  o.stop(now + dur + 0.02);
  noiseBurst(e, now, dur, rand(900, 5000), 0.7, 0.05 + 0.08 * strength, rand(-0.5, 0.5));
}

/** Static swell: filtered noise that breathes in and out over ~1.4 s, like a bad signal. */
export function staticSwell(strength = 0.5) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const dur = 1.4;
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 2.5;
  bp.frequency.setValueAtTime(600, now);
  bp.frequency.exponentialRampToValueAtTime(2600, now + dur * 0.6);
  bp.frequency.exponentialRampToValueAtTime(900, now + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.04 + 0.05 * strength, now + dur * 0.5);
  g.gain.linearRampToValueAtTime(0, now + dur);
  src.connect(bp).connect(g).connect(e.master);
  src.start(now);
  src.stop(now + dur + 0.05);
}

/** Warped tape: a low tone whose pitch sags and wobbles, as if the recording slowed down. */
export function tapeWarble(strength = 0.5) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const dur = 1.1;
  const o = e.ctx.createOscillator();
  o.type = "triangle";
  o.frequency.setValueAtTime(rand(260, 340), now);
  o.frequency.exponentialRampToValueAtTime(rand(90, 130), now + dur);
  const wobble = e.ctx.createOscillator();
  wobble.frequency.value = 7;
  const depth = e.ctx.createGain();
  depth.gain.value = 12;
  wobble.connect(depth).connect(o.frequency);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.035 + 0.04 * strength, now + 0.08);
  g.gain.linearRampToValueAtTime(0, now + dur);
  o.connect(g).connect(e.master);
  o.start(now);
  wobble.start(now);
  o.stop(now + dur + 0.05);
  wobble.stop(now + dur + 0.05);
}

/** Sub thud: felt more than heard, like something heavy in the next room. */
export function subThud(strength = 0.5) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const o = e.ctx.createOscillator();
  o.frequency.setValueAtTime(70, now);
  o.frequency.exponentialRampToValueAtTime(34, now + 0.5);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.12 + 0.1 * strength, now + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  o.connect(g).connect(e.master);
  o.start(now);
  o.stop(now + 0.75);
}

const GLITCH_SOUNDS = [glitch, staticSwell, tapeWarble, subThud];
let nextGlitchSound = 0;

/** The four glitch sounds in turn, so the ear never gets the same one twice in a row. */
export function glitchSound(strength = 0.5) {
  GLITCH_SOUNDS[nextGlitchSound](strength);
  nextGlitchSound = (nextGlitchSound + 1) % GLITCH_SOUNDS.length;
}

/** Camera shutter: two dry clicks, the blades closing and opening. */
export function shutter() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  noiseBurst(e, now, 0.018, 3200, 2, 0.09);
  noiseBurst(e, now + 0.07, 0.024, 2400, 2, 0.07);
}

/** Soft notification: two low sine tones, never a chime. */
export function blip() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  [660, 494].forEach((f, i) => {
    const o = e.ctx.createOscillator();
    o.frequency.value = f;
    const g = e.ctx.createGain();
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.045, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g).connect(e.master);
    o.start(t);
    o.stop(t + 0.3);
  });
}

/**
 * Room tone under everything: a low detuned hum that thickens with the stage.
 * 0 fades it out. Changes glide over 2 s — no sudden sounds.
 */
export function drone(level: number) {
  const e = engine;
  if (!e) return;
  const now = e.ctx.currentTime;
  if (!e.drone) {
    const g = e.ctx.createGain();
    g.gain.value = 0;
    const lp = e.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 220;
    [55, 55.7, 110.4].forEach((f) => {
      const o = e.ctx.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    });
    lp.connect(g).connect(e.master);
    e.drone = g;
  }
  e.drone.gain.setTargetAtTime(0.05 * level, now, 0.8);
}
