"use client";

// The figure in S9's lit window (owner, round 10c): a rigged 3D person (the Ready Player Me
// avatar from the three.js examples: public/figure3d/person.glb) seen from the hips up, black
// against the room's light, the light catching its edges. Its arms are let down from the
// model's T-pose and it breathes; its head copies the player's, and an arm reaches with real
// bones (shoulder, elbow, wrist) for where the player's hand is. The beard is hidden, so in
// silhouette it could be anyone.
//
// One full-screen transparent canvas; each frame the figure is drawn only inside the glass
// rectangle the host passes (viewport + scissor), so the canvas never resizes mid-zoom.

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type FigurePose = {
  /** -1..1, the player's head, mirrored (as PresenceState) */
  headX: number;
  headY: number;
  /** the palm from the nose in face widths, mirrored (x > 0 screen right, y > 0 below);
   * null: both arms hang */
  arm: { x: number; y: number } | null;
};

export type Glass = { x: number; y: number; w: number; h: number };

const URL = "/figure3d/person.glb";
// parts that would only give it away (or never show in a silhouette)
const HIDDEN = ["Wolf3D_Beard", "Wolf3D_Headwear", "EyeLeft", "EyeRight", "Wolf3D_Teeth"];
// what the window shows of the room, in metres (the model is ~1.8 m tall): from below the
// hips to a little above the head, at the glass's aspect
const VIEW_BOTTOM = 0.74;
const VIEW_TOP = 2.12;
const FOV = 16;
// a face width (cheek to cheek) and where the nose is from the head bone, in metres
const FACE_W = 0.15;
const NOSE = new THREE.Vector3(0, 0.085, 0.11);
// wrist to the middle of the palm
const PALM = 0.075;
// how far to the side a hand can go and still be inside the window (metres)
const HAND_X = 0.24;
// which way the palm is turned once raised: +1 towards the street (the camera)
const PALM_FACING = 1;
// the edge light of the room behind
const RIM = new THREE.Color(0.62, 0.68, 0.78);
// the flower in the jacket's buttonhole: the edge light leaves it alone, so it disappears
// into the black of the jacket (model space, metres)
const FLOWER = { at: new THREE.Vector3(-0.15, 1.44, 0), r: 0.075 };

const UP = new THREE.Vector3(0, 1, 0);
const RIGHT = new THREE.Vector3(1, 0, 0);

/** Turns `bone` in world space by `q` (keeps its children attached). */
function rotateWorld(bone: THREE.Object3D, q: THREE.Quaternion) {
  const parent = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
  const world = bone.getWorldQuaternion(new THREE.Quaternion()).premultiply(q);
  bone.quaternion.copy(parent.invert().multiply(world));
  bone.updateMatrixWorld(true);
}

/** Points the segment from `bone` to `child` along `dir` (world), turning `bone`. */
function aim(bone: THREE.Object3D, child: THREE.Object3D, dir: THREE.Vector3) {
  const from = child.getWorldPosition(new THREE.Vector3()).sub(bone.getWorldPosition(new THREE.Vector3())).normalize();
  rotateWorld(bone, new THREE.Quaternion().setFromUnitVectors(from, dir.clone().normalize()));
}

/** Short, uneven hair: a lumpy cap, its outline broken into tufts, low at the back. */
function hairCap(material: THREE.Material): THREE.Mesh {
  const geo = new THREE.IcosahedronGeometry(1, 7);
  const p = geo.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n =
      Math.sin(v.x * 9.1 + v.z * 4.3) * 0.4 +
      Math.sin(v.y * 11.7 - v.x * 6.1) * 0.25 +
      Math.sin(v.z * 17.3 + v.y * 5.2) * 0.2 +
      Math.sin(v.x * 23.1 - v.z * 19.7 + v.y * 7.0) * 0.18;
    const top = THREE.MathUtils.smoothstep(v.y, -0.1, 0.95);
    // tufts: little on the sides, more and spikier on top
    v.multiplyScalar(1 + (0.012 + 0.1 * top) * Math.pow(Math.max(0, n), 1.5));
    // volume on top, the sides cut short above the ears
    v.y *= 1.06;
    if (v.y < 0.25) v.x *= 0.93;
    // off the face: the front pulled in under the fringe, the bottom flattened at the nape
    if (v.z > 0.3 && v.y < 0.3) v.z -= (v.z - 0.3) * 0.95;
    if (v.y < -0.3) v.y = -0.3 + (v.y + 0.3) * 0.25;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

/** Near black, with the light of the room behind catching every edge (strongest on top).
 * `cut`: where the edge light is not drawn (model space), for a detail it would pick out. */
function silhouette(cut?: { at: THREE.Vector3; r: number }): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0x07080b, roughness: 0.75, metalness: 0 });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.rimColor = { value: RIM };
    shader.uniforms.cutAt = { value: cut?.at ?? new THREE.Vector3() };
    shader.uniforms.cutR = { value: cut?.r ?? 0 };
    shader.vertexShader = shader.vertexShader
      .replace("void main() {", "varying vec3 vModelPos;\nvoid main() {")
      .replace("#include <project_vertex>", "#include <project_vertex>\nvModelPos = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("void main() {", "uniform vec3 rimColor;\nuniform vec3 cutAt;\nuniform float cutR;\nvarying vec3 vModelPos;\nvoid main() {")
      .replace(
      "#include <dithering_fragment>",
      `{
        vec3 n = normalize(normal);
        float edge = pow(1.0 - abs(dot(n, normalize(vViewPosition))), 5.0);
        float high = 0.35 + 0.65 * smoothstep(-0.4, 0.8, n.y);
        float lit = distance(vModelPos.xy, cutAt.xy) < cutR ? 0.0 : 1.0;
        gl_FragColor.rgb += rimColor * edge * high * 0.55 * lit;
      }
      #include <dithering_fragment>`,
    );
  };
  return m;
}

export class Figure3D {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(FOV, 0.5, 0.1, 20);
  bones: Record<string, THREE.Bone> = {};
  private bind = new Map<THREE.Bone, THREE.Quaternion>();
  private model: THREE.Object3D | null = null;
  private clock = new THREE.Clock();
  private reach = { L: 0, R: 0 };
  ready = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // the room's light: high and behind, cool; next to nothing from the street
    const back = new THREE.DirectionalLight(0xdfe6f2, 2.2);
    back.position.set(0.4, 3, -2.5);
    this.scene.add(back, new THREE.HemisphereLight(0x8090a0, 0x000000, 0.08));
  }

  async load() {
    const gltf = await new GLTFLoader().loadAsync(URL);
    const model = gltf.scene;
    const material = silhouette();
    const jacket = silhouette(FLOWER);
    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        (o as THREE.Mesh).material = o.name === "Wolf3D_Outfit_Top" ? jacket : material;
        o.frustumCulled = false;
        if (HIDDEN.includes(o.name)) o.visible = false;
      }
      if ((o as THREE.Bone).isBone) {
        this.bones[o.name] = o as THREE.Bone;
        this.bind.set(o as THREE.Bone, o.quaternion.clone());
      }
    });
    for (const name of ["Spine1", "Spine2", "Head", "Neck", "LeftArm", "LeftForeArm", "LeftHand", "RightArm", "RightForeArm", "RightHand"])
      if (!this.bones[name]) throw new Error(`person.glb: no ${name} bone`);
    this.scene.add(model);
    this.model = model;
    // hair, sized on the real head (the model's own hair came with a hat, hidden)
    model.updateMatrixWorld(true);
    const headMesh = model.getObjectByName("Wolf3D_Head") as THREE.Mesh | undefined;
    if (!headMesh) throw new Error("person.glb: no Wolf3D_Head mesh");
    headMesh.geometry.computeBoundingBox();
    const box = headMesh.geometry.boundingBox!.clone().applyMatrix4(headMesh.matrixWorld);
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const r = (size.x / 2) * 1.08;
    const cap = hairCap(material);
    const head = this.bones.Head;
    const k = head.getWorldScale(new THREE.Vector3()).x;
    cap.position.copy(head.worldToLocal(new THREE.Vector3(centre.x, box.max.y - r * 0.92, centre.z - r * 0.12)));
    cap.scale.set(r / k, (r * 1.02) / k, (r * 1.12) / k);
    head.add(cap);
    this.ready = true;
  }

  /** Draws the figure inside `glass` (CSS px of the canvas), posed as the player is. */
  render(glass: Glass, pose: FigurePose) {
    const r = this.renderer;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    const size = r.getSize(new THREE.Vector2());
    if (size.x !== cw || size.y !== ch) r.setSize(cw, ch, false);
    r.setScissorTest(false);
    r.clear();
    if (!this.ready || !this.model || glass.w < 2 || glass.h < 2) return;
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.rest(this.clock.elapsedTime);
    this.pose(pose, dt);

    // the camera frames the hips up, at the glass's aspect, from a few metres away
    const mid = (VIEW_TOP + VIEW_BOTTOM) / 2;
    const dist = (VIEW_TOP - VIEW_BOTTOM) / 2 / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.camera.aspect = glass.w / glass.h;
    this.camera.position.set(0, mid, dist);
    this.camera.lookAt(0, mid, 0);
    this.camera.updateProjectionMatrix();

    // the canvas's y runs up from the bottom
    const y = ch - glass.y - glass.h;
    r.setViewport(glass.x, y, glass.w, glass.h);
    r.setScissor(glass.x, y, glass.w, glass.h);
    r.setScissorTest(true);
    r.render(this.scene, this.camera);
  }

  /** Standing still: the arms down at the sides from the T-pose, breathing. */
  private rest(t: number) {
    this.bind.forEach((q, bone) => bone.quaternion.copy(q));
    this.model!.updateMatrixWorld(true);
    const b = this.bones;
    const breath = Math.sin(t * 1.5);
    rotateWorld(b.Spine1, new THREE.Quaternion().setFromAxisAngle(RIGHT, -0.012 * breath));
    rotateWorld(b.Spine2, new THREE.Quaternion().setFromAxisAngle(RIGHT, -0.01 * breath));
    for (const [name, out] of [["Left", 1], ["Right", -1]] as const) {
      // the upper arm hangs a little out from the body, the forearm a little forward
      aim(b[`${name}Arm`], b[`${name}ForeArm`], new THREE.Vector3(out * 0.16, -1, 0.02));
      aim(b[`${name}ForeArm`], b[`${name}Hand`], new THREE.Vector3(out * 0.06, -1, 0.16));
    }
  }

  private pose(p: FigurePose, dt: number) {
    const b = this.bones;
    // the head, as the player's: turned towards the side they turn to, tilted as they nod
    rotateWorld(b.Neck, new THREE.Quaternion().setFromAxisAngle(UP, p.headX * 0.25));
    rotateWorld(b.Head, new THREE.Quaternion().setFromAxisAngle(UP, p.headX * 0.3));
    rotateWorld(b.Head, new THREE.Quaternion().setFromAxisAngle(RIGHT, p.headY * 0.35));

    // which arm: screen right is the figure's left (it faces the street)
    const side: "L" | "R" | null = p.arm ? (p.arm.x >= 0 ? "L" : "R") : null;
    for (const s of ["L", "R"] as const) {
      const want = side === s ? 1 : 0;
      this.reach[s] += (want - this.reach[s]) * (1 - Math.pow(0.0005, dt));
    }
    if (!p.arm) return;
    const nose = b.Head.getWorldPosition(new THREE.Vector3()).add(NOSE);
    // the palm is there; the wrist a hand's length below it (the fingers point up)
    // kept inside the glass: the window shows about ±0.33 m around the figure
    const x = THREE.MathUtils.clamp(nose.x + p.arm.x * FACE_W, -HAND_X, HAND_X);
    const target = new THREE.Vector3(x, nose.y - p.arm.y * FACE_W - PALM, nose.z + 0.06);
    for (const s of ["L", "R"] as const) if (this.reach[s] > 0.001) this.arm(s, target, this.reach[s]);
  }

  /** Two bones from the shoulder to `target` (world), blended over the idle by `w`. */
  private arm(s: "L" | "R", target: THREE.Vector3, w: number) {
    const name = s === "L" ? "Left" : "Right";
    const upper = this.bones[`${name}Arm`];
    const fore = this.bones[`${name}ForeArm`];
    const hand = this.bones[`${name}Hand`];
    const before = [upper.quaternion.clone(), fore.quaternion.clone(), hand.quaternion.clone()];

    const S = upper.getWorldPosition(new THREE.Vector3());
    const E = fore.getWorldPosition(new THREE.Vector3());
    const W = hand.getWorldPosition(new THREE.Vector3());
    const a = S.distanceTo(E);
    const c = E.distanceTo(W);
    const toT = target.clone().sub(S);
    const d = THREE.MathUtils.clamp(toT.length(), Math.abs(a - c) + 0.01, a + c - 0.002);
    const dir = toT.normalize();
    // the elbow goes down, out and a little forward, as when someone raises a hand
    const out = s === "L" ? 1 : -1;
    const pole = new THREE.Vector3(out * 0.35, -0.5, 0.8).normalize();
    const perp = pole.sub(dir.clone().multiplyScalar(pole.dot(dir))).normalize();
    const cosA = THREE.MathUtils.clamp((a * a + d * d - c * c) / (2 * a * d), -1, 1);
    const elbow = S.clone()
      .add(dir.clone().multiplyScalar(a * cosA))
      .add(perp.multiplyScalar(a * Math.sqrt(1 - cosA * cosA)));
    aim(upper, fore, elbow.clone().sub(S));
    const wrist = S.clone().add(dir.clone().multiplyScalar(d));
    aim(fore, hand, wrist.clone().sub(fore.getWorldPosition(new THREE.Vector3())));
    // the hand open, fingers on along the forearm, the palm turned to the street
    const knuckle = this.bones[`${name}HandMiddle1`];
    const index = this.bones[`${name}HandIndex1`];
    const pinky = this.bones[`${name}HandPinky1`];
    const along = wrist.clone().sub(elbow).normalize();
    aim(hand, knuckle, along);
    const across = index.getWorldPosition(new THREE.Vector3()).sub(pinky.getWorldPosition(new THREE.Vector3()));
    const palm = along.clone().cross(across).multiplyScalar(s === "L" ? 1 : -1).normalize();
    // twist about the forearm until the palm faces +z (the window)
    const flat = (v: THREE.Vector3) => v.clone().sub(along.clone().multiplyScalar(v.dot(along))).normalize();
    const now = flat(palm);
    const want = flat(new THREE.Vector3(0, 0, PALM_FACING));
    const twist = Math.atan2(along.dot(now.clone().cross(want)), now.dot(want));
    rotateWorld(hand, new THREE.Quaternion().setFromAxisAngle(along, twist));

    if (w < 0.999) {
      for (const [i, bone] of [upper, fore, hand].entries()) bone.quaternion.copy(before[i].clone().slerp(bone.quaternion, w));
      upper.updateMatrixWorld(true);
    }
  }

  dispose() {
    this.ready = false;
    this.renderer.dispose();
  }
}
