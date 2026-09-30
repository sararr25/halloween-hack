"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { glitchSound, key, lightSwitch, playRoom, recordRoom, staticSwell, subThud, tapeWarble } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { acrossRive, useMountedRive } from "@/lib/rive/persistent";
import LiveFeed from "./LiveFeed";
import { useStory } from "@/lib/story/store";
import { clock, duration } from "@/lib/story/time";
import styles from "./reveal.module.css";

// S9 · Reveal, about a minute, in beats that wait for the player.
//  1. What the session recorded, in the second person, one line at a time (click or a key
//     moves on). Behind it the window across lights up with the stutter of an old tube.
//  2. Someone steps into the light and copies the player's head 1:1, no lag. "don't move."
//     makes them try, and see it.
//  3. "raise your hand." (E.V.'s voice note). With the camera, an open palm makes the figure
//     raise its hand *with* the player. Nothing raised in time, or no camera: it raises it
//     anyway, on its own.
//  4. Silence while the room is recorded (microphone granted in S1, memory only), then it
//     is played back: "that was your room."
//  5. The window corrupts into the live camera of flat 4A: the player. Then black, login.
// Every step runs on timers, not tweens, so a throttled tab still reaches the end.

const LINE_MIN_MS = 1200;
const LINE_MAX_MS = 4200;
const HAND_WAIT_MS = 10_000;
const ROOM_MS = 3000;
const FEED_MS = 8000;

export default function Reveal() {
  const { state, dispatch } = useStory();
  const { tracker } = usePresence();
  const host = useRef<HTMLDivElement>(null);
  const [line, setLine] = useState<{ text: string; order?: boolean; next?: boolean } | null>(null);
  const [black, setBlack] = useState(false);
  const [feed, setFeed] = useState<"off" | "on" | "cut">("off");
  const following = useRef(false);
  // resolves the beat that is waiting for a click/key, or for a raised hand
  const advance = useRef<(() => void) | null>(null);
  const palm = useRef<(() => void) | null>(null);

  useMountedRive(host, acrossRive);

  // Once the figure is there it is the user: no smoothing, no delay.
  usePresenceEvent("change", (s) => {
    if (!following.current) return;
    acrossRive().set("headX", s.headX);
    acrossRive().set("headY", s.headY);
  });
  usePresenceEvent("gesture", (g) => {
    if (g === "palm") palm.current?.();
  });
  useEffect(() => {
    const go = () => advance.current?.();
    window.addEventListener("pointerdown", go);
    window.addEventListener("keydown", go);
    return () => {
      window.removeEventListener("pointerdown", go);
      window.removeEventListener("keydown", go);
    };
  }, []);

  // Second person, built from what the session recorded. Never "it's you".
  const [lines] = useState(() => {
    const { openedAt, clues, interruptions, session, frames } = state;
    const out = [`You came in at ${clock(openedAt)}.`];
    if ("photo_figure" in clues) out.push(`You found the one in the street in ${duration(clues.photo_figure)}.`);
    out.push(
      session.camera === "granted"
        ? "You held still when you were asked."
        : `You said no at ${clock(session.verifiedAt ?? openedAt)}. It made no difference.`,
    );
    if (interruptions.length) out.push(`You looked away ${interruptions.length} ${interruptions.length === 1 ? "time" : "times"}.`);
    if (frames.length) out.push(`You closed your eyes ${frames.length} ${frames.length === 1 ? "time" : "times"}. We kept them.`);
    return out;
  });

  useEffect(() => {
    const a = acrossRive();
    const v = { zoom: 0, light: 0, figure: 0, corruption: 0, hand: 0 };
    // a fixed list: GSAP adds its own bookkeeping key to the tweened object
    const KEYS = ["zoom", "light", "figure", "corruption", "hand"] as const;
    const write = () => KEYS.forEach((k) => a.set(k, v[k]));
    write();
    a.set("neon", 0.6);
    a.set("headX", 0);
    a.set("headY", 0);
    const tweens: gsap.core.Tween[] = [];
    const to = (vars: Partial<typeof v>, dur: number, ease = "power1.inOut") =>
      tweens.push(gsap.to(v, { ...vars, duration: dur, ease, onUpdate: write }));

    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const sleep = (ms: number) => new Promise<void>((r) => timers.push(setTimeout(r, ms)));
    /** Waits for `slot` to be called (a click, a palm) or `ms`; true if it was called. */
    const until = (slot: typeof advance, ms: number) =>
      new Promise<boolean>((resolve) => {
        const t = setTimeout(() => {
          slot.current = null;
          resolve(false);
        }, ms);
        timers.push(t);
        slot.current = () => {
          clearTimeout(t);
          slot.current = null;
          resolve(true);
        };
      });
    const say = (text: string | null, opts: { order?: boolean; next?: boolean } = {}) => {
      if (!alive) return;
      if (text) key();
      setLine(text ? { text, ...opts } : null);
    };

    // the window lights up behind the first lines, with the stutter of an old tube
    timers.push(
      setTimeout(() => {
        lightSwitch();
        tweens.push(gsap.to(v, { keyframes: { light: [0.6, 0.1, 0.9, 0.3, 1] }, duration: 0.7, ease: "none", onUpdate: write }));
        to({ zoom: 0.55 }, 14);
      }, 2400),
    );

    const run = async () => {
      // 1 · what was recorded
      await sleep(800);
      for (const l of lines) {
        if (!alive) return;
        say(l, { next: true });
        await sleep(LINE_MIN_MS);
        await until(advance, LINE_MAX_MS - LINE_MIN_MS);
      }
      say(null);
      await sleep(900);

      // 2 · someone steps into the light, and from now on moves as the user moves
      if (!alive) return;
      following.current = true;
      a.set("headX", tracker.state.headX);
      a.set("headY", tracker.state.headY);
      to({ figure: 1 }, 1.4, "power2.out");
      to({ zoom: 0.9 }, 10);
      subThud(0.5);
      await sleep(2600);
      say("don't move.", { order: true });
      await sleep(4200);
      say(null);
      await sleep(1200);

      // 3 · the hand
      say("raise your hand.", { order: true });
      const camera = tracker.state.source === "camera";
      const raised = camera ? await until(palm, HAND_WAIT_MS) : (await sleep(3500), false);
      if (!alive) return;
      if (raised) {
        to({ hand: 1 }, 0.3, "power3.out"); // with the player, not after
        say(null);
        await sleep(3200);
      } else {
        to({ hand: 1 }, 1.6, "power2.inOut"); // on its own
        await sleep(1200);
        say(camera ? "it raised its hand. you didn't." : "it didn't wait for you.");
        await sleep(3400);
      }
      to({ hand: 0 }, 1.2, "power2.inOut");
      say(null);
      await sleep(1400);

      // 4 · the room, recorded in silence, then played back
      // only with the microphone granted in S1: asking again here would break the scene
      const room = state.session.mic === "granted" ? await recordRoom(ROOM_MS) : (await sleep(ROOM_MS), null);
      if (!alive) return;
      if (room) {
        say("that was your room.", { order: true });
        playRoom(room);
        await sleep(room.duration * 1000 + 1200);
      } else {
        say("your microphone was off. we listened anyway.");
        tapeWarble(0.9);
        staticSwell(0.5);
        await sleep(3800);
      }
      say(null);

      // 5 · the window corrupts and resolves into the live camera: the user, in flat 4A
      glitchSound(1);
      to({ corruption: 1 }, 0.9, "power2.in");
      await sleep(1000);
      if (!alive) return;
      setFeed("on");
      await sleep(FEED_MS);
      glitchSound(0.8);
      setFeed("cut");
      await sleep(500);
      if (!alive) return;
      setBlack(true);
      await sleep(2600);
      if (alive) dispatch({ type: "phase", phase: "login" });
    };
    void run();

    return () => {
      alive = false;
      advance.current = null;
      palm.current = null;
      timers.forEach(clearTimeout);
      tweens.forEach((t) => t.kill());
      following.current = false;
    };
    // runs once for the whole scene
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.reveal}>
      <div ref={host} className={styles.scene} data-black={black || feed !== "off"} />
      {feed !== "off" && !black && (
        <div className={styles.feedWrap} data-cut={feed === "cut"}>
          <LiveFeed />
        </div>
      )}
      <p className={styles.line} aria-live="polite" data-order={!!line?.order} key={line?.text ?? "none"}>
        {line?.text}
      </p>
      {line?.next && <span className={styles.next}>click to go on</span>}
    </div>
  );
}
