"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import gsap from "gsap";
import { recordVoice, ring } from "@/lib/audio/call";
import { ringBell } from "@/lib/audio/dread";
import { spokenPace, startCaption } from "@/lib/audio/captions";
import { playCallLine, type CallLine } from "@/lib/audio/voices";
import { glitchNow } from "@/lib/story/glitch";
import VOICES from "@/lib/story/voices.json";
import { useStory } from "@/lib/story/store";
import Transcript from "./views/Transcript";
import styles from "./call.module.css";

// The interlude, live: E.V.'s phone has just come back on, and Mara calls it. The player
// answers on E.V.'s laptop. Mara hopes it's Ev, asks her to say something, and the laptop
// really listens: a few seconds of the player's microphone are recorded (memory only,
// lib/audio/call.ts) while a meter shows it. Then Mara hears a voice that is not Ev's, and
// the line dies mid-word. Declined or left ringing, she gives up and writes instead.
// Declined once, she calls straight back, and this time the laptop rings like the phone in
// The Ring (owner's easter egg). Declined again, or left ringing: she writes instead.
// When the call is over, `call_done` lets the interlude go on to Find My (Desktop.tsx).
export const CALL_EVENT = "recovery:call";
const RING_MS = 22_000;
// each time she asks, the laptop listens this long; she asks up to TRIES times
const LISTEN_MS = 6000;
const TRIES = 3;
// after the first decline: her message, then the second call
const CALL_AGAIN_MS = 5000;

type Step = "ringing" | "talking" | "listening" | "reply" | "ended";

// What Mara says, word for word (lib/story/voices.json). Written while she speaks; the
// last word stays cut, like the line.
const said = (line: CallLine) => VOICES.clips[line].say;

export default function IncomingCall() {
  const { state, dispatch } = useStory();
  const [step, setStep] = useState<Step | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const panel = useRef<HTMLDivElement>(null);
  // the line playing, and a caption id unique per take (she may plead more than once)
  const [saying, setSaying] = useState<{ line: CallLine; id: string } | null>(null);
  const stopRing = useRef<(() => void) | null>(null);
  const alive = useRef(true);
  const [again, setAgain] = useState(false);
  const mic = state.session.mic === "granted";

  const finish = (after: "answered" | "declined" | "missed") => {
    stopRing.current?.();
    stopRing.current = null;
    dispatch({ type: "clue", id: `call_${after}` }); // the case file remembers how it went
    if (after === "declined") dispatch({ type: "notify", from: "mara", text: "pick up. please. PLEASE." });
    if (after === "missed") dispatch({ type: "notify", from: "mara", text: "why aren't you picking up" });
    setStep("ended");
    setTimeout(() => {
      if (!alive.current) return;
      gsap.to(panel.current, {
        opacity: 0,
        y: -8,
        duration: 0.3,
        ease: "power2.in",
        onComplete: () => setStep(null),
      });
      dispatch({ type: "clue", id: "call_done" });
    }, after === "answered" ? 1600 : 400);
  };

  // the first decline is not the end: she writes, and calls back with the other ring
  const decline = () => {
    if (again) return finish("declined");
    stopRing.current?.();
    stopRing.current = null;
    dispatch({ type: "notify", from: "mara", text: "don't you dare hang up on me. pick up." });
    setStep("ended");
    gsap.to(panel.current, { opacity: 0, y: -8, duration: 0.3, ease: "power2.in" });
    setTimeout(() => {
      if (!alive.current) return;
      setAgain(true);
      setStep("ringing");
      stopRing.current = ringBell();
    }, CALL_AGAIN_MS);
  };

  // the interlude starts the call
  useEffect(() => {
    alive.current = true;
    const start = () => {
      setStep("ringing");
      stopRing.current = ring();
    };
    window.addEventListener(CALL_EVENT, start);
    return () => {
      alive.current = false;
      window.removeEventListener(CALL_EVENT, start);
      stopRing.current?.();
    };
  }, []);

  useEffect(() => {
    if (step !== "ringing") return;
    gsap.fromTo(panel.current, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.35, ease: "power3.out" });
    const t = setTimeout(() => finish("missed"), RING_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // the call clock, from the moment it is answered
  useEffect(() => {
    if (step !== "talking" && step !== "listening" && step !== "reply") return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [step]);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  const answer = async () => {
    stopRing.current?.();
    stopRing.current = null;
    setStep("talking");
    const speak = async (line: CallLine, n: number, cut = false) => {
      const id = `${line}-${n}`;
      const take = playCallLine(line, { cut });
      setSaying({ line, id });
      startCaption(id, take?.speech ?? spokenPace(said(line).split(" ").length / 2.6));
      await (take?.done ?? wait(said(line).split(" ").length * 420));
    };
    await speak("mara-call-1", 0);
    // She only hears a stranger when the player really spoke. Silence: she pleads, and
    // the laptop listens again. Nothing after the last try: she hears breathing.
    let heard = null;
    for (let n = 0; n < TRIES && alive.current; n++) {
      if (n > 0) {
        setStep("talking");
        await speak("mara-call-plead", n);
        if (!alive.current) return;
      }
      setStep("listening");
      heard = mic ? await recordVoice(LISTEN_MS, setLevel) : (await wait(LISTEN_MS), null);
      if (heard || !mic) break;
    }
    if (!alive.current) return;
    setStep("reply");
    await speak(heard ? "mara-call-2" : "mara-call-silent", 0, true);
    if (!alive.current) return;
    glitchNow(0.9);
    finish("answered");
  };

  if (!step) return null;
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  const status: Record<Step, string> = {
    ringing: again ? "mobile · calling again" : "mobile · incoming call",
    talking: clock,
    listening: clock,
    reply: clock,
    ended: `call ended · ${clock}`,
  };

  return (
    <div
      ref={panel}
      className={`${styles.call} ${step === "ringing" ? styles.ringing : ""}`}
      role="dialog"
      aria-label="Incoming call from Mara"
    >
      <span className={styles.face}>
        <Image src="/avatars/mara.webp" alt="" width={96} height={96} />
      </span>
      <span className={styles.who}>
        <b>Mara</b>
        <small>{status[step]}</small>
      </span>

      {step === "ringing" && (
        <span className={styles.actions}>
          <button className={styles.decline} onClick={decline}>
            Decline
          </button>
          <button className={styles.accept} onClick={answer}>
            Accept
          </button>
        </span>
      )}

      {step === "listening" && (
        // the laptop is listening, and says so
        <span className={styles.listen}>
          <span className={styles.meter} style={{ "--level": level } as CSSProperties}>
            {Array.from({ length: 12 }, (_, i) => (
              <i key={i} style={{ "--i": i } as CSSProperties} />
            ))}
          </span>
          <small>{mic ? "● microphone · live" : "microphone off"}</small>
        </span>
      )}

      {saying && (step === "talking" || step === "reply") && (
        <Transcript key={saying.id} id={saying.id} className={styles.caption} text={said(saying.line)} />
      )}
    </div>
  );
}
