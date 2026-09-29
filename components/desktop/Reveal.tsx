"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { glitchSound, lightSwitch, playRoom, recordRoom, staticSwell, tapeWarble } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { acrossRive, useMountedRive } from "@/lib/rive/persistent";
import { useStory } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import styles from "./reveal.module.css";

// S9 · Reveal. The window across (the building of IMG_0418) lights up and someone is in it.
// The figure copies the user's head 1:1, with no lag for the first time: nothing says
// "it's you", the synchrony does. Then ~1 s of the user's own room plays back (microphone
// granted in S1, kept in memory only), the image corrupts, black. See docs/scenes.md S9.
// Every step runs on a timer, not on tweens, so a throttled tab still reaches the end.

type Beat = { at: number; run: () => void };

export default function Reveal() {
  const { state, dispatch } = useStory();
  const { tracker } = usePresence();
  const host = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<string | null>(null);
  const [black, setBlack] = useState(false);
  const following = useRef(false);

  useMountedRive(host, acrossRive);

  // Once the figure is there it is the user: no smoothing, no delay.
  usePresenceEvent("change", (s) => {
    if (!following.current) return;
    acrossRive().set("headX", s.headX);
    acrossRive().set("headY", s.headY);
  });

  // Second person, built from what the session recorded. Never "it's you".
  const [lines] = useState(() => {
    const { openedAt, clues, interruptions, session } = state;
    const out = [`You came in at ${clock(openedAt)}.`];
    if ("photo_figure" in clues) out.push(`You found the one in the street in ${duration(clues.photo_figure)}.`);
    out.push(
      session.camera === "granted"
        ? "You held still when you were asked."
        : `You said no at ${clock(session.verifiedAt ?? openedAt)}. It made no difference.`,
    );
    if (interruptions.length) out.push(`You looked away ${interruptions.length} ${interruptions.length === 1 ? "time" : "times"}.`);
    return out;
  });

  useEffect(() => {
    const a = acrossRive();
    const v = { zoom: 0, light: 0, figure: 0, corruption: 0 };
    // a fixed list: GSAP adds its own bookkeeping key to the tweened object
    const KEYS = ["zoom", "light", "figure", "corruption"] as const;
    const write = () => KEYS.forEach((k) => a.set(k, v[k]));
    write();
    a.set("neon", 0.6);
    a.set("headX", 0);
    a.set("headY", 0);
    const tweens: gsap.core.Tween[] = [];
    const to = (vars: Partial<typeof v>, dur: number, ease = "power1.inOut") =>
      tweens.push(gsap.to(v, { ...vars, duration: dur, ease, onUpdate: write }));
    let room: Promise<AudioBuffer | null> | null = null;

    const beats: Beat[] = [
      ...lines.map((l, i) => ({ at: 800 + i * 2300, run: () => setLine(l) })),
      { at: 800 + lines.length * 2300, run: () => setLine(null) },
      // the window lights up, with the stutter of an old tube
      {
        at: 2400,
        run: () => {
          lightSwitch();
          tweens.push(
            gsap.to(v, {
              keyframes: { light: [0.6, 0.1, 0.9, 0.3, 1] },
              duration: 0.7,
              ease: "none",
              onUpdate: write,
            }),
          );
        },
      },
      { at: 3200, run: () => to({ zoom: 0.9 }, 9) },
      // someone steps into the light, and from now on moves as the user moves
      {
        at: 5200,
        run: () => {
          following.current = true;
          a.set("headX", tracker.state.headX);
          a.set("headY", tracker.state.headY);
          to({ figure: 1 }, 1.4, "power2.out");
        },
      },
      // listen to the room while the user watches
      { at: 9000, run: () => (room = recordRoom(1200)) },
      {
        at: 12400,
        run: () => {
          void room?.then((buf) => {
            if (buf) playRoom(buf);
            else {
              // no microphone: a reconstructed recording
              tapeWarble(0.9);
              staticSwell(0.5);
            }
          });
        },
      },
      {
        at: 14000,
        run: () => {
          glitchSound(1);
          to({ corruption: 1 }, 1.1, "power2.in");
        },
      },
      { at: 15200, run: () => setBlack(true) },
      { at: 17800, run: () => dispatch({ type: "phase", phase: "login" }) },
    ];
    const timers = beats.map((b) => setTimeout(b.run, b.at));
    return () => {
      timers.forEach(clearTimeout);
      tweens.forEach((t) => t.kill());
      following.current = false;
    };
    // runs once for the whole scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.reveal}>
      <div ref={host} className={styles.scene} data-black={black} />
      <p className={styles.line} aria-live="polite" key={line ?? "none"}>
        {line}
      </p>
    </div>
  );
}
