// Client-side perception: head pose, blinks and hand gestures from the webcam.
// Frames never leave the browser. Everything degrades to the mouse when the camera is unavailable.
import {
  FaceLandmarker,
  FilesetResolver,
  GestureRecognizer,
} from "@mediapipe/tasks-vision";

export type Gesture = "none" | "palm" | "fist" | "point" | "victory" | "thumbUp" | "thumbDown" | "love";

export type PresenceState = {
  source: "camera" | "mouse";
  headX: number; // -1 (left) .. 1 (right), smoothed
  headY: number; // -1 (up) .. 1 (down), smoothed
  lookingAway: boolean;
  faceLost: boolean;
  gesture: Gesture;
};

export type PresenceEvents = {
  onChange?: (s: PresenceState) => void;
  onBlink?: () => void;
  onGesture?: (g: Gesture) => void;
};

const GESTURES: Record<string, Gesture> = {
  Open_Palm: "palm",
  Closed_Fist: "fist",
  Pointing_Up: "point",
  Victory: "victory",
  Thumb_Up: "thumbUp",
  Thumb_Down: "thumbDown",
  ILoveYou: "love",
};

// Tuning
const EMA = 0.2;
const YAW_RANGE = 28; // degrees mapped to headX = ±1
const PITCH_RANGE = 18;
const AWAY_YAW = 25; // |yaw| beyond this counts as looking away
const AWAY_AFTER_MS = 1500;
const LOST_AFTER_MS = 3000;
const BLINK_ON = 0.5;
const BLINK_OFF = 0.3;
const GESTURE_SCORE = 0.7;
const GESTURE_HOLD_MS = 300;
const FRAME_BUDGET_MS = 12; // detection time per frame before we start skipping frames

const clamp = (v: number) => Math.max(-1, Math.min(1, v));
const DEG = 180 / Math.PI;

export class PresenceTracker {
  state: PresenceState = {
    source: "mouse",
    headX: 0,
    headY: 0,
    lookingAway: false,
    faceLost: false,
    gesture: "none",
  };

  private face?: FaceLandmarker;
  private hands?: GestureRecognizer;
  private video?: HTMLVideoElement;
  private stream?: MediaStream;
  private raf = 0;
  private frame = 0;
  private stride = 1; // run detection every `stride` animation frames
  private lastRunAt = 0;
  private baseYaw = 0;
  private basePitch = 0;
  private lastFaceAt = 0;
  private awaySince = 0;
  private blinking = false;
  private gestureCandidate: Gesture = "none";
  private gestureSince = 0;
  private stopMouse?: () => void;

  constructor(private events: PresenceEvents = {}) {}

  /** Mouse fallback: the cursor plays the head. */
  startMouse() {
    this.state.source = "mouse";
    const move = (e: PointerEvent) => {
      const tx = (e.clientX / window.innerWidth) * 2 - 1;
      const ty = (e.clientY / window.innerHeight) * 2 - 1;
      this.state.headX += (tx - this.state.headX) * 0.5;
      this.state.headY += (ty - this.state.headY) * 0.5;
      this.emit();
    };
    const away = (value: boolean) => () => {
      if (this.state.source !== "mouse") return;
      this.state.lookingAway = value;
      this.emit();
    };
    const visibility = () => away(document.hidden)();
    const leave = away(true);
    const enter = away(false);
    window.addEventListener("pointermove", move);
    document.documentElement.addEventListener("pointerleave", leave);
    document.documentElement.addEventListener("pointerenter", enter);
    document.addEventListener("visibilitychange", visibility);
    this.stopMouse = () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
      document.documentElement.removeEventListener("pointerenter", enter);
      document.removeEventListener("visibilitychange", visibility);
    };
  }

  /** Must be called from a user gesture. Resolves false if the camera is refused or unsupported. */
  async startCamera(video: HTMLVideoElement): Promise<boolean> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: false,
      });
    } catch {
      return false;
    }
    video.srcObject = this.stream;
    video.muted = true;
    video.playsInline = true;
    await video.play();
    this.video = video;

    const fileset = await FilesetResolver.forVisionTasks("/mediapipe");
    this.face = await createWithFallback((delegate) =>
      FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/face_landmarker.task", delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      }),
    );
    this.hands = await createWithFallback((delegate) =>
      GestureRecognizer.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: "/models/gesture_recognizer.task", delegate },
        runningMode: "VIDEO",
        numHands: 1,
      }),
    ).catch(() => undefined); // gestures are optional

    this.stopMouse?.();
    this.state.source = "camera";
    this.lastFaceAt = performance.now();
    this.loop();
    return true;
  }

  /** Current head pose becomes the neutral position. */
  calibrate() {
    this.baseYaw += this.state.headX * YAW_RANGE;
    this.basePitch += this.state.headY * PITCH_RANGE;
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.stopMouse?.();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.face?.close();
    this.hands?.close();
  }

  private loop = () => {
    this.raf = requestAnimationFrame(this.loop);
    const video = this.video;
    if (!video || video.readyState < 2 || !this.face) return;
    this.frame++;
    // adaptive throttle: slow devices track less often, animations keep their frame rate
    if (this.frame % this.stride !== 0) return;
    const now = performance.now();
    if (now - this.lastRunAt < 30) return; // ~33 Hz is plenty for a head
    this.lastRunAt = now;

    const r = this.face.detectForVideo(video, now);
    const m = r.facialTransformationMatrixes?.[0]?.data;
    if (m) {
      this.lastFaceAt = now;
      // column-major 4x4: yaw around Y, pitch around X
      const yaw = Math.atan2(m[8], m[10]) * DEG;
      const pitch = Math.asin(-clamp(m[9])) * DEG;
      // mirrored: turning your head to your right moves things to screen right
      const tx = clamp(-(yaw - this.baseYaw) / YAW_RANGE);
      const ty = clamp((pitch - this.basePitch) / PITCH_RANGE);
      this.state.headX += (tx - this.state.headX) * EMA;
      this.state.headY += (ty - this.state.headY) * EMA;

      const turned = Math.abs(yaw - this.baseYaw) > AWAY_YAW;
      this.awaySince = turned ? this.awaySince || now : 0;

      const shapes = r.faceBlendshapes?.[0]?.categories;
      if (shapes) {
        const score = (name: string) => shapes.find((c) => c.categoryName === name)?.score ?? 0;
        const blink = (score("eyeBlinkLeft") + score("eyeBlinkRight")) / 2;
        if (!this.blinking && blink > BLINK_ON) {
          this.blinking = true;
          this.events.onBlink?.();
        } else if (this.blinking && blink < BLINK_OFF) {
          this.blinking = false;
        }
      }
    } else {
      this.awaySince = this.awaySince || now;
    }

    this.state.faceLost = now - this.lastFaceAt > LOST_AFTER_MS;
    this.state.lookingAway = this.awaySince > 0 && now - this.awaySince > AWAY_AFTER_MS;

    // gestures at half rate; a gesture counts once it is held
    if (this.hands && this.frame % (2 * this.stride) === 0) {
      const top = this.hands.recognizeForVideo(video, now).gestures?.[0]?.[0];
      const g = top && top.score > GESTURE_SCORE ? (GESTURES[top.categoryName] ?? "none") : "none";
      if (g !== this.gestureCandidate) {
        this.gestureCandidate = g;
        this.gestureSince = now;
      } else if (g !== this.state.gesture && now - this.gestureSince > GESTURE_HOLD_MS) {
        this.state.gesture = g;
        if (g !== "none") this.events.onGesture?.(g);
      }
    }

    const cost = performance.now() - now;
    if (cost > FRAME_BUDGET_MS && this.stride < 8) this.stride++;
    else if (cost < FRAME_BUDGET_MS / 2 && this.stride > 1) this.stride--;

    this.emit();
  };

  private emit() {
    this.events.onChange?.(this.state);
  }
}

async function createWithFallback<T>(make: (delegate: "GPU" | "CPU") => Promise<T>): Promise<T> {
  try {
    return await make("GPU");
  } catch {
    return make("CPU");
  }
}
