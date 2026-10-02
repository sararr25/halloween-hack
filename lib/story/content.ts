// Story content for the desktop apps. English only. Tone (docs/desktop.md): the system is
// clinical; E.V. is literary. Most items are skimmable everyday noise that still feeds the
// theme — a perfect life that slowly feels observed. `key` marks the few that matter.
//
// Dates are relative to "now" (`days` ago). E.V. went missing 7 days ago, so anything newer
// than that should not exist. Tokens filled at render time by `fill()`:
//   {{entry}}  local time the user opened the site (HH:MM)  — also the backup password
//   {{now}}    local time right now (HH:MM)
//   {{today}}  today's date, long form

import VOICES from "./voices.json";

/** What a recording's transcript writes (lib/story/voices.json): `show` if set, else the words said. */
const T = (id: keyof typeof VOICES.clips) => {
  const c: { say: string; show?: string } = VOICES.clips[id];
  return c.show ?? c.say;
};

export type Mail = {
  id: string;
  from: string;
  address: string;
  subject: string;
  days: number;
  time: string;
  /** how it is laid out: a friend, a company, a newsletter, a note to self */
  kind: "personal" | "service" | "newsletter" | "self";
  body: string[];
  /** a visual block drawn inside the mail (Mail.tsx) */
  block?: "signin" | "usage" | "tracking" | "contact" | "books";
  /** quoted earlier message, shown under the reply */
  quote?: { from: string; days: number; text: string[] };
  /** the sender is told you read it */
  receipt?: boolean;
  /** a scheduled send: it was set to arrive today */
  scheduled?: boolean;
  attachment?: string;
  /** a voice memo attached to the mail: played by lib/audio/voices.ts */
  memo?: { name: string; length: string; transcript: string };
  key?: boolean;
  /** only in the inbox from this stage on: clues for a later step stay hidden until then */
  fromStage?: 2 | 3;
};

export type Photo = {
  id: string;
  caption: string;
  days: number;
  key?: boolean;
  /** only listed from this stage on */
  fromStage?: 2 | 3;
};

export type Voice = { length: string; transcript: string };
export type ChatLine = {
  me: boolean;
  text?: string;
  voice?: Voice;
  /** a photo from Photos, sent in the chat (opens Photos) */
  photo?: string;
  /** "This message was deleted" */
  deleted?: boolean;
  /** read receipt time, on E.V.'s own messages */
  read?: string;
  days: number;
  time: string;
};
export type Chat = { id: string; name: string; status: string; lines: ChatLine[] };

export type Note = { id: string; title: string; days: number; body: string[]; typed?: boolean; key?: boolean; fromStage?: 2 | 3 };

export type Search = { q: string; days: number; time: string };

export type Call = {
  id: string;
  who: string;
  number: string;
  days: number;
  time: string;
  kind: "missed" | "incoming" | "outgoing";
  /** `audio`: what the recording contains (lib/audio/voices.ts plays it); `transcript`: what the phone wrote. */
  voicemail?: { length: string; audio: string; transcript: string };
  fromStage?: 2 | 3;
};

export type TrashFile = { id: string; name: string; days: number; body: string[] };

export function fill(text: string, ctx: { entry: string; now: string; today: string }) {
  return text.replaceAll("{{entry}}", ctx.entry).replaceAll("{{now}}", ctx.now).replaceAll("{{today}}", ctx.today);
}

// ─── Mail ────────────────────────────────────────────────────────────────────
// Each mail is its own kind of email, and each hides a small piece of the theme:
// a sign-in near home, a bill that knows when the lights were on, a parcel signed
// for at the empty flat, a contact sheet with one burned frame.

export const MAILS: Mail[] = [
  {
    id: "security",
    from: "Account Security",
    address: "no-reply@accounts.mail",
    subject: "New sign-in to your account",
    days: 1,
    time: "03:12",
    kind: "service",
    block: "signin",
    body: ["We noticed a new sign-in to your account. If this was you, you don't need to do anything."],
  },
  {
    id: "bill",
    from: "Northgrid Energy",
    address: "bills@northgrid.energy",
    subject: "Your September bill is ready",
    days: 3,
    time: "08:00",
    kind: "service",
    block: "usage",
    body: [
      "Your bill for September is £61.40, due on the 14th.",
      "Your usage went up this month. Most of it happened between 23:00 and 04:00. A light left on overnight is the usual reason.",
    ],
  },
  {
    id: "mara-police",
    from: "Mara",
    address: "mara.okafor@post.me",
    subject: "are you ok",
    days: 5,
    time: "22:47",
    kind: "personal",
    receipt: true,
    body: [
      "I went to the police today. They were kind about it, in the way people are kind to someone who's overreacting.",
      "They said your email was used yesterday, so you're probably fine.",
      "Was it you? Just tell me it was you. One word is enough.",
    ],
    quote: {
      from: "E.V.",
      days: 9,
      text: ["I'm fine, honestly. Just tired.", "Weird thing: lately I open emails I'm sure I've already read."],
    },
  },
  {
    id: "parcel",
    from: "ParcelLine",
    address: "tracking@parcelline.co",
    subject: "Delivered: your parcel",
    days: 6,
    time: "14:31",
    kind: "service",
    block: "tracking",
    body: ["Good news! Your parcel (blackout curtains, 2 panels) has been delivered."],
  },
  {
    id: "for-later",
    from: "E.V.",
    address: "ev@post.me",
    subject: "for later",
    days: 7,
    time: "23:58",
    kind: "self",
    scheduled: true,
    // it explains the backup code: it lands with stage 2, when the backup exists
    fromStage: 2,
    body: [],
    memo: {
      name: "for_later.m4a",
      length: "0:13",
      transcript: T("ev-forlater"),
    },
    key: true,
  },
  {
    id: "lab",
    from: "Lumen Film Lab",
    address: "orders@lumenlab.photo",
    subject: "Your scans are ready · order 0412",
    days: 9,
    time: "11:05",
    kind: "service",
    block: "contact",
    body: [
      "Hi E., your Harrow St roll is scanned. 11 of 12 frames came out well.",
      "We couldn't correct frame 6: one area is burned out (a lit window, top right) and the rest is almost black. We printed it anyway. It's in the envelope with the others.",
      "Lumen",
    ],
  },
  {
    id: "theo-sunday",
    from: "Theo",
    address: "theo.v@post.me",
    subject: "Sunday",
    days: 10,
    time: "19:20",
    kind: "personal",
    body: ["Mum's doing the lamb. Bring nothing, she says, which means bring wine.", "T."],
  },
  {
    id: "studio",
    from: "Ines Arden",
    address: "ines@studioarden.co",
    subject: "Harrow St series: one more thing",
    days: 13,
    time: "16:44",
    kind: "personal",
    body: [
      "Hi E.V.,",
      "Night only, as agreed. Twelve frames by the end of the month.",
      "We keep coming back to frame 6 on the contact sheet. Could you reshoot it with the window across lit? Same angle, same time if you can manage it.",
      "Ines",
    ],
  },
  {
    id: "books",
    from: "Stillwater Books",
    address: "letters@stillwaterbooks.shop",
    subject: "Autumn reading: stories you have to read twice",
    days: 15,
    time: "07:00",
    kind: "newsletter",
    block: "books",
    body: ["This month our staff picked novels with narrators you shouldn't trust. Read them once for the story, then again for the truth."],
  },
  {
    id: "hale-boiler",
    from: "R. Hale",
    address: "office@halelettings.co",
    subject: "Boiler service Tuesday",
    days: 20,
    time: "09:15",
    kind: "personal",
    body: ["Engineer coming Tuesday between 9 and 12. Please make sure someone is in.", "R. Hale, Hale Lettings"],
  },
];

/** Blocks drawn inside service mails (Mail.tsx). */
export const SIGNIN = {
  device: "unknown device",
  place: "approx. 40 m from your home",
  time: "03:12",
  button: "This wasn't me",
  answer: "Thanks. We have noted that it was you.",
};

/** kWh per hour of the day, averaged over September: the nights are wrong. */
export const USAGE = [0.9, 0.8, 0.8, 0.7, 0.3, 0.2, 0.2, 0.3, 0.3, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.3, 0.4, 0.4, 0.4, 0.4, 0.5, 1.0];

export const TRACKING = [
  { time: "08:02", step: "Out for delivery" },
  { time: "14:12", step: "Nobody answered at 16 Harrow Street" },
  { time: "14:29", step: "Left with a neighbour: 17 Harrow Street, flat 4A" },
  { time: "14:31", step: "Signed for by E.V." },
];

export const BOOKS = [
  { title: "The Tenant Upstairs", note: "A woman hears footsteps in the empty flat above hers. Every night, the same route." },
  { title: "Everyone Is Watching Harriet", note: "A village, a missing teacher, and a town that remembers her better than she does." },
  { title: "Twice Read", note: "The second time through, the letters are addressed to you." },
];

// ─── Photos ──────────────────────────────────────────────────────────────────

/** Every photo but the key one is a file in public/photos named after its id. */
export const photoSrc = (id: string) => `/photos/${id}.jpg`;

export const PHOTOS: Photo[] = [
  { id: "IMG_0419", caption: "source: unknown device", days: 0, fromStage: 2 },
  { id: "IMG_0418", caption: "window across, night (6/12)", days: 8, key: true },
  { id: "IMG_0417", caption: "window across (5/12)", days: 8 },
  { id: "IMG_0416", caption: "cat on the wall, no. 14", days: 9 },
  { id: "IMG_0411", caption: "self-portrait, hallway mirror", days: 10 },
  { id: "IMG_0401", caption: "Harrow St, dusk (1/12)", days: 12 },
  { id: "IMG_0397", caption: "bus window, rain", days: 14 },
  { id: "IMG_0392", caption: "my desk, finally tidy", days: 16 },
  { id: "IMG_0390", caption: "rooftop, Mara, two fingers up. “the only sign that opens anything”", days: 17 },
  { id: "IMG_0385", caption: "flowers, Saturday market", days: 19 },
  { id: "IMG_0380", caption: "Theo's dog, refusing the bath", days: 22 },
  { id: "IMG_0374", caption: "Mara, laughing at something I said", days: 24 },
  { id: "IMG_0371", caption: "kitchen, morning light", days: 26 },
];

// ─── Messages ────────────────────────────────────────────────────────────────
// Fake choice (The Game): Mara and Theo both lead to the same key fact. The flat across
// is empty, its light comes on every night, and the shape in it moves when she moves.

export const CHATS: Chat[] = [
  {
    id: "mara",
    name: "Mara",
    status: "last seen 5 days ago",
    lines: [
      { me: false, text: "drinks thurs? you still owe me a birthday", days: 12, time: "18:02" },
      { me: true, text: "yes. god yes.", days: 12, time: "18:40", read: "18:41" },
      { me: true, text: "weird question. have you ever felt like someone knows what you're going to do before you do it", days: 9, time: "23:10", read: "23:11" },
      { me: false, text: "every monday. it's called my manager", days: 9, time: "23:12" },
      { me: true, text: "I mean it", days: 9, time: "23:12", read: "23:12" },
      { me: false, text: "ok. what's going on", days: 9, time: "23:13" },
      { me: true, text: "the flat across from mine. 4A. it's been empty since last year, Hale says so", days: 8, time: "23:01", read: "23:04" },
      { me: true, text: "the light comes on every night. same time", days: 8, time: "23:02", read: "23:04" },
      { me: false, text: "timer? people do that for burglars", days: 8, time: "23:05" },
      {
        me: true,
        voice: {
          length: "0:17",
          transcript: T("ev-voicenote"),
        },
        days: 8,
        time: "23:09",
        read: "23:09",
      },
      { me: true, deleted: true, days: 8, time: "23:09" },
      { me: false, text: "ev.", days: 8, time: "23:10" },
      { me: false, text: "what did you delete", days: 8, time: "23:10" },
      { me: false, text: "come stay at mine. tonight. I'm serious", days: 8, time: "23:10" },
      { me: false, text: "you didn't come thursday", days: 7, time: "21:30" },
      { me: false, text: "ev?", days: 6, time: "09:12" },
      { me: false, text: "I'm calling Theo", days: 6, time: "09:40" },
      { me: false, text: "please just answer anything", days: 5, time: "23:55" },
    ],
  },
  {
    id: "theo",
    name: "Theo",
    status: "last seen yesterday",
    lines: [
      { me: false, text: "mum's asking if you're coming sunday", days: 10, time: "12:30" },
      { me: true, text: "tell her yes", days: 10, time: "12:41", read: "12:50" },
      { me: true, text: "can you come and check something at mine. the window", days: 8, time: "23:20", read: "23:31" },
      { me: false, text: "what's wrong with the window", days: 8, time: "23:31" },
      { me: true, text: "nothing's wrong with the window", days: 8, time: "23:31", read: "23:31" },
      { me: true, text: "the flat across is empty. there's someone in it. they copy me. I know how that sounds", days: 8, time: "23:33", read: "23:33" },
      { me: false, text: "Ev have you been sleeping", days: 8, time: "23:40" },
      { me: true, photo: "IMG_0418", text: "don't look at the window. look at the street", days: 8, time: "23:44", read: "07:58" },
      { me: false, text: "it's all dark. I can't see anything", days: 7, time: "08:03" },
      { me: true, text: "look closer", days: 7, time: "08:03", read: "08:03" },
      { me: false, text: "went by yours. lights off, door locked", days: 6, time: "20:15" },
      { me: false, text: "the flat across had its light on though", days: 6, time: "20:16" },
      { me: false, text: "police say adults are allowed to leave. that's the word they used. allowed", days: 3, time: "17:48" },
    ],
  },
  {
    // Mum: no clue in here, only the cost of it.
    id: "mum",
    name: "Mum",
    status: "last seen 2 hours ago",
    lines: [
      { me: false, text: "Sunday. Lamb. Theo says you're bringing wine, I say you're bringing yourself x", days: 10, time: "12:05" },
      { me: true, text: "both. promise", days: 10, time: "12:30", read: "12:31" },
      { me: true, text: "mum, odd question. did I ever sleepwalk as a kid", days: 8, time: "23:48", read: "07:02" },
      { me: false, text: "Once or twice. You used to stand at the window. Why darling?", days: 7, time: "07:04" },
      { me: false, text: "Ev?", days: 7, time: "12:40" },
      { me: false, text: "You didn't come Sunday. Theo made excuses for you. He's a bad liar, like his father.", days: 6, time: "19:30" },
      { me: false, text: "Mara rang me. Please call me, I don't care what time it is.", days: 5, time: "08:10" },
      { me: false, text: "The police came to the house. They asked if you'd been unhappy. I didn't know what to say.", days: 3, time: "22:14" },
      { me: false, text: "I've left the landing light on for you. Like when you were small.", days: 1, time: "22:40" },
    ],
  },
  {
    id: "hale",
    name: "R. Hale",
    status: "last seen yesterday",
    lines: [
      { me: false, text: "Boiler engineer Tues 9 to 12", days: 20, time: "09:16" },
      { me: true, text: "fine, thanks", days: 20, time: "10:02", read: "10:30" },
      { me: true, text: "who's renting 17 Harrow St, 4A?", days: 8, time: "22:58", read: "23:14" },
      { me: false, text: "Nobody. Not one of mine but I know the owner. Empty over a year.", days: 8, time: "23:15" },
      { me: true, text: "the light is on every night", days: 8, time: "23:16", read: "23:29" },
      { me: false, text: "Timer probably.", days: 8, time: "23:30" },
      { me: false, text: "Rent is due Friday. Please confirm you are receiving these messages.", days: 2, time: "10:00" },
    ],
  },
];

// ─── Notes ───────────────────────────────────────────────────────────────────

export const NOTES: Note[] = [
  {
    id: "dated",
    title: "{{today}}",
    days: 0,
    typed: true,
    key: true,
    body: [
      "{{today}}.",
      "I write the date first now, so I can prove it later.",
      "I don't remember writing yesterday's note. The handwriting is mine.",
    ],
  },
  {
    id: "for-m",
    title: "for M.",
    days: 7,
    body: ["If you read this before I do:", "it isn't the window. It was never the window.", "It's the screen."],
  },
  {
    id: "code",
    title: "backup",
    days: 7,
    key: true,
    fromStage: 2,
    body: [
      "Set the backup code tonight. Four digits, like a clock.",
      "The time they come in. Not the light across. The other one, the one who opens this.",
      "I don't know it yet. I set it anyway. It was already set.",
    ],
  },
  {
    id: "lights",
    title: "lights across",
    days: 8,
    body: [
      "mon 23:02",
      "tue 23:02",
      "wed 23:02",
      "thu 23:02",
      "Always two minutes after I switch mine on.",
      "Tonight I didn't switch mine on. It came on anyway.",
    ],
  },
  {
    id: "sure",
    title: "things I'm sure of",
    days: 9,
    body: [
      "my name",
      "the date",
      "that I locked the door",
      "that 4A has been empty for a year",
      "that I'm the one taking the photos",
      "This morning I was sure of five things. Now four.",
    ],
  },
  {
    id: "dream",
    title: "dream",
    days: 11,
    body: [
      "I was in a room made of windows and every window had someone in it doing what I did.",
      "When I stopped, they didn't.",
    ],
  },
  {
    id: "shopping",
    title: "shopping",
    days: 12,
    body: ["oat milk", "batteries (AA)", "blackout curtains ×2", "bin bags", "something for Mara's birthday"],
  },
  {
    id: "work",
    title: "Harrow St series",
    days: 14,
    body: ["12 frames, night only.", "Tripod. Long exposure.", "Shoot the street, not the flat. Never the flat."],
  },
];

// ─── Browser history ─────────────────────────────────────────────────────────
// Newest first. The first entry is the clickable one: it points at the session log.

export const LAST_SEARCH_RESULT = [
  "Most systems record the exact time a session was opened.",
  "It is shown once, when the session starts. Nobody checks it again.",
];

export const SEARCHES: Search[] = [
  { q: "how to see when someone opened your computer", days: 7, time: "23:51" },
  { q: "can a laptop camera turn on without the light", days: 7, time: "23:47" },
  { q: "17 harrow street 4a", days: 7, time: "23:40" },
  { q: "why don't I remember tuesday", days: 7, time: "23:33" },
  { q: "blackout curtains next day delivery", days: 7, time: "22:10" },
  { q: "is it normal to feel watched in your own home", days: 8, time: "23:58" },
  { q: "mirror neurons copying movements stranger", days: 8, time: "23:21" },
  { q: "how to tell if someone is watching you through your window", days: 8, time: "23:06" },
  { q: "light timer how to tell", days: 8, time: "23:04" },
  { q: "long exposure night street settings", days: 9, time: "20:12" },
  { q: "lumen film lab opening hours", days: 9, time: "10:40" },
  { q: "how long does it take to forget a face", days: 9, time: "02:14" },
  { q: "can't sleep 3am every night", days: 10, time: "03:02" },
  { q: "lamb recipe slow cooked", days: 10, time: "19:30" },
  { q: "recover deleted photos", days: 11, time: "22:48" },
  { q: "harrow street history", days: 12, time: "21:00" },
  { q: "cat breeds grey stripes", days: 13, time: "13:15" },
  { q: "studio arden photography brief", days: 13, time: "16:50" },
  { q: "bus 38 timetable", days: 14, time: "08:02" },
  { q: "tripod for night photography", days: 15, time: "20:33" },
  { q: "unreliable narrator books", days: 15, time: "07:45" },
  { q: "birthday present ideas for best friend", days: 16, time: "21:20" },
  { q: "boiler making knocking noise", days: 20, time: "07:10" },
  { q: "market saturday flowers near me", days: 20, time: "09:00" },
  { q: "kitchen plants low light", days: 26, time: "08:15" },
];

/** Stage 2+: searches that appear while you read, as if someone is still typing them. */
export const LIVE_SEARCHES = [
  "is someone reading my files",
  "recovery session {{entry}}",
  "how to know if you are being watched right now",
];

// ─── Phone (synced) ──────────────────────────────────────────────────────────
// The transcript writes what was said. Where the voice is lost (static, breathing) it
// writes on anyway, marked, and only there it knows things about the user's session.

export const CALLS: Call[] = [
  {
    id: "mara-3",
    who: "Mara",
    number: "07700 900127",
    days: 1,
    time: "01:17",
    kind: "missed",
    fromStage: 2,
    voicemail: {
      length: "0:10",
      audio: "Mara inside E.V.'s flat, panicking: the laptop shows a recording waiting for an operator. The line dies mid-word.",
      transcript: T("mara-3"),
    },
  },
  {
    id: "ev",
    who: "E.V. (mobile)",
    number: "07700 900418",
    days: 2,
    time: "03:12",
    kind: "missed",
    fromStage: 2,
    voicemail: {
      length: "0:18",
      audio: "E.V. whispering from across the road, she can see her own flat, the light is on; then breathing, a window opening, traffic.",
      transcript: T("ev-voicemail"),
    },
  },
  {
    id: "mara-2",
    who: "Mara",
    number: "07700 900127",
    days: 3,
    time: "02:40",
    kind: "missed",
    fromStage: 2,
    voicemail: {
      length: "0:16",
      audio: "Mara inside E.V.'s flat at night, the door left open: E.V. is not there, the laptop is on showing the street, someone stands in the lit window across and looks at her.",
      transcript: T("mara-2"),
    },
  },
  {
    id: "mum",
    who: "Mum",
    number: "01632 960441",
    days: 4,
    time: "22:31",
    kind: "missed",
    voicemail: {
      length: "0:17",
      audio: "Mum, late at night, tender and frightened: she has lost count of the calls, the landing light is on, come home.",
      transcript: T("mum"),
    },
  },
  {
    id: "mara-1",
    who: "Mara",
    number: "07700 900127",
    days: 5,
    time: "23:56",
    kind: "missed",
    voicemail: {
      length: "0:11",
      audio: "Mara, worried sick, trying to stay calm: nobody has heard from E.V., call me.",
      transcript: T("mara-1"),
    },
  },
  {
    id: "unknown",
    who: "Unknown",
    number: "No caller ID",
    days: 7,
    time: "23:02",
    kind: "missed",
    fromStage: 2,
    voicemail: {
      length: "0:11",
      audio: "a low, calm voice. The time it names is lost in a burst of static.",
      // the static eats the time; the transcript writes it anyway
      transcript: `${T("unknown-1")} [through static] {{entry}}. ${T("unknown-2")}`,
    },
  },
  { id: "theo-out", who: "Theo", number: "07700 900233", days: 8, time: "23:50", kind: "outgoing" },
  { id: "hale", who: "R. Hale", number: "020 7946 0112", days: 8, time: "23:17", kind: "incoming" },
  { id: "lab", who: "Lumen Film Lab", number: "020 7946 0880", days: 9, time: "11:02", kind: "incoming" },
  { id: "theo-in", who: "Theo", number: "07700 900233", days: 10, time: "12:28", kind: "incoming" },
];

// ─── Trash ───────────────────────────────────────────────────────────────────

export const TRASH: TrashFile[] = [
  {
    id: "log-0417",
    name: "recovery_0417.log",
    days: 30,
    body: [
      "RECOVERY/4 · device image E.V. · 118.4 GB",
      "session opened 23:02:51",
      "operator verification refused",
      "operator unresponsive after 00:16:49",
      "case closed",
    ],
  },
  {
    id: "untitled",
    name: "untitled.txt",
    days: 8,
    body: ["When I lift my hand, the light across lifts its hand.", "When I put it down, it waits a little longer than I do."],
  },
  {
    id: "police",
    name: "draft_police.txt",
    days: 7,
    body: [
      "To whom it may concern,",
      "I know how this will read. There is a flat opposite mine, 17 Harrow Street, 4A, that has been empty for over a year. Every night at 23:02 its light comes on, and someone in it does what I do.",
      "I am not asking you to believe me. I am asking you to look at the street, not at the window.",
    ],
  },
  { id: "dup", name: "IMG_0418 (2).jpg", days: 8, body: ["Preview unavailable: the file was open on another device when it was deleted."] },
  { id: "invoice", name: "invoice_arden_07.pdf", days: 18, body: ["Invoice 07 · Studio Arden · 4 frames · £640.00 · paid"] },
];

/** backup_you contents, shown once the code is right (stage 3). */
export const BACKUP_README = [
  "It keeps track of who looks. Not what they look at. Who, and for how long.",
  "I found my own sessions in here. Then I found the ones after mine.",
];

// ─── Desktop decor ───────────────────────────────────────────────────────────
// References (docs/desktop.md, project.md): The Game (an invitation from a company that
// arranges "experiences"), Black Mirror (the audience, the recurring Sign, the cracked
// screen, the screenshot of your own screen), Memento (a polaroid with a handwritten note).
// All names and marks are invented.

/** invitation.pdf — The Game. Sent 16 days ago, before anything started. */
export const INVITATION = {
  days: 16,
  company: "PARALLAX",
  tagline: "private experiences",
  body: [
    "Dear E.V.,",
    "Your enrolment has been accepted. Your experience has been arranged around you.",
    "It began before this letter reached you. It ends when you stop looking for the edges.",
    "You will not be told the rules. You will recognise them.",
    "Please do not try to contact us. We will know when you need us.",
  ],
  footer: "enrolment 0418",
};

/** operator_manual.pdf — the system's own voice: clinical, and about you. */
export const MANUAL = {
  title: "RECOVERY/4 · operator guidelines (excerpt)",
  sections: [
    "§1  The operator is given access to one device image. Other images are not their concern.",
    "§2  Sessions are recorded in full: duration, pauses, where the operator looks.",
    "§3  The operator is not informed that the session is observed. If the operator asks, the session continues.",
    "§4  A session ends when the operator stops. Operators who do not stop are enrolled.",
    "§5  Case numbers are not reused.",
  ],
};

/** Calendar widget. `fromStage` events appear on their own; nobody created them. */
export const CALENDAR: { when: string; what: string; fromStage?: 2 | 3 }[] = [
  { when: "Thu", what: "drinks with Mara · declined" },
  { when: "Fri", what: "Harrow St series due · Arden" },
  { when: "Sun", what: "Mum's · bring wine" },
  { when: "today 23:02", what: "leave the light on", fromStage: 2 },
  { when: "today {{now}}", what: "operator", fromStage: 3 },
];

/** The polaroid stuck to the desktop (handwritten). Rewritten at stage 3. */
export const POLAROID: Record<1 | 2 | 3, string> = {
  1: "the window across. don't trust 23:02",
  2: "the window across. don't trust 23:02",
  3: "it was never the window",
};
