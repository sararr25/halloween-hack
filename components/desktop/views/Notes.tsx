"use client";

import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { key } from "@/lib/audio/sfx";
import { NOTES } from "@/lib/story/content";
import { usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { Empty, Row, Split, useFill, when } from "./shared";
import styles from "./views.module.css";

gsap.registerPlugin(useGSAP);

// S5 · Notes. E.V.'s voice is literary. The first note carries today's real date and
// writes itself when opened, with one mistake corrected, as if by hand.
export default function Notes() {
  const { dispatch } = useStory();
  const f = useFill();
  const [openId, setOpenId] = useState<string | null>(null);
  const note = NOTES.find((n) => n.id === openId);
  const body = useRef<HTMLDivElement>(null);

  const open = (id: string) => {
    setOpenId(id);
    if (id === "dated") dispatch({ type: "clue", id: "note_dated" });
    if (id === "code") dispatch({ type: "clue", id: "note_code" });
  };

  // Blink → the line under the cursor flickers for 80 ms.
  usePresenceEvent("blink", () => {
    const hovered = body.current?.querySelector("p:hover");
    if (hovered) gsap.fromTo(hovered, { opacity: 0.15 }, { opacity: 1, duration: 0.08, ease: "none" });
  });

  useGSAP(
    () => {
      if (!note?.typed || !body.current) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      const lines = body.current.querySelectorAll<HTMLElement>("p");
      const tl = gsap.timeline();
      lines.forEach((line) => {
        const text = line.dataset.text ?? "";
        // one typo, then the correction: the second word is mistyped and fixed
        const words = text.split(" ");
        const typo = words.length > 3 ? words.slice(0, 2).join(" ") + "e" : null;
        line.textContent = "";
        const state = { n: 0 };
        if (typo && line === lines[1]) {
          tl.to(state, {
            n: typo.length,
            duration: typo.length * 0.04,
            ease: `steps(${typo.length})`,
            onUpdate: () => {
              line.textContent = typo.slice(0, Math.round(state.n));
              key();
            },
          });
          tl.to({}, { duration: 0.35 });
          tl.call(() => {
            line.textContent = typo.slice(0, -1); // backspace
            key();
          });
          tl.to({}, { duration: 0.2 });
          const start = typo.length - 1;
          const rest = { n: start };
          tl.to(rest, {
            n: text.length,
            duration: (text.length - start) * 0.036,
            ease: `steps(${text.length - start})`,
            onUpdate: () => {
              line.textContent = text.slice(0, Math.round(rest.n));
              key();
            },
          });
        } else {
          tl.to(state, {
            n: text.length,
            duration: text.length * 0.036,
            ease: `steps(${Math.max(1, text.length)})`,
            onUpdate: () => {
              line.textContent = text.slice(0, Math.round(state.n));
              key();
            },
          });
        }
        tl.to({}, { duration: 0.3 });
      });
    },
    { scope: body, dependencies: [openId] },
  );

  return (
    <Split
      list={NOTES.map((n) => (
        <Row
          key={n.id}
          active={n.id === openId}
          onClick={() => open(n.id)}
          title={f(n.title)}
          meta={when(n.days)}
          preview={f(n.body[n.id === "dated" ? 1 : 0])}
        />
      ))}
    >
      {!note ? (
        <Empty>{NOTES.length} notes</Empty>
      ) : (
        <article key={note.id}>
          <p className={styles.byline}>{when(note.days)}</p>
          <div ref={body} className={`${styles.prose} ${styles.literary}`}>
            {note.body.map((p, i) => (
              <p key={i} data-text={f(p)}>
                {f(p)}
              </p>
            ))}
          </div>
        </article>
      )}
    </Split>
  );
}
