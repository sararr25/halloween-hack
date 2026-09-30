// One frame of the webcam as the system keeps it: mirrored, coarse, 1-bit cyan with an
// ordered dither (the same look as the live feed of flat 4A in S9). It stays in memory,
// as a data URL, for the rest of the session; nothing is stored or sent.

const W = 128;
const H = 96;
// 4x4 Bayer matrix, thresholds 0..1
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

let ctx: CanvasRenderingContext2D | null = null;

/** Null when the video has no frame yet (camera refused, or not started). */
export function grabStill(video: HTMLVideoElement | null): string | null {
  if (!video || !video.srcObject || video.videoWidth === 0) return null;
  if (!ctx) {
    ctx = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("grabStill: no 2D context");
    ctx.canvas.width = W;
    ctx.canvas.height = H;
  }
  ctx.setTransform(-1, 0, 0, 1, W, 0);
  ctx.drawImage(video, 0, 0, W, H);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  const p = img.data;
  for (let y = 0; y < H; y++) {
    const scan = y % 2 ? 0.72 : 1;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const lum = (0.3 * p[i] + 0.59 * p[i + 1] + 0.11 * p[i + 2]) / 255;
      const lit = Math.min(1, (lum - 0.12) * 1.6) > BAYER[(y % 4) * 4 + (x % 4)];
      p[i] = 0;
      p[i + 1] = lit ? 240 * scan : 6;
      p[i + 2] = lit ? 255 * scan : 12;
      p[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return ctx.canvas.toDataURL("image/png");
}
