"use client";

import { useEffect, useRef, useState } from "react";
import { Figure3D } from "@/lib/figure3d";

// Test bench for the S9 figure (lib/figure3d.ts): the lit window and the figure in it, with
// sliders for the head and the hand. `?arm=1.1,0.1&head=0.2` sets them from the address.
export default function FigureLab() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [v, setV] = useState({ headX: 0, headY: 0, armX: 1.1, armY: 0.1, raised: true });
  // from the address once mounted (reading it while rendering would not match the server)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const arm = q.get("arm") ?? "1.1,0.1";
    const [ax, ay] = arm === "none" ? [1.1, 0.1] : arm.split(",").map(Number);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setV({ headX: Number(q.get("head") ?? 0), headY: 0, armX: ax, armY: ay, raised: arm !== "none" });
  }, []);
  const live = useRef(v);
  useEffect(() => {
    live.current = v;
  }, [v]);

  useEffect(() => {
    const el = canvas.current!;
    const fig = new Figure3D(el);
    let raf = 0;
    void fig.load();
    (window as unknown as { figure?: Figure3D }).figure = fig; // for inspection from the console
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const s = live.current;
      const h = el.clientHeight * 0.9;
      const w = (h * 60) / 124;
      fig.render(
        { x: (el.clientWidth - w) / 2, y: el.clientHeight * 0.05, w, h },
        { headX: s.headX, headY: s.headY, arm: s.raised ? { x: s.armX, y: s.armY } : null },
      );
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fig.dispose();
    };
  }, []);

  const slider = (key: "headX" | "headY" | "armX" | "armY", min: number, max: number) => (
    <label style={{ display: "grid", gap: 2 }}>
      {key} {v[key].toFixed(2)}
      <input type="range" min={min} max={max} step={0.01} value={v[key]} onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })} />
    </label>
  );

  return (
    <main style={{ position: "fixed", inset: 0, background: "#1b1d22", color: "#ccc", font: "12px monospace" }}>
      {/* the lit room behind the glass, roughly as in S9 */}
      <div
        style={{
          position: "absolute", left: "50%", top: "5%", height: "90%", aspectRatio: "60 / 124", transform: "translateX(-50%)",
          background: "radial-gradient(circle at 55% 12%, #e9eef5, #9aa6b4 45%, #5b6470)",
        }}
      />
      <canvas ref={canvas} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div style={{ position: "absolute", left: 16, top: 16, display: "grid", gap: 8, width: 200 }}>
        {slider("headX", -1, 1)}
        {slider("headY", -1, 1)}
        {slider("armX", -3, 3)}
        {slider("armY", -2, 5)}
        <label>
          <input type="checkbox" checked={v.raised} onChange={(e) => setV({ ...v, raised: e.target.checked })} /> hand tracked
        </label>
      </div>
    </main>
  );
}
