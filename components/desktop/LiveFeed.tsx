"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { scanRive, useMountedRive } from "@/lib/rive/persistent";
import { clock } from "@/lib/story/time";
import styles from "./reveal.module.css";

// The end of S9: "View live" on the camera in flat 4A, and it is the user. The webcam frame
// (already running for the tracking, never stored or sent) is mirrored and turned into a
// 1-bit cyan surveillance image: ordered dither, scanlines, rows that tear. Without a
// camera, the guessed head from S1 is shown instead, following the mouse.

const W = 200; // processed resolution: coarse on purpose, scaled up with hard pixels
const H = 150;
// 4x4 Bayer matrix, thresholds 0..1
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const CYAN = [0, 240, 255];

export default function LiveFeed() {
  const { tracker, video } = usePresence();
  const [live] = useState(() => tracker.state.source === "camera" && !!video()?.srcObject);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!live) return;
    const el = video();
    const out = canvas.current?.getContext("2d");
    if (!el || !out) throw new Error("live feed: video or canvas missing");
    const src = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!src) throw new Error("live feed: no 2D context");
    src.canvas.width = W;
    src.canvas.height = H;
    const frame = out.createImageData(W, H);
    let raf = 0;
    let t = 0;
    const draw = () => {
      t++;
      // mirrored, like a selfie: the user sees their own movements the right way round
      src.setTransform(-1, 0, 0, 1, W, 0);
      src.drawImage(el, 0, 0, W, H);
      const px = src.getImageData(0, 0, W, H).data;
      const o = frame.data;
      // a few rows slip sideways now and then
      const tearRow = t % 23 < 3 ? Math.floor(Math.random() * H) : -1;
      for (let y = 0; y < H; y++) {
        const shift = Math.abs(y - tearRow) < 6 ? 14 : 0;
        const scan = y % 2 ? 0.72 : 1;
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1, x + shift);
          const i = (y * W + sx) * 4;
          const lum = (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
          const lit = Math.min(1, (lum - 0.12) * 1.6) > BAYER[(y % 4) * 4 + (x % 4)];
          const j = (y * W + x) * 4;
          o[j] = lit ? CYAN[0] : 0;
          o[j + 1] = lit ? CYAN[1] * scan : 6;
          o[j + 2] = lit ? CYAN[2] * scan : 12;
          o[j + 3] = 255;
        }
      }
      out.putImageData(frame, 0, 0);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, video]);

  // no camera: the guessed head, turning with the mouse
  const scanHost = useRef<HTMLDivElement>(null);
  useMountedRive(scanHost, scanRive);
  useEffect(() => {
    if (live) return;
    const s = scanRive();
    s.set("mode", 1);
    s.set("sweep", -1.3);
    s.set("reveal", 1);
    s.set("spin", 0);
  }, [live]);
  usePresenceEvent("change", (p) => {
    if (live) return;
    scanRive().set("yaw", p.headX * 0.6);
    scanRive().set("pitch", p.headY * 0.35);
  });

  return (
    <div className={styles.feed}>
      {live ? (
        <canvas ref={canvas} width={W} height={H} className={styles.feedCanvas} aria-label="live camera, flat 4A" />
      ) : (
        <div ref={scanHost} className={styles.feedScan} />
      )}
      <div className={styles.hud} aria-hidden="true">
        <span className={styles.hudTop}>
          <b>● LIVE</b> · 17 HARROW ST · FLAT 4A · CAM 2
        </span>
        <span className={styles.hudBottom}>
          {live ? "subject: operator" : "subject: operator · signal reconstructed"} · {clock(now, true)}
        </span>
        <i className={styles.bracket} />
      </div>
    </div>
  );
}
