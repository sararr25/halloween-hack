// Client-side perception: head pose, blinks and hand gestures from the webcam.
// MediaPipe runs in public/presence-worker.js; frames never leave the browser.
// Everything degrades to the mouse when the camera or the worker is unavailable.

export type Gesture = "none" | "palm" | "fist" | "point" | "victory" | "thumbUp" | "thumbDown" | "love";

export type PresenceState = {
  source: "camera" | "mouse";
  headX: number; // -1 (left) .. 1 (right), smoothed
  headY: number; // -1 (up) .. 1 (down), smoothed
  lookingAway: boolean;
  faceLost: boolean;
  gesture: Gesture;
  /** diagnostics for the debug overlay */
  debug: { hands: string; rawGesture: string };
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
const EMA = 0.3;
const YAW_RANGE = 18; // degrees mapped to headX = ±1
const PITCH_RANGE = 12;
const AWAY_YAW = 25; // |yaw| beyond this counts as looking away
const AWAY_AFTER_MS = 1500;
const LOST_AFTER_MS = 3000;
const BLINK_ON = 0.5;
const BLINK_OFF = 0.3;
const GESTURE_SCORE = 0.6;
const GESTURE_HOLD_MS = 300;
const MIN_FRAME_MS = 30; // ~33 Hz is plenty for a head

type WorkerResult = {
  type: "result";
  ts: number;
  m: [number, number, number] | null; // facial transformation matrix entries 8, 9, 10
  blink: number | null;
  gesture: { name: string; score: number } | null;
};

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
    debug: { hands: "-", rawGesture: "-" },
  };

  private worker?: Worker;
  private video?: HTMLVideoElement;
  private stream?: MediaStream;
  private running = false;
  private busy = false; // one frame in flight at most; frames arriving meanwhile are skipped
  private frame = 0;
  private lastSentAt = 0;
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

    try {
      const { worker, gestures, handsError } = await startWorker();
      this.worker = worker;
      this.state.debug.hands = gestures ? "ready" : `off (${handsError || "unknown"})`;
    } catch {
      this.stream.getTracks().forEach((t) => t.stop());
      return false;
    }
    this.worker.onmessage = ({ data }: MessageEvent<WorkerResult>) => {
      if (data.type !== "result") return;
      this.busy = false;
      this.apply(data);
    };

    this.stopMouse?.();
    this.state.source = "camera";
    this.lastFaceAt = performance.now();
    this.running = true;
    this.schedule();
    return true;
  }

  /** Current head pose becomes the neutral position. */
  calibrate() {
    this.baseYaw += this.state.headX * YAW_RANGE;
    this.basePitch += this.state.headY * PITCH_RANGE;
  }

  stop() {
    this.running = false;
    this.stopMouse?.();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.worker?.postMessage({ type: "close" });
  }

  // Frame pump: follows the camera's own frames when the browser supports it.
  private schedule() {
    if (!this.running || !this.video) return;
    if ("requestVideoFrameCallback" in this.video) this.video.requestVideoFrameCallback(this.pump);
    else requestAnimationFrame(() => this.pump());
  }

  private pump = async () => {
    const video = this.video;
    if (!this.running || !video) return;
    const now = performance.now();
    if (!this.busy && video.readyState >= 2 && now - this.lastSentAt >= MIN_FRAME_MS) {
      this.busy = true;
      this.lastSentAt = now;
      this.frame++;
      try {
        const bitmap = await createImageBitmap(video);
        // gestures at half rate
        this.worker?.postMessage({ type: "frame", bitmap, ts: now, wantHands: this.frame % 2 === 0 }, [bitmap]);
      } catch {
        this.busy = false;
      }
    }
    this.schedule();
  };

  private apply(r: WorkerResult) {
    const now = performance.now();
    if (r.m) {
      const [m8, m9, m10] = r.m;
      this.lastFaceAt = now;
      // column-major 4x4: yaw around Y, pitch around X
      const yaw = Math.atan2(m8, m10) * DEG;
      const pitch = Math.asin(-clamp(m9)) * DEG;
      // mirrored: turning your head to your right moves things to screen right
      const tx = clamp(-(yaw - this.baseYaw) / YAW_RANGE);
      const ty = clamp((pitch - this.basePitch) / PITCH_RANGE);
      this.state.headX += (tx - this.state.headX) * EMA;
      this.state.headY += (ty - this.state.headY) * EMA;

      const turned = Math.abs(yaw - this.baseYaw) > AWAY_YAW;
      this.awaySince = turned ? this.awaySince || now : 0;

      if (r.blink !== null) {
        if (!this.blinking && r.blink > BLINK_ON) {
          this.blinking = true;
          this.events.onBlink?.();
        } else if (this.blinking && r.blink < BLINK_OFF) {
          this.blinking = false;
        }
      }
    } else {
      this.awaySince = this.awaySince || now;
    }

    this.state.faceLost = now - this.lastFaceAt > LOST_AFTER_MS;
    this.state.lookingAway = this.awaySince > 0 && now - this.awaySince > AWAY_AFTER_MS;

    // a gesture counts once it is held
    if (r.gesture) {
      this.state.debug.rawGesture = `${r.gesture.name} ${r.gesture.score.toFixed(2)}`;
      const g = r.gesture.score > GESTURE_SCORE ? (GESTURES[r.gesture.name] ?? "none") : "none";
      if (g !== this.gestureCandidate) {
        this.gestureCandidate = g;
        this.gestureSince = now;
      } else if (g !== this.state.gesture && now - this.gestureSince > GESTURE_HOLD_MS) {
        this.state.gesture = g;
        if (g !== "none") this.events.onGesture?.(g);
      }
    }

    this.emit();
  }

  private emit() {
    this.events.onChange?.(this.state);
  }
}

type WorkerReady = { worker: Worker; gestures: boolean; handsError: string };

function startWorker(): Promise<WorkerReady> {
  return new Promise((resolve, reject) => {
    const worker = new Worker("/presence-worker.js");
    worker.onmessage = ({ data }) => {
      if (data.type === "ready") resolve({ worker, gestures: data.gestures, handsError: data.handsError });
      else if (data.type === "error") {
        worker.terminate();
        reject(new Error(data.message));
      }
    };
    worker.onerror = (e) => {
      worker.terminate();
      reject(e);
    };
    worker.postMessage({ type: "init" });
  });
}
