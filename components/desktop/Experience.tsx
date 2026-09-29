"use client";

import { StoryProvider, useStory } from "@/lib/story/store";
import Desktop from "./Desktop";
import styles from "./desktop.module.css";

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
      // Placeholder: the /lab S1 (camera + mic verification) moves here next.
      return (
        <div className={styles.screen}>
          <p className={styles.mono}>data recovery · session pending</p>
          <button className={styles.cta} onClick={() => dispatch({ type: "phase", phase: "desktop" })}>
            Start recovery
          </button>
        </div>
      );
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
      <Phases />
      <div className={styles.small} role="alert">
        <p className={styles.mono}>This device cannot run the recovery. Use a desktop.</p>
      </div>
    </StoryProvider>
  );
}
