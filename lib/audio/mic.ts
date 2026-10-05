// The microphone granted at the start (Gate.tsx / Boot.tsx via PresenceTracker.startCamera),
// kept open for the whole session and lent to the recordings (the call with Mara, the room in
// S9). Safari forgets a microphone permission about a minute after capture stops and asks
// again (WebKit bug 215884), and Firefox does not remember it by default: a second request
// minutes later, with no click behind it, fails, and the scene says the microphone was off.
// Kept open, it is never asked for twice. Nothing is stored or sent: recordings stay in memory.

let shared: MediaStream | null = null;

/** Keeps the granted microphone (replacing, and closing, any earlier one). */
export function keepMic(stream: MediaStream | null) {
  if (shared && shared !== stream) shared.getTracks().forEach((t) => t.stop());
  shared = stream;
}

/** The kept microphone while it is still live, else null. */
export function keptMic(): MediaStream | null {
  return shared?.getAudioTracks().some((t) => t.readyState === "live") ? shared : null;
}

/**
 * A microphone to record from: the kept one, or (none kept) a new request. `release` closes
 * only a stream opened here, never the kept one.
 */
export async function borrowMic(constraints: MediaTrackConstraints): Promise<{ stream: MediaStream; release: () => void }> {
  const kept = keptMic();
  if (kept) return { stream: kept, release: () => {} };
  const stream = await navigator.mediaDevices.getUserMedia({ audio: constraints });
  return { stream, release: () => stream.getTracks().forEach((t) => t.stop()) };
}
