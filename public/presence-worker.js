/* eslint-disable */
// Classic worker: runs MediaPipe off the main thread so animations keep their frame rate.
// Receives ImageBitmaps, returns only numbers (no frames ever leave this worker).
importScripts("/mediapipe/vision_bundle.js");

const { FilesetResolver, FaceLandmarker, GestureRecognizer } = self.Vision;

let face = null;
let hands = null;
let handsError = "";

async function withFallback(make) {
  try {
    return await make("GPU");
  } catch {
    return make("CPU");
  }
}

async function init() {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
  face = await withFallback((delegate) =>
    FaceLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    }),
  );
  hands = await withFallback((delegate) =>
    GestureRecognizer.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/models/gesture_recognizer.task", delegate },
      runningMode: "VIDEO",
      numHands: 1,
    }),
  ).catch((e) => {
    handsError = String(e); // gestures are optional
    return null;
  });
}

function detect(bitmap, ts, wantHands) {
  const out = { type: "result", ts, m: null, blink: null, gesture: null };
  const r = face.detectForVideo(bitmap, ts);
  const m = r.facialTransformationMatrixes?.[0]?.data;
  if (m) out.m = [m[8], m[9], m[10]];
  const shapes = r.faceBlendshapes?.[0]?.categories;
  if (shapes) {
    const score = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
    out.blink = (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2;
  }
  if (hands && wantHands) {
    const top = hands.recognizeForVideo(bitmap, ts).gestures?.[0]?.[0];
    out.gesture = top ? { name: top.categoryName, score: top.score } : { name: "None", score: 1 };
  }
  return out;
}

self.onmessage = async ({ data }) => {
  if (data.type === "init") {
    try {
      await init();
      self.postMessage({ type: "ready", gestures: !!hands, handsError });
    } catch (e) {
      self.postMessage({ type: "error", message: String(e) });
    }
    return;
  }
  if (data.type === "frame") {
    const { bitmap, ts, wantHands } = data;
    try {
      self.postMessage(detect(bitmap, ts, wantHands));
    } catch (e) {
      self.postMessage({ type: "result", ts, m: null, blink: null, gesture: null });
    } finally {
      bitmap.close();
    }
  }
  if (data.type === "close") {
    face?.close();
    hands?.close();
    self.close();
  }
};
