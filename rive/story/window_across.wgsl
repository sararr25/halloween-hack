// S9 · the window across, the same building as IMG_0418, seen live.
// One window lights up. Inside, a figure against the light copies the user's head 1:1,
// with no lag for the first time. The host pushes the camera in (zoom) and corrupts the
// image in blocks at the end (corruption). Scene units: 1280 x 800, y down.

struct Uniforms {
    time: f32,
    width: f32,
    height: f32,
    headX: f32,       // -1..1, mirrored like a selfie
    headY: f32,       // -1..1
    zoom: f32,        // 0..1 push-in on the lit window
    light: f32,       // 0..1 the lit window
    corruption: f32,  // 0..1 block displacement + vertical smear
    figure: f32,      // 0..1 the figure's presence
    neon: f32,        // 0..1 cyan in the light
    pad0: f32,
    pad1: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(
        vec2<f32>(-1.0, -1.0),
        vec2<f32>(3.0, -1.0),
        vec2<f32>(-1.0, 3.0),
    );
    let p = pos[idx];
    var out: VertexOutput;
    out.position = vec4<f32>(p, 0.0, 1.0);
    out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return out;
}

const SCENE = vec2<f32>(1280.0, 800.0);
const LIT = vec2<f32>(640.0, 380.0);   // centre of the lit window
const HALF = vec2<f32>(48.0, 62.0);    // half size of every window
const GRID = vec2<f32>(170.0, 150.0);
const BONE = vec3<f32>(0.86, 0.87, 0.9);
const CYAN = vec3<f32>(0.0, 0.94, 1.0);

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}
fn sdBox(p: vec2<f32>, c: vec2<f32>, hs: vec2<f32>) -> f32 {
    let d = abs(p - c) - hs;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}
fn sdEllipse(p: vec2<f32>, c: vec2<f32>, r: vec2<f32>) -> f32 {
    return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}
// smooth union: the neck grows into the shoulders like a body, not like stacked shapes
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
fn cover(sd: f32, aa: f32) -> f32 {
    return 1.0 - smoothstep(-aa, aa, sd);
}

// the room behind the lit window, with the figure against its light
fn litRoom(p: vec2<f32>, aa: f32) -> vec3<f32> {
    let local = (p - LIT) / HALF;               // -1..1 inside the window
    let lamp = exp(-length(local - vec2<f32>(0.1, -0.9)) * 1.3);
    let tint = mix(BONE, CYAN, u.neon * 0.35);
    var col = tint * (0.35 + 0.75 * lamp) * u.light;
    // the back wall: a door edge, faint
    col = col * (1.0 - 0.12 * step(0.55, local.x));

    // the figure: a bust seen through a sheer curtain, the head exactly where the user's is
    let hx = LIT.x + u.headX * 20.0;
    let hy = LIT.y - 7.0 + u.headY * 9.0;
    let tilt = u.headX * 0.12;                   // the head leans a little into the turn
    var q = p - vec2<f32>(hx, hy);
    q = vec2<f32>(q.x * cos(tilt) - q.y * sin(tilt), q.x * sin(tilt) + q.y * cos(tilt));
    let skull = sdEllipse(q, vec2<f32>(0.0, 0.0), vec2<f32>(12.0, 14.5));
    let jaw = sdEllipse(q, vec2<f32>(0.0, 7.0), vec2<f32>(9.5, 10.0));
    let ear = sdEllipse(q, vec2<f32>(-11.5, 1.5), vec2<f32>(2.2, 4.0));
    let head = smin(smin(skull, jaw, 3.0), ear, 1.5);
    let bx = LIT.x + u.headX * 7.0;
    let neck = sdBox(p, vec2<f32>(mix(bx, hx, 0.6), hy + 20.0), vec2<f32>(7.0, 8.0)) - 1.5;
    let shoulders = sdEllipse(p, vec2<f32>(bx, LIT.y + 58.0), vec2<f32>(50.0, 30.0));
    // trapezius: the slope from the neck down to each shoulder
    let traps = sdEllipse(p, vec2<f32>(mix(bx, hx, 0.3), LIT.y + 36.0), vec2<f32>(22.0, 12.0));
    let fig = smin(smin(smin(head, neck, 4.0), traps, 6.0), shoulders, 8.0);
    let soft = aa * 1.5 + 1.8;                  // diffused by the curtain and the glass
    let shape = cover(fig, soft) * u.figure;
    let rim = (cover(fig - 1.6, soft) - cover(fig, soft)) * u.figure * 0.1 * u.light;
    col = mix(col, vec3<f32>(0.02, 0.024, 0.032), shape * 0.94) + tint * rim;

    // the sheer curtain: vertical folds over half the window, catching the light
    let folds = 0.5 + 0.5 * sin(p.x * 0.55 + sin(p.y * 0.05) * 1.5);
    let curtain = smoothstep(LIT.x - 6.0, LIT.x - 18.0, p.x);
    col = mix(col, tint * u.light * (0.28 + 0.16 * folds), curtain * 0.42);

    // mullion and transom
    let mull = min(abs(p.x - LIT.x) - 1.2, abs(p.y - (LIT.y - 18.0)) - 1.2);
    col = mix(col, vec3<f32>(0.03, 0.035, 0.045), cover(mull, aa) * 0.9);
    return col;
}

fn scene(p: vec2<f32>, aa: f32) -> vec3<f32> {
    // night sky above the roofline, facade below
    let sky = mix(vec3<f32>(0.03, 0.04, 0.06), vec3<f32>(0.012, 0.015, 0.024), clamp(p.y / 200.0, 0.0, 1.0));
    var col = vec3<f32>(0.035, 0.04, 0.05) + 0.012 * hash(floor(p / 3.0));
    col = mix(sky, col, step(95.0, p.y));

    // the window grid, all dark, a couple faintly lit by screens
    let cell = floor((p - LIT + GRID * 0.5) / GRID);
    let c = LIT + cell * GRID;
    let isLit = abs(cell.x) < 0.5 && abs(cell.y) < 0.5;
    let d = sdBox(p, c, HALF);
    let frame = sdBox(p, c, HALF + vec2<f32>(5.0));
    let facade = step(95.0, p.y);
    col = mix(col, vec3<f32>(0.06, 0.065, 0.075), cover(frame, aa) * facade);
    var glass = vec3<f32>(0.012, 0.015, 0.022);
    let h = hash(cell + vec2<f32>(3.7));
    if (h > 0.86) {
        // a television somewhere, cold and flickering
        let flick = (0.6 + 0.4 * sin(u.time * 9.0 + h * 40.0)) * (0.5 + 0.5 * hash(vec2<f32>(floor(u.time * 6.0), h)));
        glass = glass + vec3<f32>(0.05, 0.06, 0.08) * flick;
    }
    if (isLit) {
        glass = litRoom(p, aa);
    } else {
        // reflections of the street on the dark glass
        glass = glass + vec3<f32>(0.02) * clamp((p.y - c.y + HALF.y) / (HALF.y * 2.0), 0.0, 1.0) * hash(cell);
    }
    col = mix(col, glass, cover(d, aa) * facade);
    // light spill from the lit window onto the facade
    let spill = exp(-max(sdBox(p, LIT, HALF), 0.0) / 40.0) * 0.08 * u.light;
    col = col + mix(BONE, CYAN, u.neon * 0.35) * spill * (1.0 - cover(d, aa));
    return col;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    // cover the canvas with the scene, then push in on the lit window
    let aspect = u.width / u.height;
    let uv = in.uv;
    var p = vec2<f32>((uv.x - 0.5) * SCENE.y * aspect + SCENE.x * 0.5, uv.y * SCENE.y);
    let z = 1.0 + 4.2 * u.zoom * u.zoom;
    p = LIT + (p - LIT) / z;
    p.x = p.x + sin(u.time * 0.37) * 1.5 / z; // a hand-held camera, barely

    // corruption: blocks slide sideways, some columns smear downwards
    let block = floor(uv * vec2<f32>(24.0, 14.0));
    let tick = floor(u.time * 10.0);
    let r = hash(block + vec2<f32>(tick));
    if (r < u.corruption * 0.55) {
        p.x = p.x + (hash(block.yx + vec2<f32>(tick)) - 0.5) * 220.0 * u.corruption / z;
    }
    let colR = hash(vec2<f32>(block.x, tick));
    if (colR < u.corruption * 0.3) {
        p.y = min(p.y, LIT.y + (colR - 0.15) * 400.0);
    }

    let aa = 1.2 / z;
    var col = scene(p, aa);
    // under corruption the channels come apart
    if (u.corruption > 0.01) {
        let off = vec2<f32>(6.0 * u.corruption / z, 0.0);
        col = vec3<f32>(scene(p + off, aa).r, col.g, scene(p - off, aa).b);
    }
    return vec4<f32>(col, 1.0);
}
