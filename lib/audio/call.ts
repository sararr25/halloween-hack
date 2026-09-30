// The live call in the interlude (IncomingCall.tsx): the ringtone, and the player's own
// voice. When Mara asks "say something", a few seconds of the microphone granted in S1 are
// recorded, kept in memory for this page only, and played back once in S9 ("she heard
// you."). Nothing is stored or sent, and nothing is transcribed: speech recognition in
// the browser would send the audio to a server.

import { audioEngine, isMuted, RAW_MIC } from "./sfx";

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

/**
 * Records `ms` of the microphone (already granted in S1, so no prompt) and reports its
 * level 0..1 as it goes, for the meter. Keeps the result for S9. Null without a microphone.
 */
export async function recordVoice(ms: number, onLevel: (level: number) => void): Promise<AudioBuffer | null> {
  const e = audioEngine();
  if (!e || typeof MediaRecorder === "undefined") return null;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: RAW_MIC });
  } catch {
    return null;
  }
  const analyser = e.ctx.createAnalyser();
  analyser.fftSize = 512;
  const tap = e.ctx.createMediaStreamSource(stream);
  tap.connect(analyser); // measured only, never sent to the speakers
  const data = new Uint8Array(analyser.fftSize);
  const meter = setInterval(() => {
    analyser.getByteTimeDomainData(data);
    let peak = 0;
    for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
    onLevel(Math.min(1, peak * 2.5));
  }, 60);

  const chunks: Blob[] = [];
  const rec = new MediaRecorder(stream);
  rec.ondataavailable = (ev) => chunks.push(ev.data);
  const done = new Promise<void>((resolve) => (rec.onstop = () => resolve()));
  rec.start();
  await new Promise((r) => setTimeout(r, ms));
  rec.stop();
  await done;
  clearInterval(meter);
  onLevel(0);
  tap.disconnect();
  stream.getTracks().forEach((t) => t.stop());
  const bytes = await new Blob(chunks, { type: rec.mimeType }).arrayBuffer();
  voice = await e.ctx.decodeAudioData(bytes);
  return voice;
}
