// The live call in the interlude (IncomingCall.tsx): the ringtone, and the player's own
// voice. When Mara asks "say something", a few seconds of the microphone granted in S1 are
// recorded, kept in memory for this page only, and played back once in S9 ("she heard
// you."). Nothing is stored or sent, and nothing is transcribed: speech recognition in
// the browser would send the audio to a server.

import { audioEngine, isMuted, RAW_MIC } from "./sfx";
import { borrowMic } from "./mic";

let voice: AudioBuffer | null = null;

/** The player's answer on the phone, or null (no microphone, or no call yet). */
export function callVoice() {
  return voice;
}

/**
 * A UK ringtone, from the laptop speaker: two short bursts of 400 + 450 Hz, a pause, again.
 * Returns a stop function.
 */
export function ring(): () => void {
  const e = audioEngine();
  if (!e || isMuted()) return () => {};
  const out = e.ctx.createGain();
  out.gain.value = 0.05;
  out.connect(e.master);
  const burst = (at: number) => {
    [400, 450].forEach((f) => {
      const o = e.ctx.createOscillator();
      o.frequency.value = f;
      const g = e.ctx.createGain();
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(1, at + 0.02);
      g.gain.setValueAtTime(1, at + 0.38);
      g.gain.linearRampToValueAtTime(0, at + 0.4);
      o.connect(g).connect(out);
      o.start(at);
      o.stop(at + 0.42);
    });
  };
  let next = e.ctx.currentTime + 0.05;
  const schedule = () => {
    while (next < e.ctx.currentTime + 1) {
      burst(next);
      burst(next + 0.6);
      next += 3;
    }
  };
  schedule();
  const timer = setInterval(schedule, 250);
  return () => {
    clearInterval(timer);
    out.gain.setTargetAtTime(0, e.ctx.currentTime, 0.02);
    setTimeout(() => out.disconnect(), 200);
  };
}

// A voice, not a room: the level must pass this peak for SPEECH_MS in total before the
// take counts as the player speaking (owner: Mara must not hear a voice in silence).
const SPEECH_PEAK = 0.06;
const SPEECH_MS = 400;
const TICK_MS = 60;

/**
 * Records `ms` of the microphone (already granted in S1, so no prompt) and reports its
 * level 0..1 as it goes, for the meter. Returns the take only if someone spoke in it (kept
 * for S9); null for silence, or without a microphone. Stops early once speech has been
 * heard and has gone quiet again.
 */
export async function recordVoice(ms: number, onLevel: (level: number) => void): Promise<AudioBuffer | null> {
  const e = audioEngine();
  if (!e || typeof MediaRecorder === "undefined") return null;
  let mic: Awaited<ReturnType<typeof borrowMic>>;
  try {
    mic = await borrowMic(RAW_MIC);
  } catch {
    return null;
  }
  const { stream } = mic;
  const analyser = e.ctx.createAnalyser();
  analyser.fftSize = 512;
  const tap = e.ctx.createMediaStreamSource(stream);
  tap.connect(analyser); // measured only, never sent to the speakers
  const data = new Uint8Array(analyser.fftSize);
  let spoken = 0;
  let quiet = 0;
  let finishEarly: () => void = () => {};
  const early = new Promise<void>((r) => (finishEarly = r));
  const meter = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
    onLevel(Math.min(1, peak * 2.5));
    if (peak > SPEECH_PEAK) {
      spoken += TICK_MS;
      quiet = 0;
    } else quiet += TICK_MS;
    // they said something and stopped: no need to wait out the whole take
    if (spoken >= SPEECH_MS && quiet >= 900) finishEarly();
  }, TICK_MS);

  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (ev) => chunks.push(ev.data);
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  rec.start();
  await Promise.race([new Promise((r) => setTimeout(r, ms)), early]);
  rec.stop();
  await done;
  clearInterval(meter);
  onLevel(0);
  tap.disconnect();
  mic.release();
  if (spoken < SPEECH_MS) return null;
  const bytes = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer();
  voice = await e.ctx.decodeAudioData(bytes);
  return voice;
}
