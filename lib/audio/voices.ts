// The recordings in Phone and Messages. The voices are files in public/audio (Deepgram
// Aura-2, made once by scripts/make-voices.mjs); everything around them is built here with
// Web Audio (lib/audio/sfx.ts engine): the phone line, the static, breathing, a window,
// the street. What you hear and what the automatic transcript writes do not always agree:
// that is the point (docs/desktop.md).

import { audioEngine, isMuted, noiseBurst, type Engine } from "./sfx";

export type RecordingId =
  | "ev-voicemail"
  | "mara-voicemail"
  | "mara-voicemail-2"
  | "mara-voicemail-3"
  | "mum-voicemail"
  | "unknown-voicemail"
  | "ev-voicenote";

export type Playback = { stop: () => void };

type Clip = "ev-voicemail" | "mara-1" | "mara-2" | "mara-3" | "mum" | "unknown-1" | "unknown-2" | "ev-voicenote";

const rand = (a: number, b: number) => a + Math.random() * (b - a);

/** A looping noise bed through a filter, faded in and out. */
function bed(e: Readonly<Engine>, from: number, to: number, type: BiquadFilterType, freq: number, level: number) {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const f = e.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, from);
  g.gain.linearRampToValueAtTime(level, from + 0.3);
  g.gain.setValueAtTime(level, to - 0.3);
  g.gain.linearRampToValueAtTime(0, to);
  src.connect(f).connect(g).connect(e.master);
  src.start(from);
  src.stop(to + 0.05);
  return src;
}

/** One breath: a slow swell of filtered air, in or out. */
function breath(e: Readonly<Engine>, at: number, dur: number, inhale: boolean) {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.Q.value = 0.9;
  bp.frequency.setValueAtTime(inhale ? 900 : 700, at);
  bp.frequency.linearRampToValueAtTime(inhale ? 1400 : 500, at + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(inhale ? 0.05 : 0.04, at + dur * 0.4);
  g.gain.linearRampToValueAtTime(0, at + dur);
  src.connect(bp).connect(g).connect(e.master);
  src.start(at);
  src.stop(at + dur + 0.05);
  return src;
}

/** A sash window pushed up: a dry wooden creak, then the knock of the frame. */
function sashWindow(e: Readonly<Engine>, at: number) {
  const o = e.ctx.createOscillator();
  o.type = "sawtooth";
  for (let t = 0; t < 0.9; t += 0.06) o.frequency.setValueAtTime(rand(80, 150), at + t);
  const bp = e.ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 900;
  bp.Q.value = 3;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.03, at + 0.1);
  g.gain.linearRampToValueAtTime(0, at + 0.95);
  o.connect(bp).connect(g).connect(e.master);
  o.start(at);
  o.stop(at + 1);
  noiseBurst(e as Engine, at + 1.0, 0.09, 180, 1.4, 0.14);
  return o;
}

/** A car passing somewhere below: a filtered swell that crosses from one side to the other. */
function carPass(e: Readonly<Engine>, at: number, dur: number) {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  src.loop = true;
  const lp = e.ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(300, at);
  lp.frequency.linearRampToValueAtTime(900, at + dur / 2);
  lp.frequency.linearRampToValueAtTime(250, at + dur);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(0.09, at + dur / 2);
  g.gain.linearRampToValueAtTime(0, at + dur);
  const p = e.ctx.createStereoPanner();
  p.pan.setValueAtTime(-0.8, at);
  p.pan.linearRampToValueAtTime(0.8, at + dur);
  src.connect(lp).connect(g).connect(p).connect(e.master);
  src.start(at);
  src.stop(at + dur + 0.05);
  return src;
}

const clips = new Map<Clip, Promise<AudioBuffer>>();

/** Decoded once, kept for the session. A missing file is an error, not silence. */
function clip(e: Readonly<Engine>, name: Clip): Promise<AudioBuffer> {
  let p = clips.get(name);
  if (!p) {
    p = fetch(`/audio/${name}.mp3`).then(async (r) => {
      if (!r.ok) throw new Error(`voice file missing: public/audio/${name}.mp3 (${r.status})`);
      return e.ctx.decodeAudioData(await r.arrayBuffer());
    });
    clips.set(name, p);
  }
  return p;
}

/** `cut`: seconds into the clip where the line goes dead, mid-word. */
type Voice = { at: number; gain: number; phone: boolean; rate?: number; cut?: number };

/** A voice file placed on the timeline, through a phone line (band-limited) or close to the mic. */
function voice(e: Readonly<Engine>, name: Clip, start: number, v: Voice, nodes: AudioScheduledSourceNode[]) {
  return clip(e, name).then((buf) => {
    const src = e.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = v.rate ?? 1;
    const hp = e.ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = v.phone ? 320 : 90;
    const lp = e.ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = v.phone ? 3300 : 7500;
    const g = e.ctx.createGain();
    g.gain.value = v.gain;
    src.connect(hp).connect(lp).connect(g).connect(e.master);
    src.start(start + v.at);
    if (v.cut) src.stop(start + v.at + v.cut);
    nodes.push(src);
  });
}

/**
 * Plays one recording. Returns null when there is nothing to play (audio still locked, or
 * muted). The voice files load on the first play; a missing one throws.
 */
export function playRecording(id: RecordingId): Playback | null {
  const e = audioEngine();
  if (!e || isMuted()) return null;
  const now = e.ctx.currentTime + 0.15; // room for the first decode
  const nodes: AudioScheduledSourceNode[] = [];
  let stopped = false;
  const add = (p: Promise<void>) =>
    p.then(() => {
      if (stopped) nodes.forEach((n) => n.stop());
    });
  const line = (dur: number) => {
    // the phone line: a thin hiss and a click at each end
    nodes.push(bed(e, now, now + dur, "highpass", 3000, 0.018));
    noiseBurst(e as Engine, now, 0.02, 2000, 2, 0.08);
    noiseBurst(e as Engine, now + dur - 0.05, 0.02, 2000, 2, 0.08);
  };

  switch (id) {
    case "ev-voicemail": {
      // 0:16 · two whispered words, then breathing, a window opening, the street
      line(16);
      nodes.push(bed(e, now, now + 16, "lowpass", 260, 0.05)); // the room
      add(voice(e, "ev-voicemail", now, { at: 0.9, gain: 0.55, phone: true }, nodes));
      for (let t = 4.2; t < 14; t += rand(2.8, 3.6)) {
        nodes.push(breath(e, now + t, 1.3, true), breath(e, now + t + 1.4, 1.5, false));
      }
      nodes.push(sashWindow(e, now + 7.4));
      nodes.push(bed(e, now + 8.4, now + 16, "lowpass", 420, 0.07)); // the street comes in
      nodes.push(carPass(e, now + 10.5, 4.2));
      break;
    }
    case "mara-voicemail": {
      // 0:12 · Mara, five days ago, near midnight, worried sick
      line(12);
      nodes.push(bed(e, now, now + 12, "lowpass", 300, 0.03));
      add(voice(e, "mara-1", now, { at: 1.1, gain: 1, phone: true }, nodes));
      break;
    }
    case "mara-voicemail-2": {
      // 0:18 · Mara outside E.V.'s flat at 02:40: wind and the street around her
      line(18);
      nodes.push(bed(e, now, now + 18, "lowpass", 520, 0.08));
      nodes.push(breath(e, now + 0.2, 0.7, true));
      nodes.push(carPass(e, now + 5.5, 5));
      add(voice(e, "mara-2", now, { at: 0.9, gain: 1, phone: true }, nodes));
      break;
    }
    case "mara-voicemail-3": {
      // 0:12 · Mara inside E.V.'s flat, yesterday, breathing hard; the line dies mid-word
      line(12.2);
      nodes.push(bed(e, now, now + 12.2, "lowpass", 300, 0.05));
      nodes.push(breath(e, now + 0.1, 0.5, true));
      add(voice(e, "mara-3", now, { at: 0.5, gain: 1, phone: true, cut: 11.5 }, nodes));
      break;
    }
    case "mum-voicemail": {
      // 0:19 · Mum, four days ago, at home late at night: a quiet kitchen
      line(19.2);
      nodes.push(bed(e, now, now + 19.2, "lowpass", 180, 0.04));
      add(voice(e, "mum", now, { at: 1.0, gain: 1, phone: true }, nodes));
      break;
    }
    case "unknown-voicemail": {
      // 0:11 · a low, calm voice; the time it names is lost in a burst of static
      line(11);
      nodes.push(bed(e, now, now + 11, "bandpass", 1800, 0.06));
      add(voice(e, "unknown-1", now, { at: 1.4, gain: 0.75, phone: true, rate: 0.93 }, nodes));
      nodes.push(bed(e, now + 4.6, now + 6.6, "bandpass", 2400, 0.22)); // the time, gone
      add(voice(e, "unknown-2", now, { at: 6.8, gain: 0.7, phone: true, rate: 0.9 }, nodes));
      break;
    }
    case "ev-voicenote": {
      // 0:20 · E.V. at her window, very close to the phone
      nodes.push(bed(e, now, now + 20, "lowpass", 300, 0.04));
      add(voice(e, "ev-voicenote", now, { at: 0.6, gain: 1, phone: false }, nodes));
      break;
    }
  }

  return {
    stop: () => {
      stopped = true;
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          // not started yet or already finished: nothing to stop
        }
      });
    },
  };
}
