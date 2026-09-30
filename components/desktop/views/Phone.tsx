"use client";

import { useState } from "react";
import { CALLS } from "@/lib/story/content";
import { useStory } from "@/lib/story/store";
import type { RecordingId } from "@/lib/audio/voices";
import { Empty, Row, Split, useFill, when } from "./shared";
import VoicePlayer from "./VoicePlayer";
import styles from "./views.module.css";

// Phone, synced from E.V.'s mobile. The automatic transcript is unreliable: what you would
// hear and what it writes disagree, and only the text knows about your session.
// Stage 2+: a voicemail from E.V.'s own number, dated after she disappeared.
// The recordings are played by lib/audio/voices.ts (Deepgram voices + procedural sound).

const RECORDING: Record<string, RecordingId> = {
  ev: "ev-voicemail",
  "mara-1": "mara-voicemail",
  "mara-2": "mara-voicemail-2",
  "mara-3": "mara-voicemail-3",
  mum: "mum-voicemail",
  unknown: "unknown-voicemail",
};

function recordingOf(callId: string): RecordingId {
  const id = RECORDING[callId];
  if (!id) throw new Error(`voicemail ${callId} has no recording in lib/audio/voices.ts`);
  return id;
}
export default function Phone() {
  const { state, dispatch } = useStory();
  const f = useFill();
  const calls = CALLS.filter((c) => !c.fromStage || state.stage >= c.fromStage);
  const [openId, setOpenId] = useState<string | null>(null);
  const call = calls.find((c) => c.id === openId);

  const open = (id: string) => {
    setOpenId(id);
    if (id === "ev") dispatch({ type: "clue", id: "voicemail_ev" });
    if (id === "unknown") dispatch({ type: "clue", id: "voicemail_unknown" });
  };

  return (
    <Split
      list={calls.map((c) => (
        <Row
          key={c.id}
          active={c.id === openId}
          unread={!!c.voicemail && c.kind === "missed" && c.id !== openId && c.days < 7}
          onClick={() => open(c.id)}
          title={<span className={c.kind === "missed" ? styles.missed : ""}>{c.who}</span>}
          meta={when(c.days, c.time)}
          preview={`${c.kind}${c.voicemail ? ` · voicemail ${c.voicemail.length}` : ""}`}
        />
      ))}
    >
      {!call ? (
        <Empty>synced from E.V.&apos;s phone · {calls.length} calls</Empty>
      ) : (
        <article>
          <h2 className={styles.subject}>{call.who}</h2>
          <p className={styles.byline}>
            {call.number} · {call.kind} · {when(call.days, call.time)}
          </p>
          {call.voicemail ? (
            <>
              <div className={styles.panel}>
                <span className={styles.panelLabel}>voicemail · {call.voicemail.length} · audio</span>
                <VoicePlayer key={call.id} id={recordingOf(call.id)} length={call.voicemail.length} />
              </div>
              <div className={styles.panel}>
                <span className={styles.panelLabel}>transcript · automatic · confidence low</span>
                <span>{f(call.voicemail.transcript)}</span>
              </div>
            </>
          ) : (
            <Empty>no voicemail</Empty>
          )}
        </article>
      )}
    </Split>
  );
}
