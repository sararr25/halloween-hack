// S9 · the window across, over the real photo of the terrace (round 9). across.luau draws
// the photo (an image mesh that bends with the head); this adds, in photo px (1536 x 1024):
//   layer 0 ("screen"): the light in 4A (the window above the lamp), its spill on the brick,
//            its reflection trembling on the wet road, the lamp's bloom
//   layer 1 (over): rain, the vignette, grain, and under corruption torn colour bands.
// The figure in the window is drawn by across.luau as vector paths, over layer 0.

struct Uniforms {
    time: f32,
    width: f32,
    height: f32,
    headX: f32,       // -1..1, mirrored like a selfie
    headY: f32,       // -1..1
    zoom: f32,        // 0..1 push-in on the lit window
    light: f32,       // 0..1 the lit window
    corruption: f32,  // 0..1 torn strips and colour bands
    figure: f32,      // unused here (across.luau draws the figure)
    neon: f32,        // 0..1 cyan in the light
    hand: f32,        // unused (always 0)
    layer: f32,       // 0 light, 1 over
    pad0: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(@builtin(vertex_index) idx: u32) -> VertexOutput {
    var pos = array<vec2<f32>, 3>(vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0));
    let p = pos[idx];
    var out: VertexOutput;
    out.position = vec4<f32>(p, 0.0, 1.0);
    out.uv = vec2<f32>(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5);
    return out;
}

const SCENE = vec2<f32>(1536.0, 1024.0);
// the lit window's glass: centre and half size (keep in sync with across.luau, Reveal.tsx)
const LIT = vec2<f32>(914.0, 362.0);
const HALF = vec2<f32>(30.0, 62.0);
const LAMP = vec2<f32>(1004.0, 492.0);
const ROAD = 830.0;
const BONE = vec3<f32>(0.86, 0.87, 0.9);
const CYAN = vec3<f32>(0.0, 0.94, 1.0);
const WARM = vec3<f32>(1.0, 0.72, 0.4);

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}
fn sdBox(p: vec2<f32>, c: vec2<f32>, hs: vec2<f32>) -> f32 {
    let d = abs(p - c) - hs;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}
fn cover(sd: f32, aa: f32) -> f32 {
    return 1.0 - smoothstep(-aa, aa, sd);
}
fn over(dst: vec4<f32>, src: vec4<f32>) -> vec4<f32> {
    return src + dst * (1.0 - src.a);
}

// layer 0 · light (premultiplied, composited with "screen")
fn lightLayer(p: vec2<f32>, aa: f32) -> vec4<f32> {
    let tint = mix(BONE, CYAN, u.neon * 0.35);
    var acc = vec3<f32>(0.0);
    let d = sdBox(p, LIT, HALF);
    let local = (p - LIT) / HALF;
    // the room: a bare bulb high up, the far wall deeper, the sill darker
    let bulb = exp(-length(local - vec2<f32>(0.1, -0.75)) * 1.25);
    let depth = smoothstep(1.0, 0.5, abs(local.x)) * smoothstep(1.05, 0.3, local.y);
    acc = acc + tint * u.light * cover(d + 1.5, aa + 1.0) * (0.3 + 0.9 * bulb) * (0.6 + 0.4 * depth);
    // spill on the brick and the stone surround, and up under the lintel
    acc = acc + tint * u.light * exp(-max(d, 0.0) / 34.0) * (1.0 - cover(d, aa)) * 0.16;
    // its reflection in the wet road, trembling with the rain
    if (p.y > ROAD) {
        let wob = sin(p.y * 0.35 + u.time * 3.1) * 2.5 + sin(p.y * 0.9 - u.time * 5.0) * 1.2;
        let streak = exp(-abs(p.x - LIT.x + wob) / 18.0) * exp(-(p.y - ROAD) / 120.0);
        acc = acc + tint * u.light * streak * 0.22;
    }
    // the lamp blooms in the damp air
    acc = acc + WARM * 0.14 * exp(-length(p - LAMP) / 60.0);
    let a = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
    return vec4<f32>(min(acc, vec3<f32>(a)), a);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let size = vec2<f32>(u.width, u.height);
    let q = in.uv * size;
    // the same camera as across.luau: cover, push in on the lit window, a hand-held drift
    let cover0 = max(size.x / SCENE.x, size.y / SCENE.y);
    let z = 1.0 + 4.2 * u.zoom * u.zoom;
    let s = cover0 * z;
    let c = size * 0.5 + (LIT - SCENE * 0.5) * cover0;
    let drift = sin(u.time * 0.37) * 1.5 / z;
    let p = LIT + (q - c) / s - vec2<f32>(drift, 0.0);
    let aa = 1.2 / z;

    if (u.layer < 0.5) {
        return lightLayer(p, aa);
    }

    var out = vec4<f32>(0.0);
    // rain, in front of everything, thin and slanted
    let rp = vec2<f32>(q.x + q.y * 0.15, q.y);
    let colId = floor(rp.x / 6.0);
    let speed = 1100.0 + 600.0 * hash(vec2<f32>(colId, 1.0));
    let y = fract((rp.y + u.time * speed) / (size.y * 0.35) + hash(vec2<f32>(colId, 2.0)));
    let streak = smoothstep(0.0, 0.04, y) * smoothstep(0.12, 0.04, y) * step(0.86, hash(vec2<f32>(colId, 3.0)));
    let thin = 1.0 - smoothstep(0.0, 0.9, abs(fract(rp.x / 6.0) - 0.5) * 6.0);
    let rain = streak * thin * 0.07;
    out = over(out, vec4<f32>(vec3<f32>(0.75, 0.8, 0.9) * rain, rain));

    // under corruption: rows torn into colour, as a dying feed does
    if (u.corruption > 0.01) {
        let tick = floor(u.time * 12.0);
        let row = floor(q.y / 6.0);
        let r = hash(vec2<f32>(row, tick));
        if (r < u.corruption * 0.18) {
            let band = select(vec3<f32>(1.0, 0.1, 0.25), CYAN, hash(vec2<f32>(row, tick + 3.0)) > 0.5);
            let a = 0.25 * u.corruption;
            out = over(out, vec4<f32>(band * a, a));
        }
        let block = floor(q / vec2<f32>(48.0, 22.0));
        if (hash(block + vec2<f32>(tick)) < u.corruption * 0.08) {
            out = over(out, vec4<f32>(0.0, 0.0, 0.0, 0.85));
        }
    }

    // the vignette of a dark room looking out
    let e = (in.uv - vec2<f32>(0.5)) * vec2<f32>(size.x / size.y, 1.0);
    let vig = smoothstep(0.45, 1.05, length(e)) * 0.7;
    out = over(out, vec4<f32>(0.0, 0.0, 0.0, vig));

    // grain, every frame
    let n = (hash(floor(q) + vec2<f32>(floor(u.time * 24.0) * 7.3)) - 0.5) * 0.08;
    out = over(out, vec4<f32>(vec3<f32>(max(n, 0.0)), abs(n)));
    return out;
}
