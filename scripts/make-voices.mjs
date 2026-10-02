#!/usr/bin/env node
// Generates the story's voice recordings with Deepgram Aura-2 TTS into public/audio/.
// Run once from the repo root: `node scripts/make-voices.mjs` (reads DEEPGRAM_API_KEY from
// .env.local, never ships it). Existing files are skipped; pass a clip id to redo just
// that one: `node scripts/make-voices.mjs mara-2`. Every call costs credits: redo only
// what you listened to and did not like.
//
// Aura-2 has no emotion control: the feeling is in the writing (hesitations, repeats,
// short broken sentences) and the speed. Phone-line filtering and room noise are added
// at play time by lib/audio/voices.ts, not baked in.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

// The lines live in lib/story/voices.json, shared with the transcripts the game shows.
const CLIPS = Object.entries(JSON.parse(readFileSync("lib/story/voices.json", "utf8")).clips).map(([id, c]) => ({
  id,
  ...c,
  text: c.say,
}));

// `--audition`: the same line in a few candidate voices, into voice-audition/ (git-ignored),
// so the owner can pick by ear before everything is regenerated.
const AUDITION = [
  { line: "mum", voices: ["aura-2-helena-en", "aura-2-vesta-en", "aura-2-hera-en"] },
  { line: "ev-forlater", voices: ["aura-2-juno-en", "aura-2-selene-en", "aura-2-cora-en"] },
];

function apiKey() {
  const env = readFileSync(".env.local", "utf8");
  const line = env.split(/\r?\n/).find((l) => l.startsWith("DEEPGRAM_API_KEY="));
  const key = line?.slice("DEEPGRAM_API_KEY=".length).trim();
  if (!key) throw new Error("DEEPGRAM_API_KEY missing in .env.local");
  return key;
}

const only = process.argv[2];
const key = apiKey();
let chars = 0;
const jobs =
  only === "--audition"
    ? AUDITION.flatMap(({ line, voices }) => {
        const c = CLIPS.find((x) => x.id === line);
        if (!c) throw new Error(`audition: no line ${line}`);
        return voices.map((voice) => ({ ...c, voice, out: `voice-audition/${line}__${voice.replace(/^aura-2-|-en$/g, "")}.mp3` }));
      })
    : CLIPS.map((c) => ({ ...c, out: `public/audio/${c.id}.mp3` }));
if (only === "--audition") mkdirSync("voice-audition", { recursive: true });
for (const clip of jobs) {
  const out = clip.out;
  if (only === "--audition" ? existsSync(out) : only ? clip.id !== only : existsSync(out)) continue;
  const url = `https://api.deepgram.com/v1/speak?model=${clip.voice}&encoding=mp3&speed=${clip.speed}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: clip.text }),
  });
  if (!res.ok) throw new Error(`${clip.id}: Deepgram ${res.status} ${await res.text()}`);
  writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  chars += clip.text.length;
  console.log(`wrote ${out}`);
}
console.log(`characters sent: ${chars} (about $${((chars / 1000) * 0.03).toFixed(3)})`);
