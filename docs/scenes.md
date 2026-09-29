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
| Glitch | 60–140 ms | `none` | frequenza per stage (HANDOVER) |
| Transizione di stage | 1.2–2 s | `sine.inOut` | uniform shader via GSAP, mai un taglio netto |

`prefers-reduced-motion`: niente glitch né shiver, i follow diventano statici, il testo appare intero. La storia resta completa.

## Stato di implementazione (2026-09-29, sera)

| Pezzo | Stato | Dove |
|---|---|---|
| Occhio Rive (`Presence`: headX/headY, lookingAway, blink) | ✅ provato sul Mac | `rive/presence/`, `components/PresenceEye.tsx` |
| Tracking testa, battito, sguardo altrove | ✅ provato sul Mac | `lib/presence/tracker.ts`, `public/presence-worker.js` |
| Gesture + risposta (battito dell'occhio + riga di stato) | ✅ provato sul Mac (la mano aperta è la più fragile) | `app/lab/Boot.tsx` (`GESTURE_LINES`, testi segnaposto) |
| S1 minimale: richiesta camera diegetica, calibrazione 2 s, rifiuto salvato | ✅ | `app/lab/Boot.tsx` |
| Overlay WGSL (grain, vignette, scanline, strappi glitch) | ✅ firmato, visibile nel browser con `enableGPUCanvas: true` | `rive/effects/`, `components/FxOverlay.tsx` |
| Shader `lens` (S3) | ✅ la foto IMG_0418 è disegnata interamente nello shader, con la lente | `rive/photo/`, `components/desktop/views/PhotoLens.tsx` |
| Shader `corruption`, `mirror_dither` | ⬜ da fare (S9) | — |
| S1 dentro `/` (camera + microfono) | ✅ percorso "rifiuto"; percorso "consenso" da provare sul Mac | `components/desktop/Boot.tsx` |
| Desktop OS, finestre GSAP, S2–S7 con contenuti | ✅ | `components/desktop/`, `lib/story/content.ts` |
| S8–S10 | ⬜ da fare | — |

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
| `lens` | `center, radius, strength, time` | zoom "Rear Window" sulle foto; centro = cursore o testa |
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

### S2 · Email · stage 1
- **GSAP:** app Mail con apertura Flip dall'icona, lista con stagger 30 ms.
- **Rive:** nessun oggetto vivo. La mail "per dopo" ha un'icona allegato Rive che resta leggibile finché la guardi e si corrompe quando `lookingAway`: il primo seme, invisibile.
- **Shader:** `glitch_rgb` subliminale (ogni 9–16 s).
- **Interazione:** click sulle mail; l'allegato non si apre ("formato non supportato").
- **Uscita:** aperta almeno la mail "per dopo", oppure 3 mail qualsiasi.

### S3 · Foto · stage 1 → 2
- **Rive** artboard `photo_street`: la foto contiene la finestra di fronte come nodo animabile.
- **Shader:** `lens` segue il cursore; con camera attiva si sposta di poco anche con la testa (sporgerti in avanti = zoom? da testare con la scala dei landmark).
- **Interazione:** zoom su 10 foto. Nella foto chiave, lo sfondo sfocato **cambia posizione quando distogli lo sguardo** (lookingAway → swap di frame in Rive).
- **Uscita:** zoom sulla figura sfocata → passaggio a **stage 2** (transizione uniform 1.5 s) e compare la cartella `backup_you` (primo neon, respiro Rive 4 s).

### S4 · Chat · stage 2 · scelta finta
- **GSAP:** bolle in entrata con typing indicator. La scelta "chat con Marco / con l'amica" porta alla stessa informazione chiave.
- **Rive** artboard `webcam_widget`: compare la finestrina webcam con un indicatore REC. L'"occhio" della lente segue `headX/headY` con un lag di 500 ms.
- **Interazione:** se l'utente guarda via durante una chat, all'ultimo messaggio si aggiunge "…ci sei ancora?".
- **Uscita:** entrambe le chat, o una più la nota collegata.

### S5 · Note · stage 2
- **GSAP SplitText:** una nota riporta la **data reale di oggi** (`Date()`), scritta come se fosse stata digitata a mano (typewriter con un errore corretto).
- **Interazione:** blink → la riga sotto il cursore sfarfalla per 80 ms (glitch sincronizzato al battito).
- **Uscita:** aperta la nota datata.

### S6 · Cronologia browser · stage 2
- **GSAP:** lista con stagger. Le ricerche compaiono "in tempo reale" mentre le leggi, come se qualcuno stesse ancora cercando.
- **Rive** `ghost_cursor`: un secondo cursore bone-white scorre la lista mezzo secondo prima del tuo. Con camera attiva segue lo sguardo.
- **Toast:** "foto scattata dall'esterno" (HANDOVER stage 2).
- **Uscita:** click sull'ultima ricerca → indizio della password del backup.

### S7 · Cartella Backup · stage 2 → 3
- **Rive** `backup_you`: la password sbaglia → shake orizzontale 6 px (niente bounce). Password giusta → apertura.
- **Gesture (camera attiva):** nei file precedenti compare un indizio visivo, una foto con la mano a `Victory` / `Pointing_Up`. Se l'utente fa quel gesto alla camera, la cartella si apre da sola, **senza che gli sia mai stato detto che la camera guarda le mani**. È il momento del "come ha fatto?".
- **Uscita:** passaggio a **stage 3**.

### S8 · Primo colpo dati reali · stage 3
- **Rive** artboard `session_log`: log tecnico con `sessionSeconds` legato in data binding ("Sessione attiva da 6m 42s. Ultima interruzione: 12s fa", dove l'interruzione viene da `lookingAway`/`document.hidden`).
- **Shader:** `glitch_rgb` con `neon=1`, ogni 0.9–2.6 s; `grain_vignette` alto.
- **Gesture:** se l'utente copre la camera o mostra `Open_Palm`, lo schermo si oscura per 1 s e appare in mono: "non serve coprirti". Con camera negata: stesso effetto su un click fuori dalla finestra.
- **Uscita:** chiusura del log (o dopo 20 s il log si chiude da solo).

### S9 · Reveal · stage 3
- **Timeline GSAP master** (≈12 s): `corruption` 0→1, le finestre si chiudono da sole in ordine inverso di apertura, il testo della nota si riscrive in seconda persona usando i dati reali (ora locale, tempo per trovare il backup, ritorni indietro da `localStorage`).
- **Rive** `window_across`: la finestra illuminata di fronte si accende. Dentro, la silhouette **fa i tuoi movimenti** (`headX/headY` 1:1, senza lag per la prima volta). Se la camera è attiva, la silhouette diventa il tuo feed in `mirror_dither` cyan (elaborato solo in locale, mai salvato).
- **Ambiguità:** nessuna frase dice "sei tu". Solo la sincronia del movimento lo fa capire.
- **Uscita:** la timeline finisce e lo schermo va a nero.

### S10 · Login finale
- **Rive** artboard `login`: campo utente vuoto, caret che lampeggia.
- **Interazione:** se `faceLost`, il caret si ferma e la schermata "aspetta". Quando il volto torna, il caret riparte. Senza camera, il caret si ferma quando il mouse è fermo per 5 s.
- Nessun'altra spiegazione. La digitazione è libera; con Invio lo schermo torna a S1 con "non è la prima volta" (flag in `localStorage`).

---

## Rischi e verifiche
- **Permesso camera:** va chiesto dopo un gesto dell'utente e solo su HTTPS. Su Safari va testato `delegate: "GPU"`; fallback `CPU`.
- **Performance:** face ogni frame, gesture a 15 Hz, target 60 fps con Rive webgl2. Se il device è lento, si disattivano le gesture.
- **Rive `--publish`:** gli script richiedono la firma, quindi prima del deploy serve login e piano Cadet+ (vedi tech-setup).
- **Privacy:** i frame non escono dal browser. Va scritto nei credits finali, ed è anche coerente col tema.
