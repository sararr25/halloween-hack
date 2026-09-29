"use client";

import { useSyncExternalStore } from "react";
import { enterFullscreen, exitFullscreen, isFullscreen, onFullscreenChange } from "@/lib/fullscreen";

/** Next to the sound toggle: back into full screen after Esc, or out of it. */
export default function FullscreenToggle({ className }: { className?: string }) {
  const full = useSyncExternalStore(onFullscreenChange, isFullscreen, () => false);
  return (
    <button className={className} onClick={() => (full ? exitFullscreen() : enterFullscreen())} aria-pressed={full}>
      {full ? "exit full screen" : "full screen"}
    </button>
  );
}
