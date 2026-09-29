"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { phonePing } from "@/lib/audio/sfx";
import { usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import styles from "./locate.module.css";

// The interlude before the reveal: the case seems to go back to E.V. Her phone is online
// again, in flat 4A across the road, the empty one. The dot drifts a little when the
// user moves (nobody says why). "Play sound" pings in the user's own headphones.
// "View live" starts the reveal (useReveal in Desktop.tsx).

const HOUSES = [11, 13, 15, 17, 19, 21];
const HOME = [10, 12, 14, 16, 18, 20];

export default function Locate() {
  const { dispatch } = useStory();
  const dot = useRef<SVGGElement>(null);
  const [since, setSince] = useState(0);
  const [pinged, setPinged] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setSince((s) => s + 1), 1000);
    return () => clearInterval(t);
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
      onUpdate: () => dot.current?.setAttribute("transform", `translate(${pos.current.x} ${pos.current.y})`),
    });
  });

  const ping = () => {
    phonePing();
    setPinged(true);
  };

  return (
    <div className={styles.locate}>
      <svg className={styles.map} viewBox="0 0 420 240" aria-label="Map: Harrow Street. E.V.'s phone is in number 17, across from her flat">
        <rect width="420" height="240" className={styles.ground} />
        {/* the terraces either side of the street */}
        {HOUSES.map((n, i) => (
          <g key={n}>
            <rect x={18 + i * 66} y={30} width={60} height={62} className={n === 17 ? styles.target : styles.house} />
            <text x={48 + i * 66} y={24} className={styles.num}>{n}</text>
          </g>
        ))}
        <rect x="0" y="104" width="420" height="34" className={styles.street} />
        <text x="210" y="125" className={styles.streetName}>HARROW ST</text>
        {HOME.map((n, i) => (
          <g key={n}>
            <rect x={18 + i * 66} y={150} width={60} height={62} className={n === 16 ? styles.home : styles.house} />
            <text x={48 + i * 66} y={228} className={styles.num}>{n}</text>
          </g>
        ))}
        <text x="246" y="186" className={styles.homeLabel}>E.V. · home</text>
        {/* the phone: accuracy halo and a pulsing dot on number 17, flat 4A */}
        <g ref={dot}>
          <circle cx="246" cy="60" r="26" className={styles.halo} />
          <circle cx="246" cy="60" r="12" className={styles.pulse} />
          <circle cx="246" cy="60" r="5" className={styles.dot} />
        </g>
      </svg>

      <div className={styles.info}>
        <p className={styles.device}>E.V.&apos;s iPhone</p>
        <p>17 Harrow St · flat 4A</p>
        <p className={styles.meta}>online · located {since < 5 ? "just now" : `${since}s ago`} · accuracy 5 m</p>
        <p className={styles.meta}>battery 12%</p>
        {pinged && <p className={styles.meta}>sound played · no one picked it up</p>}
        <div className={styles.actions}>
          <button className={styles.button} onClick={ping}>
            Play sound
          </button>
          <button className={`${styles.button} ${styles.primary}`} onClick={() => dispatch({ type: "clue", id: "look_live" })}>
            View live
          </button>
        </div>
      </div>
    </div>
  );
}
