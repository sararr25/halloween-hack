"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useStory, type AppId, type WindowState } from "@/lib/story/store";
import { APP } from "./apps";
import styles from "./desktop.module.css";

gsap.registerPlugin(useGSAP);

/** Closes a window with the same short fade wherever the close comes from (dot, Esc, a link). */
export function fadeClose(id: AppId, dispatch: ReturnType<typeof useStory>["dispatch"]) {
  const node = document.querySelector(`[data-win="${id}"]`);
  if (!node) return dispatch({ type: "close", id });
  gsap.to(node, { opacity: 0, duration: 0.18, ease: "power2.in", onComplete: () => dispatch({ type: "close", id }) });
}

// Frosted-glass OS window: drag by the title bar, focus on press, open from its icon, close with a fade.
export default function Window({ win }: { win: WindowState }) {
  const { state, dispatch } = useStory();
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const app = APP[win.id];
  // the second click of a double click on the icon must not land inside the new window
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 350);
    return () => clearTimeout(t);
  }, []);

  // Open: grow out of the icon (280 ms — docs/scenes.md motion table).
  useGSAP(() => {
    const node = el.current;
    if (!node) return;
    const icon = document.querySelector(`[data-icon="${win.id}"]`)?.getBoundingClientRect();
    const box = node.getBoundingClientRect();
    const from = icon
      ? { x: icon.left + icon.width / 2 - (box.left + box.width / 2), y: icon.top + icon.height / 2 - (box.top + box.height / 2), scale: 0.2 }
      : { scale: 0.98 };
    gsap.from(node, { ...from, opacity: 0, duration: 0.28, ease: "power3.out", clearProps: "transform" });
  }, []);

  const close = () => fadeClose(win.id, dispatch);

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { dx: e.clientX - win.x, dy: e.clientY - win.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    const x = Math.max(-app.size.w + 80, Math.min(window.innerWidth - 80, e.clientX - drag.current.dx));
    const y = Math.max(28, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy));
    dispatch({ type: "move", id: win.id, x, y });
  };
  const up = () => {
    drag.current = null;
  };

  return (
    <div
      ref={el}
      role="dialog"
      aria-label={app.title}
      data-win={win.id}
      // the windows behind dim, so the one in front reads at once
      data-behind={win.z < Math.max(...state.windows.map((w) => w.z)) || undefined}
      className={`${styles.window} ${styles.glass}`}
      style={{ left: win.x, top: win.y, width: app.size.w, height: app.size.h, zIndex: win.z }}
      onPointerDown={() => dispatch({ type: "focus", id: win.id })}
    >
      <div className={styles.titlebar} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
        <button className={styles.close} aria-label={`Close ${app.title}`} onClick={close} />
        <span>{app.title}</span>
      </div>
      <div className={styles.body} style={ready ? undefined : { pointerEvents: "none" }}>
        {app.body}
      </div>
    </div>
  );
}
