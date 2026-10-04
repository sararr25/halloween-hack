// Find My · View live: 17 Harrow St through binoculars (docs/plan-round8.md, round 9).
// The real photo of the terrace (plate_*.jpg, IMG_0413's view) is drawn by facade.luau,
// magnified around the look point; this shader adds what lives on it, in two layers:
//   layer 0 (blended "screen" under the figures): light in the windows on their timers,
//            the TV's cold flicker, the phone's glow in 4A, light spilling onto the brick
//   layer 1 (over everything): shapes behind the curtains (someone walking through, a man
//            in front of the TV, a woman reading, a cat), the sheer curtains catching the
//            light, rain, the binoculars themselves (two lenses, chromatic fringe, dust,
//            a glint, the reticle, the haze while they move) and film grain.
// Coordinates: canvas pixels = artboard units; plate pixels = look + (p - size / 2) / k.

struct Uniforms {
    time: f32,
    width: f32,
    height: f32,
    lookX: f32,     // plate px at the centre of the view
    lookY: f32,
    k: f32,         // artboard units per plate px
    blur: f32,      // 0..1 the binoculars moving
    glow: f32,      // 0..1 the phone lighting 4A
    figX: f32,      // the watcher: plate px, centre of its window
    figOn: f32,     // 0..1
    found: f32,     // seconds since 4A was found, < 0 before
    layer: f32,     // 0 light, 1 over
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

const WARM = vec3<f32>(1.0, 0.72, 0.4);
const COLD = vec3<f32>(0.62, 0.78, 1.0);
const LOOP = 40.0;
const TARGET = 5;

// the glass of every window in the photo (x0, y0, x1, y1), measured on plate_sharp.jpg:
// upstairs U1..U9, then the ground floor G1..G5. Keep in sync with Facade.tsx WINDOWS.
fn win(i: i32) -> vec4<f32> {
    switch i {
        case 0: { return vec4<f32>(35.0, 300.0, 95.0, 424.0); }
        case 1: { return vec4<f32>(184.0, 300.0, 246.0, 424.0); }
        case 2: { return vec4<f32>(366.0, 300.0, 430.0, 424.0); }
        case 3: { return vec4<f32>(584.0, 300.0, 646.0, 424.0); }
        case 4: { return vec4<f32>(735.0, 300.0, 797.0, 424.0); }
        case 5: { return vec4<f32>(884.0, 300.0, 944.0, 424.0); }
        case 6: { return vec4<f32>(1062.0, 300.0, 1124.0, 424.0); }
        case 7: { return vec4<f32>(1208.0, 300.0, 1270.0, 424.0); }
        case 8: { return vec4<f32>(1356.0, 300.0, 1418.0, 424.0); }
        case 9: { return vec4<f32>(5.0, 512.0, 60.0, 640.0); }
        case 10: { return vec4<f32>(360.0, 512.0, 418.0, 640.0); }
        case 11: { return vec4<f32>(595.0, 512.0, 655.0, 640.0); }
        case 12: { return vec4<f32>(880.0, 515.0, 940.0, 605.0); }
        default: { return vec4<f32>(1088.0, 512.0, 1148.0, 640.0); }
    }
}

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
fn on(t: f32, a: f32, b: f32) -> f32 {
    return step(a, t) * step(t, b);
}
// premultiplied "over"
fn over(dst: vec4<f32>, src: vec4<f32>) -> vec4<f32> {
    return src + dst * (1.0 - src.a);
}
fn inWin(pp: vec2<f32>, i: i32) -> f32 {
    let w = win(i);
    return cover(sdBox(pp, (w.xy + w.zw) * 0.5, (w.zw - w.xy) * 0.5), 1.0);
}

// how much light each window has right now (a), and its colour
fn lightOf(i: i32, t: f32) -> vec4<f32> {
    let c = t - floor(t / LOOP) * LOOP;
    var level = 0.0;
    var col = WARM;
    switch i {
        case 0: { level = 0.5; }
        case 1: { level = 0.8 * (on(c, 0.0, 15.0) + on(c, 31.0, 40.0)); }
        case 2: { level = 0.75 * on(c, 10.0, 26.0); }
        case 4: {
            // a bulb that will not settle
            let f = step(0.35, hash(vec2<f32>(floor(u.time * 9.0), 3.0)));
            level = 0.7 * on(c, 28.0, 36.0) * mix(0.25, 1.0, f);
        }
        case 6: { level = 0.6; }
        case 7: {
            // a television, cold, flickering
            let f = 0.55 + 0.45 * hash(vec2<f32>(floor(u.time * 7.0), 11.0));
            level = 0.42 * f;
            col = vec3<f32>(0.56, 0.69, 1.0);
        }
        case 8: { level = 0.7; }
        case 10: { level = 0.75; }
        case 12: { level = 0.6 * (on(c, 5.0, 9.0) + on(c, 22.0, 26.0)); }
        case 13: { level = 0.5 * on(c, 0.0, 20.0); }
        default: { level = 0.0; }
    }
    // the watcher's window is lit, faintly cold, while it stands there
    let w = win(i);
    if (u.figOn > 0.001 && u.figX > w.x && u.figX < w.z) {
        level = max(level, 0.75 * u.figOn);
        col = mix(col, COLD, 0.7);
    }
    // 4A: dark, the phone lighting it for an instant; found, a tube that stutters on
    if (i == TARGET) {
        level = 0.0;
        col = COLD;
        if (u.found >= 0.0) {
            let f = u.found;
            let lit = (f > 0.1 && f < 0.18) || (f > 0.36 && f < 0.44) || f > 0.62;
            level = select(0.0, 1.2, lit);
            col = vec3<f32>(0.82, 0.86, 0.95);
        }
    }
    return vec4<f32>(col, level);
}

// layer 0 · light in the windows (premultiplied, composited with "screen")
fn lights(pp: vec2<f32>) -> vec4<f32> {
    var acc = vec3<f32>(0.0);
    for (var i = 0; i < 14; i = i + 1) {
        let w = win(i);
        let c = (w.xy + w.zw) * 0.5;
        let hs = (w.zw - w.xy) * 0.5;
        if (i == TARGET) {
            // the phone on the floor by the bed: a cold glow low in the window
            let g = exp(-length((pp - vec2<f32>(c.x + 10.0, w.w - 14.0)) / vec2<f32>(26.0, 18.0)) * 1.6);
            acc = acc + COLD * g * u.glow * 0.9 * cover(sdBox(pp, c, hs), 1.5);
        }
        let L = lightOf(i, u.time);
        if (L.a < 0.001) {
            continue;
        }
        let d = sdBox(pp, c, hs);
        // inside: brighter under the ceiling light
        let local = (pp - c) / hs;
        let lamp = exp(-length(local - vec2<f32>(0.2, -0.45)) * 1.5);
        // the glass is darker at its edges and towards the sill, the room deeper than the pane
        let depth = smoothstep(1.0, 0.55, abs(local.x)) * smoothstep(1.05, 0.35, local.y);
        var inside = cover(d + 2.0, 2.5) * (0.18 + 0.5 * lamp) * (0.55 + 0.45 * depth);
        if (i == TARGET) {
            // found: a bare tube, much brighter than any room on the street
            inside = inside * 2.4 + cover(d + 2.0, 2.5) * 0.25;
        }
        // spill on the brick and the stone surround
        let spill = exp(-max(d, 0.0) / 18.0) * (1.0 - cover(d, 1.5)) * 0.07;
        acc = acc + L.rgb * L.a * (inside + spill);
    }
    // the street lamp blooms a little in the damp air
    acc = acc + WARM * 0.12 * exp(-length(pp - vec2<f32>(1004.0, 492.0)) / 70.0);
    let a = clamp(max(acc.r, max(acc.g, acc.b)), 0.0, 1.0);
    return vec4<f32>(min(acc, vec3<f32>(a)), a);
}

// layer 1 · shapes behind the curtains: soft and dark, against whatever light the room has
fn shapes(pp: vec2<f32>) -> vec4<f32> {
    var dst = vec4<f32>(0.0);
    let t = u.time;
    let c = t - floor(t / LOOP) * LOOP;
    let ink = vec3<f32>(0.03, 0.025, 0.02);
    // U2: someone walks through the room, now and then
    let w1 = win(1);
    let walkX = mix(w1.x - 30.0, w1.z + 30.0, clamp((fract(t / 14.0) * 14.0 - 3.0) / 3.5, 0.0, 1.0));
    let walker = smin(sdEllipse(pp, vec2<f32>(walkX, 352.0), vec2<f32>(8.0, 10.0)),
                      sdEllipse(pp, vec2<f32>(walkX, 400.0), vec2<f32>(19.0, 36.0)), 6.0);
    dst = over(dst, vec4<f32>(ink, 1.0) * cover(walker, 6.0) * inWin(pp, 1) * 0.55 * lightOf(1, t).a);
    // U8: a man in front of the TV, his head nodding off
    let nod = sin(t * 0.4) * 2.0;
    let man = smin(sdEllipse(pp, vec2<f32>(1232.0, 384.0 + nod), vec2<f32>(9.0, 11.0)),
                   sdEllipse(pp, vec2<f32>(1234.0, 420.0), vec2<f32>(22.0, 18.0)), 6.0);
    dst = over(dst, vec4<f32>(ink, 1.0) * cover(man, 5.0) * inWin(pp, 7) * 0.55);
    // U9: a woman reading by the lamp; she looks up, now and then
    let look = -4.0 * on(c, 17.0, 21.0);
    let reader = smin(sdEllipse(pp, vec2<f32>(1398.0, 372.0 + look), vec2<f32>(8.5, 10.5)),
                      sdEllipse(pp, vec2<f32>(1396.0, 410.0), vec2<f32>(17.0, 22.0)), 6.0);
    dst = over(dst, vec4<f32>(ink, 1.0) * cover(reader, 5.0) * inWin(pp, 8) * 0.5);
    // G2: a cat on the inside sill, its tail going
    let tail = 3.0 * sin(t * 2.1);
    let body = smin(sdEllipse(pp, vec2<f32>(392.0, 628.0), vec2<f32>(15.0, 8.0)),
                    sdEllipse(pp, vec2<f32>(378.0, 618.0), vec2<f32>(6.5, 6.0)), 3.0);
    let cat = smin(body, sdEllipse(pp, vec2<f32>(408.0 + tail * 0.5, 622.0 - abs(tail)), vec2<f32>(3.0, 9.0)), 2.0);
    let ears = min(sdEllipse(pp, vec2<f32>(375.0, 612.0), vec2<f32>(1.8, 3.2)), sdEllipse(pp, vec2<f32>(381.0, 612.0), vec2<f32>(1.8, 3.2)));
    dst = over(dst, vec4<f32>(ink, 1.0) * cover(min(cat, ears), 2.0) * 0.7);

    // the sheer curtains of every lit window catch its light, in folds
    for (var i = 0; i < 14; i = i + 1) {
        let L = lightOf(i, t);
        if (L.a < 0.001) {
            continue;
        }
        let w = win(i);
        let folds = 0.5 + 0.5 * sin(pp.x * 0.9 + sin(pp.y * 0.07 + f32(i)) * 1.7);
        let side = smoothstep(w.x + 22.0, w.x + 4.0, pp.x) + smoothstep(w.z - 22.0, w.z - 4.0, pp.x);
        let a = inWin(pp, i) * side * (0.12 + 0.12 * folds) * L.a;
        dst = over(dst, vec4<f32>(L.rgb * a, a));
        // the sash: centre bar, meeting rail a little above the middle, the frame's inner edge
        let cx = (w.x + w.z) * 0.5;
        let rail = w.y + (w.w - w.y) * 0.48;
        let bars = min(abs(pp.x - cx) - 1.3, abs(pp.y - rail) - 1.6);
        let edge = -sdBox(pp, (w.xy + w.zw) * 0.5, (w.zw - w.xy) * 0.5) - 2.5;
        let wood = max(cover(bars, 0.9), cover(edge, 1.2)) * inWin(pp, i) * min(L.a * 1.4, 1.0) * 0.85;
        dst = over(dst, vec4<f32>(vec3<f32>(0.05, 0.045, 0.04) * wood, wood));
    }
    return dst;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let size = vec2<f32>(u.width, u.height);
    let p = in.uv * size;
    let pp = vec2<f32>(u.lookX, u.lookY) + (p - size * 0.5) / u.k;

    if (u.layer < 0.5) {
        return lights(pp);
    }

    var out = shapes(pp);

    // rain: thin slanted streaks in front of the lenses, falling fast
    let rp = vec2<f32>(p.x + p.y * 0.18, p.y);
    let colId = floor(rp.x / 7.0);
    let speed = 900.0 + 500.0 * hash(vec2<f32>(colId, 1.0));
    let y = fract((rp.y + u.time * speed) / 260.0 + hash(vec2<f32>(colId, 2.0)));
    let streak = smoothstep(0.0, 0.05, y) * smoothstep(0.16, 0.05, y) * step(0.82, hash(vec2<f32>(colId, 3.0)));
    let thin = 1.0 - smoothstep(0.0, 0.9, abs(fract(rp.x / 7.0) - 0.5) * 7.0);
    let rain = streak * thin * 0.09;
    out = over(out, vec4<f32>(vec3<f32>(0.75, 0.8, 0.9) * rain, rain));

    // the haze while the binoculars move (the photo itself crossfades to its soft plate)
    let haze = u.blur * 0.28;
    out = over(out, vec4<f32>(vec3<f32>(0.32, 0.35, 0.4) * haze, haze));

    // the binoculars: two lenses side by side, overlapping a little
    let R = size.y * 0.46;
    let c1 = vec2<f32>(size.x * 0.5 - R * 0.56, size.y * 0.5);
    let c2 = vec2<f32>(size.x * 0.5 + R * 0.56, size.y * 0.5);
    let d = min(length(p - c1) - R, length(p - c2) - R);
    // dark towards the rim, as real optics fall off
    let vig = smoothstep(-R * 0.6, 0.0, d) * 0.62;
    out = over(out, vec4<f32>(0.0, 0.0, 0.0, vig));
    // chromatic fringe at the rim: cold inside, warm at the edge
    let fringeIn = exp(-abs(d + 7.0) / 3.0) * 0.18;
    let fringeOut = exp(-abs(d + 2.0) / 2.0) * 0.14;
    out = over(out, vec4<f32>(vec3<f32>(0.1, 0.35, 0.6) * fringeIn, fringeIn));
    out = over(out, vec4<f32>(vec3<f32>(0.6, 0.25, 0.1) * fringeOut, fringeOut));
    // a glint on the glass, upper left of each lens
    let g1 = exp(-length((p - c1 - vec2<f32>(-R * 0.45, -R * 0.5)) / vec2<f32>(R * 0.35, R * 0.12)) * 2.0);
    let g2 = exp(-length((p - c2 - vec2<f32>(-R * 0.45, -R * 0.5)) / vec2<f32>(R * 0.35, R * 0.12)) * 2.0);
    let glint = (g1 + g2) * 0.05;
    out = over(out, vec4<f32>(vec3<f32>(0.8, 0.85, 0.95) * glint, glint));
    // dust on the objective, the same specks every time
    let cell = floor(p / 46.0);
    let h = hash(cell);
    let spot = (cell + vec2<f32>(hash(cell + 1.3), hash(cell + 2.7))) * 46.0;
    let speck = step(0.93, h) * cover(length(p - spot) - 1.6 - 2.0 * h, 1.2);
    out = over(out, vec4<f32>(0.0, 0.0, 0.0, speck * 0.35));
    // the reticle: a thin scale across the centre, in the one neon, very faint
    let rc = p - size * 0.5;
    let minor = step(abs(fract(rc.x / 24.0 + 0.5) - 0.5) * 24.0, 0.6);
    let major = step(abs(fract(rc.x / 120.0 + 0.5) - 0.5) * 120.0, 0.6);
    let tick = minor * step(abs(rc.y), 5.0 + 4.0 * major);
    let axis = step(abs(rc.y), 0.5);
    let ret = clamp(tick + axis, 0.0, 1.0) * step(abs(rc.x), R * 0.9) * 0.16 * (1.0 - u.blur * 0.7);
    out = over(out, vec4<f32>(vec3<f32>(0.0, 0.94, 1.0) * ret, ret));
    // outside the lenses: the black of the eyecups
    let mask = smoothstep(-3.0, 3.0, d);
    out = over(out, vec4<f32>(0.0, 0.0, 0.0, mask));

    // grain, every frame
    let n = (hash(floor(p) + vec2<f32>(floor(u.time * 24.0) * 7.3)) - 0.5) * 0.09;
    out = over(out, vec4<f32>(vec3<f32>(max(n, 0.0)), abs(n)));
    return out;
}
