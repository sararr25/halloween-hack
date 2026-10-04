// The louder end of the sound design, for the two places that are meant to frighten: the
// "pass it on" DM (InviteDM.tsx) and the black screen after the case file is downloaded
// (Login.tsx). Same rules as sfx.ts (Web Audio, no files, one compressor), but here a
// peak is allowed: the owner asked for one small jump scare.
//  ringNotify   a message tone rung like the phone in The Ring, over a phone buzzing on a table
//  jumpStinger  the hit under the jump scare: a cluster stab, a scrape, a sub drop
//  slam         one heavy word landing (the full-screen lines in the DM)
//  dread        a bed in the spirit of The Shining's score: string clusters sliding apart,
//               the Dies Irae low down, a slow heart. Returns a stop function
//  afterBed     the after-screen: a clock in an empty room and a low hum. Returns a stop function
//  recOn        a relay and a tape motor: something starts recording
//  alertChime   a calendar alert, one note too flat

import { audioEngine, isMuted, noiseBurst, type Engine } from "./sfx";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

let room: { e: Engine; input: GainNode } | null = null;
/** A long dark reverb shared by everything here. */
function reverb(e: Engine): GainNode {
  if (room?.e === e) return room.input;
  const len = Math.floor(e.ctx.sampleRate * 4.5);
  const buf = e.ctx.createBuffer(2, len, e.ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
  }
  const conv = e.ctx.createConvolver();
  conv.buffer = buf;
  const input = e.ctx.createGain();
  const wet = e.ctx.createGain();
  wet.gain.value = 0.6;
  input.connect(conv).connect(wet).connect(e.master);
  room = { e, input };
  return input;
}

/** The running engine (sfx.ts hands it out read-only; the nodes here only read it too). */
const engineNow = () => audioEngine() as Engine | null;
/** One live engine, or null when there is nothing to play (locked or muted). */
function live() {
  const e = engineNow();
  return e && !isMuted() ? e : null;
}

/** A phone vibrating on a wooden table: a low rattle, chopped. */
function buzz(e: Engine, at: number, dur: number) {
  const o = e.ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.value = 148;
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const chop = e.ctx.createGain();
  chop.gain.value = 0.5;
  const lfo = e.ctx.createOscillator();
  lfo.type = "square";
  lfo.frequency.value = 31;
  const depth = e.ctx.createGain();
  depth.gain.value = 0.5;
  lfo.connect(depth).connect(chop.gain);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.09, at + 0.02);
  g.gain.setValueAtTime(0.09, at + dur - 0.03);
  g.gain.linearRampToValueAtTime(0, at + dur);
  o.connect(lp).connect(chop).connect(g).connect(e.master);
  [o, lfo].forEach((n) => {
    n.start(at);
    n.stop(at + dur + 0.02);
  });
}

/** A bell note struck fast by a clapper, sagging flat as it rings. */
function bell(e: Engine, at: number, f: number, level: number, dur = 0.9) {
  const rv = reverb(e);
  const out = e.ctx.createGain();
  out.gain.setValueAtTime(0, at);
  out.gain.linearRampToValueAtTime(level, at + 0.006);
  out.gain.setValueAtTime(level, at + dur * 0.55);
  out.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  // the clapper: an old phone bell is a hammer between two domes
  const clap = e.ctx.createGain();
  clap.gain.value = 0.6;
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 19;
  const depth = e.ctx.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth).connect(clap.gain);
  lfo.start(at);
  lfo.stop(at + dur + 0.05);
  [
    [1, 1],
    [2.76, 0.35],
    [5.4, 0.12],
  ].forEach(([mult, amp]) => {
    const o = e.ctx.createOscillator();
    o.frequency.setValueAtTime(f * mult, at);
    o.frequency.exponentialRampToValueAtTime(f * mult * 0.965, at + dur);
    o.detune.value = rand(-9, 9);
    const g = e.ctx.createGain();
    g.gain.value = amp;
    o.connect(g).connect(clap);
    o.start(at);
    o.stop(at + dur + 0.05);
  });
  clap.connect(out);
  out.connect(e.master);
  out.connect(rv);
}

/**
 * A message tone rung like an old telephone, twice, the second time slower and lower,
 * over a phone buzzing on a table. One call is one ring (about 2 s); repeat it for more.
 */
export function ringNotify() {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime + 0.02;
  buzz(e, now, 0.42);
  buzz(e, now + 0.56, 0.36);
  [987.77, 783.99, 622.25].forEach((f, i) => bell(e, now + 0.05 + i * 0.17, f * 0.95, 0.05, 0.75));
  [987.77, 783.99, 622.25].forEach((f, i) => bell(e, now + 0.95 + i * 0.26, f * 0.71, 0.032, 0.95));
}

/** The hit under the jump scare. Short, loud for this project, then gone. */
export function jumpStinger() {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime;
  const rv = reverb(e);
  // a cluster stab: six notes a semitone apart, the filter closing fast
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(7000, now);
  lp.frequency.exponentialRampToValueAtTime(500, now + 1.1);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.16, now + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
  lp.connect(g);
  g.connect(e.master);
  g.connect(rv);
  [220, 233.08, 246.94, 261.63, 440, 466.16].forEach((f) => {
    const o = e.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(f * 1.06, now);
    o.frequency.exponentialRampToValueAtTime(f, now + 0.25);
    o.connect(lp);
    o.start(now);
    o.stop(now + 1.45);
  });
  // the scrape: a high tone bent down, with a nervous vibrato
  const s = e.ctx.createOscillator();
  s.type = "triangle";
  s.frequency.setValueAtTime(2900, now);
  s.frequency.exponentialRampToValueAtTime(1500, now + 0.7);
  const vib = e.ctx.createOscillator();
  vib.frequency.value = 13;
  const vd = e.ctx.createGain();
  vd.gain.value = 60;
  vib.connect(vd).connect(s.frequency);
  const sg = e.ctx.createGain();
  sg.gain.setValueAtTime(0, now);
  sg.gain.linearRampToValueAtTime(0.05, now + 0.01);
  sg.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
  s.connect(sg);
  sg.connect(e.master);
  sg.connect(rv);
  [s, vib].forEach((n) => {
    n.start(now);
    n.stop(now + 0.85);
  });
  // air torn open, and a drop felt in the chest
  noiseBurst(e, now, 0.45, 1800, 0.4, 0.3);
  const sub = e.ctx.createOscillator();
  sub.frequency.setValueAtTime(110, now);
  sub.frequency.exponentialRampToValueAtTime(28, now + 0.9);
  const subG = e.ctx.createGain();
  subG.gain.setValueAtTime(0, now);
  subG.gain.linearRampToValueAtTime(0.5, now + 0.01);
  subG.gain.exponentialRampToValueAtTime(0.0001, now + 1);
  sub.connect(subG).connect(e.master);
  sub.start(now);
  sub.stop(now + 1.05);
}

/** One heavy word landing on screen: a low boom and a crack of static, in a big room. */
export function slam(strength = 1) {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime;
  const rv = reverb(e);
  const o = e.ctx.createOscillator();
  o.frequency.setValueAtTime(82, now);
  o.frequency.exponentialRampToValueAtTime(30, now + 0.8);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.32 * strength, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
  o.connect(g);
  g.connect(e.master);
  g.connect(rv);
  o.start(now);
  o.stop(now + 1.15);
  noiseBurst(e, now, 0.16, 2600, 0.6, 0.12 * strength);
  noiseBurst(e, now, 0.3, 140, 0.8, 0.2 * strength);
}

// Dies Irae, as the opening of The Shining plays it: F E F D E C D D, slow and low
const DIES_IRAE: [number, number][] = [
  [87.31, 1],
  [82.41, 1],
  [87.31, 1],
  [73.42, 1],
  [82.41, 1],
  [65.41, 1],
  [73.42, 1],
  [73.42, 2],
];

/**
 * The DM's score. Strings in a cluster that slowly slide apart (some up, some down), a low
 * minor second, the Dies Irae on something like low brass every few bars, and a slow heart.
 * Fades in over a few seconds. Call the returned function to fade it out. The master gain
 * in sfx.ts mutes it with everything else.
 */
export function dread(): (fade?: number) => void {
  const e = engineNow();
  if (!e) return () => {};
  const now = e.ctx.currentTime;
  const rv = reverb(e);
  const bus = e.ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + 5);
  bus.connect(e.master);
  const nodes: AudioScheduledSourceNode[] = [];
  const run = <T extends AudioScheduledSourceNode>(n: T) => {
    n.start();
    nodes.push(n);
    return n;
  };

  // the floor: D and E flat, low, breathing through a slow filter
  const floorLp = e.ctx.createBiquadFilter();
  floorLp.type = "lowpass";
  floorLp.frequency.value = 260;
  const floorLfo = run(e.ctx.createOscillator());
  floorLfo.frequency.value = 0.09;
  const floorDepth = e.ctx.createGain();
  floorDepth.gain.value = 140;
  floorLfo.connect(floorDepth).connect(floorLp.frequency);
  const floorG = e.ctx.createGain();
  floorG.gain.value = 0.07;
  [36.71, 38.89, 73.42].forEach((f) => {
    const o = run(e.ctx.createOscillator());
    o.type = "sawtooth";
    o.frequency.value = f;
    o.detune.value = rand(-6, 6);
    o.connect(floorLp);
  });
  floorLp.connect(floorG).connect(bus);

  // the strings: eight voices packed into a cluster, each sliding its own way over 40 s
  const strBp = e.ctx.createBiquadFilter();
  strBp.type = "bandpass";
  strBp.frequency.value = 1300;
  strBp.Q.value = 0.6;
  const strG = e.ctx.createGain();
  strG.gain.setValueAtTime(0, now);
  strG.gain.linearRampToValueAtTime(0.022, now + 9);
  const trem = run(e.ctx.createOscillator());
  trem.frequency.value = 6.5;
  const tremDepth = e.ctx.createGain();
  tremDepth.gain.value = 0.007;
  trem.connect(tremDepth).connect(strG.gain);
  for (let i = 0; i < 8; i++) {
    const o = run(e.ctx.createOscillator());
    o.type = "sawtooth";
    const f = 440 * 2 ** ((i * 0.7 - 2) / 12);
    o.frequency.setValueAtTime(f, now);
    o.frequency.exponentialRampToValueAtTime(f * 2 ** (((i % 2 ? 1 : -1) * rand(2, 5)) / 12), now + 40);
    const p = e.ctx.createStereoPanner();
    p.pan.value = (i / 7) * 1.4 - 0.7;
    o.connect(p).connect(strBp);
  }
  strBp.connect(strG);
  strG.connect(bus);
  strG.connect(rv);

  // a thin glassy tone very high, barely there
  const glass = run(e.ctx.createOscillator());
  glass.frequency.value = 2793.83;
  const glassG = e.ctx.createGain();
  glassG.gain.value = 0.0035;
  glass.connect(glassG).connect(bus);

  // timed parts: the heart and the Dies Irae, scheduled a little ahead
  const brassLp = e.ctx.createBiquadFilter();
  brassLp.type = "lowpass";
  brassLp.frequency.value = 520;
  brassLp.connect(bus);
  const brassWet = e.ctx.createGain();
  brassLp.connect(brassWet).connect(rv);
  const note = (f: number, at: number, len: number) => {
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.06, at + 0.18);
    g.gain.setValueAtTime(0.06, at + len - 0.12);
    g.gain.linearRampToValueAtTime(0, at + len);
    g.connect(brassLp);
    [1, 2].forEach((k) =>
      [-5, 5].forEach((cents) => {
        const o = e.ctx.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f * k;
        o.detune.value = cents;
        const kg = e.ctx.createGain();
        kg.gain.value = k === 1 ? 1 : 0.4;
        o.connect(kg).connect(g);
        o.start(at);
        o.stop(at + len + 0.05);
      }),
    );
  };
  const heart = (at: number) =>
    [0, 0.26].forEach((dt, i) => {
      const o = e.ctx.createOscillator();
      o.frequency.setValueAtTime(60, at + dt);
      o.frequency.exponentialRampToValueAtTime(36, at + dt + 0.25);
      const g = e.ctx.createGain();
      g.gain.setValueAtTime(0, at + dt);
      g.gain.linearRampToValueAtTime(i ? 0.16 : 0.22, at + dt + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dt + 0.32);
      o.connect(g).connect(bus);
      o.start(at + dt);
      o.stop(at + dt + 0.35);
    });

  const BEAT_S = 60 / 58;
  const NOTE_S = 0.62;
  let nextHeart = now + 2;
  let nextPhrase = now + 4;
  const timer = setInterval(() => {
    const until = e.ctx.currentTime + 0.5;
    while (nextHeart < until) {
      heart(nextHeart);
      nextHeart += BEAT_S;
    }
    while (nextPhrase < until) {
      let at = nextPhrase;
      DIES_IRAE.forEach(([f, beats]) => {
        note(f, at, NOTE_S * beats - 0.04);
        at += NOTE_S * beats;
      });
      nextPhrase = at + rand(5, 8);
    }
  }, 150);

  let stopped = false;
  return (fade = 2.5) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    const t = e.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + fade);
    brassWet.gain.setTargetAtTime(0, t, fade / 3);
    strG.disconnect(rv);
    setTimeout(() => nodes.forEach((n) => n.stop()), (fade + 0.2) * 1000);
  };
}

/**
 * The after-screen: a clock ticking in an empty room (tick and tock a little different), a
 * low hum, and now and then a breath of tape hiss. Call the returned function to stop it.
 */
export function afterBed(): (fade?: number) => void {
  const e = engineNow();
  if (!e) return () => {};
  const now = e.ctx.currentTime;
  const rv = reverb(e);
  const bus = e.ctx.createGain();
  bus.gain.setValueAtTime(0, now);
  bus.gain.linearRampToValueAtTime(1, now + 3);
  bus.connect(e.master);
  const wet = e.ctx.createGain();
  wet.connect(rv);
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 200;
  const humG = e.ctx.createGain();
  humG.gain.value = 0.05;
  const hum = [55, 58.27].map((f) => {
    const o = e.ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f;
    o.connect(lp);
    o.start();
    return o;
  });
  lp.connect(humG).connect(bus);

  const tick = (at: number, tock: boolean) => {
    const src = e.ctx.createBufferSource();
    src.buffer = e.noise;
    const bp = e.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = tock ? 2300 : 3400;
    bp.Q.value = 8;
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(tock ? 0.1 : 0.13, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    src.connect(bp).connect(g);
    g.connect(bus);
    g.connect(wet);
    src.start(at, rand(0, 0.4), 0.06);
  };
  let next = now + 0.6;
  let n = 0;
  const timer = setInterval(() => {
    const until = e.ctx.currentTime + 0.4;
    while (next < until) {
      tick(next, n % 2 === 1);
      // every so often, a breath of tape between the ticks
      if (n % 9 === 4 && !isMuted()) noiseBurst(e, next + 0.3, 1.2, 700, 0.6, 0.02, rand(-0.6, 0.6));
      n += 1;
      next += 1;
    }
  }, 120);

  let stopped = false;
  return (fade = 0.15) => {
    if (stopped) return;
    stopped = true;
    clearInterval(timer);
    const t = e.ctx.currentTime;
    bus.gain.cancelScheduledValues(t);
    bus.gain.setValueAtTime(bus.gain.value, t);
    bus.gain.linearRampToValueAtTime(0, t + fade);
    wet.gain.setValueAtTime(0, t + fade);
    setTimeout(() => hum.forEach((o) => o.stop()), (fade + 0.2) * 1000);
  };
}

/** Something starts recording: a relay clicks in, a small tape motor spins up. */
export function recOn() {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime;
  noiseBurst(e, now, 0.014, 2800, 3, 0.14);
  noiseBurst(e, now + 0.012, 0.06, 260, 1.4, 0.12);
  const o = e.ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(30, now + 0.05);
  o.frequency.exponentialRampToValueAtTime(118, now + 0.55);
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, now + 0.05);
  g.gain.linearRampToValueAtTime(0.03, now + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);
  o.connect(lp).connect(g).connect(e.master);
  o.start(now + 0.05);
  o.stop(now + 1.35);
}

/** A calendar alert: three bright notes going up, the last one flat and late. */
export function alertChime() {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime + 0.02;
  bell(e, now, 1046.5, 0.035, 0.6);
  bell(e, now + 0.16, 1318.5, 0.035, 0.6);
  bell(e, now + 0.42, 1567.98 * 0.94, 0.03, 1.4);
}

/**
 * The phone in The Ring: an old electromechanical bell, two long rings, a long silence,
 * again, in a big empty room. Mara's second call (IncomingCall.tsx). Returns a stop function.
 */
export function ringBell(): () => void {
  const e = live();
  if (!e) return () => {};
  const out = e.ctx.createGain();
  out.connect(e.master);
  const rv = reverb(e);
  out.connect(rv);
  // one ring: two bells a minor third apart, struck by a clapper at 20 Hz
  const ringOnce = (at: number, dur: number) => {
    const clap = e.ctx.createGain();
    clap.gain.value = 0.5;
    const lfo = e.ctx.createOscillator();
    lfo.type = "square";
    lfo.frequency.value = 20;
    const depth = e.ctx.createGain();
    depth.gain.value = 0.5;
    lfo.connect(depth).connect(clap.gain);
    const env = e.ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.07, at + 0.01);
    env.gain.setValueAtTime(0.07, at + dur);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.5);
    clap.connect(env).connect(out);
    lfo.start(at);
    lfo.stop(at + dur + 0.55);
    [1046.5, 1244.5].forEach((f) =>
      [
        [1, 1],
        [2.4, 0.3],
        [4.1, 0.12],
      ].forEach(([mult, amp]) => {
        const o = e.ctx.createOscillator();
        o.frequency.value = f * mult;
        o.detune.value = rand(-12, 12);
        const g = e.ctx.createGain();
        g.gain.value = amp;
        o.connect(g).connect(clap);
        o.start(at);
        o.stop(at + dur + 0.55);
      }),
    );
  };
  let next = e.ctx.currentTime + 0.05;
  const schedule = () => {
    while (next < e.ctx.currentTime + 1) {
      ringOnce(next, 0.4);
      ringOnce(next + 0.6, 0.4);
      next += 3.2;
    }
  };
  schedule();
  const timer = setInterval(schedule, 250);
  return () => {
    clearInterval(timer);
    out.gain.setTargetAtTime(0, e.ctx.currentTime, 0.03);
    setTimeout(() => out.disconnect(), 400);
  };
}

/**
 * Find My's ping where the phone is: `near` 0 (far) to 1 (with you), `pan` -1 left to 1 right.
 * Far away it is thin, quiet and dull; close it is loud, bright and dry.
 */
export function pingAt(near: number, pan = 0) {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime;
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900 + 7000 * near * near;
  const p = e.ctx.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  lp.connect(p).connect(e.master);
  if (near < 0.6) lp.connect(reverb(e));
  const level = 0.012 + 0.07 * near * near;
  [1318.5, 1760].forEach((f, i) => {
    const o = e.ctx.createOscillator();
    o.frequency.value = f;
    const g = e.ctx.createGain();
    const t = now + i * 0.12;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(level, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(lp);
    o.start(t);
    o.stop(t + 0.4);
  });
}

/** A breath right next to the ear, after the phone has arrived "with you". */
export function breath() {
  const e = live();
  if (!e) return;
  const now = e.ctx.currentTime;
  [0, 1.3].forEach((dt, i) => {
    const src = e.ctx.createBufferSource();
    src.buffer = e.noise;
    src.loop = true;
    const bp = e.ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(i ? 1400 : 700, now + dt);
    bp.frequency.linearRampToValueAtTime(i ? 700 : 1300, now + dt + 1.1);
    const g = e.ctx.createGain();
    g.gain.setValueAtTime(0, now + dt);
    g.gain.linearRampToValueAtTime(0.08, now + dt + 0.5);
    g.gain.linearRampToValueAtTime(0, now + dt + 1.2);
    const p = e.ctx.createStereoPanner();
    p.pan.value = -0.7;
    src.connect(bp).connect(g).connect(p).connect(e.master);
    src.start(now + dt);
    src.stop(now + dt + 1.25);
  });
}
