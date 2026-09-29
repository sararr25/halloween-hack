"use client";

import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";

// Story state machine — see docs/desktop.md. Client-side only: nothing leaves the browser.

export type Phase = "premise" | "boot" | "desktop" | "reveal" | "login";
export type Stage = 1 | 2 | 3;
export type AppId = "mail" | "photos" | "messages" | "notes" | "history" | "phone" | "trash" | "camera" | "backup";

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
};

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
  | { type: "session"; session: Partial<Session> };

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
      return { ...s, topZ: z, windows: [...s.windows, { id: a.id, z, x: 180 + n * 36, y: 70 + n * 30 }] };
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
  }
}

const Ctx = createContext<{ state: StoryState; dispatch: (a: Action) => void } | null>(null);

const DEV_STAGES: Record<string, Stage> = { Digit1: 1, Digit2: 2, Digit3: 3 };
const DEV_PHASES: Record<string, Phase> = {
  KeyP: "premise",
  KeyB: "boot",
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
  }));

  // Dev only: Alt+1/2/3 jumps stage, Alt+P/B/D/R/L jumps phase.
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
