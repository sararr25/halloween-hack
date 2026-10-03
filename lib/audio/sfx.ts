// Procedural sound design (Web Audio): no files, no network, nothing recorded.
// Rules (docs/desktop.md): rich but never loud, no sudden peaks, a mute toggle.
// Everything goes through one compressor so stacked sounds cannot spike.

export type Engine = {
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

/** For other sound modules (lib/audio/voices.ts): the running engine, or null before the first gesture. */
export function audioEngine(): Readonly<Engine> | null {
  return engine;
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

export function noiseBurst(e: Engine, at: number, dur: number, freq: number, q: number, peak: number, pan = 0) {
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

/** The structured-light sweep of a scan: a thin tone gliding down with a band of hiss. */
export function scanSweep(duration = 2) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const o = e.ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(2600, now);
  o.frequency.exponentialRampToValueAtTime(900, now + duration);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.018, now + 0.15);
  g.gain.setValueAtTime(0.018, now + duration - 0.3);
  g.gain.linearRampToValueAtTime(0, now + duration);
  o.connect(g).connect(e.master);
  o.start(now);
  o.stop(now + duration + 0.05);

  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 6;
  bp.frequency.setValueAtTime(5200, now);
  bp.frequency.exponentialRampToValueAtTime(1400, now + duration);
  const ng = e.ctx.createGain();
  ng.gain.setValueAtTime(0, now);
  ng.gain.linearRampToValueAtTime(0.05, now + 0.2);
  ng.gain.linearRampToValueAtTime(0, now + duration);
  const p = e.ctx.createStereoPanner();
  p.pan.setValueAtTime(-0.5, now);
  p.pan.linearRampToValueAtTime(0.5, now + duration);
  src.connect(bp).connect(ng).connect(p).connect(e.master);
  src.start(now);
  src.stop(now + duration + 0.05);
}

/** A light switch in another flat: a soft click and a low thump. */
export function lightSwitch() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  noiseBurst(e, now, 0.012, 2600, 3, 0.1);
  noiseBurst(e, now + 0.018, 0.05, 240, 1.5, 0.08);
}

/**
 * S9: records `ms` of the room through the microphone the user granted in S1. The audio
 * stays in memory, is played back once and dropped: nothing is stored or sent.
 * Resolves null without a microphone (never granted, or refused now).
 */
/**
 * The microphone as it is: echo cancellation and noise suppression treat a voice under the
 * music as noise and pull it down; automatic gain lifts a quiet laptop microphone.
 */
export const RAW_MIC: MediaTrackConstraints = { echoCancellation: false, noiseSuppression: false, autoGainControl: true };

export async function recordRoom(ms = 1200): Promise<AudioBuffer | null> {
  const e = engine;
  if (!e || typeof MediaRecorder === "undefined") return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_MIC });
  } catch {
    return null;
  }
  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (ev) => chunks.push(ev.data);
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  rec.start();
  await new Promise((r) => setTimeout(r, ms));
  rec.stop();
  await done;
  stream.getTracks().forEach((t) => t.stop());
  const bytes = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer();
  return e.ctx.decodeAudioData(bytes);
}

/**
 * A copy of a microphone recording brought up to a clear level: laptop microphones record
 * quietly, and the player must hear themselves. The gain is capped, so a silent room
 * becomes a hiss, not a roar.
 */
function loudened(ctx: BaseAudioContext, buffer: AudioBuffer, peak = 0.9, maxGain = 18): AudioBuffer {
  let top = 0;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let i = 0; i < d.length; i++) top = Math.max(top, Math.abs(d[i]));
  }
  const k = top > 0 ? Math.min(maxGain, peak / top) : 1;
  const out = ctx.createBuffer(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const src = buffer.getChannelData(c);
    const dst = out.getChannelData(c);
    for (let i = 0; i < src.length; i++) dst[i] = src[i] * k;
  }
  return out;
}

/**
 * Plays a recording of the player back (their voice from the call, or the room), close and
 * a little dull, as if from the other side of a wall, but clearly: the score is ducked
 * underneath it (onDuck, lib/audio/music.ts) and it bypasses nothing but the master.
 */
export function playRoom(buffer: AudioBuffer) {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const clip = loudened(e.ctx, buffer);
  duckListeners.forEach((fn) => fn(clip.duration + 0.6));
  const src = e.ctx.createBufferSource();
  src.buffer = clip;
  const hp = e.ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 120;
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  // a gentle squash so a breath and a word sit at the same level
  const comp = e.ctx.createDynamicsCompressor();
  comp.threshold.value = -26;
  comp.ratio.value = 4;
  comp.attack.value = 0.005;
  comp.release.value = 0.2;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(1.6, now + 0.05);
  g.gain.setValueAtTime(1.6, now + clip.duration - 0.15);
  g.gain.linearRampToValueAtTime(0, now + clip.duration);
  src.connect(hp).connect(lp).connect(comp).connect(g).connect(e.master);
  src.start(now);
}

const duckListeners = new Set<(seconds: number) => void>();
/** The score listens here, to step back while the player hears themselves. */
export function onDuck(fn: (seconds: number) => void) {
  duckListeners.add(fn);
  return () => void duckListeners.delete(fn);
}

/** An old screen switching off: a falling whine, a static crackle, a low thump. */
export function tubeOff() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const o = e.ctx.createOscillator();
  o.frequency.setValueAtTime(7800, now);
  o.frequency.exponentialRampToValueAtTime(400, now + 1.2);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.012, now);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  o.connect(g).connect(e.master);
  o.start(now);
  o.stop(now + 1.35);
  noiseBurst(e, now, 0.25, 3000, 0.8, 0.07);
  noiseBurst(e, now + 0.05, 0.12, 160, 1.2, 0.12);
}

/**
 * Find My's "play sound": a bright two-tone ping, three times. It plays in the user's own
 * headphones, dead centre, as if the phone were in the room. A fainter copy answers from
 * the right, a little late.
 */
export function phonePing() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  const ping = (at: number, level: number, pan: number) => {
    [1318.5, 1760].forEach((f, i) => {
      const o = e.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = e.ctx.createGain();
      const t = at + i * 0.12;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      const p = e.ctx.createStereoPanner();
      p.pan.value = pan;
      o.connect(g).connect(p).connect(e.master);
      o.start(t);
      o.stop(t + 0.4);
    });
  };
  for (let i = 0; i < 3; i++) {
    ping(now + i * 0.9, 0.05, 0);
    ping(now + i * 0.9 + 0.23, 0.012, 0.8);
  }
}

/**
 * A DM arriving where none should (the "pass it on" invite): a message tone pitched down and
 * detuned, a breath of reversed air before it, then the same tone again, slower, like tape.
 */
export function creepyMessage() {
  const e = engine;
  if (!e || muted) return;
  const now = e.ctx.currentTime;
  // the breath: noise swelling in, cut dead
  const n = e.ctx.createBufferSource();
  n.buffer = e.noise;
  n.loop = true;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(400, now);
  bp.frequency.exponentialRampToValueAtTime(2200, now + 0.7);
  const ng = e.ctx.createGain();
  ng.gain.setValueAtTime(0.0001, now);
  ng.gain.exponentialRampToValueAtTime(0.05, now + 0.7);
  ng.gain.setValueAtTime(0.0001, now + 0.72);
  n.connect(bp).connect(ng).connect(e.master);
  n.start(now);
  n.stop(now + 0.75);
  const tone = (at: number, rate: number, level: number) => {
    [784, 988, 659].forEach((f, i) => {
      [0, 7].forEach((cents) => {
        const o = e.ctx.createOscillator();
        o.type = "sine";
        o.frequency.value = f * rate;
        o.detune.value = cents;
        const g = e.ctx.createGain();
        const t = at + (i * 0.11) / rate;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(level, t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5 / rate);
        o.connect(g).connect(e.master);
        o.start(t);
        o.stop(t + 0.55 / rate);
      });
    });
  };
  tone(now + 0.75, 0.84, 0.035);
  tone(now + 1.6, 0.6, 0.022);
  noiseBurst(e, now + 0.75, 0.3, 90, 1, 0.08);
}

/**
 * A music box winding down: a minor phrase on bright metal tines, each note a little later
 * than the last and a little flatter, until it stops on a note it never finishes.
 * Returns how long it lasts, in ms, so the caller can switch everything off on the last note.
 */
export function musicBox(): number {
  const notes = [76, 72, 71, 69, 72, 76, 74, 71, 69, 68, 69, 64, 63];
  let at = 0;
  const times = notes.map((_, i) => {
    const t = at;
    at += 0.32 + i * i * 0.012; // the spring running out
    return t;
  });
  const total = (times.at(-1) ?? 0) + 1.6;
  const e = engine;
  if (!e || muted) return total * 1000;
  const now = e.ctx.currentTime + 0.05;
  notes.forEach((midi, i) => {
    const sag = 1 - (i / notes.length) ** 3 * 0.035;
    const f = 440 * 2 ** ((midi - 69) / 12) * sag;
    const t = now + times[i];
    // a tine: the fundamental and two slightly inharmonic partials
    [
      [1, 0.04],
      [3.01, 0.012],
      [5.98, 0.005],
    ].forEach(([mult, level]) => {
      const o = e.ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f * mult;
      const g = e.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(level, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + (mult === 1 ? 1.4 : 0.4));
      const p = e.ctx.createStereoPanner();
      p.pan.value = Math.sin(i * 1.7) * 0.25;
      o.connect(g).connect(p).connect(e.master);
      o.start(t);
      o.stop(t + 1.5);
    });
    noiseBurst(e, t, 0.01, 5200, 3, 0.012); // the pin plucking the comb
  });
  return total * 1000;
}
