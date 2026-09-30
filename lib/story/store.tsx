"use client";

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";

// Story state machine — see docs/desktop.md. Client-side only: nothing leaves the browser.

export type Phase = "premise" | "boot" | "briefing" | "desktop" | "reveal" | "login";
export type Stage = 1 | 2 | 3;
export type AppId =
  | "mail" | "photos" | "messages" | "notes" | "history" | "phone" | "trash" | "camera" | "backup"
  | "invitation" | "screenshot" | "manual" | "session" | "locate";

export type WindowState = { id: AppId; z: number; x: number; y: number };

export type StoryState = {
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
};

/** "anon" = the anonymous sender (help that is really guidance); "system" = the OS;
 * "mara" = a message from Mara arriving on E.V.'s laptop. */
export type Notice = { id: number; from: "anon" | "system" | "mara"; text: string };

/** Facts about the user, gathered in S1 and reused by the story (S8/S9). */
export type Session = {
  /** "granted" | "denied" once the S1 verification ran; null before. */
  camera: "granted" | "denied" | null;
  mic: "granted" | "denied" | null;
  /** Epoch ms of the S1 verification answer. */
  verifiedAt: number | null;
};

type Action =
  | { type: "phase"; phase: Phase }
  | { type: "stage"; stage: Stage }
  | { type: "open"; id: AppId }
  | { type: "close"; id: AppId }
  | { type: "focus"; id: AppId }
  | { type: "move"; id: AppId; x: number; y: number }
  | { type: "clue"; id: string }
  | { type: "session"; session: Partial<Session> }
  | { type: "notify"; from: Notice["from"]; text: string }
  | { type: "dismiss"; id: number }
  | { type: "wrongCode" }
  | { type: "interrupt"; at: number }
  | { type: "calm"; calm: boolean };

function reducer(s: StoryState, a: Action): StoryState {
  switch (a.type) {
    case "phase":
      return { ...s, phase: a.phase };
    case "stage":
      return { ...s, stage: a.stage };
    case "open": {
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
      return { ...s, notices: [...s.notices, { id, from: a.from, text: a.text }] };
    }
    case "dismiss":
      return { ...s, notices: s.notices.filter((n) => n.id !== a.id) };
    case "wrongCode":
      return { ...s, wrongCodes: s.wrongCodes + 1 };
    case "interrupt":
      return { ...s, interruptions: [...s.interruptions, a.at] };
    case "calm":
      return { ...s, calm: a.calm };
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
