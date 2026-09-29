// IMG_0418 — "the window across, night", taken from E.V.'s flat.
// The whole photo is drawn here (the web runtime has no offscreen 2D canvas for scripts),
// so the lens is just a change of coordinates: soft night shot everywhere, sharp and
// magnified under the lens (Rear Window). Scene units: 1200 x 800, y down.

struct Uniforms {
    time: f32,
    lensX: f32,       // 0..1, lens centre in uv
    lensY: f32,
    lens: f32,        // 0..1, lens strength (fades in while hovering)
    width: f32,
    height: f32,
    zoom: f32,        // magnification at full strength
    blur: f32,        // softness outside the lens, in scene units
    figure: f32,      // 0..1, where the figure on the street stands (swapped while you look away)
    silhouette: f32,  // 0..1, the shape in the lit window
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

const SCENE = vec2<f32>(1200.0, 800.0);

fn hash(p: vec2<f32>) -> f32 {
    return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}

// signed distances, scene units
fn sdBox(p: vec2<f32>, c: vec2<f32>, hs: vec2<f32>) -> f32 {
    let d = abs(p - c) - hs;
    return length(max(d, vec2<f32>(0.0))) + min(max(d.x, d.y), 0.0);
}
fn sdEllipse(p: vec2<f32>, c: vec2<f32>, r: vec2<f32>) -> f32 {
    return (length((p - c) / r) - 1.0) * min(r.x, r.y);
}
fn cover(sd: f32, aa: f32) -> f32 {
    return 1.0 - smoothstep(-aa, aa, sd);
}

// one dark window with its frame
fn pane(col: vec3<f32>, p: vec2<f32>, c: vec2<f32>, hs: vec2<f32>, fill: vec3<f32>, aa: f32) -> vec3<f32> {
    let sd = sdBox(p, c, hs);
    var o = mix(col, vec3<f32>(0.0863, 0.1059, 0.1490), cover(sd - 1.0, aa));
    o = mix(o, fill, cover(sd + 1.0, aa));
    return o;
}

// The photo, sharp. `aa` = scene units per screen pixel.
fn scene(p: vec2<f32>, aa: f32) -> vec3<f32> {
    // night sky
    var col = mix(vec3<f32>(0.0157, 0.0235, 0.0392), vec3<f32>(0.0392, 0.0549, 0.0863), clamp(p.y / SCENE.y, 0.0, 1.0));

    // the building across the street
    let facade = mix(vec3<f32>(0.0471, 0.0627, 0.0941), vec3<f32>(0.0667, 0.0863, 0.1294), clamp((p.y - 20.0) / 700.0, 0.0, 1.0));
    col = mix(col, facade, cover(sdBox(p, vec2<f32>(600.0, 370.0), vec2<f32>(450.0, 350.0)), aa));

    // windows: 5 x 3, dark, two faintly lit
    let hs = vec2<f32>(50.0, 65.0);
    for (var i = 0; i < 5; i = i + 1) {
        for (var j = 0; j < 3; j = j + 1) {
            let c = vec2<f32>(260.0 + f32(i) * 170.0, 140.0 + f32(j) * 160.0);
            if (i == 3 && j == 1) { continue; } // the lit one, below
            var fill = vec3<f32>(0.0392, 0.0510, 0.0784);
            if (i == 4 && j == 0) { fill = vec3<f32>(0.0706, 0.0941, 0.1333); }
            if (i == 1 && j == 2) { fill = vec3<f32>(0.0627, 0.0824, 0.1255); }
            col = pane(col, p, c, hs, fill, aa);
        }
    }
    // ground floor: door, shop front, window
    col = pane(col, p, vec2<f32>(260.0, 610.0), vec2<f32>(50.0, 45.0), vec3<f32>(0.0275, 0.0353, 0.0549), aa);
    col = pane(col, p, vec2<f32>(600.0, 610.0), vec2<f32>(220.0, 45.0), vec3<f32>(0.0353, 0.0471, 0.0706), aa);
    col = pane(col, p, vec2<f32>(940.0, 610.0), vec2<f32>(50.0, 45.0), vec3<f32>(0.0392, 0.0510, 0.0784), aa);

    // the lit window: cold light, and someone in it
    let lit = vec2<f32>(770.0, 300.0);
    let spill = 1.0 - smoothstep(0.0, 140.0, length((p - lit) * vec2<f32>(1.0, 0.9)));
    col += vec3<f32>(0.7882, 0.8275, 0.8784) * spill * spill * 0.16;
    let inLit = cover(sdBox(p, lit, hs), aa);
    var light = mix(vec3<f32>(0.6627, 0.7059, 0.7686), vec3<f32>(0.3373, 0.3804, 0.4549), clamp(length((p - lit) / hs) * 0.8, 0.0, 1.0));
    let body = min(sdEllipse(p, lit + vec2<f32>(0.0, -8.0), vec2<f32>(15.0, 18.0)),
                   sdEllipse(p, lit + vec2<f32>(0.0, 46.0), vec2<f32>(43.0, 30.0)));
    light = mix(light, vec3<f32>(0.1020, 0.1255, 0.1882), cover(body, aa) * u.silhouette);
    col = mix(col, light, inLit);
    col = mix(col, vec3<f32>(0.0863, 0.1059, 0.1490), cover(abs(sdBox(p, lit, hs)) - 1.0, aa));

    // street
    let street = mix(vec3<f32>(0.0431, 0.0549, 0.0824), vec3<f32>(0.0196, 0.0275, 0.0392), clamp((p.y - 700.0) / 100.0, 0.0, 1.0));
    col = mix(col, street, cover(sdBox(p, vec2<f32>(600.0, 750.0), vec2<f32>(600.0, 50.0)), aa));

    // street lamp
    let lamp = vec2<f32>(1090.0, 598.0);
    let glow = 1.0 - smoothstep(0.0, 130.0, length(p - lamp));
    col += vec3<f32>(0.7216, 0.7608, 0.8314) * glow * glow * 0.22;
    col = mix(col, vec3<f32>(0.0392, 0.0510, 0.0745), cover(sdBox(p, vec2<f32>(1090.0, 690.0), vec2<f32>(4.0, 100.0)), aa));
    col = mix(col, vec3<f32>(0.8471, 0.8627, 0.8980), cover(sdEllipse(p, lamp, vec2<f32>(11.0, 5.0)), aa));

    // the figure on the street, looking up. It changes place only while you look away.
    let fx = 330.0 + u.figure * 490.0;
    let fig = min(min(sdEllipse(p, vec2<f32>(fx, 650.0), vec2<f32>(8.5, 10.5)),
                      sdBox(p, vec2<f32>(fx, 700.0), vec2<f32>(17.0, 40.0)) - 4.0),
                  sdBox(p, vec2<f32>(fx, 756.0), vec2<f32>(12.0, 20.0)));
    col = mix(col, vec3<f32>(0.1647, 0.1882, 0.2510), cover(fig - 1.0, aa) * 0.8); // faint rim from the lamp
    col = mix(col, vec3<f32>(0.0118, 0.0157, 0.0275), cover(fig, aa));

    // foreground: E.V.'s own window frame
    col = mix(col, vec3<f32>(0.0078, 0.0118, 0.0196), cover(sdBox(p, vec2<f32>(70.0, 400.0), vec2<f32>(22.0, 400.0)), aa));
    col = mix(col, vec3<f32>(0.0078, 0.0118, 0.0196), cover(sdBox(p, vec2<f32>(600.0, 786.0), vec2<f32>(600.0, 14.0)), aa));
    return col;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let aspect = u.width / max(u.height, 1.0);
    let centre = vec2<f32>(u.lensX, u.lensY);
    let dist = length((in.uv - centre) * vec2<f32>(aspect, 1.0));
    let radius = 0.17;
    let px = SCENE.x / max(u.width, 1.0); // scene units per pixel

    // outside: a soft night shot (9 jittered samples)
    let p = in.uv * SCENE;
    var soft = scene(p, px) * 0.2;
    for (var i = 0; i < 8; i = i + 1) {
        let a = f32(i) * 0.7854 + 0.4;
        soft += scene(p + vec2<f32>(cos(a), sin(a)) * u.blur, px * 2.0) * 0.1;
    }

    // inside: magnified and sharp, with a slight bulge toward the rim
    let bulge = 1.0 + 0.35 * pow(clamp(dist / radius, 0.0, 1.0), 2.0);
    let zoom = mix(1.0, u.zoom, u.lens) / bulge;
    let muv = centre + (in.uv - centre) / zoom;
    let sharp = scene(muv * SCENE, px / zoom);

    let inside = (1.0 - smoothstep(radius - 0.006, radius, dist)) * u.lens;
    var col = mix(soft, sharp, inside);

    // the rim: a thin bone-white edge, never neon (the lens is yours, not theirs)
    let rim = smoothstep(radius - 0.004, radius, dist) * (1.0 - smoothstep(radius, radius + 0.003, dist));
    col += vec3<f32>(0.85, 0.87, 0.9) * rim * 0.35 * u.lens;

    // sensor noise, stronger outside the lens
    let n = hash(floor(in.uv * vec2<f32>(u.width, u.height)) + vec2<f32>(floor(u.time * 24.0) * 7.3)) - 0.5;
    col += vec3<f32>(n * mix(0.05, 0.02, inside));

    return vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
