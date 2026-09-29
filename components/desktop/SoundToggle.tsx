"use client";

import { useSyncExternalStore } from "react";
import { isMuted, onMuteChange, setMuted } from "@/lib/audio/sfx";

/** Mute toggle (docs/desktop.md: rich sound, always mutable). */
export default function SoundToggle({ className }: { className?: string }) {
  const muted = useSyncExternalStore(onMuteChange, isMuted, () => false);
  return (
    <button className={className} onClick={() => setMuted(!muted)} aria-pressed={!muted} aria-label={muted ? "Sound off" : "Sound on"}>
      {muted ? "sound off" : "sound on"}
    </button>
  );
}
