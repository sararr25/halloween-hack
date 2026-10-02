// Stills of the player, taken without a word while they play (a blink, a clue found). They
// are never shown during the game (owner: they gave the ending away); they come back only
// as evidence on page 2 of the case file (casefile.ts). Memory only, this page only: they
// are dropped with the tab and never stored or sent.

export type Frame = { canvas: HTMLCanvasElement; at: number; label: string };

const W = 480;
const H = 360;
const MAX = 24;
const frames: Frame[] = [];

/** One frame of the camera as it is right now. Does nothing without a live video. */
export function grabFrame(video: HTMLVideoElement | null, label: string) {
  if (!video || video.readyState < 2 || !video.videoWidth) return;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const x = c.getContext("2d");
  if (!x) throw new Error("frames: no 2D context");
  // cover-crop the camera into 4:3
  const s = Math.max(W / video.videoWidth, H / video.videoHeight);
  const w = video.videoWidth * s;
  const h = video.videoHeight * s;
  x.drawImage(video, (W - w) / 2, (H - h) / 2, w, h);
  frames.push({ canvas: c, at: Date.now(), label });
  if (frames.length > MAX) frames.splice(1, 1); // keep the first one, drop the oldest after it
}

/** Up to `n` frames spread over the whole session, oldest first. */
export function pickFrames(n: number): Frame[] {
  if (frames.length <= n) return [...frames];
  return Array.from({ length: n }, (_, i) => frames[Math.round((i * (frames.length - 1)) / (n - 1))]);
}
