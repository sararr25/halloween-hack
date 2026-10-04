/* eslint-disable */
// Classic worker: runs MediaPipe off the main thread so animations keep their frame rate.
// Receives ImageBitmaps, returns only numbers (no frames ever leave this worker):
// head pose, blink, gesture and, on request, the face mesh landmarks.
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

function detect(bitmap, ts, wantHands, wantPoints) {
  const out = { type: "result", ts, m: null, blink: null, gesture: null, hand: null, nose: null, points: null, aspect: bitmap.width / bitmap.height };
  const r = face.detectForVideo(bitmap, ts);
  // the face mesh as plain numbers (x, y, z per landmark), only when the story asks for it
  const lm = r.faceLandmarks?.[0];
  // the nose tip and the face's width (cheek to cheek): where the hand is is measured from them
  if (lm) out.nose = [lm[1].x, lm[1].y, Math.abs(lm[454].x - lm[234].x)];
  if (wantPoints && lm) {
    out.points = new Float32Array(lm.length * 3);
    lm.forEach((p, i) => out.points.set([p.x, p.y, p.z], i * 3));
  }
  const m = r.facialTransformationMatrixes?.[0]?.data;
  if (m) out.m = [m[8], m[9], m[10]];
  const shapes = r.faceBlendshapes?.[0]?.categories;
  if (shapes) {
    const score = (name) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
    out.blink = (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2;
  }
  if (hands && wantHands) {
    const g = hands.recognizeForVideo(bitmap, ts);
    const top = g.gestures?.[0]?.[0];
    out.gesture = top ? { name: top.categoryName, score: top.score } : { name: "None", score: 1 };
    // the palm centre (wrist + the four knuckles), normalized image coords: the hand can
    // steer things (the binoculars in the facade, round 8)
    const hl = g.landmarks?.[0];
    if (hl) {
      const palm = [0, 5, 9, 13, 17].map((i) => hl[i]);
      out.hand = [palm.reduce((a, p) => a + p.x, 0) / 5, palm.reduce((a, p) => a + p.y, 0) / 5];
    }
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
    const { bitmap, ts, wantHands, wantPoints } = data;
    try {
      const out = detect(bitmap, ts, wantHands, wantPoints);
      self.postMessage(out, out.points ? [out.points.buffer] : []);
    } catch (e) {
      self.postMessage({ type: "result", ts, m: null, blink: null, gesture: null, points: null });
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
