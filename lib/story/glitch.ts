// Story moments that need a glitch *now* (a refusal, a stage change) dispatch this event;
// the overlay in Experience.tsx fires shader tear + DOM split + sound together.

export const GLITCH_EVENT = "recovery:glitch";

export type GlitchRequest = { strength: number; sound: boolean };

/** strength 0..1; `sound: false` for frequent, small moments (the Sign moving). */
export function glitchNow(strength = 0.8, { sound = true }: { sound?: boolean } = {}) {
  window.dispatchEvent(new CustomEvent<GlitchRequest>(GLITCH_EVENT, { detail: { strength, sound } }));
}

export const CRT_EVENT = "recovery:crt";

/**
 * S10: the screen switches off like an old tube (overlay shader `crt`), over `seconds`.
 * `crtOff(0)` puts the overlay back to normal at once (once the page itself is black).
 */
export function crtOff(seconds = 1.4) {
  window.dispatchEvent(new CustomEvent<number>(CRT_EVENT, { detail: seconds }));
}
