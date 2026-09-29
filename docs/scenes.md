# Scene, animazioni e interazioni

Spec scena per scena per le 10 schermate di `project.md` §6. Palette, stage e regola del neon sono in `HANDOVER.md`. Setup tecnico in `docs/tech-setup.md`.

## Tesi di interazione (validata il 2026-09-29, formato genjutsu)

**Interaction thesis:** il desktop si comporta come un oggetto che *ti sta guardando*. All'inizio tutto è immobile e perfetto; poi il movimento arriva sempre in risposta a te (alla tua testa, al tuo sguardo, alla tua mano) e sempre con un piccolo ritardo, come qualcuno che finge di non averti visto. Non c'è mai un movimento decorativo.

**Allowed patterns:** frosted glass con blur forte, grain, vignette, glitch RGB-split, un solo neon cyan `#00f0ff` (≤2 elementi per schermo), testo mono per metadati, finestre OS trascinabili, typewriter per il testo che si riscrive.

**Vietato:** jumpscare, bounce/spring giocosi, gradienti, blob luminosi decorativi, animazioni in loop senza motivo narrativo, suoni forti improvvisi.

### Linguaggio di movimento

| Cosa | Durata | Easing | Note |
|---|---|---|---|
| Hover / focus icone | 120 ms | `power2.out` | solo opacità + glow bone-white |
| Apertura finestra | 280 ms | `cubic-bezier(0.2,0,0,1)` | scale .98→1 + opacità; GSAP Flip dall'icona |
| Chiusura finestra | 180 ms | `power2.in` | solo opacità (l'uscita è più sobria dell'entrata) |
| "Qualcosa ti segue" (occhio, silhouette) | lag ~300 ms (tarato sul Mac) | EMA α 0.3 + interpolatore cubic Rive | il ritardo è l'inquietudine: mai 1:1 |
| Testo riscritto | 28–45 ms/char | `steps()` | SplitText + caret; stage 3 con errori corretti |
| Glitch | 60–140 ms | `none` | visivo ogni 6–11 / 2.5–5 / 0.8–2 s per stage; il **suono** molto più raro (30–50 / 18–30 / 10–16 s), a rotazione su 4 suoni |
| Transizione di stage | 1.2–2 s | `sine.inOut` | uniform shader via GSAP, mai un taglio netto |

`prefers-reduced-motion`: niente glitch né shiver, i follow diventano statici, il testo appare intero. La storia resta completa.

## Stato di implementazione (2026-09-29, notte)

| Pezzo | Stato | Dove |
|---|---|---|
| Occhio Rive (`Presence`: headX/headY, lookingAway, blink) | ✅ provato sul Mac; ora solo in `/lab` | `rive/presence/` (artboard `Eye`) |
| Obiettivo di sorveglianza (finestra Camera) | ✅ ghiera che ruota con la testa, diaframma che si chiude se guardi altrove, otturatore sul battito (o sul clic senza camera) | `rive/presence/` (artboard `Lens`), `views/Camera.tsx` |
| Tracking testa, battito, sguardo altrove, gesture | ✅ provato sul Mac (la mano aperta è la più fragile) | `lib/presence/` |
| Overlay WGSL (grain, vignette, scanline, strappi glitch sincronizzati, faro) | ✅ visibile nel browser con `enableGPUCanvas: true` | `rive/effects/`, `Experience.tsx` (`Overlay`) |
| Foto IMG_0418 + lente (S3) | ✅ real photo (IMG_0413 view) + cut-out figure drawn in Luau, lens by clip + transform, lit window from WGSL | `rive/photo/`, `views/PhotoLens.tsx`, `scripts/make-photo-plates.py` |
| S9 shader (`window_across`: building, figure, block corruption) | ✅ (replaces `corruption` + `mirror_dither`, see S9) | `rive/story/window_across.wgsl` |
| S1 dentro `/` (camera + microfono, silhouette) | ✅ percorso "rifiuto"; percorso "consenso" da riprovare sul Mac | `components/desktop/Boot.tsx` |
| S2–S7 con contenuti, progressione 1 → 2 → 3 | ✅ | `components/desktop/`, `lib/story/content.ts` |
| Suono procedurale + voci | ✅ written; the owner has not heard the latest mix or the Deepgram voices yet | `lib/audio/sfx.ts`, `lib/audio/voices.ts`, `public/audio/` |
| Foto AI, sfondo, polaroid | ✅ wired | `public/photos/`, `public/wallpaper/` |
| Deploy | ✅ https://halloween-hack.vercel.app | Vercel `sararuffini-projects/halloween-hack` |
| S8–S10 | ✅ mouse path verified; camera + mic path to test on the Mac | `views/Session.tsx`, `Reveal.tsx`, `Login.tsx` |

### Taratura attuale (in `lib/presence/tracker.ts`)

| Costante | Valore | Significato |
|---|---|---|
| `YAW_RANGE` / `PITCH_RANGE` | 18° / 12° | rotazione della testa che porta `headX`/`headY` a ±1 |
| `EMA` | 0.3 | smussamento della posa della testa |
| `AWAY_YAW` / `AWAY_AFTER_MS` | 25° / 1500 ms | oltre questa rotazione, e per questo tempo, conta come "guarda altrove" |
| `LOST_AFTER_MS` | 3000 ms | tempo senza volto prima di `faceLost` |
| `BLINK_ON` / `BLINK_OFF` | 0.5 / 0.3 | isteresi del battito |
| `GESTURE_SCORE` / `GESTURE_HOLD_MS` | 0.6 / 300 ms | confidenza e durata minime di una gesture |
| Lag Rive (`Lag X/Y` in `scene.rml`) | 0.3 s | ritardo con cui l'occhio segue |

## Chi fa cosa

| Livello | Tecnologia | Dove |
|---|---|---|
| Oggetti vivi | **Rive** (RML + state machine + view model `Presence`) | occhio/webcam, silhouette, `backup_you`, cursore fantasma, boot, login finale |
| Post-process | **Rive WGSL** (artboard come texture) | `grain_vignette`, `glitch_rgb`, `lens`, `corruption`, `mirror_dither` |
| UI del sistema operativo | **GSAP** (Flip, SplitText, CustomEase) + React | finestre, toast, typewriter, drag |
| Percezione | **MediaPipe** Face Landmarker + Gesture Recognizer | modulo `presence` |

### View model Rive condiviso `Presence` (scritto dall'host JS)

| Proprietà | Tipo | Sorgente |
|---|---|---|
| `headX`, `headY` | number −1..1 | yaw/pitch smussati; fallback: mouse normalizzato |
| `blink` | trigger | eyeBlink > 0.5 (la media dei due occhi) |
| `lookingAway` | bool | \|yaw\|>25° o volto assente > 1.5 s; fallback: `document.hidden` o mouse fuori dalla finestra |
| `faceLost` | bool | nessun volto per 3 s |
| `gesture` | enum | `none/palm/fist/point/victory/thumbUp` (score > 0.7, stabile per 300 ms) |
| `stage` | number 1..3 | narrativa |
| `corruption` | number 0..1 | narrativa (GSAP) |
| `sessionSeconds` | number | timer reale |

### Shader WGSL (uniform principali)

| Shader | Uniform | Uso |
|---|---|---|
| `grain_vignette` | `time, grain, vignette` | sempre attivo, intensità per stage |
| `glitch_rgb` | `time, amount, seed, neon` | colpi di glitch; `neon` = 1 in stage 3 (split cyan) |
| *(realizzati insieme)* | `overlay_fx.wgsl`: `time, grain, vignette, glitch, neon, width, height, seed, headX, headY, beam` | un solo shader a tutto schermo; gli strappi partono quando la pagina cambia `pulse`; il **faro** (`beam`) segue `headX/headY` con 0.6 s di ritardo |
| `lens` | `center, radius, strength, time` | zoom "Rear Window" sulle foto; centro = cursore o testa. **Realizzato** come `rive/photo/photo_lens.wgsl`: la foto intera è disegnata nello shader (`lensX, lensY, lens, figure, silhouette`), il centro segue il cursore |
| `corruption` | `amount, time, blockSize` | displacement a blocchi + smear verticale (S9) |
| `mirror_dither` | `threshold, tint` | feed webcam in dither 1-bit cyan (S9, solo locale) |

## MediaPipe: la regola del "non detto"

L'utente non riceve mai l'istruzione "muovi la testa". La camera viene chiesta **dentro la finzione** (S1: "verifica identità operatore, richiesta dal protocollo di recupero"). Se l'utente rifiuta, tutto funziona con il mouse, e il rifiuto stesso diventa un dato ("hai rifiutato la verifica alle 21:14").

L'escalation va dal subliminale all'esplicito:

1. **Atto 1:** gli oggetti seguono la testa di pochissimo (±3°) e in ritardo. Non si nota consciamente.
2. **Atto 2:** quando distogli lo sguardo, al ritorno qualcosa è cambiato. Un battito di ciglia fa scattare un micro-glitch sincronizzato.
3. **Atto 3:** le gesture diventano chiavi, e il sistema dichiara di vederti.
4. **Finale:** il login aspetta che il tuo volto torni.

---

## Scene

### S1 · Boot / recupero dati · stage 1
- **Rive** artboard `boot`: log di recupero riga per riga, barra di progresso, state machine `idle → verifying → granted`. Durante `verifying` un piccolo indicatore a forma di iride si "mette a fuoco".
- **Shader:** `grain_vignette` basso, scanline leggere.
- **GSAP:** fade del desktop dopo `granted` (600 ms, una volta sola), poi arriva la prima nota del mittente anonimo in typewriter.
- **Interazione:** click su "Avvia recupero". Prompt camera diegetico. La finta calibrazione ("mantieni la posizione", 2 s) registra il baseline di yaw/pitch.
- **Dati reali:** timestamp di apertura salvato; flag `cameraDenied`.
- **Uscita:** desktop visibile.
- **Realizzato:** niente artboard `boot` e **niente iride/occhio** (richiesta della proprietaria: mostrare il tracking qui lo svela). Log battuto con suono di tastiera, `session opened HH:MM:SS` in chiaro (è la futura password). Camera e microfono in un'unica richiesta. Un mirino vuoto; su "hold still" viene tracciata la silhouette dell'operatore (contorno, linea di scansione, punti di riferimento). Se rifiuta: "verification refused" e la silhouette viene disegnata comunque, "operator · reconstructed". Passaggio al desktop con un timer, non con la fine del tween. Il mittente anonimo arriva sul desktop dopo 2.5 s.
- **Update 2026-09-29 (owner feedback: the traced outline looked childish):** the silhouette is now a measurement. One frame of the real face mesh (478 landmarks, worker → `lib/presence/face.ts` → Rive `scan/points`) is drawn by `rive/story/face_cloud.wgsl` as a 3D point cloud: a structured-light sweep acquires the points from noise, a counter runs to 478, then the head turns slowly. Refused or no face: a guessed face, jittering, `confidence 0.31`. Still never live in S1.

### S2 · Email · stage 1
- **GSAP:** app Mail con apertura Flip dall'icona, lista con stagger 30 ms.
- **Rive:** nessun oggetto vivo. La mail "per dopo" ha un'icona allegato Rive che resta leggibile finché la guardi e si corrompe quando `lookingAway`: il primo seme, invisibile.
- **Shader:** `glitch_rgb` subliminale (ogni 9–16 s).
- **Interazione:** click sulle mail; l'allegato non si apre ("formato non supportato").
- **Uscita:** aperta almeno la mail "per dopo", oppure 3 mail qualsiasi.
- **Realizzato:** l'allegato non è Rive: è il nome del file che si "sgretola" in glifi mentre guardi altrove. Mail ridisegnata: font serif (Newsreader), intestazione vera, un tipo di mail diverso per ogni mittente con blocchi disegnati (accesso "a 40 m da casa", consumi notturni, pacco firmato "E.V." al 4A, provino con il fotogramma 6 bruciato, mail "for later" programmata per arrivare oggi all'ora d'ingresso, ricevuta di lettura a Mara). La clue è aprire "for later"; non cambia lo stage.

### S3 · Foto · stage 1 → 2
- **Rive** artboard `photo_street`: la foto contiene la finestra di fronte come nodo animabile.
- **Shader:** `lens` segue il cursore; con camera attiva si sposta di poco anche con la testa (sporgerti in avanti = zoom? da testare con la scala dei landmark).
- **Interazione:** zoom su 10 foto. Nella foto chiave, lo sfondo sfocato **cambia posizione quando distogli lo sguardo** (lookingAway → swap di frame in Rive).
- **Uscita:** zoom sulla figura sfocata → passaggio a **stage 2** (transizione uniform 1.5 s) e compare la cartella `backup_you` (primo neon, respiro Rive 4 s).
- **Built (updated 2026-09-29):** IMG_0418 is the owner's IMG_0413 (Harrow St at night) rebuilt in Rive: the photo without the woman by the lamp post (`plate_soft/sharp.jpg`) and the woman as a cut-out (`figure_soft/sharp.png`), drawn by `rive/photo/lens.luau`. Soft everywhere, sharp and magnified ×1.8 under the lens (the sharp photo redrawn inside a circular clip). She stands by the lamp or 259 px to the left and moves only while you look away. The window above her is lit from inside by `photo_lens.wgsl`, someone behind the curtain, stronger each stage (0.12 / 0.45 / 0.9). Lens held ~700 ms on her → stage 2. All 16 photos are the AI images in `public/photos/`. The breathing of `backup_you` is CSS, not Rive.

### S4 · Chat · stage 2 · scelta finta
- **GSAP:** bolle in entrata con typing indicator. La scelta "chat con Marco / con l'amica" porta alla stessa informazione chiave.
- **Rive** artboard `webcam_widget`: compare la finestrina webcam con un indicatore REC. L'"occhio" della lente segue `headX/headY` con un lag di 500 ms.
- **Interazione:** se l'utente guarda via durante una chat, all'ultimo messaggio si aggiunge "…ci sei ancora?".
- **Uscita:** entrambe le chat, o una più la nota collegata.
- **Realizzato:** Mara e Theo (più R. Hale). La finestrina webcam non è qui: la **Camera si apre da sola all'ingresso nello stage 2** con l'obiettivo di sorveglianza Rive (`Lens`, lag 0.45 s). Chat con "last seen", "Read HH:MM", un messaggio eliminato che Mara nota, la foto IMG_0418 inviata a Theo (apre Foto), vocali con trascrizione; dallo stage 2 Mara "sta scrivendo…" e non invia nulla. "…are you still there?" in inglese.

### S5 · Note · stage 2
- **GSAP SplitText:** una nota riporta la **data reale di oggi** (`Date()`), scritta come se fosse stata digitata a mano (typewriter con un errore corretto).
- **Interazione:** blink → la riga sotto il cursore sfarfalla per 80 ms (glitch sincronizzato al battito).
- **Uscita:** aperta la nota datata.
- **Realizzato:** typewriter GSAP (non SplitText) con un errore corretto, e suono di tastiera. La nota "backup" contiene l'indizio della password ("Four digits, like a clock. The time they come in").

### S6 · Cronologia browser · stage 2
- **GSAP:** lista con stagger. Le ricerche compaiono "in tempo reale" mentre le leggi, come se qualcuno stesse ancora cercando.
- **Rive** `ghost_cursor`: un secondo cursore bone-white scorre la lista mezzo secondo prima del tuo. Con camera attiva segue lo sguardo.
- **Toast:** "foto scattata dall'esterno" (HANDOVER stage 2).
- **Uscita:** click sull'ultima ricerca → indizio della password del backup.
- **Realizzato:** niente cursore fantasma per ora. Dallo stage 2 compaiono tre ricerche "just now" battute a tastiera (una contiene l'ora d'ingresso). Il toast "foto dall'esterno" è di sistema: "IMG_0419 added · source: unknown device".

### S7 · Cartella Backup · stage 2 → 3
- **Rive** `backup_you`: la password sbaglia → shake orizzontale 6 px (niente bounce). Password giusta → apertura.
- **Gesture (camera attiva):** nei file precedenti compare un indizio visivo, una foto con la mano a `Victory` / `Pointing_Up`. Se l'utente fa quel gesto alla camera, la cartella si apre da sola, **senza che gli sia mai stato detto che la camera guarda le mani**. È il momento del "come ha fatto?".
- **Uscita:** passaggio a **stage 3**.
- **Realizzato:** 4 cifre = ora locale d'apertura della pagina (`HHMM`), rivedibile nel menu Recovery. Shake CSS/GSAP da 6 px. Dopo 2 errori il mittente anonimo scrive "…check her notes.". Con camera: `Victory` apre la cartella (indizio nella foto IMG_0390). Contenuto: readme di E.V. e tre log, `session_0418.log · in progress` con l'ora di apertura e il tempo impiegato.

### S8 · Primo colpo dati reali · stage 3
- **Rive** artboard `session_log`: log tecnico con `sessionSeconds` legato in data binding ("Sessione attiva da 6m 42s. Ultima interruzione: 12s fa", dove l'interruzione viene da `lookingAway`/`document.hidden`).
- **Shader:** `glitch_rgb` con `neon=1`, ogni 0.9–2.6 s; `grain_vignette` alto.
- **Gesture:** se l'utente copre la camera o mostra `Open_Palm`, lo schermo si oscura per 1 s e appare in mono: "non serve coprirti". Con camera negata: stesso effetto su un click fuori dalla finestra.
- **Uscita:** chiusura del log (o dopo 20 s il log si chiude da solo).
- **Built (2026-09-29):** `session_0418.log` (link in the backup, nudged by the anonymous sender) opens a window with the S1 scan, now live (real mesh every frame, or the guessed head following the mouse), and a self-typing log from real data (entry, verification, time to the figure, time to the backup, wrong codes) with live neon rows (looked away N times, last time, active). Looking away while it is open adds `operator looked away · HH:MM:SS` with a glitch. Closes itself after 20 s. The palm answer ("no need to cover yourself.") stays as before. Not built: darkening the screen for 1 s on palm.

### S9 · Reveal · stage 3
- **Timeline GSAP master** (≈12 s): `corruption` 0→1, le finestre si chiudono da sole in ordine inverso di apertura, il testo della nota si riscrive in seconda persona usando i dati reali (ora locale, tempo per trovare il backup, ritorni indietro da `localStorage`).
- **Rive** `window_across`: la finestra illuminata di fronte si accende. Dentro, la silhouette **fa i tuoi movimenti** (`headX/headY` 1:1, senza lag per la prima volta). Se la camera è attiva, la silhouette diventa il tuo feed in `mirror_dither` cyan (elaborato solo in locale, mai salvato).
- **Ambiguità:** nessuna frase dice "sei tu". Solo la sincronia del movimento lo fa capire.
- **Uscita:** la timeline finisce e lo schermo va a nero.
- **Built (2026-09-29):** closing the log starts it. Windows close themselves in reverse open order (collapse + glitch each). Then Rive `Across` (`rive/story/window_across.wgsl`): the building of IMG_0418 at night, second-person lines from real data, the window lights up with a tube stutter, push-in, a backlit bust behind a sheer curtain steps in and copies `headX/headY` 1:1 with no smoothing. 1.2 s of the room is recorded at 9 s and played back at 12.4 s (memory only; no mic: tape warble). Block corruption with channel split, black, then S10. The webcam `mirror_dither` was dropped: a Rive script cannot sample a video, and a figure that only moves like you is more ambiguous than your own face.

### Interlude · the case goes back to E.V. (added 2026-09-30)
- After the session log: the desktop goes quiet (no glitches, no searchlight, `viewers 1`), the system reopens E.V.'s case, Mara writes that E.V.'s phone is on in 4A across the road, Find My opens on flat 4A. "View live" starts S9. The relief is the setup: the user goes looking for E.V. in 4A and finds themselves.
- **Built:** `Desktop.tsx` (`useInterlude`, `calm` in the store), `views/Locate.tsx`.
- **S9 end (added):** after the room recording, the lit window corrupts into the live webcam as "CAM 2, flat 4A" for ~7 s (`LiveFeed.tsx`), then black.

### S10 · Login finale
- **Rive** artboard `login`: campo utente vuoto, caret che lampeggia.
- **Interazione:** se `faceLost`, il caret si ferma e la schermata "aspetta". Quando il volto torna, il caret riparte. Senza camera, il caret si ferma quando il mouse è fermo per 5 s.
- Nessun'altra spiegazione. La digitazione è libera; con Invio lo schermo torna a S1 con "non è la prima volta" (flag in `localStorage`).
- **Built (2026-09-29), following docs/desktop.md:** caret waits on `faceLost` (camera) or 5 s of stillness (mouse). Enter → case list (`#0415 E.V. missing`, `#0416`, `#0417 operator unresponsive`, `#0418 <name> open` in neon), then CRT switch-off (overlay shader `crt`, DOM squash, falling whine), black, "No frames or audio left your device." Instead of going back to S1, the name is kept in `localStorage` and the next premise says "case 0418 is still open, <name>."

---

## Aggiunte non previste nella spec (2026-09-29)

- **Faro** (overlay WGSL): un fascio freddo dall'alto il cui cerchio segue la testa (il mouse senza camera), con anelli concentrici dentro. 25 % / 60 % / 100 % per stage, ciano nello stage 3.
- **Decorazioni del desktop** (dettaglio in `docs/desktop.md`): il Segno, `viewers 1/2/3`, vetro incrinato, invito "Parallax", manuale dell'operatore, screenshot del tuo schermo, polaroid, calendario.
- **Glitch sincronizzati:** ogni glitch fa partire insieme lo strappo nello shader, uno sfasamento RGB della pagina e (più raramente) un suono.

## Rischi e verifiche
- **Permesso camera:** va chiesto dopo un gesto dell'utente e solo su HTTPS. Su Safari va testato `delegate: "GPU"`; fallback `CPU`.
- **Performance:** face ogni frame, gesture a 15 Hz, target 60 fps con Rive webgl2. Se il device è lento, si disattivano le gesture.
- **Rive `--publish`:** gli script richiedono la firma, quindi prima del deploy serve login e piano Cadet+ (vedi tech-setup).
- **Privacy:** i frame non escono dal browser. Va scritto nei credits finali, ed è anche coerente col tema.
