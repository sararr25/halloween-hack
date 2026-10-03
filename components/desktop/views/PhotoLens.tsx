"use client";

import { useEffect, useRef, type PointerEvent } from "react";
import gsap from "gsap";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";
import { usePresenceEvent } from "@/lib/presence/context";
import type { Stage } from "@/lib/story/store";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

// Photo pixels in rive/photo (1536 x 1024, the IMG_0413 view): the figure stands at x 909
// or 259 px to its left (figure 1), its body spans y 680-825.
const FIGURE_X = (figure: number) => (909 - figure * 259) / 1536;
const FIGURE_Y = 752 / 1024;
const HIT_X = 0.03;
const HIT_Y = 0.09;
const FOUND_AFTER_MS = 700;

const SILHOUETTE: Record<Stage, number> = { 1: 0.12, 2: 0.45, 3: 0.9 };

type LensInstance = {
  canvas: HTMLCanvasElement;
  rive: Rive;
  set: (name: string, value: number) => void;
  get: (name: string) => number;
};

let shared: LensInstance | null = null;

/**
 * Called when the desktop appears: the photo's Rive file loads and renders off screen for
 * a few seconds, so the free-plan Rive mark has played out before anyone opens IMG_0418.
 */
export function prewarmLens() {
  const l = lensInstance();
  l.rive.startRendering();
  setTimeout(() => {
    if (!l.canvas.isConnected) l.rive.stopRendering();
  }, 6000);
}

/**
 * The photo's Rive instance is created once and never torn down: with `enableGPUCanvas`
 * the runtime's cleanup can crash (glDeleteTextures without a current context), which
 * takes the page — and the camera — down. Closing the photo only detaches the canvas.
 */
function lensInstance(): LensInstance {
  if (shared) return shared;
  const canvas = document.createElement("canvas");
  canvas.setAttribute("aria-label", "IMG_0418, a night photo of the building across the street");
  Object.assign(canvas.style, { display: "block", width: "100%", aspectRatio: "3 / 2", cursor: "none" });

  // values written before the file loads are applied on load
  const values = new Map<string, number>([["figure", 0]]);
  let apply: ((name: string, value: number) => void) | null = null;

  const rive = new Rive({
    src: "/rive/photo.riv",
    canvas,
    artboard: "Photo",
    stateMachines: "Photo",
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: Fit.Contain }),
    // scripts render WGSL into GPU canvases; the web runtime only draws them with this on
    enableGPUCanvas: true,
    onLoad: () => {
      rive.resizeDrawingSurfaceToCanvas();
      const vm = rive.viewModelInstance;
      if (!vm) throw new Error("photo.riv: no view model instance");
      apply = (name, value) => {
        const p = vm.number(`photo/${name}`);
        if (!p) throw new Error(`photo.riv: missing photo/${name}`);
        p.value = value;
      };
      values.forEach((v, k) => apply?.(k, v));
    },
    onLoadError: (e) => {
      throw new Error(`photo.riv failed to load: ${String(e)}`);
    },
  });

  shared = {
    canvas,
    rive,
    set: (name, value) => {
      values.set(name, value);
      apply?.(name, value);
    },
    get: (name) => values.get(name) ?? 0,
  };
  return shared;
}

/**
 * IMG_0418 in Rive: the whole photo is drawn by the photo_lens WGSL shader (soft
 * everywhere, sharp and magnified under the lens). The figure on the street changes place
 * only while the user is not looking. Holding the lens on it = found.
 */
export default function PhotoLens({ stage, onFound }: { stage: Stage; onFound: () => void }) {
  const frame = useRef<HTMLDivElement>(null);
  const inst = useRef<LensInstance | null>(null);
  const lens = useRef({ x: 0.5, y: 0.5, strength: 0 });
  const hit = useRef<ReturnType<typeof setTimeout> | null>(null);
  const found = useRef(false);

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const l = lensInstance();
    inst.current = l;
    el.appendChild(l.canvas);
    l.rive.startRendering();
    const ro = new ResizeObserver(() => l.rive.resizeDrawingSurfaceToCanvas());
    ro.observe(l.canvas);
    return () => {
      ro.disconnect();
      l.rive.stopRendering();
      l.canvas.remove();
      if (hit.current) clearTimeout(hit.current);
      hit.current = null;
    };
  }, []);

  useEffect(() => {
    inst.current?.set("silhouette", SILHOUETTE[stage]);
  }, [stage]);

  // It moves only when you are not looking.
  usePresenceEvent("change", (s) => {
    const l = inst.current;
    if (!l || !s.lookingAway || found.current) return;
    const next = l.get("figure") === 0 ? 1 : 0;
    l.set("figure", next);
  });

  const writeLens = () => {
    const { x, y, strength } = lens.current;
    inst.current?.set("lensX", x);
    inst.current?.set("lensY", y);
    inst.current?.set("lens", strength);
  };

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const l = inst.current;
    if (!l) return;
    const box = l.canvas.getBoundingClientRect();
    const x = (e.clientX - box.left) / box.width;
    const y = (e.clientY - box.top) / box.height;
    // a little late, like a hand-held loupe
    gsap.to(lens.current, { x, y, duration: 0.18, ease: "power2.out", onUpdate: writeLens });

    const onFigure = Math.abs(x - FIGURE_X(l.get("figure"))) < HIT_X && Math.abs(y - FIGURE_Y) < HIT_Y;
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

  return <div ref={frame} onPointerEnter={enter} onPointerMove={move} onPointerLeave={leave} />;
}
