"use client";

import { useEffect, useRef, useState } from "react";
import { breath, pingAt, ringBell } from "@/lib/audio/dread";
import { lightSwitch, subThud } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { facadeRive, useMountedRive } from "@/lib/rive/persistent";
import { glitchNow } from "@/lib/story/glitch";
import { usePost, useStory } from "@/lib/story/store";
import styles from "./facade.module.css";

// Find My's "View live", Rear Window style (docs/plan-round8.md A4). The front of 17 Harrow St
// at night, seen through binoculars, drawn and animated in Rive (rive/facade, built by
// scripts/gen-facade-rml.py): sixteen windows, two per flat, a building that lives on timers
// (lights, a TV, a cat, someone walking through, the stair light). This file is the game:
//  - the binoculars follow a raised hand, else the head; the mouse only without a camera.
//    Moving blurs them; held still for a moment they come into focus, and only a focused
//    look counts.
//  - E.V.'s phone (4A, the inner window) pings now and then, quietly, sometimes not at all,
//    louder and more centred the closer the lenses are. Each ping lights its window faintly
//    for an instant, so it is seen only by someone already looking there. The battery runs
//    down; at 1 % the phone dies, silence, then an old bell rings once and it is back.
//  - The watcher stands with its back to the street in 2B. Focus on it and it turns round.
//    Look away and it is gone, and stands somewhere else, each time closer to 4A.
//  - Holding a focused look on 4A's inner window for 2.5 s: its light stutters on, a raised
//    hand, and the reveal starts (look_live). No click shortcut.

const W = 800;
const H = 520;
const WIN = { w: 84, h: 70 };
const COLS = [150, 268, 448, 566];
const FLOORS: Record<number, number> = { 4: 58, 3: 156, 2: 254, 1: 352 };
type Win = { key: string; x: number; y: number };
const WINDOWS: Win[] = [4, 3, 2, 1].flatMap((floor) => COLS.map((x, i) => ({ key: `${floor}${i + 1}`, x, y: FLOORS[floor] })));
const byKey = (k: string) => WINDOWS.find((w) => w.key === k)!;
const TARGET = byKey("42");
const centre = (w: Win) => ({ x: w.x + WIN.w / 2, y: w.y + WIN.h / 2 });
// what a focused look shows in each window; none of them mentions the phone
const NIGHTS: Record<string, string> = {
  "41": "4A · dark. Curtains open.",
  "42": "4A · dark. Something on the floor, by the bed.",
  "43": "4B · a man asleep in front of the TV",
  "44": "4B · the bathroom light, on a timer",
  "31": "3A · a cat on the sofa, looking straight at you",
  "32": "3A · nothing. Then a light, for a second.",
  "33": "3B · a couple, not talking",
  "34": "3B · the other room",
  "21": "2A · someone walking through, again and again",
  "22": "2A · a kitchen, the lamp still swinging",
  "23": "2B · someone standing very still",
  "24": "2B · a child's star projector, nobody in the bed",
  "11": "1A · the stairwell. The timer light.",
  "12": "1A · the stairs go up.",
  "13": "1B · dark",
  "14": "1B · a woman reading. She looks up. No.",
};
// where the watcher stands, in order: each time it is seen it moves closer to 4A
const WATCH_PATH = ["23", "32", "41"];
const LENS_HIT = 18;
// focus: speed (artboard px/s) that blurs fully, and how still counts as focused
const BLUR_SPEED = 420;
const FOCUS_BELOW = 0.14;
const CAPTION_MS = 700;
const TURN_MS = 450;
const LEAVE_MS = 1500;
const FIND_MS = 2500;
// after the light comes on, how long the hand is seen before the reveal starts
const FOUND_HOLD_MS = 2800;
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
  [80_000, "…top floor. Her flat is on the left. The inner window.", "17 Harrow St · top floor, left, the inner window"],
];

export default function Facade() {
  const { dispatch } = useStory();
  const post = usePost();
  const { tracker } = usePresence();
  const host = useRef<HTMLDivElement>(null);
  useMountedRive(host, facadeRive);

  const target = useRef({ x: W / 2, y: H - 80 });
  const lens = useRef({ x: W / 2, y: H - 80 });
  const blur = useRef(0);
  const glow = useRef(0);
  const [over, setOver] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [steer, setSteer] = useState<"hand" | "head">("head");
  const [phone, setPhone] = useState<{ battery: number; state: "ringing" | "offline" | "back" }>({ battery: 4, state: "ringing" });
  const [found, setFound] = useState(false);
  const foundRef = useRef(false);
  const watch = useRef({ at: 0, turned: false });

  // the watcher where it stands now, back to the street
  const placeWatcher = () => {
    const w = byKey(WATCH_PATH[watch.current.at]);
    const r = facadeRive();
    r.set("figX", w.x + WIN.w / 2);
    r.set("figY", w.y + WIN.h);
    r.set("turned", 0);
    r.set("figOn", 1);
  };
  useEffect(() => {
    const r = facadeRive();
    r.set("found", 0);
    r.set("blur", 0);
    r.set("glow", 0);
    placeWatcher();
     
  }, []);

  // the input moves a target; the lenses follow it, a little heavy, every frame
  const fromClient = (cx: number, cy: number) => {
    const el = host.current;
    if (!el) return null;
    const b = el.getBoundingClientRect();
    const s = Math.max(b.width / W, b.height / H); // Fit.Cover
    return { x: (cx - b.left - (b.width - W * s) / 2) / s, y: (cy - b.top - (b.height - H * s) / 2) / s };
  };
  const move = (e: React.PointerEvent) => {
    if (tracker.state.source === "camera") return;
    const p = fromClient(e.clientX, e.clientY);
    if (p) target.current = p;
  };
  usePresenceEvent("change", (s) => {
    if (s.source !== "camera" || foundRef.current) return;
    target.current = s.hand
      ? { x: W / 2 + s.hand.x * (W / 2), y: H / 2 + s.hand.y * (H / 2) }
      : { x: W / 2 - s.headX * 300, y: H / 2 + s.headY * 220 };
    setSteer(s.hand ? "hand" : "head");
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
        const nx = lens.current.x + (target.current.x - lens.current.x) * k;
        const ny = lens.current.y + (target.current.y - lens.current.y) * k;
        const speed = Math.hypot(nx - lens.current.x, ny - lens.current.y) / Math.max(dt, 0.001);
        lens.current = { x: Math.max(0, Math.min(W, nx)), y: Math.max(0, Math.min(H, ny)) };
        const want = Math.min(1, speed / BLUR_SPEED);
        // blurs at once when moving, comes into focus slowly when still
        blur.current += (want - blur.current) * (want > blur.current ? 0.5 : 1 - Math.pow(0.08, dt));
        r.set("lensX", lens.current.x);
        r.set("lensY", lens.current.y);
        r.set("blur", blur.current);
        const { x, y } = lens.current;
        const hit = WINDOWS.find((w) => x > w.x - LENS_HIT && x < w.x + WIN.w + LENS_HIT && y > w.y - LENS_HIT && y < w.y + WIN.h + LENS_HIT);
        setOver(hit?.key ?? null);
        setFocused(blur.current < FOCUS_BELOW);
      }
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
          if (!dead && Math.random() > PING_MISS) {
            const c = centre(TARGET);
            const d = Math.hypot(lens.current.x - c.x, lens.current.y - c.y);
            const near = Math.max(0, 1 - d / 520);
            pingAt(0.1 + 0.75 * near * near, Math.max(-1, Math.min(1, (c.x - lens.current.x) / 260)));
            glow.current = 1;
          }
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
    r.set("found", 1);
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
        {!camera
          ? "move the mouse to look, hold still to focus"
          : steer === "hand"
            ? "your hand moves the binoculars · hold still to focus"
            : "raise your hand to move the binoculars, or turn your head"}
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
