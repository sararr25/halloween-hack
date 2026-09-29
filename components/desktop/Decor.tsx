"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CALENDAR, POLAROID } from "@/lib/story/content";
import { usePresenceEvent } from "@/lib/presence/context";
import { photoSrc } from "@/lib/story/content";
import { BLACKOUT_EVENT, glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { useFill } from "./views/shared";
import styles from "./desktop.module.css";

gsap.registerPlugin(useGSAP);

// Desktop decor: things that make the "perfect life" feel observed. References in
// lib/story/content.ts (Black Mirror, The Game, Memento). Everything here is invented.

/** The Sign: an invented pictogram — an eye that is also a standing figure. */
export function SignGlyph({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 56" width={size} height={size * 1.4} className={className} aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <circle cx="20" cy="12" r="9" />
        <circle cx="20" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <path d="M20 21 V52 M9 34 H31 M13 52 L20 44 L27 52" />
      </g>
    </svg>
  );
}

// Places on the wallpaper, in % of the screen, away from the icon column.
const SIGN_SPOTS: [number, number][] = [
  [64, 26], [82, 62], [46, 74], [72, 40], [34, 56], [88, 30],
];
const SIGN_NEAR_PX = 110;

/**
 * The Sign moves only while you are not looking (camera: head turned; mouse: pointer
 * out of the window or tab hidden). When you come back it has moved, with a glitch.
 * It is not clickable: it fades when the cursor gets near.
 */
export function TheSign() {
  const [spot, setSpot] = useState(0);
  const [near, setNear] = useState(false);
  const moved = useRef(false);
  const el = useRef<HTMLDivElement>(null);

  usePresenceEvent("change", (s) => {
    if (s.lookingAway && !moved.current) {
      moved.current = true;
      setSpot((i) => (i + 1 + Math.floor(Math.random() * (SIGN_SPOTS.length - 1))) % SIGN_SPOTS.length);
    } else if (!s.lookingAway && moved.current) {
      moved.current = false;
      glitchNow(0.6, { sound: false });
    }
  });

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const box = el.current?.getBoundingClientRect();
      if (!box) return;
      const d = Math.hypot(e.clientX - (box.left + box.width / 2), e.clientY - (box.top + box.height / 2));
      setNear(d < SIGN_NEAR_PX);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const [x, y] = SIGN_SPOTS[spot];
  return (
    <div ref={el} className={styles.sign} style={{ left: `${x}%`, top: `${y}%`, opacity: near ? 0 : undefined }}>
      <SignGlyph size={34} />
    </div>
  );
}

// Crack in the glass (Black Mirror's title card): a few lines at stage 2, the full
// star at stage 3. Drawn in when it appears, with a glitch.
const CRACK_2 = [
  "M200 150 L232 131 L268 126 L310 98 L352 92 L398 60",
  "M200 150 L221 172 L228 205 L262 238 L270 290",
  "M200 150 L176 163 L140 160 L108 184 L64 190 L10 220",
];
const CRACK_3 = [
  ...CRACK_2,
  "M200 150 L190 121 L197 88 L178 52 L184 8",
  "M200 150 L214 150 L246 160 L290 176 L330 172 L396 196",
  "M200 150 L186 176 L160 212 L150 250 L118 298",
  "M221 172 L214 150 L232 131 L197 128 L190 121 L176 163 L186 176 Z",
  "M246 160 L268 126 M140 160 L160 212 M228 205 L262 238",
];

export function Crack() {
  const { state } = useStory();
  const root = useRef<SVGSVGElement>(null);
  const paths = state.stage >= 3 ? CRACK_3 : state.stage >= 2 ? CRACK_2 : [];

  useGSAP(
    () => {
      if (!paths.length) return;
      glitchNow(0.9);
      root.current?.querySelectorAll<SVGPathElement>("path").forEach((p) => {
        if (p.dataset.drawn) return;
        p.dataset.drawn = "1";
        const len = p.getTotalLength();
        gsap.fromTo(p, { strokeDasharray: len, strokeDashoffset: len }, { strokeDashoffset: 0, duration: 0.35, ease: "power4.out" });
      });
    },
    { scope: root, dependencies: [paths.length] },
  );

  if (!paths.length) return null;
  return (
    <svg ref={root} className={styles.crack} viewBox="0 0 400 300" aria-hidden="true">
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

/** Calendar widget: her plans, still there. Some events appear by themselves. */
export function CalendarWidget() {
  const { state } = useStory();
  const f = useFill();
  const events = CALENDAR.filter((e) => !e.fromStage || state.stage >= e.fromStage);
  return (
    <section className={`${styles.widget} ${styles.glass}`} aria-label="Calendar">
      <header>Up next</header>
      <ul>
        {events.map((e) => (
          <li key={e.what} className={e.fromStage ? styles.intruder : undefined}>
            <span>{f(e.when)}</span>
            <span>{e.what}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Memento: a polaroid stuck to the desktop, with her handwriting. Opens Photos. */
export function Polaroid() {
  const { state, dispatch } = useStory();
  return (
    <button className={styles.polaroid} onClick={() => dispatch({ type: "open", id: "photos" })} aria-label="Polaroid: open Photos">
      <Image src={photoSrc("polaroid")} alt="" width={300} height={300} sizes="150px" />
      <span>{POLAROID[state.stage]}</span>
    </button>
  );
}

// Seconds into stage 3 after which the wallpaper changes anyway (a mouse user may never
// leave the window), always under a glitch.
const WALLPAPER_SWAP_S = 25;

/**
 * E.V.'s own photo as the wallpaper. At stage 3 it changes: in the house across, a window
 * is lit and someone stands in it. It changes the first time the user looks away.
 */
export function Wallpaper() {
  const { state } = useStory();
  const [swapped, setSwapped] = useState(false);
  const due = state.stage >= 3 && !swapped;

  usePresenceEvent("change", (s) => {
    if (due && s.lookingAway) setSwapped(true);
  });
  useEffect(() => {
    if (!due) return;
    const t = setTimeout(() => {
      glitchNow(0.9);
      setSwapped(true);
    }, WALLPAPER_SWAP_S * 1000);
    return () => clearTimeout(t);
  }, [due]);

  return <div className={styles.wallpaper} data-swapped={swapped} aria-hidden="true" />;
}

const BLACKOUT_MS = 1300;

/** One line on a black screen, for a moment: the system answering something you did. */
export function Blackout() {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const on = (e: Event) => {
      setText((e as CustomEvent<string>).detail);
      clearTimeout(t);
      t = setTimeout(() => setText(null), BLACKOUT_MS);
    };
    window.addEventListener(BLACKOUT_EVENT, on);
    return () => {
      clearTimeout(t);
      window.removeEventListener(BLACKOUT_EVENT, on);
    };
  }, []);
  if (!text) return null;
  return (
    <div className={styles.blackout} role="status">
      <p>{text}</p>
    </div>
  );
}
