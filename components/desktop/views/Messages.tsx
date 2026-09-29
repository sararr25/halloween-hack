"use client";

import { Fragment, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { CHATS, type ChatLine } from "@/lib/story/content";
import { usePresenceEvent } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";
import { Empty, Row, Split, when } from "./shared";
import styles from "./views.module.css";

gsap.registerPlugin(useGSAP);

// S4 · Messages. Mara or Theo: whichever you read, you learn the same thing (fake choice).
// Stage 2+: look away while a chat is open and, when you come back, someone has written.
export default function Messages() {
  const { state, dispatch } = useStory();
  const [openId, setOpenId] = useState<string | null>(null);
  const [extra, setExtra] = useState<Record<string, ChatLine[]>>({});
  const pane = useRef<HTMLDivElement>(null);
  const chat = CHATS.find((c) => c.id === openId);
  const lines = chat ? [...chat.lines, ...(extra[chat.id] ?? [])] : [];

  const open = (id: string) => {
    setOpenId(id);
    if (id === "mara" || id === "theo") dispatch({ type: "clue", id: "chat_window" });
  };

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
      const last = pane.current?.querySelector(`.${styles.bubbles} > :last-child`);
      if (last) gsap.from(last, { opacity: 0, y: 6, duration: 0.28, ease: "power3.out" });
      pane.current?.parentElement?.scrollTo({ top: 1e6 });
    },
    { scope: pane, dependencies: [openId, lines.length] },
  );

  return (
    <Split
      list={CHATS.map((c) => {
        const last = [...c.lines, ...(extra[c.id] ?? [])].at(-1)!;
        return (
          <Row
            key={c.id}
            active={c.id === openId}
            unread={!!extra[c.id] && c.id !== openId}
            onClick={() => open(c.id)}
            title={c.name}
            meta={when(last.days)}
            preview={last.text ?? "voice message"}
          />
        );
      })}
    >
      {!chat ? (
        <Empty>{CHATS.length} conversations</Empty>
      ) : (
        <div ref={pane} className={styles.bubbles}>
          {lines.map((l, i) => (
            <Fragment key={i}>
              {(i === 0 || lines[i - 1].days !== l.days) && <span className={styles.day}>{when(l.days)}</span>}
              <div className={`${styles.bubble} ${l.me ? styles.me : ""}`} title={l.time}>
                {l.text}
                {l.voice && (
                  <div className={styles.voice}>
                    <span className={styles.wave}>
                      {WAVE.map((h, j) => (
                        <i key={j} style={{ height: h }} />
                      ))}
                      &nbsp;{l.voice.length}
                    </span>
                    <span className={styles.transcript}>“{l.voice.transcript}”</span>
                  </div>
                )}
              </div>
            </Fragment>
          ))}
        </div>
      )}
    </Split>
  );
}

const WAVE = [4, 9, 14, 7, 11, 16, 6, 12, 8, 15, 5, 10, 13, 6, 9, 4, 11, 7];
