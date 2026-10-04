"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, type ReactNode } from "react";

// Story state machine — see docs/desktop.md. Client-side only: nothing leaves the browser.

type Phase = "premise" | "boot" | "briefing" | "desktop" | "reveal" | "login";
export type Stage = 1 | 2 | 3;
export type AppId =
  | "mail" | "photos" | "messages" | "notes" | "history" | "phone" | "trash" | "camera" | "backup"
  | "invitation" | "screenshot" | "manual" | "session" | "locate";

export type WindowState = { id: AppId; z: number; x: number; y: number };

type StoryState = {
  phase: Phase;
  stage: Stage;
  /** Open windows; array order = open order (S9 closes them in reverse). */
  windows: WindowState[];
  topZ: number;
  /** Clue id → ms since session start when it was found. */
  clues: Record<string, number>;
  /** Epoch ms of the first load of this session (the backup password is its HHMM). */
  openedAt: number;
  session: Session;
  /** Mono notifications on the desktop, newest last. */
  notices: Notice[];
  /** Wrong backup codes so far (2 → the anonymous sender nudges). */
  wrongCodes: number;
  /** Epoch ms of every time the user looked away (or left the page): S8 counts them. */
  interruptions: number[];
  /** The interlude after the session log: the case seems to go back to E.V. and the
   * desktop goes quiet (no glitches, no searchlight) until the reveal. */
  calm: boolean;
  /** Blinks the system answered (stage 2+, camera only): S8 and S9 count them. */
  blinks: number;
  /** An item an app should show when it opens or is brought forward (a hint points at it);
   * `n` changes on every request so asking twice still works. */
  focus: Partial<Record<AppId, { item: string; n: number }>>;
  /** The latest hint, kept readable under the objective until the stage changes. */
  hint: { text: string; open?: AppId; item?: string; until?: Until } | null;
  /** The menubar objective: the short form of the last notice that gave one, set just after
   * that notice (Desktop.tsx `post`). Never ahead of the notices. `until` says when it is done. */
  objective: { text: string; until?: Until } | null;
};

/** A step is done once this is true (clues found, wrong codes typed). */
export type Until = (clues: Record<string, number>, wrongCodes: number) => boolean;

/** "anon" = the anonymous sender (help that is really guidance); "system" = the OS;
 * "mara" = a message from Mara arriving on E.V.'s laptop. */
export type Notice = { id: number; from: "anon" | "system" | "mara"; text: string; open?: AppId; item?: string };

/** Facts about the user, gathered in S1 and reused by the story (S8/S9). */
type Session = {
  /** "granted" | "denied" once the S1 verification ran; null before. */
  camera: "granted" | "denied" | null;
  mic: "granted" | "denied" | null;
  /** Epoch ms of the S1 verification answer. */
  verifiedAt: number | null;
};

type Action =
  | { type: "phase"; phase: Phase }
  | { type: "stage"; stage: Stage }
  | { type: "open"; id: AppId; item?: string }
  | { type: "close"; id: AppId }
  | { type: "focus"; id: AppId }
  | { type: "move"; id: AppId; x: number; y: number }
  | { type: "clue"; id: string }
  | { type: "session"; session: Partial<Session> }
  | { type: "notify"; from: Notice["from"]; text: string; open?: AppId; item?: string }
  | { type: "dismiss"; id: number }
  | { type: "wrongCode" }
  | { type: "interrupt"; at: number }
  | { type: "calm"; calm: boolean }
  | { type: "clearNotices" }
  | { type: "hint"; text: string; open?: AppId; item?: string; until?: Until }
  | { type: "objective"; text: string; until?: Until }
  | { type: "blink" };

function reducer(s: StoryState, a: Action): StoryState {
  switch (a.type) {
    case "phase":
      return { ...s, phase: a.phase };
    case "stage":
      return { ...s, stage: a.stage, hint: null, objective: null };
    case "open": {
      if (a.item) s = { ...s, focus: { ...s.focus, [a.id]: { item: a.item, n: (s.focus[a.id]?.n ?? 0) + 1 } } };
      if (s.windows.some((w) => w.id === a.id)) return reducer(s, { type: "focus", id: a.id });
      const n = s.windows.length;
      const z = s.topZ + 1;
      return { ...s, topZ: z, windows: [...s.windows, { id: a.id, z, x: 250 + n * 36, y: 60 + n * 30 }] };
    }
    case "close":
      return { ...s, windows: s.windows.filter((w) => w.id !== a.id) };
    case "focus": {
      const z = s.topZ + 1;
      return { ...s, topZ: z, windows: s.windows.map((w) => (w.id === a.id ? { ...w, z } : w)) };
    }
    case "move":
      return { ...s, windows: s.windows.map((w) => (w.id === a.id ? { ...w, x: a.x, y: a.y } : w)) };
    case "clue":
      if (a.id in s.clues) return s;
      return { ...s, clues: { ...s.clues, [a.id]: Date.now() - s.openedAt } };
    case "session":
      return { ...s, session: { ...s.session, ...a.session } };
    case "notify": {
      const id = (s.notices.at(-1)?.id ?? 0) + 1;
      return { ...s, notices: [...s.notices, { id, from: a.from, text: a.text, open: a.open, item: a.item }] };
    }
    case "dismiss":
      return { ...s, notices: s.notices.filter((n) => n.id !== a.id) };
    case "wrongCode":
      return { ...s, wrongCodes: s.wrongCodes + 1 };
    case "interrupt":
      return { ...s, interruptions: [...s.interruptions, a.at] };
    case "calm":
      return { ...s, calm: a.calm };
    case "clearNotices":
      return { ...s, notices: [] };
    case "hint":
      return { ...s, hint: { text: a.text, open: a.open, item: a.item, until: a.until } };
    case "objective":
      return { ...s, objective: { text: a.text, until: a.until } };
    case "blink":
      return { ...s, blinks: s.blinks + 1 };
  }
}

const Ctx = createContext<{ state: StoryState; dispatch: (a: Action) => void } | null>(null);

const DEV_STAGES: Record<string, Stage> = { Digit1: 1, Digit2: 2, Digit3: 3 };
const DEV_PHASES: Record<string, Phase> = {
  KeyP: "premise",
  KeyB: "boot",
  KeyI: "briefing",
  KeyD: "desktop",
  KeyR: "reveal",
  KeyL: "login",
};

export function StoryProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, () => ({
    phase: "premise" as Phase,
    stage: 1 as Stage,
    windows: [],
    topZ: 10,
    clues: {},
    openedAt: Date.now(),
    session: { camera: null, mic: null, verifiedAt: null },
    notices: [],
    wrongCodes: 0,
    interruptions: [],
    calm: false,
    blinks: 0,
    focus: {},
    hint: null,
    objective: null,
  }));

  // Dev only: Alt+1/2/3 jumps stage, Alt+P/B/I/D/R/L jumps phase.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const key = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const stage = DEV_STAGES[e.code];
      if (stage) dispatch({ type: "stage", stage });
      const phase = DEV_PHASES[e.code];
      if (phase) dispatch({ type: "phase", phase });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  return <Ctx.Provider value={{ state, dispatch }}>{children}</Ctx.Provider>;
}

export function useStory() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStory must be used inside <StoryProvider>");
  return ctx;
}

/** How long after a notice its short form reaches the menubar (it is read on the right first). */
export const OBJECTIVE_AFTER_MS = 1500;

/**
 * Posts a notice and, once it has had time to be read, its short form as the objective
 * (owner playtest: the menubar must never be ahead of the notices on the right).
 */
export function usePost() {
  const { dispatch } = useStory();
  return useCallback(
    (
      notice: { from: Notice["from"]; text: string; open?: AppId; item?: string },
      objective?: { text: string; until?: Until },
    ) => {
      dispatch({ type: "notify", ...notice });
      if (objective) setTimeout(() => dispatch({ type: "objective", ...objective }), OBJECTIVE_AFTER_MS);
    },
    [dispatch],
  );
}
