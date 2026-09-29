"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import gsap from "gsap";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";
import { usePresenceEvent } from "@/lib/presence/context";
import type { Stage } from "@/lib/story/store";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

// Street artboard coordinates (rive/photo/scene.rml): the figure stands at x 330 or 820 of
// 1200, its body spans y 640–782 of 800.
const FIGURE_X = (figure: number) => (330 + figure * 490) / 1200;
const FIGURE_Y = 0.87;
const HIT_X = 0.045;
const HIT_Y = 0.1;
const FOUND_AFTER_MS = 700;

const SILHOUETTE: Record<Stage, number> = { 1: 0.12, 2: 0.45, 3: 0.9 };

type Vm = { set: (name: string, value: number) => void };

/**
 * IMG_0418 in Rive: the photo is drawn by rive/photo and processed by the photo_lens WGSL
 * shader (soft everywhere, sharp and magnified under the lens). The figure on the street
 * changes place only while the user is not looking. Holding the lens on it = found.
 */
export default function PhotoLens({ stage, onFound }: { stage: Stage; onFound: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const vm = useRef<Vm | null>(null);
  const lens = useRef({ x: 0.5, y: 0.5, strength: 0 });
  const figure = useRef(0);
  const hit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const found = useRef(false);
  const stageRef = useRef(stage);

  useEffect(() => {
    if (!canvas.current) return;
    const r = new Rive({
      src: "/rive/photo.riv",
      canvas: canvas.current,
      artboard: "Photo",
      stateMachines: "Photo",
      autoplay: true,
      autoBind: true,
      layout: new Layout({ fit: Fit.Contain }),
      // scripts render WGSL into GPU canvases; the web runtime only draws them with this on
      enableGPUCanvas: true,
      onLoad: () => {
        r.resizeDrawingSurfaceToCanvas();
        const inst = r.viewModelInstance;
        if (!inst) throw new Error("photo.riv: no view model instance");
        vm.current = {
          set: (name, value) => {
            const p = inst.number(`photo/${name}`);
            if (!p) throw new Error(`photo.riv: missing photo/${name}`);
            p.value = value;
          },
        };
        vm.current.set("figure", figure.current);
        vm.current.set("silhouette", SILHOUETTE[stageRef.current]);
      },
      onLoadError: (e) => {
        throw new Error(`photo.riv failed to load: ${String(e)}`);
      },
    });
    const ro = new ResizeObserver(() => r.resizeDrawingSurfaceToCanvas());
    ro.observe(canvas.current);
    return () => {
      ro.disconnect();
      r.cleanup();
      vm.current = null;
    };
  }, []);

  useEffect(() => {
    stageRef.current = stage;
    vm.current?.set("silhouette", SILHOUETTE[stage]);
  }, [stage]);

  useEffect(() => () => void (hit.current && clearTimeout(hit.current)), []);

  // It moves only when you are not looking.
  usePresenceEvent("change", (s) => {
    if (!s.lookingAway || found.current) return;
    const next = figure.current === 0 ? 1 : 0;
    if (next === figure.current) return;
    figure.current = next;
    vm.current?.set("figure", next);
  });

  const writeLens = () => {
    const l = lens.current;
    vm.current?.set("lensX", l.x);
    vm.current?.set("lensY", l.y);
    vm.current?.set("lens", l.strength);
  };

  const move = (e: PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    // a little late, like a hand-held loupe
    gsap.to(lens.current, { x, y, duration: 0.18, ease: "power2.out", onUpdate: writeLens });

    const onFigure = Math.abs(x - FIGURE_X(figure.current)) < HIT_X && Math.abs(y - FIGURE_Y) < HIT_Y;
    if (onFigure && !hit.current && !found.current) {
      hit.current = setTimeout(() => {
        found.current = true;
        onFound();
      }, FOUND_AFTER_MS);
    } else if (!onFigure && hit.current) {
      clearTimeout(hit.current);
      hit.current = null;
    }
  };

  const enter = () => gsap.to(lens.current, { strength: 1, duration: 0.3, ease: "power2.out", onUpdate: writeLens });
  const leave = () => {
    gsap.to(lens.current, { strength: 0, duration: 0.25, ease: "power2.in", onUpdate: writeLens });
    if (hit.current) clearTimeout(hit.current);
    hit.current = null;
  };

  return (
    <canvas
      ref={canvas}
      aria-label="IMG_0418, a night photo of the building across the street"
      style={{ aspectRatio: "3 / 2" }}
      onPointerEnter={enter}
      onPointerMove={move}
      onPointerLeave={leave}
    />
  );
}
