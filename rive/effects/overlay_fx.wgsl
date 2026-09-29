// Diegetic post-process overlay: grain, vignette, scanlines and glitch tears.
// Drawn over the page with premultiplied alpha, so it only ever darkens or adds light.

struct Uniforms {
    time: f32,
    grain: f32,     // 0..1
    vignette: f32,  // 0..1
    glitch: f32,    // 0..1, strength of the current tear burst
    neon: f32,      // 0 = ghost blue split, 1 = cyan split (stage 3)
    width: f32,
    height: f32,
    seed: f32,      // changes per burst so each tear lands somewhere new
    headX: f32,     // -1..1, where the user's head is (mouse without camera)
    headY: f32,
    beam: f32,      // 0..1, the searchlight that follows the user
    crt: f32,       // 0..1, the screen switching off (S10): collapse to a line, a dot, black
    flash: f32,     // 0..1, the searchlight flaring for an instant, colder (the page fires it)
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

fn hash(p: vec2<f32>) -> f32 {
    let h = dot(p, vec2<f32>(127.1, 311.7));
    return fract(sin(h) * 43758.5453);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let px = in.uv * vec2<f32>(u.width, u.height);
    var rgb = vec3<f32>(0.0);
    var alpha = 0.0;

    // film grain: per-pixel noise re-rolled ~24 times a second
    let frame = floor(u.time * 24.0);
    let n = hash(floor(px) + vec2<f32>(frame * 13.1, frame * 7.7)) - 0.5;
    let grainA = abs(n) * 0.22 * u.grain;
    rgb += select(vec3<f32>(0.0), vec3<f32>(0.85, 0.87, 0.9) * grainA, n > 0.0);
    alpha += grainA;

    // scanlines, barely there
    let scan = 0.5 + 0.5 * sin(px.y * 3.14159);
    alpha += scan * 0.035 * u.grain;

    // vignette: darkens the edges (black with alpha)
    let d = distance(in.uv, vec2<f32>(0.5));
    alpha += smoothstep(0.35, 0.85, d) * 0.75 * u.vignette;

    // glitch tears: a few horizontal bands, RGB-split light on their edges
    if (u.glitch > 0.001) {
        let bandH = 0.012 + 0.05 * hash(vec2<f32>(u.seed, 1.0));
        let row = floor(in.uv.y / bandH);
        let r = hash(vec2<f32>(row, u.seed));
        if (r > 1.0 - 0.18 * u.glitch) {
            let shift = (hash(vec2<f32>(row, u.seed + 3.0)) - 0.5) * 0.08 * u.glitch;
            // streaks of random length along the tear, split into two offset channels
            let x = in.uv.x + shift;
            let segA = hash(vec2<f32>(floor(x * 18.0), row + u.seed));
            let segB = hash(vec2<f32>(floor((x + 0.004) * 18.0), row + u.seed));
            let split = mix(vec3<f32>(0.54, 0.59, 0.70), vec3<f32>(0.0, 0.94, 1.0), u.neon);
            let lineY = abs(fract(in.uv.y / bandH) - 0.5) < 0.18;
            let a = select(0.0, 1.0, segA > 0.62 && lineY);
            let b = select(0.0, 1.0, segB > 0.62 && lineY);
            let lit = max(a, b) * 0.5 * u.glitch;
            rgb += (split * a + vec3<f32>(0.85, 0.87, 0.9) * b * (1.0 - a)) * 0.5 * u.glitch;
            alpha += lit + 0.25 * u.glitch; // the band itself dims what is under it
        }
    }

    // the searchlight: a cold beam from above the window, its spot a little late on the
    // user's head. Faint concentric rings inside it: the lens of something looking back.
    if (u.beam > 0.001 || u.flash > 0.001) {
        let aspect = u.width / max(u.height, 1.0);
        let aim = vec2<f32>(0.5 + u.headX * 0.42, 0.52 + u.headY * 0.3);
        let origin = vec2<f32>(0.5 + u.headX * 0.1, -0.25);
        let q = (in.uv - aim) * vec2<f32>(aspect, 1.0);
        let spot = 1.0 - smoothstep(0.05, 0.3, length(q));
        let rings = 0.5 + 0.5 * sin(length(q) * 140.0 - u.time * 1.5);
        // the cone: distance from the segment src -> aim
        let ab = (aim - origin) * vec2<f32>(aspect, 1.0);
        let ap = (in.uv - origin) * vec2<f32>(aspect, 1.0);
        let t = clamp(dot(ap, ab) / dot(ab, ab), 0.0, 1.0);
        let cone = (1.0 - smoothstep(0.02 + 0.2 * t, 0.06 + 0.3 * t, length(ap - ab * t))) * t;
        let tint = mix(vec3<f32>(0.85, 0.88, 0.94), vec3<f32>(0.0, 0.94, 1.0), u.neon * 0.6);
        let light = (spot * (0.55 + 0.25 * rings) + cone * 0.25) * u.beam * 0.22;
        rgb += tint * light;
        alpha += light * 0.35;
        // the flare: the same beam, suddenly much brighter and a colder, violet-blue light
        let flareTint = mix(vec3<f32>(0.5, 0.58, 1.0), vec3<f32>(0.78, 1.0, 1.0), u.neon);
        let flare = (spot * (0.8 + 0.4 * rings) + cone * 0.55) * u.flash * 0.5;
        rgb += flareTint * flare;
        alpha += flare * 0.75;
    }

    // an old tube switching off: the picture collapses to a white-hot line, then to a dot
    if (u.crt > 0.001) {
        let c = u.crt;
        let hh = mix(0.5, 0.002, smoothstep(0.0, 0.45, c));
        let hw = mix(0.5, 0.001, smoothstep(0.45, 0.85, c));
        let dy = abs(in.uv.y - 0.5);
        let dx = abs(in.uv.x - 0.5) * u.width / max(u.height, 1.0);
        let hwA = hw * u.width / max(u.height, 1.0);
        let heat = smoothstep(0.15, 0.45, c) * (1.0 - smoothstep(0.88, 1.0, c));
        let outside = max(dy - hh, 0.0) + max(dx - hwA, 0.0);
        let bloom = exp(-outside * 60.0) * heat;
        if (outside <= 0.0) {
            // inside what is left of the picture: it burns white
            return vec4<f32>(vec3<f32>(0.95, 0.97, 1.0) * heat, heat);
        }
        return vec4<f32>(vec3<f32>(0.8, 0.85, 0.95) * bloom * 0.6, 1.0);
    }

    alpha = clamp(alpha, 0.0, 1.0);
    return vec4<f32>(min(rgb, vec3<f32>(alpha)), alpha);
}
