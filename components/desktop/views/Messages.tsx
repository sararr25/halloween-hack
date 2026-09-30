"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Image from "next/image";
import { CHATS, photoSrc, type ChatLine } from "@/lib/story/content";
import { usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import { Avatar, when } from "./shared";
import VoicePlayer from "./VoicePlayer";
import styles from "./messages.module.css";

gsap.registerPlugin(useGSAP);

const TYPING_MS = 4200;

// S4 · Messages. Mara or Theo: whichever you read, you learn the same thing (fake choice).
// Stage 2+: Mara starts typing and never sends; look away while a chat is open and,
// when you come back, someone has written.
export default function Messages() {
  const { state, dispatch } = useStory();
  const [openId, setOpenId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, ChatLine[]>>({});
  const [typing, setTyping] = useState(false);
  const pane = useRef<HTMLDivElement>(null);
  const chat = CHATS.find((c) => c.id === openId);
  const lines = chat ? [...chat.lines, ...(extra[chat.id] ?? [])] : [];

  const open = (id: string) => {
    setOpenId(id);
    if (id === "mara" || id === "theo") dispatch({ type: "clue", id: "chat_window" });
  };

  // "Mara is typing…" for a few seconds, then nothing arrives.
  useEffect(() => {
    if (openId !== "mara" || state.stage < 2) return;
    const on = setTimeout(() => setTyping(true), 1500);
    const off = setTimeout(() => setTyping(false), 1500 + TYPING_MS);
    return () => {
      clearTimeout(on);
      clearTimeout(off);
      setTyping(false);
    };
  }, [openId, state.stage]);

  const awaySince = useRef(0);
  usePresenceEvent("change", (s) => {
    if (!chat || state.stage < 2) return;
    if (s.lookingAway && !awaySince.current) awaySince.current = Date.now();
    if (!s.lookingAway && awaySince.current) {
      awaySince.current = 0;
      if (extra[chat.id]) return; // once per chat
      setExtra((e) => ({
        ...e,
        [chat.id]: [{ me: false, text: "…are you still there?", days: 0, time: clock(Date.now()) }],
      }));
    }
  });

  // new bubbles arrive, older ones are already there
  useGSAP(
    () => {
      const last = pane.current?.querySelector(`.${styles.thread} > :last-child`);
      if (last) gsap.from(last, { opacity: 0, y: 6, duration: 0.28, ease: "power3.out" });
      const scroller = pane.current?.querySelector(`.${styles.thread}`);
      scroller?.scrollTo({ top: 1e6 });
    },
    { scope: pane, dependencies: [openId, lines.length, typing] },
  );

  return (
    <div className={styles.messages}>
      <ul className={styles.list} aria-label="Conversations">
        {CHATS.map((c) => {
          const last = [...c.lines, ...(extra[c.id] ?? [])].at(-1)!;
          return (
            <li key={c.id}>
              <button className={`${styles.row} ${c.id === openId ? styles.active : ""}`} onClick={() => open(c.id)}>
                <Avatar name={c.name} className={styles.avatar} />
                <span className={styles.rowText}>
                  <span className={styles.rowHead}>
                    <span className={`${styles.name} ${extra[c.id] && c.id !== openId ? styles.unread : ""}`}>{c.name}</span>
                    <span className={styles.meta}>{when(last.days)}</span>
                  </span>
                  <span className={styles.preview}>{preview(last)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div ref={pane} className={styles.pane}>
        {!chat ? (
          <p className={styles.meta} style={{ padding: 24 }}>
            {CHATS.length} conversations
          </p>
        ) : (
          <>
            <header className={styles.head}>
              <Avatar name={chat.name} className={styles.avatar} />
              <span>
                <span className={styles.name}>{chat.name}</span>
                <span className={styles.status}>{typing ? "typing…" : chat.status}</span>
              </span>
            </header>
            <div className={styles.thread}>
              {lines.map((l, i) => {
                const prev = lines[i - 1];
                const next = lines[i + 1];
                const newDay = !prev || prev.days !== l.days;
                const lastOfRun = !next || next.me !== l.me || next.days !== l.days;
                return (
                  <Fragment key={i}>
                    {newDay && <span className={styles.day}>{when(l.days)}</span>}
                    <Bubble line={l} tail={lastOfRun} onPhoto={() => dispatch({ type: "open", id: "photos" })} />
                    {l.me && l.read && (!next || !next.me) && <span className={styles.read}>Read {l.read}</span>}
                  </Fragment>
                );
              })}
              {typing && (
                <span className={styles.typing} aria-label="Mara is typing">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function preview(l: ChatLine) {
  if (l.deleted) return "message deleted";
  if (l.voice) return `voice message · ${l.voice.length}`;
  if (l.photo) return "photo";
  return l.text ?? "";
}

function Bubble({ line: l, tail, onPhoto }: { line: ChatLine; tail: boolean; onPhoto: () => void }) {
  const cls = `${styles.bubble} ${l.me ? styles.me : ""} ${tail ? styles.tail : ""}`;
  if (l.deleted) return <div className={`${cls} ${styles.deleted}`}>This message was deleted</div>;
  return (
    <div className={cls} title={l.time}>
      {l.photo && (
        <button className={styles.photo} onClick={onPhoto} aria-label={`${l.photo}, open in Photos`}>
          <Image src={photoSrc(l.photo)} alt="" width={240} height={160} sizes="240px" />
        </button>
      )}
      {l.voice && (
        <span className={styles.voice}>
          <VoicePlayer id="ev-voicenote" length={l.voice.length} />
          <span className={styles.transcript}>“{l.voice.transcript}”</span>
        </span>
      )}
      {l.text && <span>{l.text}</span>}
      <span className={styles.time}>{l.time}</span>
    </div>
  );
}

