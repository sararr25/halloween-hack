"use client";

import { useEffect, useRef, useState } from "react";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { scanRive, useMountedRive } from "@/lib/rive/persistent";
import { clock } from "@/lib/story/time";
import { useStory } from "@/lib/story/store";
import { caseId } from "@/lib/story/caseno";
import styles from "./reveal.module.css";

// The end of S9: "View live" on the camera in flat 4A, and it is the user. The webcam frame
// (already running for the tracking, never stored or sent) becomes a CCTV feed in the
// Black Mirror register: mirrored, grey and cold, crushed contrast, grain, interlaced lines,
// a colour fringe at the edges, a vignette, a band that rolls down and rows that tear, and a
// face-recognition box that locks onto the real face. Without a camera, the guessed head
// from S1 is shown instead, following the mouse.

const W = 320; // processed resolution: coarse enough to feel like a cheap camera
const H = 240;

export default function LiveFeed() {
  const { tracker, video } = usePresence();
  const id = caseId(useStory().state.caseNo);
  const [live] = useState(() => tracker.state.source === "camera" && !!video()?.srcObject);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // the face box follows the real face: the tracker keeps its bounds while points are asked for
  const box = useRef<HTMLDivElement>(null);
  const match = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!live) return;
    return tracker.onPoints(() => {});
  }, [live, tracker]);

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
    // vignette, once
    const vig = new Float32Array(W * H);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const dx = x / W - 0.5;
        const dy = y / H - 0.5;
        vig[y * W + x] = Math.max(0, 1 - 1.5 * (dx * dx + dy * dy));
      }
    let raf = 0;
    let t = 0;
    let held = 0; // frames the image stays frozen (a dropped signal)
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t++;
      placeBox();
      if (held > 0) {
        held--;
        return;
      }
      if (Math.random() < 0.004) held = 6;
      // mirrored, like a selfie: the user sees their own movements the right way round
      src.setTransform(-1, 0, 0, 1, W, 0);
      src.drawImage(el, 0, 0, W, H);
      const px = src.getImageData(0, 0, W, H).data;
      const o = frame.data;
      const tearRow = t % 47 < 3 ? Math.floor(Math.random() * H) : -99;
      const roll = (t * 1.3) % (H * 3); // a brighter band crawling down, now and then on screen
      for (let y = 0; y < H; y++) {
        const shift = Math.abs(y - tearRow) < 5 ? 10 + Math.floor(Math.random() * 6) : 0;
        const line = y % 2 ? 0.74 : 1;
        const band = Math.abs(y - roll) < 7 ? 1.18 : 1;
        for (let x = 0; x < W; x++) {
          const sx = Math.min(W - 1, x + shift);
          const lum = (i: number) => (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255;
          const c = lum((y * W + sx) * 4);
          // colour fringe: red a little right, blue a little left, stronger at the edges
          const edge = Math.abs(x / W - 0.5) > 0.3 ? 2 : 1;
          const r = lum((y * W + Math.min(W - 1, sx + edge)) * 4);
          const b = lum((y * W + Math.max(0, sx - edge)) * 4);
          const k = vig[y * W + x] * line * band;
          const g = (Math.random() - 0.5) * 0.16;
          // crushed blacks, cold greys
          const curve = (v: number) => Math.min(1, Math.max(0, (v - 0.08) * 1.45 + g)) * k;
          const j = (y * W + x) * 4;
          o[j] = curve(r) * 205;
          o[j + 1] = curve(c) * 222;
          o[j + 2] = curve(b) * 236;
          o[j + 3] = 255;
        }
      }
      out.putImageData(frame, 0, 0);
    };
    // the canvas is drawn "cover": the same mapping places the box over the face
    const placeBox = () => {
      const f = tracker.faceBox;
      const b = box.current;
      if (!b) return;
      if (!f) {
        b.style.opacity = "0";
        return;
      }
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const sc = Math.max(vw / W, vh / H);
      const ox = (vw - W * sc) / 2;
      const oy = (vh - H * sc) / 2;
      const pad = 0.18;
      const x = 1 - (f.x + f.w) - f.w * pad; // mirrored
      const y = f.y - f.h * pad;
      Object.assign(b.style, {
        opacity: "1",
        left: `${ox + x * W * sc}px`,
        top: `${oy + y * H * sc}px`,
        width: `${f.w * (1 + 2 * pad) * W * sc}px`,
        height: `${f.h * (1 + 2 * pad) * H * sc}px`,
      });
      if (match.current && t % 9 === 0) match.current.textContent = (97.4 + Math.random() * 2.2).toFixed(1);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [live, video, tracker]);

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
      {live && (
        <div ref={box} className={styles.faceBox} aria-hidden="true">
          <span>
            ID {id} · OPERATOR · MATCH <span ref={match}>98.1</span>%
          </span>
        </div>
      )}
      <div className={styles.hud} aria-hidden="true">
        <span className={styles.hudTop}>
          <b>●</b> LIVE · CAM 2 · 17 HARROW ST · FLAT 4A
        </span>
        <span className={styles.hudRight}>{new Date(now).toLocaleDateString("en-GB").replaceAll("/", ".")} {clock(now, true)}</span>
        <span className={styles.hudBottom}>
          {live ? `subject ${id} · operator · recording` : `subject ${id} · operator · signal reconstructed`}
        </span>
        {!live && <i className={styles.bracket} />}
      </div>
    </div>
  );
}
