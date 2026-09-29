# Interactive Psychological Thriller — Project Doc

Hackathon: [Contra — Halloween Challenge](https://contra.com/community/topic/rivehalloweenchallenge)
Scope: solo, 18 giorni.

## 1. Concept

Mini-esperienza thriller psicologica interattiva, senza durata fissa: è l'utente a far avanzare la storia cliccando attraverso una sequenza di schermate. Ogni schermata contiene pochi elementi cliccabili che permettono di:

- scoprire nuovi indizi;
- cambiare punto di vista;
- aprire un messaggio, una foto, una finestra, un file;
- passare alla scena successiva;
- far avanzare la tensione narrativa.

Priorità assoluta: **thriller psicologico**, non horror.

### Cosa NON deve essere

- niente splatter, gore, mostri gratuiti;
- niente jumpscare come elemento principale;
- niente estetica Halloween cliché (zucche, fantasmini).

### La sensazione da costruire

Non paura fisica, ma quella tipica dei thriller in cui lentamente capisci che qualcosa non torna. La tensione nasce da: paranoia, osservazione, perdita di controllo, dubbi sulla realtà, manipolazione, memoria, identità, intrusione nella vita privata, qualcuno che sa cose che non dovrebbe sapere.

Il finale deve lasciare ansia e disagio, con un twist che faccia rileggere tutto quello che è successo prima.

## 2. Riferimenti cinematografici (meccanismi, non trame)

| Film / show | Cosa prendiamo |
|---|---|
| **Rear Window** | Voyeurismo, osservare qualcuno da lontano, dubitare di ciò che si vede, dettagli insignificanti che diventano significativi. |
| **Disturbia** | La sensazione "sto vedendo qualcosa di reale o me lo sto immaginando?" |
| **Shutter Island** | Narratore/protagonista inaffidabile, identità, realtà percepita vs reale, twist che cambia il significato di tutto ciò che hai visto. |
| **The Others** | Reveal in cui la posizione del protagonista nella storia non è quella che pensava — horror/thriller senza violenza. |
| **Memento** | Memoria frammentata, documenti/note/prove, impossibilità di fidarsi del proprio passato. |
| **Black Swan** | Identità, percezione alterata, doppio, paranoia, perdita progressiva della certezza su cosa sia reale. |
| **The Game** | L'utente crede di investigare liberamente ma scopre che qualcun altro aveva previsto le sue mosse — struttura di riferimento per l'illusione di controllo. |
| **Black Mirror** | Tecnologia normale → comportamento leggermente strano → implicazione personale → reveal inquietante. Riferimento anche per il tono/l'atmosfera generale (vedi immagini di mood salvate separatamente). |

## 3. Formato

**Desktop/telefono simulato**: l'utente riceve un link/messaggio anonimo che gli dà accesso ai file di una persona (email, foto, note, cronologia browser, chat, cartella backup, cestino). Non un sito "a pagine": un finto sistema operativo navigabile, con icone cliccabili e finestre che si aprono.

Genere di riferimento: found-device narrative (tipo *Sara is Missing*, *Emily is Away*, *Orwell*).

Perché questo formato: il "contenitore" **è** già il meccanismo di gioco — niente bisogno di narrazione diretta, la storia emerge dall'esplorazione dell'interfaccia.

## 4. Il twist scelto

**"Sei tu quello osservato"** (Black Mirror + The Game).

L'utente crede di aver ottenuto accesso al computer di una persona scomparsa e la esplora come investigatore esterno. Verso la fine, dettagli che sembravano neutri — una data, un nome in una cartella — combaciano troppo bene con **dati reali della sessione corrente** (l'ora in cui ha aperto il sito, quanto tempo ci ha messo a trovare un indizio, se è tornato indietro su una scena). Il reveal: il desktop non apparteneva a uno sconosciuto — apparteneva a *lui*, da un punto nel tempo che non ricorda — e "loro" sapevano che ci sarebbe arrivato esattamente in quel momento.

Perché questo twist e non altri: è l'unico che usa dati *veri* del browser come colpo di scena finale, non semplice testo — è l'unica cosa che un'esperienza interattiva web può fare e un film non potrebbe mai fare.

L'ambiguità finale va preservata: il testo non deve mai dire esplicitamente "sei tu la persona scomparsa" — lascia aperto se il giocatore sia collegato al caso, sia il prossimo, o se il "sistema" osservi semplicemente chiunque clicchi.

## 5. Meccanica di scelta (da "The Game")

Non serve un vero albero di branching. 1-2 punti nel percorso danno l'illusione di scelta libera (es. "Leggi la chat con Marco" / "Leggi la chat con l'amica"), ma qualunque opzione scelga l'utente porta alla stessa scena successiva — cambia solo l'angolo da cui arrivano le stesse informazioni chiave. Riduce drasticamente il lavoro di scrittura/branching mantenendo la sensazione di controllo.

## 6. Struttura narrativa — scene by scene

**Premessa**: l'utente riceve un link/messaggio anonimo: *"Ti hanno dato accesso ai file di [nome]. È scomparsa una settimana fa. Forse tu puoi capire cosa le è successo."*

### Atto 1 — Normalità che scricchiola

1. **Boot / disclaimer finto** — schermata di accesso "recupero dati in corso", poi il desktop appare. Prima nota/messaggio dal mittente anonimo. Tono clinico, non horror.
2. **Email** — 4-5 mail banali (bollette, amica, lavoro) più una mail vuota con allegato illeggibile e oggetto "per dopo". Nessun indizio sottolineato: solo lasciato lì.
3. **Foto** — una decina di foto quotidiane. Una foto ha sullo sfondo, sfocato, qualcosa che non dovrebbe esserci. Il giocatore può ingrandire (piccola gratificazione da osservazione attiva, alla Rear Window).

### Atto 2 — Paranoia e prime scelte finte

4. **Chat** — conversazioni con un'amica: "ho la sensazione che qualcuno sappia cose che non dovrebbe sapere". Prima scelta finta alla The Game (due ordini di lettura diversi, stesso contenuto chiave).
5. **Note app** — appunti sparsi, uno datato con la **data reale odierna** (letta da `Date()`, non scritta a mano) — seme non ancora percepito consapevolmente dal giocatore.
6. **Cronologia browser** — ricerche della persona scomparsa: "come sapere se qualcuno ti osserva", "perché non ricordo [qualcosa]". Vira verso Shutter Island/Black Swan: dubbio su chi stiamo seguendo davvero.

### Atto 3 — Il cedimento

7. **Cartella "Backup"** — sblocco con password suggerita nei file precedenti (piccolo puzzle). Dentro: la persona scomparsa dice di aver scoperto che "il sistema" tiene traccia di chi guarda cosa e per quanto tempo.
8. **Primo colpo dati-reali** — appare un log tipo: *"Sessione attiva da 6 minuti e 42 secondi. Ultima interruzione: [x] secondi fa."* — numeri veri della sessione corrente. Sembra ancora un log tecnico del file recovery, non ancora rivolto esplicitamente al giocatore.
9. **Il reveal** — il finto sistema operativo si "rompe" (schermo che sfarfalla, finestre che si chiudono da sole). Appare un messaggio diretto in seconda persona che intreccia narrazione e dati reali: ora locale, tempo impiegato dal giocatore, se è già tornato indietro su una scena. Ambiguità preservata (vedi sezione 4).

### Finale

10. Il desktop torna a una schermata di login vuota — ma il campo nome utente questa volta è vuoto, cursore lampeggiante, in attesa che *qualcuno* scriva qualcosa. Nessuna spiegazione ulteriore.

## 7. Note tecniche per il twist (non design, meccanismo)

Tre agganci reali, tutti banali in JS vanilla, zero backend:

- `Date()` per data/ora corrente (scena 5 e 9);
- un timer dal primo caricamento della pagina per il "tempo di sessione" (scena 8 e 9);
- `localStorage` per sapere se è la prima visita o se l'utente è tornato indietro/ha ricaricato (rinforzo opzionale in scena 9: *"non è la prima volta che apri questo file"*).

## 8. Stato del progetto / prossimi passi

- [x] Concept, riferimenti, twist scelti
- [x] Scaletta scena-per-scena (Atto 1-3 + finale)
- [x] Direzione visiva: palette Ink + neon cyan, 3 stage (`HANDOVER.md`, `prototype/design-mockup.html`)
- [x] Spec scene/animazioni/interazioni (`docs/scenes.md`) e setup Rive CLI · WGSL · MediaPipe · GSAP (`docs/tech-setup.md`)
- [x] Tesi di interazione validata (2026-09-29)
- [x] Rete aperta per `*.rive.app`, Rive CLI installata (container + Mac)
- [x] Setup tecnico: Next.js 16 + TS + pnpm, Rive, MediaPipe in Web Worker, GSAP
- [x] S1 minimale in `/lab`: occhio Rive che segue la testa, battito, sguardo altrove, gesture con risposta. Provata sul Mac
- [ ] Firmare gli shader (`rive login` + `pnpm rive:publish` sul Mac) e vedere l'overlay WGSL nel browser
- [ ] Tono e voce dei testi (quanto letterario vs secco/clinico); le risposte alle gesture sono segnaposto
- [ ] Lista precisa degli asset da produrre (quante foto, mail, note, messaggi chat)
- [ ] Desktop OS vero: finestre trascinabili, app (Mail, Foto, Chat, Note, Cronologia, Backup)
- [ ] Build delle 10 schermate
- [ ] Deploy su Vercel
- [ ] Playtest e tuning del ritmo/degli indizi
