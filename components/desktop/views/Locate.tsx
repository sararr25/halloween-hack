"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { blip, creepyMessage, key } from "@/lib/audio/sfx";
import { breath, pingAt } from "@/lib/audio/dread";
import { usePresenceEvent } from "@/lib/presence/context";
import { glitchNow } from "@/lib/story/glitch";
import { usePost, useStory } from "@/lib/story/store";
import Facade from "./Facade";
import styles from "./locate.module.css";

// The interlude before the reveal: the case seems to go back to E.V. Her phone is online
// again, across the road. Drawn like the real Find My (dark map, devices on the left): this
// Mac is at number 16, her flat, and her phone is 20 m away at number 17. The phone drifts
// a little when the user moves (nobody says why). The player has to act (owner playtest,
// docs/plan-round7.md §6):
//  1. "Play Sound": the ping is not across the road, it is behind you, coming closer. The
//     distance counts down by itself and the pin crosses the road onto This Mac. 0 m.
//  2. "Mark As Lost": a message for the lock screen. The phone writes back.
//  3. The pin goes back to no. 17. "View live" opens the building (Facade.tsx), where the
//     flat is found by ear; finding it starts the reveal (useReveal in Desktop.tsx).

// Harrow St runs across the map; terraced houses both sides, odd numbers north.
const ROAD = { y: 250, h: 22 };
const LOT = 19;
const ROW_X = 142;
const LOTS = 17;
const house = (n: number) => {
  const odd = n % 2 === 1;
  const i = odd ? (n - 1) / 2 : (n - 2) / 2;
  const x = ROW_X + i * LOT + (odd ? 0 : 9);
  return { x, y: odd ? ROAD.y - 36 : ROAD.y + ROAD.h + 2, cx: x + (LOT - 1) / 2 };
};
const PHONE = { x: house(17).cx, y: house(17).y + 16 };
const MAC = { x: house(16).cx, y: house(16).y + 18 };

// the blocks around, as plain footprints (x, y, w, h)
const BLOCKS: [number, number, number, number][] = [
  [10, 70, 50, 38], [66, 70, 42, 60], [10, 114, 50, 44], [10, 164, 98, 62],
  [10, 290, 60, 40], [76, 290, 32, 70], [10, 336, 60, 52], [10, 396, 98, 36],
  [500, 290, 56, 44], [562, 290, 68, 30], [500, 340, 130, 46], [500, 392, 70, 40], [576, 326, 54, 60],
  [150, 70, 60, 40], [216, 70, 48, 52], [270, 70, 90, 30], [270, 106, 40, 40], [316, 106, 44, 26],
  [150, 116, 110, 50], [370, 70, 90, 60], [370, 136, 90, 30],
  [150, 330, 70, 50], [226, 330, 50, 34], [282, 330, 90, 44], [378, 330, 82, 60], [150, 386, 120, 46], [276, 380, 90, 52],
];

type Device = { id: string; name: string; where: string; when: string; far?: string; glyph: "phone" | "laptop" | "buds" };
const DEVICES: Device[] = [
  { id: "iphone", name: "E.V.'s iPhone", where: "17 Harrow St", when: "Now", glyph: "phone" },
  { id: "mac", name: "E.V.'s MacBook Pro", where: "This Mac", when: "With you", glyph: "laptop" },
  { id: "buds", name: "E.V.'s AirPods", where: "No location found", when: "7 days ago", glyph: "buds" },
];

function Glyph({ kind }: { kind: Device["glyph"] }) {
  if (kind === "phone") return <path d="M-4 -7h8a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-8a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1-4-7zM-1.5 4.5h3" />;
  if (kind === "laptop") return <path d="M-6 -5h12v8h-12zM-8 4.5h16" />;
  return <path d="M-4 -5a2 2 0 0 1 2 2v7M4 -5a2 2 0 0 0-2 2v7" />;
}

// It comes to you: metres, how far left the ping sits (behind you, then centred)
const APPROACH: [number, number][] = [
  [20, -0.9],
  [12, -0.75],
  [6, -0.5],
  [2, -0.2],
  [0, 0],
];
const APPROACH_STEP_MS = 1700;
const REPLY_EVERY_MS = 2300;

type Step = "map" | "coming" | "here" | "lost" | "reply" | "back" | "live";
// one instruction at a time, numbered (owner playtest, round 8: it was unclear what to do)
const GUIDE: Record<Exclude<Step, "live">, [string, string]> = {
  map: ["1 / 3", "Press Play Sound and listen. Where is it ringing?"],
  coming: ["1 / 3", "Listen. It's moving."],
  here: ["2 / 3", "It's here, with you. Mark the phone as lost."],
  lost: ["2 / 3", "Write a message for whoever has it, then Send."],
  reply: ["2 / 3", "Someone is answering."],
  back: ["3 / 3", "Press View live and find her flat across the road."],
};

export default function Locate() {
  const { dispatch } = useStory();
  const post = usePost();
  const pin = useRef<SVGGElement>(null);
  const travel = useRef<SVGGElement>(null);
  const view = useRef<SVGGElement>(null);
  const [since, setSince] = useState(0);
  const [step, setStep] = useState<Step>("map");
  const [metres, setMetres] = useState(20);
  const [message, setMessage] = useState("");
  const [replies, setReplies] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSince((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // the map flies in on the phone, as the real one does when a device is found
  useEffect(() => {
    const g = view.current;
    if (!g || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = gsap.fromTo(
      g,
      { scale: 0.55, x: 140, y: 60, svgOrigin: `${PHONE.x} ${PHONE.y}` },
      { scale: 1, x: 0, y: 0, duration: 1.6, ease: "power3.inOut" },
    );
    return () => void t.kill();
  }, []);

  // the phone moves when you move, a few pixels, a little late
  const pos = useRef({ x: 0, y: 0 });
  usePresenceEvent("change", (s) => {
    gsap.to(pos.current, {
      x: s.headX * 5,
      y: s.headY * 3,
      duration: 0.8,
      ease: "power2.out",
      overwrite: true,
      onUpdate: () => pin.current?.setAttribute("transform", `translate(${pos.current.x} ${pos.current.y})`),
    });
  });

  // the pin crossing the road: 0 = at no. 17, 1 = on This Mac
  const cross = (k: number, seconds: number) => {
    const to = { x: (MAC.x - PHONE.x) * k, y: (MAC.y - PHONE.y) * k };
    gsap.to(travel.current, { attr: { transform: `translate(${to.x} ${to.y})` }, duration: seconds, ease: "power2.inOut" });
  };

  // 1 · Play Sound: it is behind you, and coming
  const ping = () => {
    dispatch({ type: "clue", id: "locate_ping" });
    setStep("coming");
    APPROACH.forEach(([m, pan], i) =>
      setTimeout(() => {
        setMetres(m);
        pingAt(0.35 + (0.65 * i) / (APPROACH.length - 1), pan);
        cross(1 - m / 20, 1.2);
        if (m === 0) {
          glitchNow(0.8);
          setTimeout(breath, 500);
          setStep("here");
          post(
            { from: "anon", text: "…it isn't across the road any more." },
            { text: "Find My · mark her phone as lost", until: (c) => "locate_lost" in c },
          );
        }
      }, 300 + i * APPROACH_STEP_MS),
    );
  };

  // 2 · Mark As Lost: whatever is written, the phone answers
  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    dispatch({ type: "clue", id: "locate_lost" });
    setStep("reply");
    const lines = ["i can see you typing.", "you write like she did.", "i'm not behind you. look across the road."];
    lines.forEach((line, i) => {
      setTimeout(() => setTyping(true), 600 + i * REPLY_EVERY_MS);
      setTimeout(
        () => {
          setTyping(false);
          setReplies((r) => [...r, line]);
          if (i === lines.length - 1) creepyMessage();
          else blip();
        },
        600 + i * REPLY_EVERY_MS + 1400,
      );
    });
    const back = 600 + lines.length * REPLY_EVERY_MS + 600;
    setTimeout(() => {
      cross(0, 1.4);
      setMetres(20);
      setStep("back");
      post(
        { from: "anon", text: "…17 Harrow St. Look at it. Listen." },
        { text: "Find My · View live, then find her flat by ear", until: (c) => "look_live" in c },
      );
    }, back);
  };

  if (step === "live") return <Facade />;

  const located = since < 5 ? "Now" : `${since} seconds ago`;
  const here = step === "here" || step === "lost" || step === "reply";
  const where = here ? "This Mac" : "17 Harrow St";
  const far = metres === 0 ? "with you" : `${metres} m`;

  return (
    <div className={styles.locate}>
      <aside className={styles.side}>
        <div className={styles.tabs} aria-hidden="true">
          <span>People</span>
          <span className={styles.tabOn}>Devices</span>
          <span>Items</span>
        </div>
        <ul className={styles.list}>
          {DEVICES.map((d) => (
            <li key={d.id} className={d.id === "iphone" ? styles.selected : undefined}>
              <svg className={styles.icon} viewBox="-12 -12 24 24" aria-hidden="true">
                <circle r="11" />
                <Glyph kind={d.glyph} />
              </svg>
              <span className={styles.what}>
                <b>{d.name}</b>
                <small>
                  {d.id === "iphone" ? `${where} · ${located}` : `${d.where} · ${d.when}`}
                </small>
              </span>
              {d.id === "iphone" && <small className={`${styles.far} ${metres < 20 ? styles.close : ""}`}>{far}</small>}
            </li>
          ))}
        </ul>

        <div className={styles.card}>
          <p className={styles.guide} aria-live="polite">
            <span>{GUIDE[step][0]}</span>
            {GUIDE[step][1]}
          </p>
          <b>E.V.&apos;s iPhone</b>
          <small>{here ? "This Mac · 0 m" : "17 Harrow St · flat unknown"}</small>
          <small>
            {located} · accuracy 5 m · <span className={styles.battery}>12%</span>
          </small>
          {step === "map" && (
            <div className={styles.actions}>
              <button className={`${styles.button} ${styles.primary} ${styles.wide}`} onClick={ping}>
                Play Sound
              </button>
            </div>
          )}
          {step === "coming" && <small className={styles.coming}>Playing sound… {far}</small>}
          {step === "here" && (
            <div className={styles.actions}>
              <button className={`${styles.button} ${styles.danger} ${styles.wide}`} onClick={() => setStep("lost")}>
                Mark As Lost
              </button>
            </div>
          )}
          {step === "lost" && (
            <form className={styles.lost} onSubmit={send}>
              <small>Enter a message to show on the lock screen.</small>
              <textarea
                value={message}
                autoFocus
                rows={3}
                maxLength={120}
                onChange={(e) => {
                  key();
                  setMessage(e.target.value);
                }}
                aria-label="Message for the lock screen"
              />
              <button className={`${styles.button} ${styles.primary}`} disabled={!message.trim()}>
                Send
              </button>
            </form>
          )}
          {(step === "reply" || step === "back") && (
            <div className={styles.thread} aria-live="polite">
              <p className={styles.mine}>{message.trim()}</p>
              {replies.map((r) => (
                <p key={r} className={styles.theirs}>
                  {r}
                </p>
              ))}
              {typing && <p className={styles.theirs}>…</p>}
            </div>
          )}
          {step === "back" && (
            <div className={styles.actions}>
              <button className={`${styles.button} ${styles.primary} ${styles.wide}`} onClick={() => setStep("live")}>
                View live
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className={styles.mapWrap}>
        <svg
          className={styles.map}
          viewBox="100 80 470 366"
          preserveAspectRatio="xMidYMid slice"
          aria-label="Map: Harrow Street. This Mac is at number 16. E.V.'s iPhone is across the road, at number 17."
        >
          <rect x="-400" y="-300" width="1440" height="1080" className={styles.land} />
          <g ref={view}>
            <rect x="-400" y="-300" width="1440" height="1080" className={styles.land} />
            {/* the canal to the south, the gardens to the north-east */}
            <path d="M-400 452 C 120 438, 360 470, 1040 446 L 1040 780 L -400 780 Z" className={styles.water} />
            <text x="330" y="444" className={styles.waterName}>Regent&apos;s Canal</text>
            <rect x="500" y="66" width="130" height="160" rx="6" className={styles.park} />
            <path d="M510 210 C 540 170, 590 150, 622 80" className={styles.parkPath} />
            <text x="540" y="150" className={styles.parkName}>Harrow Gardens</text>

            {BLOCKS.map(([x, y, w, h], i) => (
              <rect key={i} x={x} y={y} width={w} height={h} rx="1.5" className={styles.building} />
            ))}

            {/* back gardens, then the terraces facing each other */}
            <rect x={ROW_X} y={ROAD.y - 70} width={LOTS * LOT} height={32} className={styles.garden} />
            <rect x={ROW_X + 9} y={ROAD.y + ROAD.h + 40} width={LOTS * LOT} height={30} className={styles.garden} />
            {Array.from({ length: LOTS }, (_, i) => [2 * i + 1, 2 * i + 2])
              .flat()
              .map((n) => {
                const h = house(n);
                return (
                  <rect key={n} x={h.x} y={h.y} width={LOT - 1.5} height={36} className={n === 16 || n === 17 ? styles.buildingMark : styles.building} />
                );
              })}
            {[14, 15, 16, 17, 18, 19].map((n) => (
              <text key={n} x={house(n).cx} y={house(n).y + (n % 2 ? 10 : 30)} className={styles.houseNum}>
                {n}
              </text>
            ))}

            {/* roads: the side streets first, then the street itself */}
            <rect x="-400" y="46" width="1440" height="14" className={styles.road} />
            <rect x="-400" y="434" width="1440" height="12" className={styles.road} />
            <rect x="116" y="-300" width="18" height="760" className={styles.road} />
            <rect x="472" y="-300" width="18" height="760" className={styles.road} />
            <rect x="-400" y={ROAD.y} width="1440" height={ROAD.h} className={styles.roadMain} />
            <text x="420" y={ROAD.y + 14.5} className={styles.roadName}>Harrow St</text>
            <text x="160" y={ROAD.y + 14.5} className={styles.roadName}>Harrow St</text>
            <text x="300" y="57" className={styles.roadName}>Carlton Rd</text>
            <text x="125" y="150" className={styles.roadName} transform="rotate(-90 125 150)">Aldine Rd</text>
            <text x="481" y="360" className={styles.roadName} transform="rotate(-90 481 360)">Mercer St</text>
            <circle cx="214" cy={ROAD.y - 5} r="3" className={styles.poi} />
            <text x="220" y={ROAD.y - 2.5} className={styles.poiName}>bus stop</text>

            {/* this Mac: the blue dot, at her flat */}
            <circle cx={MAC.x} cy={MAC.y} r="9" className={styles.meHalo} />
            <circle cx={MAC.x} cy={MAC.y} r="4.5" className={styles.me} />
            <text x={MAC.x} y={MAC.y + 22} className={styles.pinName}>This Mac</text>

            {/* the phone: accuracy circle and the device bubble on number 17 */}
            <g ref={travel} transform="translate(0 0)">
            <g ref={pin}>
              <circle cx={PHONE.x} cy={PHONE.y} r="26" className={styles.accuracy} />
              <circle cx={PHONE.x} cy={PHONE.y} r="10" className={styles.pulse} />
              <g transform={`translate(${PHONE.x} ${PHONE.y - 24})`}>
                <path d="M0 17 L-5 9 L5 9 Z" className={styles.bubble} />
                <circle r="13" className={styles.bubble} />
                <g className={styles.bubbleGlyph}>
                  <Glyph kind="phone" />
                </g>
              </g>
            </g>
            </g>
          </g>
        </svg>
        <span className={styles.controls} aria-hidden="true">
          <i>+</i>
          <i>−</i>
        </span>
        <span className={styles.compass} aria-hidden="true">N</span>
        <span className={styles.legal} aria-hidden="true">Legal</span>
      </div>
    </div>
  );
}
