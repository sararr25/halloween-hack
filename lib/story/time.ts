// Time helpers for the story. All local time: the twist uses the user's own clock.

const pad = (n: number) => String(n).padStart(2, "0");

/** "21:14" or, with seconds, "21:14:07". */
export function clock(ms: number, seconds = false) {
  const d = new Date(ms);
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return seconds ? `${hm}:${pad(d.getSeconds())}` : hm;
}

/** The backup password: the local time the user opened the site, as HHMM. */
export function entryCode(openedAt: number) {
  return clock(openedAt).replace(":", "");
}

/** "6m 42s" */
export function duration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
}

/** A date `days` before today, formatted like a file listing: "23 Sep". */
export function daysAgo(days: number, now = Date.now()) {
  const d = new Date(now - days * 86_400_000);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Today, long form: "Tuesday 29 September". */
export function today(now = Date.now()) {
  return new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}
