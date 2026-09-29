"use client";

import { useRef, useState } from "react";
import { scanRive, useMountedRive } from "@/lib/rive/persistent";

const CONTROLS = [
  ["sweep", -1.3, 1.3, -1.3],
  ["reveal", 0, 1, 1],
  ["mode", 0, 1, 1],
  ["spin", 0, 1, 1],
  ["yaw", -1, 1, 0],
  ["pitch", -1, 1, 0],
] as const;

/** Sliders for every scan/* value. Without camera there are no real points: use mode 1. */
export default function ScanBench() {
  const host = useRef<HTMLDivElement>(null);
  useMountedRive(host, scanRive);
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(CONTROLS.map(([k, , , v]) => [k, v])),
  );
  const set = (k: string, v: number) => {
    scanRive().set(k, v);
    setValues((s) => ({ ...s, [k]: v }));
  };

  return (
    <main style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 24, padding: 24, minHeight: "100vh" }}>
      <div style={{ display: "grid", gap: 12, alignContent: "start", fontFamily: "monospace", fontSize: 12 }}>
        {CONTROLS.map(([k, min, max]) => (
          <label key={k} style={{ display: "grid", gap: 4 }}>
            {k} {values[k].toFixed(2)}
            <input
              type="range"
              min={min}
              max={max}
              step={0.01}
              value={values[k]}
              onChange={(e) => set(k, Number(e.target.value))}
              ref={(el) => {
                if (el) scanRive().set(k, values[k]);
              }}
            />
          </label>
        ))}
      </div>
      <div ref={host} style={{ width: 400, aspectRatio: "480 / 576", outline: "1px solid #333" }} />
    </main>
  );
}
