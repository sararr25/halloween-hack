// Story moments that need a glitch *now* (a refusal, a stage change) dispatch this event;
// the overlay in Experience.tsx fires shader tear + DOM split + sound together.

export const GLITCH_EVENT = "recovery:glitch";

/** strength 0..1 */
export function glitchNow(strength = 0.8) {
  window.dispatchEvent(new CustomEvent<number>(GLITCH_EVENT, { detail: strength }));
}
