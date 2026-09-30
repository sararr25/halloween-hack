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

import { existsSync, readFileSync, writeFileSync } from "node:fs";

const CLIPS = [
  {
    // E.V.'s voicemail: almost a whisper, then only breathing, a window, traffic (added live)
    id: "ev-voicemail",
    voice: "aura-2-pandora-en",
    speed: 0.95,
    text: "It's me... I'm by the window.",
  },
  {
    // Mara, five days ago, near midnight: worried sick, trying to stay calm and failing
    id: "mara-1",
    voice: "aura-2-theia-en",
    speed: 1.08,
    text: "Ev. Ev, it's me, again. Where are you? Nobody's heard from you, your phone just rings and rings. I'm not angry, okay? I just need to know you're okay. Call me. Please. Whenever you get this. Please.",
  },
  {
    // Mara, three days ago, 02:40, outside E.V.'s flat: scared, out of breath
    id: "mara-2",
    voice: "aura-2-theia-en",
    speed: 1.18,
    text: "Ev! Ev, pick up. Pick up. I'm outside yours, the door's open. The door's just open! And your laptop's on. Why is your laptop on? And the light across the road, it's on. There's someone in the window. They're not moving. They're just standing there, looking at me. Call me. Please, please call me!",
  },
  {
    // Mara, yesterday: she went back in. Panicked, and cut off mid-sentence
    id: "mara-3",
    voice: "aura-2-theia-en",
    speed: 1.2,
    text: "Ev, I went back. I went inside. Your laptop was open and it was, it was showing me. Me! Standing in your room, filmed from across the road. Right now. Ev, who is watching this? Who is",
  },
  {
    // Mum, four days ago: warm, frightened, holding it together for her daughter
    id: "mum",
    voice: "aura-2-hera-en",
    speed: 1.02,
    text: "Evie, it's Mum. I've rung and rung, darling. The police came round, they asked me all sorts. I told them you'd never just go, not without telling me. Just ring me, love. Even in the middle of the night. I'm keeping my phone on. I'm keeping the landing light on.",
  },
  {
    // the unknown caller, part one: calm, low. The time is lost in the static (added live)
    id: "unknown-1",
    voice: "aura-2-draco-en",
    speed: 0.84,
    text: "It's ready. They'll open it at",
  },
  {
    // the unknown caller, part two, after the static
    id: "unknown-2",
    voice: "aura-2-draco-en",
    speed: 0.8,
    text: "Leave the light on.",
  },
  {
    // E.V.'s voice note to Mara: shaken, whispering fast, talking herself out of it and failing
    id: "ev-voicenote",
    voice: "aura-2-pandora-en",
    speed: 1.05,
    text: "Mara. Okay. Okay, I did something stupid. I stood at the window and I raised my hand. Just to see. And the shape over there, it raised its hand too. Not after me. With me! At the exact same time. I'm not imagining it. Mara, I'm not imagining it.",
  },
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
for (const clip of CLIPS) {
  const out = `public/audio/${clip.id}.mp3`;
  if (only ? clip.id !== only : existsSync(out)) continue;
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
