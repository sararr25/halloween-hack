// Screens too small for the desktop experience (phones, small tablets). The friend's DM still
// plays there (round 8 B1), the rest asks for a computer. Same query as desktop.module.css .small.
const NARROW_QUERY = "(max-width: 900px), (max-height: 520px)";

export const isNarrow = () => typeof window !== "undefined" && window.matchMedia(NARROW_QUERY).matches;

export function onNarrowChange(fn: () => void) {
  const mq = window.matchMedia(NARROW_QUERY);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
