// S9 · the window across: the Harrow St terrace of IMG_0413 / IMG_0418, seen live.
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
    hand: f32,        // 0..1 the figure's hand, from out of sight to raised beside the head
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
fn sdSegment(p: vec2<f32>, a: vec2<f32>, b: vec2<f32>, r: f32) -> f32 {
    let pa = p - a;
    let ba = b - a;
    let h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
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
    var fig = smin(smin(smin(head, neck, 4.0), traps, 6.0), shoulders, 8.0);
    // the raised hand (E.V.'s voice note: "it raised its hand too"): an arm from the right
    // shoulder, as in a mirror, up beside the head, palm out. Out of sight below at 0.
    if (u.hand > 0.001) {
        let shoulder = vec2<f32>(bx + 30.0, LIT.y + 44.0);
        let palm = mix(vec2<f32>(bx + 36.0, LIT.y + 96.0), vec2<f32>(bx + 38.0, hy - 14.0), u.hand);
        let elbow = mix(shoulder, palm, 0.5) + vec2<f32>(9.0 * u.hand, 4.0);
        let arm = min(sdSegment(p, shoulder, elbow, 6.0), sdSegment(p, elbow, palm, 5.0));
        let palmShape = smin(sdEllipse(p, palm - vec2<f32>(0.0, 3.0), vec2<f32>(6.5, 9.0)),
                        sdSegment(p, palm + vec2<f32>(-5.0, 2.0), palm + vec2<f32>(-10.0, -3.0), 2.0), 2.0);
        fig = smin(fig, smin(arm, palmShape, 3.0), 3.0);
    }
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

// ── Harrow St, the terrace across: the same houses as IMG_0413 / IMG_0418 ──────────────
// Two storeys of London stock brick, a slate roof with chimney stacks on the party walls,
// white-framed sash windows upstairs, bays and dark front doors below, a low wall with
// railings and hedges, a lamp post, the wet pavement. Upstairs windows sit every PITCH
// from the lit one, so LIT and HALF (and the figure layer in Reveal.tsx) are unchanged.

const PITCH = 150.0;
const ROOF_TOP = 170.0;
const EAVES = 246.0;
const BAND = 470.0;        // between the floors
const WALL_TOP = 648.0;    // the front garden wall
const KERB = 716.0;
const LAMP = vec2<f32>(742.0, 520.0);
const BRICK = vec3<f32>(0.085, 0.074, 0.058);
const PAINT = vec3<f32>(0.20, 0.20, 0.19);
const SLATE = vec3<f32>(0.035, 0.04, 0.052);
const WARM = vec3<f32>(1.0, 0.78, 0.5);

fn fmodf(a: f32, b: f32) -> f32 {
    return a - floor(a / b) * b;
}

// stretcher bond: 1 where mortar is
fn mortar(p: vec2<f32>) -> f32 {
    let course = floor(p.y / 7.0);
    let shift = fmodf(course, 2.0) * 9.0;
    let bx = fract((p.x + shift) / 18.0);
    let by = fract(p.y / 7.0);
    return max(1.0 - step(0.07, bx), 1.0 - step(0.16, by));
}

// dark glass of an unlit sash, with the street faintly on it and a curtain in some
fn darkPane(p: vec2<f32>, c: vec2<f32>, hs: vec2<f32>, seed: f32) -> vec3<f32> {
    let local = (p - c) / hs;
    var g = vec3<f32>(0.012, 0.014, 0.02) + vec3<f32>(0.018) * clamp(local.y * 0.5 + 0.5, 0.0, 1.0) * seed;
    if (seed > 0.55) {
        let folds = 0.5 + 0.5 * sin(p.x * 0.7 + seed * 20.0);
        g = g + vec3<f32>(0.012, 0.011, 0.01) * folds * step(0.2, abs(local.x));
    }
    if (seed > 0.9) {
        // a television somewhere, cold and flickering
        let flick = (0.6 + 0.4 * sin(u.time * 9.0 + seed * 40.0)) * (0.5 + 0.5 * hash(vec2<f32>(floor(u.time * 6.0), seed)));
        g = g + vec3<f32>(0.05, 0.06, 0.08) * flick;
    }
    // sash bars: the meeting rail and a centre bar
    let bars = min(abs(p.x - c.x) - 1.2, abs(p.y - (c.y - 18.0 * hs.y / 62.0)) - 1.4);
    g = mix(g, PAINT * 0.35, cover(bars, 1.0) * 0.8);
    return g;
}

fn scene(p: vec2<f32>, aa: f32) -> vec3<f32> {
    // the lamp's warm light, falling off across the facade and the pavement
    let lampD = length((p - LAMP) * vec2<f32>(1.0, 1.25));
    let lampLit = WARM * (1.3 * exp(-lampD / 110.0) + 0.35 * exp(-lampD / 360.0));

    // night sky, a little orange from the city near the roofline
    var col = mix(vec3<f32>(0.03, 0.035, 0.055), vec3<f32>(0.055, 0.05, 0.06), clamp(p.y / ROOF_TOP, 0.0, 1.0));

    // index of the house bay this point belongs to (0 = the lit window)
    let k = floor((p.x - LIT.x + PITCH * 0.5) / PITCH);
    let cx = LIT.x + k * PITCH;
    let odd = fmodf(k, 2.0);                 // odd bays: the door below, even: the bay window
    // party walls between every other bay, carrying the chimneys
    let party = LIT.x + (floor((p.x - LIT.x - PITCH * 0.5) / (PITCH * 2.0)) * 2.0 + 1.5) * PITCH;

    // chimney stacks and pots
    let stack = sdBox(p, vec2<f32>(party, 146.0), vec2<f32>(26.0, 40.0));
    let pots = min(sdBox(p, vec2<f32>(party - 12.0, 100.0), vec2<f32>(5.0, 9.0)), sdBox(p, vec2<f32>(party + 10.0, 102.0), vec2<f32>(5.0, 8.0)));
    col = mix(col, BRICK * 0.75 * (1.0 - 0.3 * mortar(p)), cover(min(stack, pots), aa));

    // the slate roof, tiles in courses, a skylight here and there
    if (p.y > ROOF_TOP && p.y < EAVES) {
        let tile = 1.0 - 0.3 * (1.0 - step(0.12, fract((p.y - ROOF_TOP) / 9.0)));
        col = SLATE * tile * (0.85 + 0.3 * hash(floor(p / vec2<f32>(14.0, 9.0))));
        let sky = sdBox(p, vec2<f32>(cx + 30.0, 205.0), vec2<f32>(14.0, 9.0));
        if (hash(vec2<f32>(k, 7.0)) > 0.5) {
            col = mix(col, vec3<f32>(0.06, 0.07, 0.09), cover(sky, aa));
        }
    }
    // the gutter under the eaves
    col = mix(col, vec3<f32>(0.02), cover(abs(p.y - EAVES) - 2.5, aa));

    if (p.y > EAVES + 2.5) {
        // brick, with the lamp on it and a little grime towards the ground
        let b = BRICK * (0.9 + 0.2 * hash(floor(p / vec2<f32>(18.0, 7.0))));
        col = mix(b, b * 0.6, mortar(p)) * 0.85 + BRICK * lampLit * 2.2;
        // the downpipe on each party wall
        col = mix(col, vec3<f32>(0.018), cover(abs(p.x - party) - 2.0, aa) * step(p.y, WALL_TOP));
        // the white string course between the floors
        col = mix(col, PAINT * 0.8 + WARM * lampLit * 0.2, cover(abs(p.y - BAND) - 3.0, aa));
    }

    // ── upstairs: a sash window in every bay, lintel above, sill below ──
    let c = vec2<f32>(cx, LIT.y);
    let lintel = sdBox(p, c - vec2<f32>(0.0, HALF.y + 16.0), vec2<f32>(HALF.x + 14.0, 7.0));
    let sill = sdBox(p, c + vec2<f32>(0.0, HALF.y + 9.0), vec2<f32>(HALF.x + 10.0, 4.0));
    let paint = PAINT + WARM * lampLit * 0.35;
    col = mix(col, paint, cover(min(lintel, sill), aa));
    let reveal = sdBox(p, c, HALF + vec2<f32>(5.0));
    col = mix(col, paint * 0.9, cover(reveal, aa));
    let d = sdBox(p, c, HALF);
    var glass = darkPane(p, c, HALF, hash(vec2<f32>(k, 3.7)));
    if (k == 0.0) {
        glass = litRoom(p, aa);
    }
    col = mix(col, glass, cover(d, aa));

    // ── downstairs: a bay window or a front door under each upstairs window ──
    if (odd < 0.5) {
        // the bay: white pilasters, three sashes, a slate cap
        let bay = sdBox(p, vec2<f32>(cx, 568.0), vec2<f32>(66.0, 74.0));
        col = mix(col, paint * 0.95, cover(bay, aa));
        let cap = sdBox(p, vec2<f32>(cx, 486.0), vec2<f32>(72.0 - (p.y - 478.0) * 0.4, 9.0));
        col = mix(col, SLATE * 1.2, cover(cap, aa));
        for (var i = -1; i <= 1; i = i + 1) {
            let pc = vec2<f32>(cx + f32(i) * 42.0, 574.0);
            let ph = vec2<f32>(select(14.0, 17.0, i == 0), 52.0);
            col = mix(col, darkPane(p, pc, ph, hash(vec2<f32>(k, f32(i) + 9.0)) * 0.8), cover(sdBox(p, pc, ph), aa));
        }
    } else {
        // the front door: pilasters, a fanlight, the dark door, the step
        let surround = sdBox(p, vec2<f32>(cx, 566.0), vec2<f32>(40.0, 82.0));
        col = mix(col, paint * 0.9, cover(surround, aa));
        let fan = sdBox(p, vec2<f32>(cx, 508.0), vec2<f32>(24.0, 10.0));
        col = mix(col, vec3<f32>(0.03, 0.03, 0.035) + WARM * 0.04 * hash(vec2<f32>(k, 1.0)), cover(fan, aa));
        let door = sdBox(p, vec2<f32>(cx, 582.0), vec2<f32>(24.0, 60.0));
        col = mix(col, vec3<f32>(0.012, 0.014, 0.02) + WARM * lampLit * 0.05, cover(door, aa));
        let panels = min(abs(p.x - cx) - 0.8, abs(p.y - 580.0) - 0.8);
        col = mix(col, vec3<f32>(0.03), cover(panels, aa) * cover(door, aa) * 0.6);
    }

    // ── the front: hedges, the low wall with its coping, iron railings ──
    let hedgeTop = 606.0 + 16.0 * sin(p.x * 0.045 + 1.3) + 8.0 * sin(p.x * 0.13);
    let hedge = step(hedgeTop, p.y) * step(p.y, WALL_TOP) * step(0.5, odd + 0.5 - 0.5 * step(0.5, odd));
    let leaves = 0.6 + 0.4 * hash(floor(p / 4.0));
    col = mix(col, vec3<f32>(0.018, 0.026, 0.02) * leaves + vec3<f32>(0.03, 0.035, 0.02) * lampLit, hedge * (1.0 - odd));
    if (p.y > WALL_TOP && p.y < WALL_TOP + 52.0) {
        col = mix(BRICK * 0.8, BRICK * 0.35, mortar(p)) + BRICK * lampLit * 1.4;
        col = mix(col, paint * 0.5, cover(abs(p.y - WALL_TOP - 3.0) - 3.0, aa));
    }
    let rail = cover(abs(fmodf(p.x, 9.0) - 4.5) - 0.7, aa) * step(WALL_TOP - 30.0, p.y) * step(p.y, WALL_TOP);
    col = mix(col, vec3<f32>(0.01), rail * 0.85);
    col = mix(col, vec3<f32>(0.01), cover(abs(p.y - (WALL_TOP - 28.0)) - 1.0, aa) * 0.85);

    // ── pavement and road, wet: the lamp and the lit window stretch down in them ──
    if (p.y > WALL_TOP + 52.0) {
        let wet = vec3<f32>(0.02, 0.022, 0.028);
        let flag = cover(abs(fmodf(p.x + 20.0, 60.0) - 30.0) - 29.2, aa) * step(p.y, KERB);
        col = wet * (1.0 - 0.2 * flag);
        let streak = exp(-abs(p.x - LAMP.x) / 18.0) * exp(-(p.y - WALL_TOP) / 120.0);
        col = col + WARM * (streak * 0.35 + lampLit * 0.15);
        let litStreak = exp(-abs(p.x - LIT.x) / 30.0) * 0.05 * u.light;
        col = col + mix(BONE, CYAN, u.neon * 0.35) * litStreak;
        col = mix(col, vec3<f32>(0.06), cover(abs(p.y - KERB) - 1.5, aa));
        // the centre line, dashed
        let dash = cover(abs(p.y - 776.0) - 1.5, aa) * step(fmodf(p.x, 90.0), 45.0);
        col = mix(col, vec3<f32>(0.12, 0.12, 0.11), dash * 0.6);
    }

    // ── the lamp post, lantern lit ──
    let post = sdBox(p, vec2<f32>(LAMP.x, 628.0), vec2<f32>(3.2, 100.0));
    col = mix(col, vec3<f32>(0.008), cover(post, aa));
    let lantern = sdBox(p, LAMP, vec2<f32>(6.0 - (p.y - LAMP.y) * 0.12, 9.0));
    let cap = sdBox(p, LAMP - vec2<f32>(0.0, 12.0), vec2<f32>(8.0, 2.5));
    col = mix(col, vec3<f32>(0.008), cover(cap, aa));
    col = mix(col, WARM * 1.5, cover(lantern, aa));
    col = col + WARM * (0.45 * exp(-length(p - LAMP) / 14.0) + 0.08 * exp(-length(p - LAMP) / 60.0));

    // light spill from the lit window onto the brick around it
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
