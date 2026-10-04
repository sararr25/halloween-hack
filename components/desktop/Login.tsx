"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import gsap from "gsap";
import { creepyMessage, key, musicBox, shutter, staticSwell, subThud, tubeOff } from "@/lib/audio/sfx";
import { afterBed, alertChime, recOn } from "@/lib/audio/dread";
import { usePresence, usePresenceEvent } from "@/lib/presence/context";
import { downloadCaseFile } from "@/lib/story/casefile";
import { grabFrame } from "@/lib/story/frames";
import { fileOperator, passOnLink, readInvite } from "@/lib/story/registry";
import { reminderStart } from "@/lib/story/reminder";
import { crtOff } from "@/lib/story/glitch";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import { SignGlyph } from "./Decor";
import styles from "./login.module.css";

// S10 · Login. An empty field and a caret. With the camera, the caret stops while the
// user's face is gone and starts again when it comes back; without it, it stops when the
// mouse has been still for 5 s. One quiet line under the field says what it wants
// ("stay in frame.") and, when nobody is there, that it noticed. Enter → the case list, with the
// user's name on the open case, then the screen switches off like an old tube.
// docs/desktop.md supersedes docs/scenes.md S10.
const STILL_MS = 5000;
// the case list types in over ~1.8 s; it then holds long enough to read the open case
const CASES_HOLD_MS = 7000;
const CASES_BLACK_MS = 8600;
export const CASE_KEY = "recovery.case0418";

type Step = "login" | "cases" | "off" | "credits" | "after" | "dead";
// After the download nothing closes (owner: leave them on edge): black, then the recording
// light comes back on by itself, the case is still open, and the sender has one last line.
const AFTER_REC_MS = 3000;
const AFTER_LINE_MS = 4600;
const AFTER_SEE_MS = 8200;
// then the way out that is not one (The Ring: pass it on), then the reminder pop-up
const AFTER_PASS_MS = 11_500;
// the reminder never comes before the link is safe (owner playtest: "not now" switched
// everything off before it could be copied): 3 s after passing it on, or 25 s after the button
const REMIND_AFTER_PASS_MS = 3000;
const REMIND_LATEST_MS = 25_000;
// "not now": the sender's answer stays this long before everything switches off
const LATER_HOLD_MS = 2600;
// the switch-off, then how long the black holds before the privacy link shows
const OFF_MS = 1200;
const PRIVACY_AFTER_MS = 3000;
const REC_TITLE = "● REC · 0419";

export default function Login() {
  const { state } = useStory();
  const { tracker, video } = usePresence();
  const [name, setName] = useState("");
  const [step, setStep] = useState<Step>("login");
  const [waiting, setWaiting] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const camera = tracker.state.source === "camera";

  // the caret waits for the face (camera) or for the hand (mouse)
  usePresenceEvent("change", (s) => {
    if (s.source === "camera") setWaiting(s.faceLost);
  });
  useEffect(() => {
    if (tracker.state.source === "camera") return;
    let t = setTimeout(() => setWaiting(true), STILL_MS);
    const move = () => {
      setWaiting(false);
      clearTimeout(t);
      t = setTimeout(() => setWaiting(true), STILL_MS);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("keydown", move);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("keydown", move);
    };
  }, [tracker]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const typed = name.trim();
    if (!typed) return;
    grabFrame(video(), `operator signs · ${typed}`);
    // the registry keeps the name and the times, nothing else (app/api/operators)
    fileOperator(typed, state.openedAt, readInvite()).then(setToken, (err: unknown) => {
      console.error(err);
      setToken(null);
    });
    try {
      localStorage.setItem(CASE_KEY, typed);
    } catch {
      // storage blocked: the case still opens for this session
    }
    setStep("cases");
  };

  // the case list, then the tube switches off; timers, not tweens, move the steps
  useEffect(() => {
    if (step !== "cases") return;
    const rows = screen.current?.querySelectorAll("li");
    if (rows) gsap.from(rows, { opacity: 0, duration: 0.01, stagger: { each: 0.45, onStart: key } });
    const off = setTimeout(() => {
      tubeOff();
      crtOff(1.4);
      gsap.to(screen.current, { scaleY: 0.004, duration: 0.6, ease: "power2.in" });
      gsap.to(screen.current, { scaleX: 0, duration: 0.5, delay: 0.6, ease: "power2.in" });
    }, CASES_HOLD_MS);
    const black = setTimeout(() => {
      setStep("off");
      crtOff(0);
    }, CASES_BLACK_MS);
    return () => [off, black].forEach(clearTimeout);
  }, [step]);

  // its own effect: the one above is cleaned up the moment the step becomes "off"
  useEffect(() => {
    if (step !== "off") return;
    const credits = setTimeout(() => setStep("credits"), 2200);
    return () => clearTimeout(credits);
  }, [step]);

  const [saving, setSaving] = useState(false);
  const download = async () => {
    const { openedAt, session, clues, wrongCodes, interruptions, blinks } = state;
    shutter();
    setSaving(true);
    try {
      await downloadCaseFile({
        name: name.trim(),
        openedAt,
        closedAt: Date.now(),
        camera: session.camera,
        verifiedAt: session.verifiedAt,
        figureMs: clues.photo_figure ?? null,
        backupMs: clues.backup_open ?? null,
        wrongCodes,
        lookedAway: interruptions.length,
        blinks,
        call: "call_answered" in clues ? "answered" : "call_declined" in clues ? "declined" : "call_missed" in clues ? "missed" : null,
      });
      setStep("after");
    } finally {
      setSaving(false);
    }
  };

  // undefined while filing, null when the registry could not be reached
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [passed, setPassed] = useState<"no" | "yes" | "failed">("no");
  const passOn = async () => {
    if (!token) return;
    const url = passOnLink(token);
    try {
      if (navigator.share) await navigator.share({ title: "case 0420", url });
      else await navigator.clipboard.writeText(url);
      setPassed("yes");
      creepyMessage();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return; // share sheet closed
      console.error(err);
      setPassed("failed");
    }
  };

  // The after-screen has its own sound (owner playtest: it was silent once the file was
  // saved): a clock ticking in an empty room under everything, and each beat its own sound.
  // The clock stops the moment the reminder is answered: time is up.
  const stopBed = useRef<((fade?: number) => void) | null>(null);
  useEffect(() => () => stopBed.current?.(0.3), []);
  const typeOut = (text: string) => Array.from(text, (_, i) => setTimeout(key, 80 + i * 38));
  const [after, setAfter] = useState(0); // 1 REC, 2 the open case, 3 the sender, 4 pass it on, 5 the reminder
  useEffect(() => {
    if (step !== "after") return;
    stopBed.current = afterBed();
    const typed: ReturnType<typeof setTimeout>[] = [];
    const t = [
      setTimeout(() => {
        setAfter(1);
        recOn();
      }, AFTER_REC_MS),
      setTimeout(() => {
        setAfter(2);
        typed.push(...typeOut("case 0418 · status: open"));
      }, AFTER_LINE_MS),
      setTimeout(() => {
        setAfter(3);
        creepyMessage();
      }, AFTER_SEE_MS),
      setTimeout(() => {
        setAfter(4);
        subThud(1);
        staticSwell(0.6);
      }, AFTER_PASS_MS),
    ];
    return () => [...t, ...typed].forEach(clearTimeout);
  }, [step]);
  useEffect(() => {
    if (after !== 4) return;
    const t = setTimeout(
      () => {
        setAfter(5);
        alertChime();
      },
      passed === "yes" ? REMIND_AFTER_PASS_MS : REMIND_LATEST_MS,
    );
    return () => clearTimeout(t);
  }, [after, passed]);

  // The reminder: "add" is only in the story (owner: no downloads), the alert turns into
  // "reminder set" under a music box winding down; "not now" gets one line back. Either way,
  // on the last note, everything switches off.
  const afterEl = useRef<HTMLDivElement>(null);
  const [ending, setEnding] = useState<"remind" | "later" | null>(null);
  const answer = (remind: boolean) => {
    stopBed.current?.();
    setEnding(remind ? "remind" : "later");
  };
  useEffect(() => {
    if (!ending) return;
    if (ending === "later") creepyMessage();
    const hold = ending === "remind" ? musicBox() : LATER_HOLD_MS;
    const t = [
      setTimeout(() => {
        tubeOff();
        crtOff(1.4);
        gsap.to(afterEl.current, { scaleY: 0.004, duration: 0.6, ease: "power2.in" });
        gsap.to(afterEl.current, { scaleX: 0, duration: 0.5, delay: 0.6, ease: "power2.in" });
      }, hold),
      setTimeout(() => {
        crtOff(0);
        setAfter(0);
        document.title = "recovery";
        setStep("dead");
      }, hold + OFF_MS),
    ];
    return () => t.forEach(clearTimeout);
  }, [ending]);

  const [privacy, setPrivacy] = useState(false);
  useEffect(() => {
    if (step !== "dead") return;
    const t = setTimeout(() => setPrivacy(true), PRIVACY_AFTER_MS);
    return () => clearTimeout(t);
  }, [step]);

  // the tab keeps recording, and nothing (React's own <title>, a tab switch) puts it back
  useEffect(() => {
    if (after < 1) return;
    const hold = () => {
      if (document.title !== REC_TITLE) document.title = REC_TITLE;
    };
    hold();
    const t = setInterval(hold, 500);
    return () => clearInterval(t);
  }, [after]);

  // The pass-it-on button and, when sharing and the clipboard both refuse, the link itself
  // to copy by hand. Used on the after-screen and, if the case was not passed on, kept on
  // the black after the switch-off.
  const passBlock = (
    <div className={styles.passBlock}>
      <button className={styles.passOn} onClick={passOn} disabled={!token || passed !== "no"}>
        {token === undefined
          ? "filing…"
          : token === null
            ? "registry offline"
            : passed === "yes"
              ? "link copied · send it to someone · case 0420 is theirs"
              : passed === "failed"
                ? "copy it yourself:"
                : "pass it on · case 0420"}
      </button>
      {passed === "failed" && token && (
        <input
          className={styles.passLink}
          readOnly
          value={passOnLink(token)}
          aria-label="your pass-it-on link"
          onFocus={(e) => e.currentTarget.select()}
          autoFocus
        />
      )}
    </div>
  );

  // each screen gets its own element: the switch-off leaves a squash on the one before
  if (step === "off") return <div key="off" className={styles.black} />;
  if (step === "dead")
    return (
      <div key="dead" className={`${styles.black} ${styles.dead}`}>
        {/* not passed on: the case stays unassigned, and quietly says so */}
        {privacy && token && passed !== "yes" && (
          <div className={styles.unassigned}>
            <p>case 0420 is still unassigned.</p>
            {passBlock}
          </div>
        )}
        {privacy && (
          <a className={styles.privacy} href="/privacy" target="_blank" rel="noopener">
            privacy
          </a>
        )}
      </div>
    );
  if (step === "after")
    return (
      <div key="after" className={styles.black} ref={afterEl}>
        {after >= 1 && <span className={styles.afterRec}>● REC</span>}
        <div className={styles.afterText}>
          <p>case file saved.</p>
          {after >= 2 && <p className={styles.afterOpen}>case 0418 · status: open</p>}
        </div>
        {after >= 3 && (
          <div className={styles.afterNote}>
            <span>unknown sender</span>
            <p>see you tomorrow at {clock(state.openedAt)}.</p>
            {after >= 4 && <p className={styles.afterOpen}>…unless someone takes your place.</p>}
            {ending === "later" && <p className={styles.afterOpen}>we&apos;ll remind you.</p>}
          </div>
        )}
        {/* the way out that is not one, in the middle of the screen where nobody misses it */}
        {after >= 4 && !ending && passBlock}
        {after >= 5 && ending !== "later" && (
          <ReminderPrompt at={reminderStart(state.openedAt)} set={ending === "remind"} onAnswer={answer} />
        )}
      </div>
    );
  if (step === "credits")
    return (
      <div key="credits" className={styles.black}>
        <div className={styles.end}>
          <SignGlyph size={56} />
          <p className={styles.credits}>No frames or audio left your device.</p>
          {/* the keepsake: the session as a case file, made here (lib/story/casefile.ts) */}
          <button className={styles.download} onClick={download} disabled={saving}>
            {saving ? "writing case file…" : "download case file 0418"}
          </button>
        </div>
      </div>
    );

  return (
    <div key="screen" className={styles.screen} ref={screen} data-waiting={step === "login" && waiting}>
      {step === "login" ? (
        <form className={styles.form} onSubmit={submit} onClick={() => input.current?.focus()}>
          <p className={styles.brand}>RECOVERY/4</p>
          <label className={styles.field}>
            <span className={styles.label}>operator</span>
            <span className={styles.typed}>
              {name}
              <span className={styles.caret} data-waiting={waiting} aria-hidden="true" />
            </span>
            <input
              ref={input}
              className={styles.hidden}
              value={name}
              autoFocus
              maxLength={32}
              autoComplete="off"
              spellCheck={false}
              aria-label="operator name"
              onChange={(e) => {
                key();
                setName(e.target.value);
              }}
            />
          </label>
          {/* the one thing the screen asks: be seen. Away, it notices, and waits. */}
          <p className={styles.presence} data-waiting={waiting}>
            {waiting ? "operator absent · the case is waiting" : camera ? "stay in frame." : "stay with the screen."}
          </p>
        </form>
      ) : (
        <ol className={styles.cases}>
          <li>RECOVERY/4 · cases</li>
          <li><span>#0415</span><span>E.V.</span><span>missing · 7 days</span></li>
          <li><span>#0416</span><span>redacted</span><span>closed</span></li>
          <li><span>#0417</span><span>redacted</span><span>closed · operator unresponsive</span></li>
          <li className={styles.open}><span>#0418</span><span>{name.trim()}</span><span>open</span></li>
        </ol>
      )}
    </div>
  );
}

/** A calendar alert, as the system would show it: case 0419, tomorrow, the same minute. */
function ReminderPrompt({ at, set, onAnswer }: { at: number; set: boolean; onAnswer: (remind: boolean) => void }) {
  const d = new Date(at);
  const month = d.toLocaleDateString("en-GB", { month: "short" }).toUpperCase();
  return (
    <div className={styles.remind} role="alertdialog" aria-labelledby="remind-title">
      <div className={styles.remindIcon} aria-hidden="true">
        <span>{month}</span>
        <b>{d.getDate()}</b>
      </div>
      <div className={styles.remindBody}>
        <p id="remind-title">case 0419</p>
        <small>tomorrow · {clock(at)} · 17 Harrow St</small>
      </div>
      {set ? (
        <p className={styles.remindSet} role="status">
          reminder set · tomorrow · {clock(at)}
        </p>
      ) : (
        <div className={styles.remindActions}>
          <button onClick={() => onAnswer(false)}>not now</button>
          <button className={styles.remindAdd} onClick={() => onAnswer(true)} autoFocus>
            add reminder
          </button>
        </div>
      )}
    </div>
  );
}
