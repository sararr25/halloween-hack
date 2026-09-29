"use client";

import { useEffect, useRef, useState } from "react";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

/** `pulse`: change it to fire one glitch tear now (the page schedules them, see Experience). */
export type FxLevels = { grain: number; vignette: number; glitch: number; neon: number; pulse: number };

const SRC = "/rive/effects.riv";
// A Rive file published on the free plan opens with the Rive mark on black. The overlay
// stays invisible until it has played out, then fades in (the premise is on screen then).
const REVEAL_AFTER_MS = 4000;

/**
 * Full-screen WGSL overlay from rive/effects (grain, vignette, glitch tears).
 * The file carries scripts, so it only plays once signed with `pnpm rive:publish`;
 * until public/rive/effects.riv exists this renders nothing.
 */
/** Writes one `fx/*` number directly (for values that change every frame, like the head). */
export type FxSetter = (name: string, value: number) => void;

export default function FxOverlay({ levels, onVm }: { levels: FxLevels; onVm?: (set: FxSetter) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const rive = useRef<Rive | null>(null);
  const [available, setAvailable] = useState(false);
  const [shown, setShown] = useState(false);
  const latest = useRef(levels);
  const onVmRef = useRef(onVm);
  useEffect(() => {
    onVmRef.current = onVm;
  });

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
      // scripts render WGSL into GPU canvases; the web runtime only draws them with this on
      enableGPUCanvas: true,
      onLoad: () => {
        setTimeout(() => setShown(true), REVEAL_AFTER_MS);
        r.resizeDrawingSurfaceToCanvas();
        apply();
        const vm = r.viewModelInstance;
        if (!vm) throw new Error("effects.riv: no view model instance");
        onVmRef.current?.((name, value) => {
          const p = vm.number(`fx/${name}`);
          if (!p) throw new Error(`effects.riv: missing fx/${name}`);
          p.value = value;
        });
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
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        opacity: shown ? 1 : 0,
        transition: "opacity 1.5s ease-out",
      }}
    />
  );
}
