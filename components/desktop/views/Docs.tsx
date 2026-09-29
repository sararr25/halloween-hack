"use client";

import { INVITATION, MANUAL } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import { APP } from "../apps";
import { SignGlyph } from "../Decor";
import { when } from "./shared";
import styles from "./views.module.css";

// Files on the desktop: the invitation (The Game), the operator manual (the system's
// voice) and a screenshot of this very screen (Black Mirror).

export function Invitation() {
  return (
    <article className={styles.letter}>
      <SignGlyph size={30} className={styles.letterMark} />
      <p className={styles.letterHead}>
        {INVITATION.company}
        <small>{INVITATION.tagline}</small>
      </p>
      <div className={styles.prose}>
        {INVITATION.body.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
      <p className={styles.byline} style={{ marginTop: 22 }}>
        {INVITATION.footer} · {when(INVITATION.days)}
      </p>
    </article>
  );
}

export function Manual() {
  return (
    <article>
      <p className={styles.byline}>{MANUAL.title}</p>
      <div className={`${styles.prose} ${styles.mono}`}>
        {MANUAL.sections.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>
    </article>
  );
}

/**
 * "Screenshot 23.02.png", taken 7 days ago — and it shows the windows *you* have open
 * right now, where you put them.
 */
export function Screenshot() {
  const { state } = useStory();
  const vw = typeof window === "undefined" ? 1440 : window.innerWidth;
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  return (
    <figure className={styles.shot}>
      <div className={styles.shotScreen} style={{ aspectRatio: `${vw} / ${vh}` }}>
        <span className={styles.shotBar} />
        {state.windows.map((w) => {
          const size = APP[w.id].size;
          return (
            <span
              key={w.id}
              className={styles.shotWin}
              style={{ left: `${(w.x / vw) * 100}%`, top: `${(w.y / vh) * 100}%`, width: `${(size.w / vw) * 100}%`, height: `${(size.h / vh) * 100}%`, zIndex: w.z }}
            />
          );
        })}
      </div>
      <figcaption className={styles.byline}>Screenshot · 23:02 · {when(7)}</figcaption>
    </figure>
  );
}
