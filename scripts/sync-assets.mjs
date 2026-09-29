// Copies runtime wasm into public/ and fetches MediaPipe models (self-hosted, no CDN at runtime).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
const pub = join(process.cwd(), "public");

const mpWasm = join(join(process.cwd(), "node_modules/@mediapipe/tasks-vision"), "wasm");
cpSync(mpWasm, join(pub, "mediapipe"), { recursive: true });
// IIFE bundle for the classic worker in public/presence-worker.js
cpSync(join(mpWasm, "..", "vision_bundle.js"), join(pub, "mediapipe", "vision_bundle.js"));

const riveDir = join(process.cwd(), "node_modules/@rive-app/webgl2");
mkdirSync(join(pub, "rive"), { recursive: true });
cpSync(join(riveDir, "rive.wasm"), join(pub, "rive", "rive.wasm"));

const models = {
  "face_landmarker.task":
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  "gesture_recognizer.task":
    "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
};
mkdirSync(join(pub, "models"), { recursive: true });
for (const [name, url] of Object.entries(models)) {
  const dest = join(pub, "models", name);
  if (existsSync(dest)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  console.log(`fetched ${name}`);
}
