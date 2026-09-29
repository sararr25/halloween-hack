"use client";

import { useState } from "react";
import { MAILS } from "@/lib/story/content";
import { useLookingAway } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { Empty, Row, Split, useFill, when } from "./shared";
import styles from "./views.module.css";

// S2 · Mail. Ten ordinary mails and one empty one to herself, "for later".
export default function Mail() {
  const { state, dispatch } = useStory();
  const f = useFill();
  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const [tried, setTried] = useState(false);
  const away = useLookingAway();
  const mail = MAILS.find((m) => m.id === openId);

  const open = (id: string) => {
    setOpenId(id);
    setTried(false);
    setRead((r) => new Set(r).add(id));
    if (MAILS.find((m) => m.id === id)?.key) dispatch({ type: "clue", id: "mail_for_later" });
  };

  return (
    <Split
      list={MAILS.map((m) => (
        <Row
          key={m.id}
          active={m.id === openId}
          unread={!read.has(m.id) && m.days <= 7}
          onClick={() => open(m.id)}
          title={m.from}
          meta={when(m.days)}
          preview={m.subject}
        />
      ))}
    >
      {!mail ? (
        <Empty>{MAILS.length} messages</Empty>
      ) : (
        <article>
          <h2 className={styles.subject}>{mail.subject}</h2>
          <p className={styles.byline}>
            {mail.from} · {when(mail.days, mail.time)}
          </p>
          <div className={styles.prose}>
            {mail.body.length === 0 && <p className={styles.empty}>(no text)</p>}
            {mail.body.map((p, i) => (
              <p key={i}>{f(p)}</p>
            ))}
          </div>
          {mail.attachment && (
            <>
              <button className={styles.attachment} onClick={() => setTried(true)}>
                {/* the name holds while you look at it; it comes apart when you look away */}
                <span>{away && state.stage >= 1 ? scramble(mail.attachment) : mail.attachment}</span>
                <small>4.2 MB</small>
              </button>
              {tried && <p className={styles.byline} style={{ marginTop: 10 }}>format not supported</p>}
            </>
          )}
        </article>
      )}
    </Split>
  );
}

function scramble(s: string) {
  const glyphs = "▚▞░▒▓◆◇";
  return s
    .split("")
    .map((c, i) => (i % 3 === 1 ? glyphs[(i * 7) % glyphs.length] : c))
    .join("");
}
