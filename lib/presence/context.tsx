"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { PresenceTracker, type Gesture, type PresenceState } from "./tracker";

// One PresenceTracker for the whole experience: the camera is asked once in S1 (boot)
// and every later scene listens to the same stream. Frames never leave the browser.

type Handlers = {
  change: (s: PresenceState) => void;
  blink: () => void;
  gesture: (g: Gesture) => void;
};
type EventName = keyof Handlers;

export type Presence = {
  tracker: PresenceTracker;
  /** Hidden element MediaPipe reads from; it lives as long as the provider. */
  video: () => HTMLVideoElement | null;
  on: <K extends EventName>(event: K, fn: Handlers[K]) => () => void;
};

const Ctx = createContext<Presence | null>(null);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const videoEl = useRef<HTMLVideoElement>(null);
  const [presence, setPresence] = useState<Presence | null>(null);

  useEffect(() => {
    const listeners: { [K in EventName]: Set<Handlers[K]> } = {
      change: new Set(),
      blink: new Set(),
      gesture: new Set(),
    };
    const tracker = new PresenceTracker({
      onChange: (s) => listeners.change.forEach((fn) => fn(s)),
      onBlink: () => listeners.blink.forEach((fn) => fn()),
      onGesture: (g) => listeners.gesture.forEach((fn) => fn(g)),
    });
    tracker.startMouse();
    setPresence({
      tracker,
      video: () => videoEl.current,
      on: (event, fn) => {
        const set = listeners[event] as Set<typeof fn>;
        set.add(fn);
        return () => {
          set.delete(fn);
        };
      },
    });
    return () => tracker.stop();
  }, []);

  return (
    <>
      {/* the camera feed is never shown; MediaPipe only needs the element */}
      <video
        ref={videoEl}
        aria-hidden="true"
        style={{ position: "fixed", width: 1, height: 1, opacity: 0, pointerEvents: "none" }}
      />
      {presence && <Ctx.Provider value={presence}>{children}</Ctx.Provider>}
    </>
  );
}

export function usePresence() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePresence must be used inside <PresenceProvider>");
  return ctx;
}

/** Subscribes to one presence event for the lifetime of the component; always calls the latest `fn`. */
export function usePresenceEvent<K extends EventName>(event: K, fn: Handlers[K]) {
  const { on } = usePresence();
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    const call = ((...args: unknown[]) => (latest.current as (...a: unknown[]) => void)(...args)) as Handlers[K];
    return on(event, call);
  }, [on, event]);
}

/** `lookingAway` as React state (re-renders only when it flips). */
export function useLookingAway() {
  const { tracker } = usePresence();
  const [away, setAway] = useState(tracker.state.lookingAway);
  usePresenceEvent("change", (s) => {
    if (s.lookingAway !== away) setAway(s.lookingAway);
  });
  return away;
}
