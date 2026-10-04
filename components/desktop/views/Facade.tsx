"use client";

import { useEffect, useRef, useState } from "react";
import { breath, pingAt, ringBell } from "@/lib/audio/dread";
import { lightSwitch, sideWhisper, subThud } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { facadeRive, useMountedRive } from "@/lib/rive/persistent";
import { glitchNow } from "@/lib/story/glitch";
import { usePost, useStory } from "@/lib/story/store";
import styles from "./facade.module.css";

// Find My's "View live", Rear Window style (docs/plan-round8.md, round 9). The real photo of
// the terrace across (the IMG_0413 view, rive/photo/plate_*.jpg) seen through binoculars,
// drawn by Rive (rive/facade: facade.luau draws the photo magnified, binoculars.wgsl the light
// in the windows on their timers, the shapes behind the curtains, rain, the lenses, grain).
// This file is the game; every position is in photo pixels (1536 x 1024):
//  - the binoculars follow the head only (owner, round 9: no hands; turning right looks
//    right); the mouse only without a camera. Moving blurs them; held still they come into
//    focus, and only a focused look counts.
//  - E.V.'s phone (4A, the window above the lamp) pings now and then, quietly, sometimes not
//    at all, louder and more centred the closer the view is. Each ping lights its window
//    faintly for an instant, seen only by someone already looking there. The battery runs
//    down; at 1 % the phone dies, silence, then an old bell rings once and it is back.
//  - The watcher is just another shape pacing behind a curtain, like the neighbours. Hold a
//    steady, focused look on it and it is revealed: a person, facing you. Look away and it
//    is gone, and paces somewhere else, each time closer.
//  - A missed ping is not silence: the whisper from the headphone check (Gate.tsx) comes
//    back, quieter, from the side where 4A is.
//  - Holding a focused look on 4A for 2.5 s: its light stutters on, a raised hand, and the
//    figure copies the player's head for a few seconds; then the reveal starts (look_live).

// the glass of every window in the photo, as in binoculars.wgsl (keep in sync)
type Win = { key: string; x0: number; y0: number; x1: number; y1: number };
const WINDOWS: Win[] = [
  { key: "U1", x0: 35, y0: 300, x1: 95, y1: 424 },
  { key: "U2", x0: 184, y0: 300, x1: 246, y1: 424 },
  { key: "U3", x0: 366, y0: 300, x1: 430, y1: 424 },
  { key: "U4", x0: 584, y0: 300, x1: 646, y1: 424 },
  { key: "U5", x0: 735, y0: 300, x1: 797, y1: 424 },
  { key: "U6", x0: 884, y0: 300, x1: 944, y1: 424 },
  { key: "U7", x0: 1062, y0: 300, x1: 1124, y1: 424 },
  { key: "U8", x0: 1208, y0: 300, x1: 1270, y1: 424 },
  { key: "U9", x0: 1356, y0: 300, x1: 1418, y1: 424 },
  { key: "G1", x0: 5, y0: 512, x1: 60, y1: 640 },
  { key: "G2", x0: 360, y0: 512, x1: 418, y1: 640 },
  { key: "G3", x0: 595, y0: 512, x1: 655, y1: 640 },
  { key: "G4", x0: 880, y0: 515, x1: 940, y1: 605 },
  { key: "G5", x0: 1088, y0: 512, x1: 1148, y1: 640 },
];
const byKey = (k: string) => WINDOWS.find((w) => w.key === k)!;
const TARGET = byKey("U6");
const centre = (w: Win) => ({ x: (w.x0 + w.x1) / 2, y: (w.y0 + w.y1) / 2 });
// what a focused look shows in each window; none of them mentions the phone
const NIGHTS: Record<string, string> = {
  U1: "no. 11 · upstairs · a lamp left on for someone",
  U2: "no. 11 · someone walking through, again and again",
  U3: "no. 13 · upstairs · the light comes and goes",
  U4: "no. 15 · upstairs · dark. Curtains half open.",
  U5: "no. 15 · a bulb that will not settle",
  U6: "17 · flat 4A · dark. Something on the floor, by the bed.",
  U7: "no. 19 · upstairs · curtains drawn, lit from inside",
  U8: "no. 19 · a man asleep in front of the TV",
  U9: "no. 21 · a woman reading. She looks up. No.",
  G1: "no. 11 · downstairs · dark",
  G2: "no. 13 · downstairs · a cat on the sill, looking straight at you",
  G3: "no. 15 · downstairs · nobody home",
  G4: "17 · the hallway. The timer light.",
  G5: "no. 19 · downstairs · a kitchen, the radio on",
};
// where the watcher stands, in order: each time it is seen it moves closer to 4A
const WATCH_PATH = ["U3", "U5", "U7"];
// how far around a window a look still counts, in photo px
const LOOK_HIT = 14;
// the view can travel this far (photo px): the binoculars show about 520 x 350 px of it
const LOOK = { x0: 262, x1: 1274, y0: 176, y1: 848 };
// head to view (owner, round 9: it took too much head): about 10° of turn crosses the whole
// street, about 7° of nod a storey
const HEAD_RANGE = { x: 1000, y: 560 };
// the tracker trembles a little even when the head is still: changes smaller than this
// (photo px) are ignored, and what passes is eased in
const HEAD_DEADZONE = 14;
const HEAD_EASE = 0.18;
const LOOK_HOME = { x: 768, y: 470 };
// focus: speeds below SPEED_FLOOR (photo px/s) are the tracker's tremble and do not blur;
// BLUR_SPEED blurs fully. Focus comes at FOCUS_IN and is only lost past FOCUS_OUT, so a
// steady look stays sharp (owner, round 9: focus went while she was still)
const SPEED_FLOOR = 40;
const BLUR_SPEED = 420;
const FOCUS_IN = 0.18;
const FOCUS_OUT = 0.42;
const CAPTION_MS = 700;
// the watcher is a shape like any other until a steady look rests on it this long
const TURN_MS = 1200;
const LEAVE_MS = 1500;
const FIND_MS = 2500;
// after the light comes on, how long the hand is seen before the reveal starts
const FOUND_HOLD_MS = 4800;
// the phone: a ping every 4-6 s, one in five missed; the battery and when it dies
const PING_MS: [number, number] = [4000, 6000];
const PING_MISS = 0.2;
const BATTERY: [number, number][] = [
  [30_000, 3],
  [55_000, 2],
  [75_000, 1],
];
const DIES_AT = 85_000;
const BACK_AT = 93_000;
const NUDGES: [number, string, string][] = [
  [40_000, "…listen. it rings where she is.", "17 Harrow St · follow the ringing, hold still to focus"],
  [80_000, "…upstairs. The window above the lamp.", "17 Harrow St · upstairs, above the lamp"],
];
const clampLook = (p: { x: number; y: number }) => ({
  x: Math.max(LOOK.x0, Math.min(LOOK.x1, p.x)),
  y: Math.max(LOOK.y0, Math.min(LOOK.y1, p.y)),
});

export default function Facade() {
  const { dispatch } = useStory();
  const post = usePost();
  const { tracker } = usePresence();
  const host = useRef<HTMLDivElement>(null);
  useMountedRive(host, facadeRive);

  const target = useRef({ ...LOOK_HOME });
  const look = useRef({ ...LOOK_HOME });
  const blur = useRef(0);
  const glow = useRef(0);
  const [over, setOver] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [phone, setPhone] = useState<{ battery: number; state: "ringing" | "offline" | "back" }>({ battery: 4, state: "ringing" });
  const [found, setFound] = useState(false);
  const foundRef = useRef(false);
  // performance.now() when 4A was found; Rive gets the seconds since (its tube stutter)
  const foundAt = useRef(0);
  const watch = useRef({ at: 0, turned: false });

  // the watcher where it stands now, back to the street
  const placeWatcher = () => {
    const w = byKey(WATCH_PATH[watch.current.at]);
    const r = facadeRive();
    r.set("figX", centre(w).x);
    r.set("turned", 0);
    r.set("figOn", 1);
  };
  useEffect(() => {
    const r = facadeRive();
    r.set("found", -1);
    r.set("blur", 0);
    r.set("glow", 0);
    placeWatcher();
     
  }, []);

  // the input moves a target; the view follows it, a little heavy, every frame.
  // Without a camera the mouse plays the head: across the box is across the street.
  const move = (e: React.PointerEvent) => {
    if (tracker.state.source === "camera") return;
    const b = e.currentTarget.getBoundingClientRect();
    const fx = (e.clientX - b.left) / b.width;
    const fy = (e.clientY - b.top) / b.height;
    target.current = clampLook({ x: LOOK.x0 + fx * (LOOK.x1 - LOOK.x0), y: LOOK.y0 + fy * (LOOK.y1 - LOOK.y0) });
  };
  usePresenceEvent("change", (s) => {
    // found: the figure in 4A copies the head (camera), or the mouse playing the head
    if (foundRef.current) {
      const r = facadeRive();
      r.set("headX", s.headX);
      r.set("headY", s.headY);
      return;
    }
    if (s.source !== "camera") return;
    // the head only; headX is already mirrored, so turning right looks right
    const want = clampLook({ x: LOOK_HOME.x + s.headX * HEAD_RANGE.x, y: LOOK_HOME.y + s.headY * HEAD_RANGE.y });
    const t = target.current;
    if (Math.hypot(want.x - t.x, want.y - t.y) < HEAD_DEADZONE) return;
    target.current = { x: t.x + (want.x - t.x) * HEAD_EASE, y: t.y + (want.y - t.y) * HEAD_EASE };
  });

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const r = facadeRive();
      if (!foundRef.current) {
        const k = 1 - Math.pow(0.002, dt); // frame-rate independent ease
        const nx = look.current.x + (target.current.x - look.current.x) * k;
        const ny = look.current.y + (target.current.y - look.current.y) * k;
        const speed = Math.hypot(nx - look.current.x, ny - look.current.y) / Math.max(dt, 0.001);
        look.current = { x: nx, y: ny };
        const want = Math.min(1, Math.max(0, speed - SPEED_FLOOR) / BLUR_SPEED);
        // blurs at once when moving, comes into focus slowly when still
        blur.current += (want - blur.current) * (want > blur.current ? 0.5 : 1 - Math.pow(0.08, dt));
        r.set("lookX", look.current.x);
        r.set("lookY", look.current.y);
        r.set("blur", blur.current);
        const { x, y } = look.current;
        const hit = WINDOWS.find((w) => x > w.x0 - LOOK_HIT && x < w.x1 + LOOK_HIT && y > w.y0 - LOOK_HIT && y < w.y1 + LOOK_HIT);
        setOver(hit?.key ?? null);
        setFocused((f) => (f ? blur.current < FOCUS_OUT : blur.current < FOCUS_IN));
      }
      if (foundAt.current > 0) r.set("found", (now - foundAt.current) / 1000);
      if (glow.current > 0) {
        glow.current = Math.max(0, glow.current - dt * 0.9);
        r.set("glow", glow.current);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // the phone: quiet pings from 4A, a battery running down, dead, then back
  useEffect(() => {
    const start = Date.now();
    let t: ReturnType<typeof setTimeout>;
    let stopBell: (() => void) | null = null;
    const timers = [
      ...BATTERY.map(([ms, battery]) => setTimeout(() => setPhone((p) => ({ ...p, battery })), ms)),
      setTimeout(() => setPhone({ battery: 0, state: "offline" }), DIES_AT),
      setTimeout(() => {
        if (foundRef.current) return;
        setPhone({ battery: 1, state: "back" });
        stopBell = ringBell();
        glitchNow(0.6);
        setTimeout(() => stopBell?.(), 3400);
      }, BACK_AT),
    ];
    const next = () => {
      t = setTimeout(
        () => {
          if (foundRef.current) return;
          const elapsed = Date.now() - start;
          const dead = elapsed > DIES_AT && elapsed < BACK_AT + 3500;
          const c = centre(TARGET);
          const pan = (c.x - look.current.x) / 300;
          if (!dead && Math.random() > PING_MISS) {
            const d = Math.hypot(look.current.x - c.x, look.current.y - c.y);
            const near = Math.max(0, 1 - d / 700);
            pingAt(0.1 + 0.75 * near * near, Math.max(-1, Math.min(1, pan)));
            glow.current = 1;
          } else if (!dead) sideWhisper(pan, 0.55);
          next();
        },
        PING_MS[0] + Math.random() * (PING_MS[1] - PING_MS[0]),
      );
    };
    t = setTimeout(next, 1200);
    return () => {
      clearTimeout(t);
      timers.forEach(clearTimeout);
      stopBell?.();
    };
  }, []);

  const find = () => {
    if (foundRef.current) return;
    foundRef.current = true;
    setFound(true);
    setCaption("4A · E.V.'s iPhone");
    const r = facadeRive();
    r.set("figOn", 0);
    r.set("blur", 0);
    r.set("headX", tracker.state.headX);
    r.set("headY", tracker.state.headY);
    foundAt.current = performance.now();
    r.set("found", 0);
    // the light in 4A: a tube that will not start, then does (timed with the Rive stutter)
    [100, 360, 620].forEach((ms) => setTimeout(lightSwitch, ms));
    setTimeout(breath, 1100);
    setTimeout(() => {
      glitchNow(1);
      dispatch({ type: "clue", id: "look_live" });
    }, FOUND_HOLD_MS);
  };

  // a focused look: the window's night in one line; on the watcher it turns; on 4A, found
  const watcherKey = () => WATCH_PATH[watch.current.at];
  useEffect(() => {
    if (found || !over || !focused) return;
    const t = [setTimeout(() => setCaption(NIGHTS[over]), CAPTION_MS)];
    if (over === TARGET.key) t.push(setTimeout(find, FIND_MS));
    if (over === watcherKey() && !watch.current.turned)
      t.push(
        setTimeout(() => {
          watch.current.turned = true;
          facadeRive().set("turned", 1);
          subThud(0.8);
          glitchNow(0.4, { sound: false });
        }, TURN_MS),
      );
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over, focused, found]);

  // looked away from the watcher once it has turned: it is gone, and stands somewhere closer
  useEffect(() => {
    if (found || !watch.current.turned || over === watcherKey()) return;
    const t = setTimeout(() => {
      if (foundRef.current) return;
      facadeRive().set("figOn", 0);
      glitchNow(0.5, { sound: false });
      setTimeout(() => {
        if (foundRef.current) return;
        watch.current = { at: Math.min(watch.current.at + 1, WATCH_PATH.length - 1), turned: false };
        placeWatcher();
      }, 1200);
    }, LEAVE_MS);
    return () => clearTimeout(t);
     
  }, [over, found]);

  // nobody hears it: the sender helps, twice
  useEffect(() => {
    const t = NUDGES.map(([ms, text, objective]) =>
      setTimeout(() => {
        if (!foundRef.current) post({ from: "anon", text }, { text: objective, until: (c) => "look_live" in c });
      }, ms),
    );
    return () => t.forEach(clearTimeout);
  }, [post]);

  const camera = tracker.state.source === "camera";
  const status = phone.state === "offline" ? "offline" : `${phone.battery}% · ${phone.state === "back" ? "back online" : "ringing"}`;

  return (
    <div className={styles.facade} onPointerMove={move}>
      <div ref={host} className={styles.view} />
      <p className={styles.head}>
        <span className={styles.live}>● LIVE</span> 17 HARROW ST ·{" "}
        {camera ? "turn your head to look, hold still to focus" : "move the mouse to look, hold still to focus"}
      </p>
      <p className={styles.phone} data-state={phone.state}>
        E.V.&apos;s iPhone · {status}
      </p>
      {!found && (
        <p className={styles.focus} data-on={focused}>
          {focused ? "focus" : "· · ·"}
        </p>
      )}
      {caption && (
        <p key={caption} className={styles.caption} data-found={found}>
          {caption}
        </p>
      )}
    </div>
  );
}
