"use client";

import { useEffect, useState } from "react";
import FxOverlay, { type FxLevels } from "@/components/FxOverlay";
import { drone, glitchSound, unlockAudio } from "@/lib/audio/sfx";
import { GLITCH_EVENT, type GlitchRequest } from "@/lib/story/glitch";
import { PresenceProvider } from "@/lib/presence/context";
import { StoryProvider, useStory, type Stage } from "@/lib/story/store";
import Boot from "./Boot";
import Desktop from "./Desktop";
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
    let timer: ReturnType<typeof setTimeout>;
    let soundDue = Date.now() + between(SOUND_CADENCE[stage]);
    const next = () => {
      timer = setTimeout(() => {
        const sound = Date.now() >= soundDue;
        if (sound) soundDue = Date.now() + between(SOUND_CADENCE[stage]);
        fire(STAGE_FX[stage].glitch, sound);
        next();
      }, between(CADENCE[stage]));
    };
    next();
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
  }, [live, stage]);

  useEffect(() => {
    if (live) drone(DRONE[stage]);
  }, [live, stage]);

  return <FxOverlay levels={{ ...STAGE_FX[stage], pulse }} />;
}

/** Outside the desktop the sound toggle floats bottom right; on the desktop it lives in the menubar. */
function FloatingSound() {
  const { state } = useStory();
  if (state.phase === "desktop") return null;
  return <SoundToggle className={styles.soundFloat} />;
}

// Top-level phase switch: premise → boot (S1) → desktop → reveal (S9) → login (S10). See docs/desktop.md.
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
              dispatch({ type: "phase", phase: "boot" });
            }}
          >
            Open
          </button>
          <p className={styles.hint}>best with headphones</p>
        </div>
      );
    case "boot":
      return <Boot />;
    case "desktop":
      return <Desktop />;
    case "reveal":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>S9 · reveal · to be built</p>
        </div>
      );
    case "login":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>S10 · login · to be built</p>
        </div>
      );
  }
}

export default function Experience() {
  return (
    <StoryProvider>
      <PresenceProvider>
        <Phases />
        <Overlay />
        <FloatingSound />
      </PresenceProvider>
      <div className={styles.small} role="alert">
        <p className={styles.mono}>This device cannot run the recovery. Use a desktop.</p>
      </div>
    </StoryProvider>
  );
}
