import { neon } from "@neondatabase/serverless";

// Server only (imported by app/api/operators/route.ts, never by a client component).
// The operator registry (docs/plan-round6.md B7): name, session times, an opaque token for
// the "pass it on" link, and who passed it. Never frames, audio or face data.
// Table: operators (id serial, name text, opened_at timestamptz, closed_at timestamptz,
// token text unique, invited_by int references operators on delete set null).
// Entries older than 12 months are deleted on every new filing (app/privacy/page.tsx).

export function registry() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("registry: DATABASE_URL is not set");
  return neon(url);
}

const NAME_MAX = 32;
// a session older than this is not a session that just ended
const SESSION_MAX_MS = 12 * 60 * 60 * 1000;

/** Trimmed, control characters out, capped. Null when nothing usable is left. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, NAME_MAX);
  return name || null;
}

export function cleanOpenedAt(raw: unknown, now = Date.now()): number | null {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return null;
  if (raw > now + 60_000 || now - raw > SESSION_MAX_MS) return null;
  return raw;
}

const TOKEN = /^[a-z0-9]{10}$/;
export const isToken = (t: unknown): t is string => typeof t === "string" && TOKEN.test(t);

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => "abcdefghijklmnopqrstuvwxyz0123456789"[b % 36]).join("");
}
