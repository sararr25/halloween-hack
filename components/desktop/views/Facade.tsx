"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { breath, pingAt } from "@/lib/audio/dread";
import { lightSwitch, subThud } from "@/lib/audio/sfx";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { glitchNow } from "@/lib/story/glitch";
import { usePost, useStory } from "@/lib/story/store";
import styles from "./facade.module.css";

// Find My's "View live", Rear Window style (docs/plan-round7.md §6.3). The front of 17
// Harrow St at night, seen through binoculars: the lens follows the mouse (or the head,
// with the camera on) and everything outside it is dark. E.V.'s phone keeps pinging, louder
// and more centred the closer the lens is to 4A, so the flat is found by ear. Resting on a
// wrong window shows that flat's night in one line; in 2B someone stands with their back to
// the street and turns round when the lens finds them. Holding the lens on 4A: its light
// stutters on, a figure has its hand raised, and the reveal starts (look_live).

const W = 800;
const H = 520;
const WIN = { w: 92, h: 78 };
const COLS = [262, 446];
const FLOORS: Record<number, number> = { 4: 64, 3: 168, 2: 272, 1: 376 };
type Flat = { id: string; x: number; y: number; lit: boolean };
const NIGHTS: Record<string, string> = {
  "4A": "4A · no one. The phone is ringing in there.",
  "4B": "4B · a man asleep in front of the TV",
  "3A": "3A · nobody home. A cat on the sofa, looking at you.",
  "3B": "3B · curtains drawn",
  "2A": "2A · a kitchen, the radio on",
  "2B": "2B · someone standing very still",
  "1A": "1A · the hallway. The stairs go up.",
  "1B": "1B · a woman reading. She looks up. No.",
};
const FLATS: Flat[] = [4, 3, 2, 1].flatMap((floor) =>
  ["A", "B"].map((side, i) => {
    const id = `${floor}${side}`;
    return { id, x: COLS[i], y: FLOORS[floor], lit: !["4A", "3B", "1A"].includes(id) };
  }),
);
const TARGET = FLATS.find((f) => f.id === "4A")!;
const centre = (f: Flat) => ({ x: f.x + WIN.w / 2, y: f.y + WIN.h / 2 });
const LENS_R = 58;
// binoculars: two lenses side by side, touching (overlapping, their rims crossed in the middle)
const LENS_DX = LENS_R;
const DWELL_MS = 900;
const FIND_MS = 1500;
// after the light comes on, how long the figure is seen before the reveal starts
const FOUND_HOLD_MS = 2600;
const NUDGES: [number, string, string][] = [
  [40_000, "…listen. it rings where she is.", "17 Harrow St · follow the ringing"],
  [80_000, "…top floor. On the left.", "17 Harrow St · top floor, left"],
];

export default function Facade() {
  const { dispatch } = useStory();
  const post = usePost();
  const { tracker } = usePresence();
  const svg = useRef<SVGSVGElement>(null);
  const holes = useRef<SVGGElement>(null);
  const rims = useRef<SVGGElement>(null);
  const lens = useRef({ x: W / 2, y: H - 80 });
  const lastPointer = useRef(0);
  const [over, setOver] = useState<string | null>(null);
  const [caption, setCaption] = useState<string | null>(null);
  const [turned, setTurned] = useState(false);
  const [found, setFound] = useState(false);
  const foundRef = useRef(false);

  // the lens is moved on the DOM directly (every frame); React only hears which window it is on
  const place = () => {
    const { x, y } = lens.current;
    holes.current?.setAttribute("transform", `translate(${x} ${y})`);
    rims.current?.setAttribute("transform", `translate(${x} ${y})`);
    const hit = FLATS.find((f) => x > f.x - 14 && x < f.x + WIN.w + 14 && y > f.y - 14 && y < f.y + WIN.h + 14);
    setOver(hit?.id ?? null);
  };

  // the lens: the mouse, or the head when the mouse has been still and the camera is on
  const move = (e: React.PointerEvent) => {
    const m = svg.current?.getScreenCTM();
    if (!m) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    lens.current = { x: p.x, y: p.y };
    lastPointer.current = Date.now();
    place();
  };
  usePresenceEvent("change", (s) => {
    if (s.source !== "camera" || Date.now() - lastPointer.current < 1500 || foundRef.current) return;
    lens.current = { x: W / 2 - s.headX * 300, y: H / 2 + s.headY * 220 };
    place();
  });
  useEffect(place, []);

  // the phone, ringing: closer is louder, brighter, faster, and comes from where 4A is
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (foundRef.current) return;
      const c = centre(TARGET);
      const d = Math.hypot(lens.current.x - c.x, lens.current.y - c.y);
      const near = Math.max(0, 1 - d / 520);
      pingAt(near, (c.x - lens.current.x) / 260);
      t = setTimeout(tick, 1500 - 950 * near);
    };
    t = setTimeout(tick, 600);
    return () => clearTimeout(t);
  }, []);

  const find = () => {
    if (foundRef.current) return;
    foundRef.current = true;
    setFound(true);
    setCaption("4A · E.V.'s iPhone");
    // the light in 4A: a tube that will not start, then does
    [0, 260, 520].forEach((ms) => setTimeout(lightSwitch, ms));
    setTimeout(breath, 900);
    setTimeout(() => {
      glitchNow(1);
      dispatch({ type: "clue", id: "look_live" });
    }, FOUND_HOLD_MS);
  };

  // resting on a window: its night, in one line; resting on 4A: found
  useEffect(() => {
    if (!over || found) return;
    const t = [setTimeout(() => setCaption(NIGHTS[over]), DWELL_MS)];
    if (over === TARGET.id) t.push(setTimeout(find, FIND_MS));
    if (over === "2B" && !turned)
      t.push(
        setTimeout(() => {
          setTurned(true);
          subThud(0.8);
          glitchNow(0.4, { sound: false });
        }, 450),
      );
    return () => t.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // the 2B figure turns round: a squash through zero, like a body turning in a doorway
  const figure = useRef<SVGImageElement>(null);
  useEffect(() => {
    if (!turned || !figure.current) return;
    const b = centre(FLATS.find((f) => f.id === "2B")!);
    const tw = gsap.fromTo(
      figure.current,
      { scaleX: 1 },
      { keyframes: { scaleX: [1, 0.08, 1] }, duration: 0.5, ease: "power2.inOut", svgOrigin: `${b.x} ${b.y}` },
    );
    return () => void tw.kill();
  }, [turned]);

  const camera = tracker.state.source === "camera";

  return (
    <div className={styles.facade}>
      <svg
        ref={svg}
        className={styles.view}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid slice"
        onPointerMove={move}
        aria-label="17 Harrow Street at night, through binoculars. Find the flat where her phone is ringing."
      >
        <defs>
          <mask id="facade-lens">
            <rect width={W} height={H} fill="white" />
            <g ref={holes}>
              <circle cx={-LENS_DX} r={LENS_R} fill="black" />
              <circle cx={LENS_DX} r={LENS_R} fill="black" />
            </g>
          </mask>
          <radialGradient id="facade-glow">
            <stop offset="0" stopColor="#e9dcb4" stopOpacity="0.55" />
            <stop offset="1" stopColor="#e9dcb4" stopOpacity="0" />
          </radialGradient>
        </defs>

        <rect width={W} height={H} className={styles.sky} />
        {/* the terrace: brick, a cornice, the door at street level */}
        <rect x="180" y="24" width="440" height="500" className={styles.wall} />
        <rect x="170" y="18" width="460" height="14" className={styles.cornice} />
        {Array.from({ length: 30 }, (_, i) => (
          <line key={i} x1="180" x2="620" y1={36 + i * 16} y2={36 + i * 16} className={styles.brick} />
        ))}
        <rect x="370" y="470" width="60" height="54" className={styles.door} />

        {FLATS.map((f) => (
          <g key={f.id} onClick={() => (f.id === TARGET.id ? find() : setCaption(NIGHTS[f.id]))} className={styles.window}>
            <rect x={f.x - 6} y={f.y - 6} width={WIN.w + 12} height={WIN.h + 12} className={styles.frame} />
            <rect
              x={f.x}
              y={f.y}
              width={WIN.w}
              height={WIN.h}
              className={f.id === TARGET.id ? (found ? styles.lit4a : styles.dark) : f.lit ? styles.lit : styles.dark}
            />
            {f.id === "4B" && <rect x={f.x + 8} y={f.y + 44} width="34" height="22" className={styles.tv} />}
            {f.id === "3A" && <ellipse cx={f.x + 60} cy={f.y + 64} rx="12" ry="6" className={styles.shape} />}
            {f.id === "1B" && <circle cx={f.x + 22} cy={f.y + 30} r="16" fill="url(#facade-glow)" />}
            {f.id === "2B" && (
              <image
                ref={figure}
                href="/figure/body.webp"
                x={f.x + 26}
                y={f.y + 18}
                width="44"
                height="62"
                className={turned ? styles.facing : styles.back}
              />
            )}
            {f.id === TARGET.id && found && <image href="/figure/raise/56.webp" x={f.x + 22} y={f.y + 14} width="52" height="66" />}
            {/* glazing bars */}
            <line x1={f.x + WIN.w / 2} x2={f.x + WIN.w / 2} y1={f.y} y2={f.y + WIN.h} className={styles.bar} />
            <line x1={f.x} x2={f.x + WIN.w} y1={f.y + WIN.h / 2} y2={f.y + WIN.h / 2} className={styles.bar} />
          </g>
        ))}

        {/* the night outside the binoculars */}
        <rect width={W} height={H} className={styles.dim} mask="url(#facade-lens)" />
        <g ref={rims} className={styles.rims}>
          <circle cx={-LENS_DX} r={LENS_R} />
          <circle cx={LENS_DX} r={LENS_R} />
        </g>
      </svg>

      <p className={styles.head}>
        <span className={styles.live}>● LIVE</span> 17 HARROW ST · BUILDING CAM · {camera ? "move your head" : "move the mouse"} to look
      </p>
      {caption && (
        <p key={caption} className={styles.caption} data-found={found}>
          {caption}
        </p>
      )}
    </div>
  );
}
