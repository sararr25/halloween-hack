// The recordings in Phone and Messages: no audio files. The sounds are built with Web Audio
// (lib/audio/sfx.ts engine), the words are spoken by the browser's own speech synthesis,
// on this device. What you hear and what the automatic transcript writes do not always
// agree: that is the point (docs/desktop.md).

import { audioEngine, isMuted, noiseBurst, type Engine } from "./sfx";

export type RecordingId = "ev-voicemail" | "mara-voicemail" | "unknown-voicemail" | "ev-voicenote";

export type Playback = { stop: () => void };

type Speech = { text: string; at: number; rate: number; pitch: number; volume: number; lang: string };

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

/** An English voice from the device; null when the browser has none (the transcript remains). */
function voiceFor(lang: string): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === lang) ?? voices.find((v) => v.lang.startsWith("en")) ?? null;
}

function speak(s: Speech, timers: ReturnType<typeof setTimeout>[]) {
  if (!("speechSynthesis" in window)) {
    console.warn("speech synthesis unavailable: the recording plays without words");
    return;
  }
  timers.push(
    setTimeout(() => {
      const u = new SpeechSynthesisUtterance(s.text);
      u.rate = s.rate;
      u.pitch = s.pitch;
      u.volume = s.volume;
      u.lang = s.lang;
      const v = voiceFor(s.lang);
      if (v) u.voice = v;
      window.speechSynthesis.speak(u);
    }, s.at * 1000),
  );
}

/**
 * Plays one recording. `entry` is the time the user came in (the unknown caller says it).
 * Returns null when there is nothing to play (audio still locked, or muted).
 */
export function playRecording(id: RecordingId, entry: string): Playback | null {
  const e = audioEngine();
  if (!e || isMuted()) return null;
  const now = e.ctx.currentTime;
  const nodes: AudioScheduledSourceNode[] = [];
  const timers: ReturnType<typeof setTimeout>[] = [];
  const line = (dur: number) => {
    // the phone line: a thin hiss and a click at each end
    nodes.push(bed(e, now, now + dur, "highpass", 3000, 0.018));
    noiseBurst(e as Engine, now, 0.02, 2000, 2, 0.08);
    noiseBurst(e as Engine, now + dur - 0.05, 0.02, 2000, 2, 0.08);
  };

  switch (id) {
    case "ev-voicemail": {
      // 0:16 · breathing, a window opening, traffic. No words.
      line(16);
      nodes.push(bed(e, now, now + 16, "lowpass", 260, 0.05)); // the room
      for (let t = 0.8; t < 14; t += rand(2.8, 3.6)) {
        nodes.push(breath(e, now + t, 1.3, true), breath(e, now + t + 1.4, 1.5, false));
      }
      nodes.push(sashWindow(e, now + 6.2));
      nodes.push(bed(e, now + 7.2, now + 16, "lowpass", 420, 0.07)); // the street comes in
      nodes.push(carPass(e, now + 9.5, 4.2));
      break;
    }
    case "mara-voicemail": {
      // 0:09 · Mara, crying a little: "Please call me back."
      line(9);
      nodes.push(breath(e, now + 1.0, 1.1, true), breath(e, now + 5.4, 1.6, false));
      speak({ text: "Please... call me back.", at: 2.4, rate: 0.82, pitch: 1.15, volume: 0.9, lang: "en-GB" }, timers);
      break;
    }
    case "unknown-voicemail": {
      // 0:11 · a low voice, too quiet to understand, under the static. It says when you came in.
      line(11);
      nodes.push(bed(e, now, now + 11, "bandpass", 1800, 0.07));
      speak(
        { text: `It's ready. They'll open it at ${entry}. Leave the light on.`, at: 1.8, rate: 0.72, pitch: 0.2, volume: 0.22, lang: "en-GB" },
        timers,
      );
      break;
    }
    case "ev-voicenote": {
      // 0:21 · E.V. at her window, very close to the phone
      nodes.push(bed(e, now, now + 21, "lowpass", 300, 0.04));
      speak(
        {
          text: "I stood at the window and raised my hand. Just to see. And the shape over there raised its hand. Not after me, Mara. With me. At the same time.",
          at: 0.8,
          rate: 0.86,
          pitch: 0.95,
          volume: 0.85,
          lang: "en-GB",
        },
        timers,
      );
      break;
    }
  }

  return {
    stop: () => {
      timers.forEach(clearTimeout);
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      nodes.forEach((n) => {
        try {
          n.stop();
        } catch {
          // already finished: nothing to stop
        }
      });
    },
  };
}
