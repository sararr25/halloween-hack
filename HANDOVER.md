# Handover — Visual design direction

Status as of 2026-09-29. Concept, references and twist live in `project.md`; this file covers only the visual design decided so far.

## What exists

- `prototype/design-mockup.html` — single-file static mockup of the fake desktop (home screen). Open it directly in a browser, no build step.
- Bottom-right switcher (`1 · Perfect / 2 · Watched / 3 · Corrupted`) is a designer-only tool to preview the three stages. It is not part of the experience.

## Decisions (agreed with the owner)

| Topic | Decision |
|---|---|
| Format | Desktop website simulating a computer OS (not mobile) |
| Mood | Dark, horror-leaning psychological thriller; no Halloween clichés |
| Main color | **No red or orange** as main color (too common/sloppy) |
| Palette | **"Ink"** — blue-black base, slate greys, bone-white text |
| Neon | One blinding neon, **electric cyan `#00f0ff`**, used sparingly |
| Materials | Frosted glass windows, heavy blur, film grain, vignette, glitch |
| Narrative arc | Stage A "perfect life" → B surveillance moments → C corruption |

### Palette tokens

| Token | Value | Use |
|---|---|---|
| `--bg` | `#06080d` | Page background |
| `--glass` | `rgba(15,19,28,.45)` | Window/icon glass fill |
| `--text` | `#d8dce5` | Body text |
| `--muted` | `#646b7a` | Metadata, timestamps only (low contrast, never body copy) |
| `--accent` | `#eef0f4` | Neutral highlight (white + grey underline) |
| `--ghost` | `#8a96b3` | Glitch RGB-split colour (becomes neon in stage 3) |
| `--neon` | `#00f0ff` | The single neon |

Fonts: Inter Tight (UI) + JetBrains Mono (paths, timestamps, metadata), via Google Fonts.

### Neon rule

Cyan always means "something that knows about you". Its usage grows with tension:

- **Stage 1:** none.
- **Stage 2:** one element only — the newly appeared `backup_you` folder (breathing glow).
- **Stage 3:** the lit window across the street, lines built from real session data (e.g. "you opened this at HH:MM"), and glitch RGB-split flashes.

Never more than 1–2 neon elements per screen, otherwise it turns cyberpunk.

### Stage behaviour

| | Stage 1 · Perfect | Stage 2 · Watched | Stage 3 · Corrupted |
|---|---|---|---|
| Grain / vignette | low | medium | high |
| Glitch frequency | every 9–16 s (subliminal) | every 3.5–7 s | every 0.9–2.6 s + note shivers |
| New elements | — | webcam window, REC indicator, "photo taken from outside" toast, `backup_you` folder, silhouette in lit window | note text rewritten with real session time, "you spent Ns getting here" toast, face blurred in photo |

Glitches and animations are disabled under `prefers-reduced-motion`.

## Open points / next steps

1. Stage 3 glass still carries a faint cool tint — neutralise if it reads purple.
2. Placeholder content (`m.lenhart`, dates, CSS-drawn photos) is illustrative only; real story assets still to be written/produced.
3. Monochrome UI can hide what's clickable — solve with motion (hover glow, breathing) rather than colour.
4. Build the real app: Next.js + TypeScript on Vercel (owner's default stack, pnpm). Port the tokens above to CSS variables/Tailwind theme; windows must become draggable, openable apps (Notes, Photos, Messages, History, Trash, backup folder).
5. Session-data twist (open time, time to find clues, back-navigation) is only mocked with `Date` in the prototype; needs real tracking in-app (client-side only, no personal data sent anywhere).
