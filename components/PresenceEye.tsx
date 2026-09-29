"use client";

import { useEffect, useRef } from "react";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";
import type { PresenceState } from "@/lib/presence/tracker";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

export type EyeHandle = {
  update: (s: PresenceState) => void;
  blink: () => void;
};

/** The Rive eye (rive/presence). Writes presence into the `Presence` view model. */
export default function PresenceEye({
  onReady,
  className,
}: {
  onReady: (eye: EyeHandle) => void;
  className?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvas.current) return;
    const rive = new Rive({
      src: "/rive/presence.riv",
      canvas: canvas.current,
      stateMachine: "Presence",
      autoplay: true,
      autoBind: true,
      layout: new Layout({ fit: Fit.Contain }),
      onLoad: () => {
        rive.resizeDrawingSurfaceToCanvas();
        const vm = rive.viewModelInstance;
        const headX = vm?.number("headX");
        const headY = vm?.number("headY");
        const away = vm?.boolean("lookingAway");
        const blink = vm?.trigger("blink");
        onReady({
          update: (s) => {
            if (headX) headX.value = s.headX;
            if (headY) headY.value = s.headY;
            if (away && away.value !== s.lookingAway) away.value = s.lookingAway;
          },
          blink: () => blink?.trigger(),
        });
      },
    });
    const resize = () => rive.resizeDrawingSurfaceToCanvas();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      rive.cleanup();
    };
  }, [onReady]);

  return <canvas ref={canvas} className={className} aria-hidden="true" />;
}
