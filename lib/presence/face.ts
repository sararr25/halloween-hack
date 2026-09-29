// The face mesh travels to the Rive scan (rive/story/scan.luau) as text: a view model
// string is the only way to hand a list of numbers to a Rive script. Each landmark is
// x, y, z in model units (face height = 2, centred, mirrored like a selfie, z towards
// the viewer), each coordinate quantised to 2 printable chars in base 90 from '!'.
// Keep RANGE, BASE and OFFSET in sync with scan.luau.

const RANGE = 1.25; // coordinates are clamped to ±RANGE
const BASE = 90;
const OFFSET = 33;
const STEPS = BASE * BASE - 1;

/** `points`: x, y, z per landmark in MediaPipe normalized image coords; `aspect`: frame w / h. */
export function encodeFace(points: Float32Array, aspect: number): string {
  const n = points.length / 3;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, sumZ = 0;
  for (let i = 0; i < n; i++) {
    sumZ += points[i * 3 + 2];
    const x = points[i * 3] * aspect;
    const y = points[i * 3 + 1];
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const cz = sumZ / n; // turn around the middle of the face, not the tip of the nose
  const s = 2 / Math.max(maxY - minY, 1e-6);

  const out: string[] = [];
  const put = (v: number) => {
    const q = Math.round(((Math.max(-RANGE, Math.min(RANGE, v)) + RANGE) / (2 * RANGE)) * STEPS);
    out.push(String.fromCharCode(OFFSET + Math.floor(q / BASE), OFFSET + (q % BASE)));
  };
  for (let i = 0; i < n; i++) {
    put(-(points[i * 3] * aspect - cx) * s); // mirrored
    put(-(points[i * 3 + 1] - cy) * s); // y up
    put(-(points[i * 3 + 2] - cz) * aspect * s); // MediaPipe z is negative towards the camera
  }
  return out.join("");
}
