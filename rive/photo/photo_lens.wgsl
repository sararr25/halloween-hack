// IMG_0418, "the window across, night": what is drawn over the real photo (the IMG_0413
// view, with the figure lifted out). lens.luau draws the photo and the figure (soft
// everywhere, sharp and magnified inside the lens); this shader adds the window the
// figure is looking up at, lit from inside with someone behind the curtain, sensor
// noise and the lens rim.
// Two layers: layer 0 is the whole frame, out of focus; layer 1 is the lens, magnified and
// sharp, inside its circle. Transparent elsewhere (premultiplied alpha).
// Scene units: 1200 x 800, y down, matching the photo (1536 x 1024 scaled by 0.78125).

struct Uniforms {
    time: f32,
    lensX: f32,       // 0..1, lens centre in uv
    lensY: f32,
    lens: f32,        // 0..1, lens strength (fades in while hovering)
    width: f32,
    height: f32,
    zoom: f32,        // magnification at full strength
    blur: f32,        // softness of the marks outside the lens, scene units
    figure: f32,      // unused here: lens.luau places the figure
    silhouette: f32,  // 0..1, the shape in the lit window
    layer: f32,       // 0 whole frame, 1 inside the lens
    radius: f32,      // lens radius, scene units
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
// the window above the figure (photo pixels 884-944 x 300-420) and its glazing bars
const PANE = vec2<f32>(714.06, 281.25);
const PANE_HALF = vec2<f32>(23.4, 46.9);
const LAMP = vec2<f32>(720.0, 252.0);
const COLD = vec3<f32>(0.78, 0.84, 0.94);

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
fn smin(a: f32, b: f32, k: f32) -> f32 {
    let h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}
fn cover(sd: f32, aa: f32) -> f32 {
    return 1.0 - smoothstep(-aa, aa, sd);
}

// The window, lit from inside: additive light (the curtains of the photo stay visible
// through it), dark glazing bars, someone standing behind the curtain in the lower sash,
// a little light spilling onto the brick. Premultiplied colour + coverage.
fn marks(p: vec2<f32>, aa: f32) -> vec4<f32> {
    let pane = cover(sdBox(p, PANE, PANE_HALF), aa);
    let bars = max(cover(abs(p.x - PANE.x) - 1.2, aa), cover(abs(p.y - PANE.y) - 1.4, aa));
    let lamp = exp(-length((p - LAMP) / vec2<f32>(22.0, 30.0)) * 1.4);
    let light = pane * (1.0 - bars) * (0.32 + 0.68 * lamp);
    var rgb = COLD * light * 0.62;
    var a = light * 0.4;

    let head = sdEllipse(p, vec2<f32>(PANE.x - 3.0, PANE.y + 12.0), vec2<f32>(5.8, 7.2));
    let neck = sdBox(p, vec2<f32>(PANE.x - 3.5, PANE.y + 21.0), vec2<f32>(3.2, 4.0));
    let body = sdEllipse(p, vec2<f32>(PANE.x - 4.0, PANE.y + 40.0), vec2<f32>(19.0, 13.0));
    // behind the curtain: soft edges, never a clean cut-out
    let shape = cover(smin(smin(head, neck, 2.0), body, 5.0), aa + 2.2) * pane * u.silhouette;
    rgb = rgb * (1.0 - shape * 0.85);
    a = mix(a, 0.78, shape * 0.85);

    let spill = exp(-max(sdBox(p, PANE, PANE_HALF), 0.0) / 26.0) * (1.0 - pane) * 0.05;
    rgb += COLD * spill;
    a += spill * 0.3;
    return vec4<f32>(rgb, a);
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let px = SCENE.x / max(u.width, 1.0); // scene units per pixel
    let centre = vec2<f32>(u.lensX, u.lensY);
    let d = length((in.uv - centre) * SCENE); // scene units from the lens centre
    let n = hash(floor(in.uv * vec2<f32>(u.width, u.height)) + vec2<f32>(floor(u.time * 24.0) * 7.3)) - 0.5;

    if (u.layer < 0.5) {
        // the whole frame, out of focus: the marks sampled over a small disc
        let p = in.uv * SCENE;
        var m = marks(p, px) * 0.2;
        for (var i = 0; i < 8; i = i + 1) {
            let ang = f32(i) * 0.7854 + 0.4;
            m += marks(p + vec2<f32>(cos(ang), sin(ang)) * u.blur, px * 2.0) * 0.1;
        }
        // sensor noise: light grain up, dark grain down
        let g = abs(n) * 0.09;
        let grain = select(vec4<f32>(0.0, 0.0, 0.0, g), vec4<f32>(vec3<f32>(g * 0.85), g), n > 0.0);
        return m + grain * (1.0 - m.a);
    }

    // inside the lens: magnified and sharp, nothing outside the circle
    let zoom = mix(1.0, u.zoom, u.lens);
    let muv = centre + (in.uv - centre) / zoom;
    let inside = 1.0 - smoothstep(u.radius - 2.0, u.radius, d);
    var m = marks(muv * SCENE, px / zoom) * inside;
    // the rim: a thin bone-white edge, never neon (the lens is yours, not theirs)
    let rim = smoothstep(u.radius - 3.0, u.radius, d) * (1.0 - smoothstep(u.radius, u.radius + 2.0, d)) * 0.4;
    m = m + vec4<f32>(vec3<f32>(0.85, 0.87, 0.9) * rim, rim) * (1.0 - m.a);
    return m * u.lens;
}
