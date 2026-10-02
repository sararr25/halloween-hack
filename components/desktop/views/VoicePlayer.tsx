"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { spokenPace, startCaption, stopCaption } from "@/lib/audio/captions";
import { playRecording, type Playback, type RecordingId } from "@/lib/audio/voices";
import { useStory } from "@/lib/story/store";
import styles from "./voice.module.css";

const WAVE = [4, 9, 14, 7, 11, 16, 6, 12, 8, 15, 5, 10, 13, 6, 9, 4, 11, 7, 12, 5, 9, 14, 6, 10];

const seconds = (length: string) => {
  const [m, s] = length.split(":").map(Number);
  return m * 60 + s;
};

/** Play / stop, a waveform that fills as it plays, the length. One recording at a time. */
export default function VoicePlayer({ id, length }: { id: RecordingId; length: string }) {
  const { dispatch } = useStory();
  const [playing, setPlaying] = useState(false);
  const [silent, setSilent] = useState(false);
  const wave = useRef<HTMLSpanElement>(null);
  const playback = useRef<Playback | null>(null);
  const tween = useRef<gsap.core.Tween | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = () => {
    playback.current?.stop();
    playback.current = null;
    tween.current?.kill();
    if (timer.current) clearTimeout(timer.current);
    wave.current?.style.setProperty("--played", "0");
    setPlaying(false);
    stopCaption(id);
  };

  // stop on unmount only (a recording never changes under its player)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stop, []);

  const play = () => {
    if (playing) return stop();
    dispatch({ type: "clue", id: `heard_${id}` }); // the hints know what was listened to
    const p = playRecording(id);
    const dur = seconds(length);
    if (!p) {
      // audio locked or muted: say so instead of pretending to play; the transcript still
      // arrives, at the pace of the voice
      setSilent(true);
      startCaption(id, spokenPace(dur - 1.2));
      return;
    }
    setSilent(false);
    playback.current = p;
    setPlaying(true);
    startCaption(id, p.speech);
    const progress = { v: 0 };
    tween.current = gsap.to(progress, {
      v: 1,
      duration: dur,
      ease: "none",
      onUpdate: () => wave.current?.style.setProperty("--played", String(progress.v)),
    });
    // on a timer, not on the tween: a throttled tab still ends the playback
    timer.current = setTimeout(stop, dur * 1000);
  };

  return (
    <span className={styles.player}>
      <button className={styles.button} onClick={play} aria-label={playing ? "Stop" : "Play"} aria-pressed={playing}>
        {playing ? <span className={styles.stopIcon} /> : <span className={styles.playIcon} />}
      </button>
      <span ref={wave} className={styles.wave} aria-hidden="true">
        {WAVE.map((h, j) => (
          <i key={j} style={{ height: h, ["--at" as string]: j / WAVE.length }} />
        ))}
      </span>
      <b className={styles.length}>{silent ? "sound off" : length}</b>
    </span>
  );
}
