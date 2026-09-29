"use client";

import { useEffect, useRef, useState } from "react";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

export type FxLevels = { grain: number; vignette: number; glitch: number; neon: number };

const SRC = "/rive/effects.riv";

/**
 * Full-screen WGSL overlay from rive/effects (grain, vignette, glitch tears).
 * The file carries scripts, so it only plays once signed with `pnpm rive:publish`;
 * until public/rive/effects.riv exists this renders nothing.
 */
export default function FxOverlay({ levels }: { levels: FxLevels }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rive = useRef<Rive | null>(null);
  const [available, setAvailable] = useState(false);
  const latest = useRef(levels);

  const apply = () => {
    const vm = rive.current?.viewModelInstance;
    if (!vm) return;
    for (const [key, value] of Object.entries(latest.current)) {
      const prop = vm.number(`fx/${key}`);
      if (prop) prop.value = value;
    }
  };

  useEffect(() => {
    fetch(SRC, { method: "HEAD" })
      .then((r) => setAvailable(r.ok))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    if (!available || !canvas.current) return;
    const r = new Rive({
      src: SRC,
      canvas: canvas.current,
      stateMachine: "Overlay",
      autoplay: true,
      autoBind: true,
      layout: new Layout({ fit: Fit.Cover }),
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();
        apply();
      },
    });
    rive.current = r;
    const resize = () => r.resizeDrawingSurfaceToCanvas();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      r.cleanup();
      rive.current = null;
    };
  }, [available]);

  useEffect(() => {
    latest.current = levels;
    apply();
  });

  if (!available) return null;
  return (
    <canvas
      ref={canvas}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}
