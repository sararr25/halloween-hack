"use client";

import { useEffect, useRef } from "react";
import { useStory } from "@/lib/story/store";
import { clock } from "@/lib/story/time";

// The browser tab keeps watching. Leave the page while the recovery runs and the tab turns
// into a recording (title "● REC · operator away", the Sign as its icon). Come back to the
// desktop after a few seconds away and the system says it noticed, twice at most.
const AWAY_TITLE = "● REC · operator away";
const NOTICE_AFTER_MS = 3000;

const icons = () => [...document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]')];

export default function TabWatch() {
  const { state, dispatch } = useStory();
  const live = state.phase !== "premise";
  const phase = useRef(state.phase);
  useEffect(() => {
    phase.current = state.phase;
  });
  const told = useRef(0);

  useEffect(() => {
    if (!live) return;
    const title = document.title;
    const hrefs = icons().map((l) => l.href);
    let leftAt = 0;
    const change = () => {
      if (document.hidden) {
        leftAt = Date.now();
        document.title = AWAY_TITLE;
        icons().forEach((l) => (l.href = "/sign.png"));
        return;
      }
      document.title = title;
      icons().forEach((l, i) => (l.href = hrefs[i] ?? l.href));
      if (phase.current !== "desktop" || !leftAt || Date.now() - leftAt < NOTICE_AFTER_MS || told.current >= 2) return;
      told.current += 1;
      dispatch({
        type: "notify",
        from: "system",
        text: told.current === 1 ? `you left at ${clock(leftAt)}. we didn't.` : "you left again. the session kept going.",
      });
    };
    document.addEventListener("visibilitychange", change);
    return () => {
      document.removeEventListener("visibilitychange", change);
      document.title = title;
    };
  }, [live, dispatch]);

  return null;
}
