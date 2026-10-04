"use client";

import { useEffect, type RefObject } from "react";
import { Fit, Layout, Rive, RuntimeLoader } from "@rive-app/webgl2";

RuntimeLoader.setWasmUrl("/rive/rive.wasm");

// Rive instances that draw GPU canvases (WGSL scripts) must never be destroyed mid-session:
// with `enableGPUCanvas` the runtime's cleanup can throw and take the page, and the camera,
// down with it (docs/tech-setup.md §2). So each one is created once, kept here, and only
// moved in and out of the DOM. Values written before the file loads are applied on load.

type Value = number | string;

export type PersistentRive = {
  canvas: HTMLCanvasElement;
  rive: Rive;
  /** `name` is relative to the view model prefix, e.g. "sweep" for "scan/sweep" (no prefix: a flat view model). */
  set: (name: string, value: Value) => void;
  get: (name: string) => Value | undefined;
};

type Options = {
  src: string;
  artboard: string;
  stateMachine: string;
  prefix: string;
  label?: string;
  fit?: Fit;
};

const pool = new Map<string, PersistentRive>();

function persistentRive(key: string, o: Options): PersistentRive {
  const existing = pool.get(key);
  if (existing) return existing;

  const canvas = document.createElement("canvas");
  if (o.label) canvas.setAttribute("aria-label", o.label);
  else canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, { display: "block", width: "100%", height: "100%" });

  const values = new Map<string, Value>();
  let apply: ((name: string, value: Value) => void) | null = null;

  const rive = new Rive({
    src: o.src,
    canvas,
    artboard: o.artboard,
    stateMachine: o.stateMachine,
    autoplay: true,
    autoBind: true,
    layout: new Layout({ fit: o.fit ?? Fit.Contain }),
    // scripts render WGSL into GPU canvases; the web runtime only draws them with this on
    enableGPUCanvas: true,
    onLoad: () => {
      rive.resizeDrawingSurfaceToCanvas();
      const vm = rive.viewModelInstance;
      if (!vm) throw new Error(`${o.src}: no view model instance`);
      apply = (name, value) => {
        const path = o.prefix ? `${o.prefix}/${name}` : name;
        const p = typeof value === "string" ? vm.string(path) : vm.number(path);
        if (!p) throw new Error(`${o.src}: missing ${path}`);
        p.value = value as never;
      };
      values.forEach((v, k) => apply?.(k, v));
    },
    onLoadError: (e) => {
      throw new Error(`${o.src} failed to load: ${String(e)}`);
    },
  });

  const inst: PersistentRive = {
    canvas,
    rive,
    set: (name, value) => {
      values.set(name, value);
      apply?.(name, value);
    },
    get: (name) => values.get(name),
  };
  pool.set(key, inst);
  return inst;
}

/** Shows a persistent instance inside `host` while the component is mounted. */
export function useMountedRive(host: RefObject<HTMLElement | null>, inst: () => PersistentRive) {
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const r = inst();
    el.appendChild(r.canvas);
    r.rive.startRendering();
    const ro = new ResizeObserver(() => r.rive.resizeDrawingSurfaceToCanvas());
    ro.observe(r.canvas);
    return () => {
      ro.disconnect();
      r.rive.stopRendering();
      r.canvas.remove();
    };
    // the instance factory is stable by contract (a module-level getter)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);
}

/** The operator's face as a point cloud (rive/story, artboard Scan). S1 and S8. */
export const scanRive = () =>
  persistentRive("scan", { src: "/rive/story.riv", artboard: "Scan", stateMachine: "Scan", prefix: "scan" });

/** S9: the window across, full screen (rive/story, artboard Across). */
export const acrossRive = () =>
  persistentRive("across", {
    src: "/rive/story.riv",
    artboard: "Across",
    stateMachine: "Across",
    prefix: "across",
    fit: Fit.Cover,
    label: "a lit window across the street at night, someone standing in it",
  });

/** Find My's View live: 17 Harrow St through binoculars (rive/facade, flat view model "Facade"). */
export const facadeRive = () =>
  persistentRive("facade", {
    src: "/rive/facade.riv",
    artboard: "Facade",
    stateMachine: "Facade",
    prefix: "",
    fit: Fit.Cover,
    label: "17 Harrow Street at night, through binoculars",
  });

/** The pass-it-on DM: the case file that takes the screen (rive/casefile, flat view model "CaseFile"). */
export const casefileRive = () =>
  persistentRive("casefile", {
    src: "/rive/casefile.riv",
    artboard: "CaseFile",
    stateMachine: "CaseFile",
    prefix: "",
    label: "case 0420, assigned to you",
  });
