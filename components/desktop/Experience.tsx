"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import gsap from "gsap";
import FxOverlay, { type FxLevels, type FxSetter } from "@/components/FxOverlay";
import { drone, glitchSound, lightSwitch, unlockAudio } from "@/lib/audio/sfx";
import { CRT_EVENT, GLITCH_EVENT, type GlitchRequest } from "@/lib/story/glitch";
import { enterFullscreen } from "@/lib/fullscreen";
import { PresenceProvider, usePresenceEvent } from "@/lib/presence/context";
import { StoryProvider, useStory, type Stage } from "@/lib/story/store";
import Boot from "./Boot";
import Briefing from "./Briefing";
import Desktop from "./Desktop";
import Login, { CASE_KEY } from "./Login";
import Reveal from "./Reveal";
import FullscreenToggle from "./FullscreenToggle";
import SoundToggle from "./SoundToggle";
import styles from "./desktop.module.css";

// Overlay intensity per stage (HANDOVER stage table: low / medium / high).
const STAGE_FX: Record<Stage, Omit<FxLevels, "pulse">> = {
  1: { grain: 0.3, vignette: 0.4, glitch: 0.35, neon: 0 },
  2: { grain: 0.5, vignette: 0.6, glitch: 0.6, neon: 0 },
  3: { grain: 0.7, vignette: 0.75, glitch: 0.9, neon: 1 },
};

// Seconds between visual glitches [min, max], per stage.
const CADENCE: Record<Stage, [number, number]> = { 1: [6, 11], 2: [2.5, 5], 3: [0.8, 2] };
// Glitch sounds are much rarer than the visual ones: the user has to be able to read.
const SOUND_CADENCE: Record<Stage, [number, number]> = { 1: [30, 50], 2: [18, 30], 3: [10, 16] };
const between = ([a, b]: [number, number]) => (a + Math.random() * (b - a)) * 1000;
const DRONE: Record<Stage, number> = { 1: 0.5, 2: 0.8, 3: 1 };
const DOM_GLITCH_MS = 140;
// The searchlight that follows the user's head (mouse without camera), per stage.
const BEAM: Record<Stage, number> = { 1: 0.35, 2: 0.6, 3: 1 };
// Seconds the searchlight stays [on], [off] before stage 3, where it never leaves.
const BEAM_RHYTHM: Record<1 | 2, [[number, number], [number, number]]> = {
  1: [[5, 8], [35, 60]],
  2: [[12, 20], [8, 15]],
};
// It flares for an instant, colder, like lightning: two strokes and a tail. Stage 1 keeps
// it rare (the tracking is not shown yet); from stage 2 it flares every few seconds, short
// and soft, so the player sees that the light is on them and moves with them.
const FLASH_EVERY: Record<Stage, [number, number]> = { 1: [18, 24], 2: [4.5, 6.5], 3: [4, 6] };
const FLASH_STROKES = [0, 0.75, 0.1, 0.6, 0.2, 0];
const FLASH_S = 0.4;
// Entering stage 2 the beam snaps onto the head once, hard, with the click of a lamp.
const SNAP_STROKES = [0, 1, 0.4, 1, 0.6, 0];

/**
 * One overlay for the whole experience, mounted once. Rive instances that render GPU
 * canvases must not be torn down mid-session: with `enableGPUCanvas` the runtime's
 * cleanup can crash (glDeleteTextures without a current context) and take the page,
 * and the camera, down with it.
 */
function Overlay() {
  const { state } = useStory();
  const { stage, phase } = state;
  const [pulse, setPulse] = useState(0);
  const live = phase !== "premise";
  // the reveal and the login set their own pace: glitches only when they ask for one
  const scheduled = live && phase !== "briefing" && phase !== "reveal" && phase !== "login" && !state.calm;

  // One glitch = shader tear + DOM RGB split + sound, at the same moment.
  useEffect(() => {
    if (!live) return;
    const fire = (strength: number, sound: boolean) => {
      setPulse((p) => p + 1);
      if (sound) glitchSound(strength);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      document.body.classList.add("glitching");
      setTimeout(() => document.body.classList.remove("glitching"), DOM_GLITCH_MS);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let soundDue = Date.now() + between(SOUND_CADENCE[stage]);
    const next = () => {
      timer = setTimeout(() => {
        const sound = Date.now() >= soundDue;
        if (sound) soundDue = Date.now() + between(SOUND_CADENCE[stage]);
        fire(STAGE_FX[stage].glitch, sound);
        next();
      }, between(CADENCE[stage]));
    };
    if (scheduled) next();
    // story moments ask for a glitch now (see lib/story/glitch.ts)
    const onDemand = (e: Event) => {
      const { strength, sound } = (e as CustomEvent<GlitchRequest>).detail;
      fire(strength, sound);
    };
    window.addEventListener(GLITCH_EVENT, onDemand);
    return () => {
      clearTimeout(timer);
      window.removeEventListener(GLITCH_EVENT, onDemand);
    };
  }, [live, scheduled, stage]);

  useEffect(() => {
    if (!live) return;
    drone(phase === "login" ? 0 : phase === "reveal" ? 0.4 : state.calm ? 0.25 : DRONE[stage]);
  }, [live, phase, stage, state.calm]);

  // The searchlight: the head position goes straight to the shader, a little late
  // (like something turning to look), without re-rendering React on every frame.
  const set = useRef<FxSetter | null>(null);
  const head = useRef({ x: 0, y: 0 });
  const beam = phase === "desktop" && !state.calm ? BEAM[stage] : 0;
  const beamRef = useRef(0);
  const onVm = useCallback((s: FxSetter) => {
    set.current = s;
    s("beam", beamRef.current); // the overlay may load after the stage was set
  }, []);
  usePresenceEvent("change", (s) => {
    gsap.to(head.current, {
      x: s.headX,
      y: s.headY,
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => {
        set.current?.("headX", head.current.x);
        set.current?.("headY", head.current.y);
      },
    });
  });
  // It is not always there. Stage 1: now and then, for a few seconds. Stage 2: more often
  // than not. Stage 3: always. It fades in and out like a lamp being turned.
  useEffect(() => {
    const b = { v: beamRef.current };
    const fade = (to: number, dur = 2.2) =>
      gsap.to(b, {
        v: to,
        duration: dur,
        ease: "sine.inOut",
        overwrite: true,
        onUpdate: () => {
          beamRef.current = b.v;
          set.current?.("beam", b.v);
        },
      });
    if (beam === 0 || stage === 3) {
      const t = fade(beam);
      return () => void t.kill();
    }
    const [on, off] = BEAM_RHYTHM[stage];
    let timer: ReturnType<typeof setTimeout>;
    let lit = false;
    const next = () => {
      lit = !lit;
      fade(lit ? beam : 0);
      timer = setTimeout(next, between(lit ? on : off));
    };
    fade(0);
    timer = setTimeout(next, between(off));
    return () => {
      clearTimeout(timer);
      gsap.killTweensOf(b);
    };
  }, [beam, stage]);

  // The searchlight flares now and then, on the desktop only, never in the quiet interlude.
  const snapped = useRef(false);
  useEffect(() => {
    if (phase !== "desktop" || state.calm) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const f = { v: 0 };
    const flare = (strokes: number[], seconds: number) =>
      gsap.to(f, {
        keyframes: { v: strokes },
        duration: seconds,
        ease: "none",
        overwrite: true,
        onUpdate: () => set.current?.("flash", f.v),
      });
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        if (!reduced) flare(FLASH_STROKES, FLASH_S);
        next();
      }, between(FLASH_EVERY[stage]));
    };
    if (stage >= 2 && !snapped.current) {
      snapped.current = true;
      // on the head, once the beam has faded in
      timer = setTimeout(() => {
        lightSwitch();
        if (!reduced) flare(SNAP_STROKES, 0.8);
        next();
      }, 2400);
    } else next();
    return () => {
      clearTimeout(timer);
      gsap.killTweensOf(f);
      set.current?.("flash", 0);
    };
  }, [phase, state.calm, stage]);

  // S10: the screen switches off; crtOff(0) restores the overlay once the page is black.
  useEffect(() => {
    const crt = { v: 0 };
    const off = (e: Event) => {
      const seconds = (e as CustomEvent<number>).detail;
      gsap.killTweensOf(crt);
      if (seconds === 0) {
        crt.v = 0;
        set.current?.("crt", 0);
        return;
      }
      gsap.to(crt, { v: 1, duration: seconds, ease: "power2.in", onUpdate: () => set.current?.("crt", crt.v) });
    };
    window.addEventListener(CRT_EVENT, off);
    return () => window.removeEventListener(CRT_EVENT, off);
  }, []);

  return <FxOverlay levels={{ ...STAGE_FX[stage], pulse }} onVm={onVm} />;
}

/** Every time the user looks away (or leaves the page) on the desktop is kept: S8 reads it back. */
function Interruptions() {
  const { state, dispatch } = useStory();
  const away = useRef(false);
  const on = state.phase === "desktop";
  usePresenceEvent("change", (s) => {
    if (s.lookingAway && !away.current && on) dispatch({ type: "interrupt", at: Date.now() });
    away.current = s.lookingAway;
  });
  return null;
}

/** Outside the desktop the sound toggle floats bottom right; on the desktop it lives in the menubar. */
function FloatingSound() {
  const { state } = useStory();
  // on the desktop they live in the menubar; in the reveal nothing may break the image
  if (state.phase === "desktop" || state.phase === "reveal") return null;
  return (
    <span className={styles.floatControls}>
      <FullscreenToggle className={styles.soundMenu} />
      <SoundToggle className={styles.soundMenu} />
    </span>
  );
}

/** Someone who reached the end before is remembered, quietly. */
const readCase = () => {
  try {
    return localStorage.getItem(CASE_KEY);
  } catch {
    return null; // storage blocked: nobody is remembered
  }
};
const noSubscribe = () => () => {};

function Returning() {
  const name = useSyncExternalStore(noSubscribe, readCase, () => null);
  if (!name) return null;
  return <p className={styles.hint}>case 0418 is still open, {name}.</p>;
}

// Top-level phase switch: premise → boot (S1) → briefing → desktop → reveal (S9) → login (S10). See docs/desktop.md.
function Phases() {
  const { state, dispatch } = useStory();

  switch (state.phase) {
    case "premise":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>E.V. has been missing for 7 days. You have access now. Look carefully.</p>
          <button
            className={styles.cta}
            onClick={() => {
              unlockAudio(); // audio stays locked until a user gesture
              enterFullscreen(); // so is full screen: no tabs, no address bar
              dispatch({ type: "phase", phase: "boot" });
            }}
          >
            Open
          </button>
          <p className={styles.hint}>best with headphones</p>
          <Returning />
        </div>
      );
    case "boot":
      return <Boot />;
    case "briefing":
      return <Briefing />;
    case "desktop":
      return <Desktop />;
    case "reveal":
      return <Reveal />;
    case "login":
      return <Login />;
  }
}

export default function Experience() {
  return (
    <StoryProvider>
      <PresenceProvider>
        <Phases />
        <Interruptions />
        <Overlay />
        <FloatingSound />
      </PresenceProvider>
      <div className={styles.small} role="alert">
        <p className={styles.mono}>This device cannot run the recovery. Use a desktop.</p>
      </div>
    </StoryProvider>
  );
}
