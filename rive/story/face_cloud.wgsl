// The operator, as the recovery tool sees them: a 3D point cloud of a face.
// mode 0: the real face mesh (478 MediaPipe landmarks, written by the host once in S1,
//         every frame in S8). mode 1: "reconstructed", a head guessed from nothing,
//         used when the camera was refused. Points are acquired by a horizontal sweep
//         (structured light): before the sweep reaches them they drift as noise.
// Drawn as one quad per point (6 vertices each, no vertex buffer), plus one quad for the
// sweep band. Additive blending: dense areas burn brighter, like a real depth scan.

struct Uniforms {
    time: f32,
    sweep: f32,    // y of the sweep plane, model units: +1.3 (top, nothing acquired) .. -1.3 (all)
    mode: f32,     // 0 real, 1 reconstructed
    count: f32,    // number of real points in pts
    width: f32,
    height: f32,
    reveal: f32,   // 0..1 overall
    spin: f32,     // 0 = hold the pose (live mirror), 1 = slow examination turn
    yaw: f32,      // extra yaw from the host (radians)
    pitch: f32,    // extra pitch from the host (radians)
    pad0: f32,
    pad1: f32,
    pts: array<vec4<f32>, 480>,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) local: vec2<f32>,
    @location(1) glow: f32,
    @location(2) kind: f32,
};

const MAXP: u32 = 480u;
const PROC_N: f32 = 478.0;
const BONE = vec3<f32>(0.847, 0.863, 0.898);
const COLD = vec3<f32>(0.62, 0.68, 0.82);

fn hash1(n: f32) -> f32 {
    return fract(sin(n * 12.9898) * 43758.5453);
}
fn hash3(n: f32) -> vec3<f32> {
    return vec3<f32>(hash1(n), hash1(n + 17.31), hash1(n + 41.73));
}

// A head guessed from nothing: a shell of points plus the contours a face detector keeps
// (oval, eyes, brows, nose, lips), all lying on the same guessed surface.
fn surf(x: f32, y: f32) -> f32 {
    let w = 0.74 - 0.2 * max(0.0, -y) * max(0.0, -y);
    let e = 1.0 - (x / w) * (x / w) - y * y * 0.92;
    var z = sqrt(max(e, 0.0)) * 0.55;
    z = z + 0.24 * exp(-(x * x / 0.005 + (y + 0.04) * (y + 0.04) / 0.07));
    let ex = abs(x) - 0.26;
    z = z - 0.09 * exp(-(ex * ex / 0.012 + (y - 0.14) * (y - 0.14) / 0.008));
    return z - 0.25;
}

fn ring(t: f32, c: vec2<f32>, r: vec2<f32>) -> vec2<f32> {
    let a = t * 6.28318;
    return c + vec2<f32>(cos(a) * r.x, sin(a) * r.y);
}

fn guessed(i: f32) -> vec3<f32> {
    var xy: vec2<f32>;
    if (i < 250.0) {
        // shell: Fibonacci spiral projected on the front
        let yv = 1.0 - (i + 0.5) / 250.0 * 2.0;
        let r = sqrt(max(0.0, 1.0 - yv * yv));
        let w = 0.74 - 0.2 * max(0.0, -yv) * max(0.0, -yv);
        xy = vec2<f32>(cos(i * 2.39996) * r * w, yv * 0.98);
    } else if (i < 314.0) {
        // oval with a narrower jaw
        let t = (i - 250.0) / 64.0;
        var o = ring(t, vec2<f32>(0.0, 0.0), vec2<f32>(0.72, 0.98));
        o.x = o.x * (1.0 - 0.28 * max(0.0, -o.y) * max(0.0, -o.y));
        xy = o * 0.985;
    } else if (i < 354.0) {
        // eyes
        let k = i - 314.0;
        let side = select(-1.0, 1.0, k >= 20.0);
        xy = ring((k - floor(k / 20.0) * 20.0) / 20.0, vec2<f32>(0.27 * side, 0.13), vec2<f32>(0.115, 0.042));
    } else if (i < 378.0) {
        // brows
        let k = i - 354.0;
        let side = select(-1.0, 1.0, k >= 12.0);
        let t = (k - floor(k / 12.0) * 12.0) / 11.0;
        xy = vec2<f32>(side * (0.13 + t * 0.26), 0.29 + sin(t * 3.14159) * 0.05);
    } else if (i < 404.0) {
        // nose: bridge then nostrils
        let k = i - 378.0;
        if (k < 14.0) {
            xy = vec2<f32>(0.0, 0.12 - k / 13.0 * 0.34);
        } else {
            let t = (k - 14.0) / 11.0;
            xy = vec2<f32>((t - 0.5) * 0.26, -0.24 + abs(t - 0.5) * 0.08);
        }
    } else if (i < 444.0) {
        // lips: outer and inner line
        let k = i - 404.0;
        if (k < 26.0) {
            var l = ring(k / 26.0, vec2<f32>(0.0, -0.46), vec2<f32>(0.21, 0.075));
            l.y = l.y + 0.025 * exp(-l.x * l.x / 0.002) * step(-0.46, l.y) * -1.0;
            xy = l;
        } else {
            let t = (k - 26.0) / 13.0;
            xy = vec2<f32>((t - 0.5) * 0.36, -0.46);
        }
    } else {
        // chin and cheek fill
        let k = i - 444.0;
        xy = vec2<f32>((hash1(k) - 0.5) * 0.9, -0.2 - hash1(k + 5.0) * 0.55);
    }
    return vec3<f32>(xy.x, xy.y, surf(xy.x, xy.y) + 0.01);
}

fn rot(p: vec3<f32>, yaw: f32, pitch: f32) -> vec3<f32> {
    let cy = cos(yaw);
    let sy = sin(yaw);
    let a = vec3<f32>(p.x * cy + p.z * sy, p.y, -p.x * sy + p.z * cy);
    let cp = cos(pitch);
    let sp = sin(pitch);
    return vec3<f32>(a.x, a.y * cp - a.z * sp, a.y * sp + a.z * cp);
}

@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
    let p = vi / 6u;
    let c = vi % 6u;
    var corners = array<vec2<f32>, 6>(
        vec2<f32>(-1.0, -1.0), vec2<f32>(1.0, -1.0), vec2<f32>(-1.0, 1.0),
        vec2<f32>(-1.0, 1.0), vec2<f32>(1.0, -1.0), vec2<f32>(1.0, 1.0),
    );
    let q = corners[c];
    let px = vec2<f32>(2.0 / u.width, 2.0 / u.height);
    let scale = 0.62;
    var out: VertexOutput;
    out.local = q;
    out.kind = 0.0;
    out.glow = 0.0;

    // the sweep band: a thin horizontal light across the frame
    if (p == MAXP) {
        let sy = u.sweep * scale;
        out.kind = 1.0;
        out.glow = step(-1.25, u.sweep) * step(u.sweep, 1.25);
        out.position = vec4<f32>(q.x, sy + q.y * 14.0 * px.y, 0.0, 1.0);
        return out;
    }

    let fi = f32(p);
    let real = u.mode < 0.5;
    if ((real && fi >= u.count) || (!real && fi >= PROC_N)) {
        out.position = vec4<f32>(-3.0, -3.0, 0.0, 1.0);
        return out;
    }

    var base: vec3<f32>;
    if (real) {
        base = u.pts[p].xyz;
    } else {
        base = guessed(fi);
        // a guess never holds still
        let tick = floor(u.time * 9.0);
        base = base + (hash3(fi * 3.1 + tick) - vec3<f32>(0.5)) * 0.035;
    }

    // acquisition by the sweep: noise before, the face after
    let scatter = (hash3(fi) - vec3<f32>(0.5)) * vec3<f32>(2.8, 2.8, 1.6);
    let a = smoothstep(-0.02, 0.22, base.y - u.sweep);
    let ease = 1.0 - (1.0 - a) * (1.0 - a) * (1.0 - a);
    let drift = vec3<f32>(sin(u.time * 0.7 + fi), cos(u.time * 0.5 + fi * 1.3), 0.0) * 0.05 * (1.0 - a);
    let pos = mix(scatter + drift, base, ease);

    let yaw = u.spin * (sin(u.time * 0.33) * 0.75) + u.yaw;
    let pitch = u.spin * (sin(u.time * 0.21) * 0.12) + u.pitch;
    let r = rot(pos, yaw, pitch);
    let persp = 4.0 / (4.0 - r.z);
    let aspect = u.width / u.height;
    let centre = vec2<f32>(r.x * scale * persp / aspect, r.y * scale * persp);

    let depth = clamp(r.z * 0.9 + 0.55, 0.0, 1.0);
    let flare = exp(-abs(base.y - u.sweep) * 16.0) * step(-1.25, u.sweep);
    let size = (0.55 + 0.45 * ease) * (1.5 + 1.4 * depth) + flare * ease * 2.6;
    out.position = vec4<f32>(centre + q * size * px, 0.0, 1.0);

    // structured-light banding, depth fog, dropouts for the guess
    let bands = 0.72 + 0.28 * sin(base.y * 46.0 - u.time * 0.8);
    var g = (0.22 + 0.78 * depth) * bands * (0.18 + 0.82 * ease) + flare * ease * 1.4;
    if (!real) {
        g = g * 0.8 * step(0.1, hash1(fi + floor(u.time * 11.0)));
    }
    out.glow = g;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    var a: f32;
    var col: vec3<f32>;
    if (in.kind > 0.5) {
        let edge = 1.0 - abs(in.local.x);
        a = exp(-abs(in.local.y) * 4.0) * sqrt(max(edge, 0.0)) * 0.55 * in.glow;
        col = COLD;
    } else {
        let d = length(in.local);
        a = (1.0 - smoothstep(0.35, 1.0, d)) * in.glow * 0.8;
        col = BONE;
    }
    a = a * u.reveal;
    return vec4<f32>(col * a, a);
}
