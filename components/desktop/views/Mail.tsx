"use client";

import { useState } from "react";
import { BOOKS, MAILS, SIGNIN, TRACKING, USAGE, type Mail as MailItem } from "@/lib/story/content";
import { useLookingAway } from "@/lib/presence/context";
import { useStory } from "@/lib/story/store";
import { Avatar, when, useFill } from "./shared";
import styles from "./mail.module.css";

// S2 · Mail. Every mail is its own kind of email; the service ones carry a small drawn
// block (a sign-in near home, the night usage, the parcel route, the contact sheet).
export default function Mail() {
  const { dispatch } = useStory();
  const [openId, setOpenId] = useState<string | null>(null);
  const [read, setRead] = useState<Set<string>>(() => new Set());
  const mail = MAILS.find((m) => m.id === openId);

  const open = (m: MailItem) => {
    setOpenId(m.id);
    setRead((r) => new Set(r).add(m.id));
    if (m.key) dispatch({ type: "clue", id: "mail_for_later" });
  };

  return (
    <div className={styles.mail}>
      <ul className={styles.list} aria-label="Inbox">
        {MAILS.map((m) => (
          <li key={m.id}>
            <button className={`${styles.row} ${m.id === openId ? styles.active : ""}`} onClick={() => open(m)}>
              <Avatar name={m.from} className={styles.avatar} />
              <span className={styles.rowText}>
                <span className={styles.rowHead}>
                  <span className={`${styles.from} ${!read.has(m.id) && m.days <= 7 ? styles.unread : ""}`}>{m.from}</span>
                  <span className={styles.meta}>{when(m.days)}</span>
                </span>
                <span className={styles.rowSubject}>{m.subject}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className={styles.pane}>{mail ? <Reader key={mail.id} mail={mail} /> : <p className={styles.meta}>{MAILS.length} messages · inbox</p>}</div>
    </div>
  );
}

function Reader({ mail }: { mail: MailItem }) {
  const f = useFill();
  const { dispatch } = useStory();
  const away = useLookingAway();
  const [tried, setTried] = useState(false);

  return (
    <article className={`${styles.reader} ${styles[mail.kind]}`}>
      <h2 className={styles.subject}>{mail.subject}</h2>
      <div className={styles.header}>
        <Avatar name={mail.from} className={styles.avatar} />
        <span>
          <span className={styles.sender}>{mail.from}</span> <span className={styles.address}>&lt;{mail.address}&gt;</span>
          <span className={styles.to}>to {mail.kind === "self" ? "herself" : "E.V."}</span>
        </span>
        <span className={styles.date}>{when(mail.days, mail.time)}</span>
      </div>

      {mail.scheduled && (
        <p className={styles.chip}>
          scheduled send · written {when(mail.days, mail.time)} · delivered today at {f("{{entry}}")}
        </p>
      )}

      <div className={styles.body}>
        {mail.body.length === 0 && <p className={styles.empty}>(no text)</p>}
        {mail.body.map((p, i) => (
          <p key={i}>{f(p)}</p>
        ))}
      </div>

      {mail.block === "signin" && <SignIn />}
      {mail.block === "usage" && <Usage />}
      {mail.block === "tracking" && <Tracking />}
      {mail.block === "contact" && <ContactSheet onFrame6={() => dispatch({ type: "open", id: "photos" })} />}
      {mail.block === "books" && <Books />}

      {mail.quote && (
        <blockquote className={styles.quote}>
          <p className={styles.quoteHead}>
            On {when(mail.quote.days)}, {mail.quote.from} wrote:
          </p>
          {mail.quote.text.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </blockquote>
      )}

      {mail.attachment && (
        <>
          <button className={styles.attachment} onClick={() => setTried(true)}>
            {/* the name holds while you look at it; it comes apart when you look away */}
            <span>{away ? scramble(mail.attachment) : mail.attachment}</span>
            <small>4.2 MB</small>
          </button>
          {tried && <p className={styles.meta}>format not supported</p>}
        </>
      )}

      {mail.receipt && <p className={styles.receipt}>Read receipt sent to {mail.from} · {f("{{now}}")}</p>}
    </article>
  );
}

function SignIn() {
  const [answered, setAnswered] = useState(false);
  return (
    <div className={styles.card}>
      <svg viewBox="0 0 220 120" className={styles.map} aria-hidden="true">
        {[20, 60, 100].map((y) => (
          <line key={y} x1="0" x2="220" y1={y} y2={y} />
        ))}
        {[30, 90, 150, 200].map((x) => (
          <line key={x} x1={x} x2={x} y1="0" y2="120" />
        ))}
        <circle className={styles.home} cx="90" cy="60" r="4" />
        <circle className={styles.ring} cx="104" cy="56" r="14" />
        <circle className={styles.them} cx="104" cy="56" r="3" />
      </svg>
      <dl className={styles.facts}>
        <dt>Device</dt>
        <dd>{SIGNIN.device}</dd>
        <dt>Where</dt>
        <dd>{SIGNIN.place}</dd>
        <dt>When</dt>
        <dd>{SIGNIN.time}</dd>
      </dl>
      {answered ? (
        <p className={styles.answer}>{SIGNIN.answer}</p>
      ) : (
        <button className={styles.action} onClick={() => setAnswered(true)}>
          {SIGNIN.button}
        </button>
      )}
    </div>
  );
}

function Usage() {
  const max = Math.max(...USAGE);
  return (
    <div className={styles.card}>
      <p className={styles.cardLabel}>average use by hour · September</p>
      <svg viewBox="0 0 240 70" className={styles.bars} aria-label="Usage is highest between 23:00 and 04:00">
        {USAGE.map((v, h) => {
          const height = (v / max) * 56;
          const night = h >= 23 || h < 4;
          return <rect key={h} x={h * 10 + 1} y={60 - height} width="7" height={height} className={night ? styles.night : undefined} />;
        })}
        {["00", "06", "12", "18"].map((t, i) => (
          <text key={t} x={i * 60 + 1} y="69">
            {t}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Tracking() {
  return (
    <ol className={`${styles.card} ${styles.route}`}>
      {TRACKING.map((t, i) => (
        <li key={t.time} className={i === TRACKING.length - 1 ? styles.last : undefined}>
          <span className={styles.meta}>{t.time}</span>
          <span>{t.step}</span>
        </li>
      ))}
    </ol>
  );
}

function ContactSheet({ onFrame6 }: { onFrame6: () => void }) {
  return (
    <div className={styles.card}>
      <p className={styles.cardLabel}>contact sheet · Harrow St · 12 frames</p>
      <div className={styles.sheet}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((n) =>
          n === 6 ? (
            <button key={n} className={`${styles.frame} ${styles.burned}`} onClick={onFrame6} aria-label="Frame 6, open in Photos">
              <span>{n}</span>
            </button>
          ) : (
            <span key={n} className={styles.frame} style={{ opacity: 0.55 + ((n * 37) % 40) / 100 }}>
              <span>{n}</span>
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function Books() {
  return (
    <ul className={styles.books}>
      {BOOKS.map((b, i) => (
        <li key={b.title}>
          <span className={styles.cover} style={{ filter: `brightness(${0.7 + i * 0.15})` }}>
            {b.title}
          </span>
          <span>{b.note}</span>
        </li>
      ))}
    </ul>
  );
}

function scramble(s: string) {
  const glyphs = "▚▞░▒▓◆◇";
  return s
    .split("")
    .map((c, i) => (i % 3 === 1 ? glyphs[(i * 7) % glyphs.length] : c))
    .join("");
}
