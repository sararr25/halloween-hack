"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key, staticSwell, subThud } from "@/lib/audio/sfx";
import { glitchNow } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import { SignGlyph } from "./Decor";
import styles from "./briefing.module.css";

gsap.registerPlugin(useGSAP);

// The case briefing, between the scan (S1) and the desktop: who E.V. is, who the player is
// meant to be, what to do. Under 20 s, skippable. The last frame plants the twist without
// saying it: for an instant the Sign fills the black and the recording light is on the
// operator, not on her.
// Card timings are seconds from the start; the phase change runs on a timer, not on the
// timeline, so a throttled tab still reaches the desktop.
const CARDS = [0, 4.4, 8.8, 13.2];
const FLICKER_AT = 17.6;
const END_AT = 19.4;
export const BRIEFED_KEY = "recovery.briefed";

export default function Briefing() {
  const { state, dispatch } = useStory();
  const root = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState(0);
  const [flicker, setFlicker] = useState(false);

  const done = () => {
    try {
      localStorage.setItem(BRIEFED_KEY, "1");
    } catch {
      // storage blocked: the briefing just plays again next time
    }
    dispatch({ type: "phase", phase: "desktop" });
  };

  useEffect(() => {
    const at = (s: number, run: () => void) => setTimeout(run, s * 1000);
    const timers = [
      ...CARDS.slice(1).map((s, i) =>
        at(s, () => {
          glitchNow(0.5, { sound: false });
          setCard(i + 1);
        }),
      ),
      at(FLICKER_AT, () => {
        glitchNow(0.9);
        setFlicker(true);
      }),
      at(FLICKER_AT + 0.45, () => setFlicker(false)),
      at(END_AT, done),
    ];
    return () => timers.forEach(clearTimeout);
    // runs once for the whole briefing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Each card: a thud, the lines scanned in from the left, the objective typed.
  useGSAP(
    () => {
      const el = root.current?.querySelector<HTMLElement>(`[data-card="${card}"]`);
      if (!el) return;
      subThud(card === 0 ? 0.7 : 0.4);
      if (card === 2) staticSwell(0.25);
      const lines = el.querySelectorAll<HTMLElement>("[data-line]");
      gsap.fromTo(
        lines,
        { clipPath: "inset(0 100% 0 0)" },
        { clipPath: "inset(0 0% 0 0)", duration: 0.5, ease: "power2.out", stagger: 0.55 },
      );
      const typed = el.querySelector<HTMLElement>("[data-typed]");
      if (typed) {
        const n = typed.textContent?.length ?? 10;
        const t = { c: 0 };
        let shown = 0;
        typed.style.clipPath = "inset(0 100% 0 0)";
        gsap.to(t, {
          c: n,
          delay: 1.1,
          duration: n * 0.05,
          ease: "none",
          onUpdate: () => {
            const c = Math.floor(t.c);
            if (c !== shown) {
              shown = c;
              key();
            }
            typed.style.clipPath = `inset(0 ${100 - (c / n) * 100}% 0 0)`;
          },
        });
      }
      const photo = el.querySelector("[data-photo]");
      if (photo) gsap.fromTo(photo, { scale: 1.12, opacity: 0 }, { scale: 1, opacity: 1, duration: 4.4, ease: "power1.out" });
      const face = el.querySelector("[data-face]");
      if (face) gsap.fromTo(face, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1, duration: 1.2, ease: "power2.out" });
    },
    { scope: root, dependencies: [card] },
  );

  return (
    <div ref={root} className={styles.briefing} data-glitch>
      <p className={styles.head}>RECOVERY/4 · case 0418</p>

      {card === 0 && (
        <section data-card="0" className={styles.card}>
          <span data-face className={styles.face}>
            <Image src="/avatars/ev.webp" alt="" width={192} height={192} />
          </span>
          <h1 data-line className={styles.big}>
            E.V. is missing.
          </h1>
          <p data-line className={styles.sub}>
            7 days. No calls, no messages, no card payments.
          </p>
        </section>
      )}

      {card === 1 && (
        <section data-card="1" className={styles.card}>
          <span data-photo className={styles.photo}>
            <Image src="/photos/IMG_0413.jpg" alt="" fill sizes="100vw" />
          </span>
          <h1 data-line className={styles.big}>
            Last seen at home.
          </h1>
          <p data-line className={styles.sub}>
            16 Harrow St. The door was open. Her laptop was on.
          </p>
        </section>
      )}

      {card === 2 && (
        <section data-card="2" className={styles.card}>
          <p data-line className={styles.sub}>
            The police stopped looking.
          </p>
          <h1 data-line className={styles.big}>
            You are the recovery operator.
          </h1>
        </section>
      )}

      {card === 3 && (
        <section data-card="3" className={styles.card}>
          <p data-line className={styles.sub}>
            Her laptop is on this screen. Mail, photos, messages, notes.
          </p>
          <h1 data-typed className={`${styles.big} ${styles.objective}`}>
            Find out what she saw.
          </h1>
        </section>
      )}

      {flicker && (
        <>
          <SignGlyph size={140} className={styles.sign} />
          <p className={styles.rec} aria-hidden="true">
            ● REC · operator · {clock(state.openedAt, true)}
          </p>
        </>
      )}

      <button className={styles.skip} onClick={done}>
        skip
      </button>
    </div>
  );
}
