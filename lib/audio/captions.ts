// Transcripts that are written while the voice speaks (owner playtest: the text must not be
// there before the audio). A player (VoicePlayer, the live call) announces when a recording
// starts and where its voice sits in time; a <Transcript> with the same id reveals its words
// over those spans. The voice files carry no word timings, so words are spread over the
// real speech spans by length, with a pause after punctuation. Once a recording has been
// heard to the end its transcript stays, for the whole session.

/** A stretch of speech, in performance.now() milliseconds. */
export type Span = { from: number; to: number };

type Run = { spans: Promise<Span[]> } | null;

const runs = new Map<string, Run>();
const listeners = new Map<string, Set<() => void>>();
const heard = new Set<string>();

const emit = (id: string) => listeners.get(id)?.forEach((fn) => fn());

export function startCaption(id: string, spans: Promise<Span[]>) {
  runs.set(id, { spans });
  emit(id);
}

export function stopCaption(id: string) {
  runs.set(id, null);
  emit(id);
}

export const captionRun = (id: string): Run => runs.get(id) ?? null;
export const wasHeard = (id: string) => heard.has(id);
export const markHeard = (id: string) => heard.add(id);

export function onCaption(id: string, fn: () => void) {
  let set = listeners.get(id);
  if (!set) listeners.set(id, (set = new Set()));
  set.add(fn);
  return () => void set.delete(fn);
}

/** Without sound, the words still arrive at the pace of a voice, from now. */
export function spokenPace(seconds: number, lead = 0.6): Promise<Span[]> {
  const from = performance.now() + lead * 1000;
  return Promise.resolve([{ from, to: from + seconds * 1000 }]);
}

/** How much time a word takes, in units: its letters, plus a breath after punctuation. */
const weight = (word: string) => word.length + 1 + (/[.?!]$/.test(word) ? 4 : /[,:;]$/.test(word) ? 2 : 0);

/** When each word starts, in ms, spread over the spans in order. */
export function wordTimes(words: string[], spans: Span[]): number[] {
  const total = spans.reduce((t, s) => t + (s.to - s.from), 0);
  const units = words.reduce((t, w) => t + weight(w), 0) || 1;
  let before = 0;
  return words.map((w) => {
    let at = (before / units) * total;
    before += weight(w);
    for (const s of spans) {
      const len = s.to - s.from;
      if (at <= len) return s.from + at;
      at -= len;
    }
    return spans.at(-1)?.to ?? performance.now();
  });
}
