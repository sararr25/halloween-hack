"use client";

import FxOverlay, { type FxLevels } from "@/components/FxOverlay";
import { PresenceProvider } from "@/lib/presence/context";
import { StoryProvider, useStory, type Stage } from "@/lib/story/store";
import Boot from "./Boot";
import Desktop from "./Desktop";
import styles from "./desktop.module.css";

// Overlay intensity per stage (HANDOVER stage table: low / medium / high).
const STAGE_FX: Record<Stage, FxLevels> = {
  1: { grain: 0.25, vignette: 0.35, glitch: 0.1, neon: 0 },
  2: { grain: 0.45, vignette: 0.55, glitch: 0.35, neon: 0 },
  3: { grain: 0.7, vignette: 0.75, glitch: 0.7, neon: 1 },
};

/**
 * One overlay for the whole experience, mounted once. Rive instances that render GPU
 * canvases must not be torn down mid-session: with `enableGPUCanvas` the runtime's
 * cleanup can crash (glDeleteTextures without a current context) and take the page,
 * and the camera, down with it.
 */
function Overlay() {
  const { state } = useStory();
  return <FxOverlay levels={STAGE_FX[state.stage]} />;
}

// Top-level phase switch: premise → boot (S1) → desktop → reveal (S9) → login (S10). See docs/desktop.md.
function Phases() {
  const { state, dispatch } = useStory();

  switch (state.phase) {
    case "premise":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>E.V. has been missing for 7 days. You have access now. Look carefully.</p>
          <button className={styles.cta} onClick={() => dispatch({ type: "phase", phase: "boot" })}>
            Open
          </button>
        </div>
      );
    case "boot":
      return <Boot />;
    case "desktop":
      return <Desktop />;
    case "reveal":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>S9 · reveal — to be built</p>
        </div>
      );
    case "login":
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>S10 · login — to be built</p>
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
      </PresenceProvider>
      <div className={styles.small} role="alert">
        <p className={styles.mono}>This device cannot run the recovery. Use a desktop.</p>
      </div>
    </StoryProvider>
  );
}
