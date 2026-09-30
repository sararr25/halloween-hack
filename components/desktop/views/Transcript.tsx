"use client";

import { useEffect, useState } from "react";
import { captionRun, markHeard, onCaption, wasHeard, wordTimes } from "@/lib/audio/captions";
import styles from "./voice.module.css";

/**
 * A transcript written while its recording plays (lib/audio/captions.ts), with no sound of
 * its own: the voice is already there. Before the first play it waits; words not reached
 * yet keep their place, so the text never jumps. Heard to the end, it stays.
 */
export default function Transcript({ id, text, className }: { id: string; text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean);
  const [shown, setShown] = useState(() => (wasHeard(id) ? words.length : 0));
  const [started, setStarted] = useState(() => wasHeard(id));

  useEffect(() => {
    let raf = 0;
    let live = true;
    let times: number[] = [];
    const follow = () => {
      cancelAnimationFrame(raf);
      const run = captionRun(id);
      if (!run) {
        // stopped: at the very end it counts as heard, mid-way the words said so far stay
        if (times.length && performance.now() >= times[times.length - 1]) {
          setShown(words.length);
          markHeard(id);
        }
        return;
      }
      if (wasHeard(id)) return;
      setStarted(true);
      setShown(0);
      run.spans.then((spans) => {
        if (!live || captionRun(id) !== run) return;
        times = wordTimes(words, spans);
        const tick = () => {
          const now = performance.now();
          const n = times.filter((t) => t <= now).length;
          setShown(n);
          if (n >= words.length) return void markHeard(id);
          raf = requestAnimationFrame(tick);
        };
        tick();
      });
    };
    const off = onCaption(id, follow);
    // a recording that started a moment before this transcript was on screen
    if (captionRun(id)) follow();
    return () => {
      live = false;
      off();
      cancelAnimationFrame(raf);
    };
    // the words are derived from `text`
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, text]);

  if (!started) return <span className={`${className ?? ""} ${styles.waiting}`}>written as it plays</span>;
  return (
    <span className={className}>
      {words.map((w, i) => (
        <span key={i} className={i < shown ? styles.word : styles.unsaid}>
          {w}{" "}
        </span>
      ))}
    </span>
  );
}
