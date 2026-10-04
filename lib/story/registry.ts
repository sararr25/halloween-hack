// Client side of the case registry (app/api/operators/route.ts). Only the operator name and
// the session times go to the server; frames and audio never leave the device.

const INVITE_KEY = "recovery.invite";
const INVITE_PARAM = "case";

/**
 * The token of whoever passed the case on (?case=<token>), kept for the session so the
 * name screen can file the chain. Safe to call while rendering: it only reads and remembers.
 */
export function readInvite(): string | null {
  if (typeof window === "undefined") return null;
  const fromUrl = new URL(window.location.href).searchParams.get(INVITE_PARAM);
  try {
    if (fromUrl) sessionStorage.setItem(INVITE_KEY, fromUrl);
    return sessionStorage.getItem(INVITE_KEY);
  } catch {
    return fromUrl; // storage blocked: the invite lives as long as the URL does
  }
}

/** Takes ?case= out of the address bar (after render: the router listens to history). */
export function hideInviteParam() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has(INVITE_PARAM)) return;
  url.searchParams.delete(INVITE_PARAM);
  window.history.replaceState(window.history.state, "", url);
}

/** Files the operator; resolves with the token for their "pass it on" link. */
export async function fileOperator(name: string, openedAt: number, invite: string | null): Promise<string> {
  const res = await fetch("/api/operators", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, openedAt, invite }),
  });
  if (!res.ok) throw new Error(`registry: filing failed (${res.status})`);
  const { token } = (await res.json()) as { token: string };
  return token;
}

/** Who passed the case on, or null when the link is unknown. */
export async function inviterOf(token: string): Promise<string | null> {
  // dev only: /?case=dev plays the DM from a made-up sender, without the registry
  if (process.env.NODE_ENV === "development" && token === "dev") return "Giulia";
  const res = await fetch(`/api/operators?invite=${encodeURIComponent(token)}`);
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`registry: invite lookup failed (${res.status})`);
  const { name } = (await res.json()) as { name: string };
  return name;
}

export const passOnLink = (token: string) => `${window.location.origin}/?${INVITE_PARAM}=${token}`;
