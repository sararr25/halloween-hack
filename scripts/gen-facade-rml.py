#!/usr/bin/env python3
"""Writes rive/facade/scene.rml: the front of 17 Harrow St at night, seen through binoculars
(docs/plan-round8.md A4 + A6.1). Sixteen windows, two per flat, are generated here because
they repeat; everything that lives (lights on timers, the TV, the cat, the walker, the
stair light, the watcher turning, 4A lighting up) is a Rive timeline in the state machine.

The host (components/desktop/views/Facade.tsx) writes the view model "Facade":
  lensX, lensY   binocular centre, artboard px (800 x 520)
  blur           0..1 haze in the lenses while they move (focus comes back when still)
  glow           0..1 the phone screen lighting 4A's inner window on each ping
  figX, figY     where the watcher stands (artboard px, feet at the bottom of a window)
  figOn          0..1 the watcher's opacity
  turned         0 back to the street, 1 facing you (plays Turn)
  found          0 / 1 (plays Found: 4A stutters on, the raised hand)

Run: python3 scripts/gen-facade-rml.py && pnpm rive:facade
Draw order in RML: the first element declared paints on top.
"""
from pathlib import Path

W, H = 800, 520
WIN_W, WIN_H = 84, 70
COLS = [150, 268, 448, 566]
FLOORS = {4: 58, 3: 156, 2: 254, 1: 352}
FPS = 60
LOOP_S = 40  # the building's life repeats every 40 s

_next = [100]


def nid():
    _next[0] += 1
    return f"0:{_next[0]}"


VM = "0:10"
P = {k: f"0:{11 + i}" for i, k in enumerate(["lensX", "lensY", "blur", "glow", "figX", "figY", "figOn", "turned", "found"])}
VMI = "0:30"
HAZE_MAP = "0:40"


def bind(prop, key, conv=None):
    c = f' converterId="{conv}"' if conv else ""
    return f'<DataBindContext sourcePathIds="{VM}-{P[prop]}" propertyKey="{key}"{c}/>'


def solid(c):
    return f'<SolidColor colorValue="{c}" name="C"/>'


def rect(x, y, w, h, r=0, name="R"):
    rr = f' cornerRadiusTL="{r}"' if r else ""
    return f'<Rectangle x="{x}" y="{y}" width="{w}" height="{h}" originX="0" originY="0"{rr} name="{name}"/>'


def ell(x, y, w, h, name="E"):
    return f'<Ellipse x="{x}" y="{y}" width="{w}" height="{h}" name="{name}"/>'


def shape(name, paths, fill=None, stroke=None, sid=None, x=0, y=0, opacity=None, binds=""):
    i = f' id="{sid}"' if sid else ""
    o = f' opacity="{opacity}"' if opacity is not None else ""
    f = f'<Fill name="Fill">{fill}</Fill>' if fill else ""
    s = ""
    if stroke:
        col, th = stroke
        s = f'<Stroke thickness="{th}" name="Stroke">{solid(col)}</Stroke>'
    return f'<Shape x="{x}" y="{y}"{o} name="{name}"{i}>{binds}{"".join(paths)}{f}{s}</Shape>'


def radial(cx, cy, r, inner, outer):
    return (
        f'<RadialGradient startX="{cx}" startY="{cy}" endX="{cx + r}" endY="{cy}" name="G">'
        f'<GradientStop colorValue="{inner}" position="0" name="S0"/>'
        f'<GradientStop colorValue="{outer}" position="1" name="S1"/></RadialGradient>'
    )


def linear(x0, y0, x1, y1, a, b):
    return (
        f'<LinearGradient startX="{x0}" startY="{y0}" endX="{x1}" endY="{y1}" name="G">'
        f'<GradientStop colorValue="{a}" position="0" name="S0"/>'
        f'<GradientStop colorValue="{b}" position="1" name="S1"/></LinearGradient>'
    )


WARM = "FFD9B877"
WARM_IN = "FFE8CC8E"
GLASS = "FF0B0F18"
SIL = "FF1A140C"  # a silhouette against a lit room

# window key = floor + column (1..4 left to right). Two windows per flat: columns 1-2 are
# flat A, 3-4 flat B. 42 is where E.V.'s phone is. Base light opacity, 0 = dark.
LIT = {
    "41": 0.0, "42": 0.0, "43": 0.9, "44": 0.0,
    "31": 0.85, "32": 0.0, "33": 0.0, "34": 0.0,
    "21": 0.9, "22": 0.8, "23": 0.35, "24": 0.0,
    "11": 0.0, "12": 0.0, "13": 0.0, "14": 0.75,
}
light_ids = {k: nid() for k in LIT}
anim_targets = {}


def window(floor, col):
    key = f"{floor}{col}"
    x, y = COLS[col - 1], FLOORS[floor]
    parts = [shape("Bars", [rect(WIN_W / 2 - 1, 0, 2, WIN_H), rect(0, WIN_H / 2 - 1, WIN_W, 2)], fill=solid("FF07090D"))]
    if key == "43":  # 4B: a man asleep in front of the TV; its light flickers blue on the room
        tv = anim_targets["tv"] = nid()
        parts.append(shape("TV light", [rect(0, 0, WIN_W, WIN_H)], fill=solid("FF7FA8FF"), sid=tv, opacity=0.25))
        parts.append(shape("Chair", [rect(46, 34, 30, 36, 6), ell(60, 30, 14, 15)], fill=solid(SIL)))
    if key == "31":  # 3A: a cat on the sofa, its tail going
        tail = anim_targets["tail"] = nid()
        parts.append(shape("Tail", [rect(0, -2, 22, 4, 2)], fill=solid(SIL), sid=tail, x=52, y=56))
        parts.append(shape("Cat", [ell(40, 56, 26, 14), ell(30, 50, 12, 11), rect(25, 43, 4, 6), rect(31, 43, 4, 6)], fill=solid(SIL)))
        parts.append(shape("Sofa", [rect(6, 60, 72, 10, 3)], fill=solid("FF3A2B1A")))
    if key == "22":  # 2A: a kitchen, the lamp swinging a little
        lamp = anim_targets["lamp"] = nid()
        parts.append(
            f'<Node x="{WIN_W * 0.3}" y="0" name="Lamp" id="{lamp}">'
            + shape("Bulb glow", [ell(0, 30, 36, 36)], fill=radial(0, 30, 18, "AAFFF2CC", "00FFF2CC"))
            + shape("Shade", [rect(-7, 14, 14, 8, 2), rect(-0.5, 0, 1, 14)], fill=solid(SIL))
            + "</Node>"
        )
    if key == "14":  # 1B: a woman reading under a lamp
        parts.append(shape("Lamp glow", [ell(20, 26, 40, 40)], fill=radial(20, 26, 20, "88FFF0C0", "00FFF0C0")))
        parts.append(shape("Reader", [rect(48, 40, 22, 30, 5), ell(58, 34, 12, 13), rect(40, 46, 12, 6, 2)], fill=solid(SIL)))
    if key == "21":  # 2A's other window: someone walking through, now and then
        walker = anim_targets["walker"] = nid()
        clip = nid()
        parts.append(
            f'<Node x="-24" y="0" name="Walker" id="{walker}">'
            + shape("Person", [rect(-8, 32, 16, 38, 5), ell(0, 26, 12, 13)], fill=solid(SIL)).replace("</Shape>", f'<ClippingShape sourceId="{clip}" name="Clip"/></Shape>', 1)
            + "</Node>"
        )
        parts.append(shape("Walker clip", [rect(0, 0, WIN_W, WIN_H)], sid=clip))
    if key == "24":  # 2B's other window: a child's star projector, blue, always on
        stars = anim_targets["stars"] = nid()
        clip = nid()
        dots = [ell(8 + (i * 23) % 124, 8 + (i * 17) % 50, 3, 3) for i in range(12)]
        parts.append(
            f'<Node x="0" y="0" name="Stars" id="{stars}">'
            + shape("Dots", dots, fill=solid("CCAFC8FF")).replace("</Shape>", f'<ClippingShape sourceId="{clip}" name="Clip"/></Shape>', 1)
            + "</Node>"
        )
        parts.append(shape("Stars clip", [rect(0, 0, WIN_W, WIN_H)], sid=clip))
    if key in ("11", "12"):  # 1A: the stairwell, a timer light
        parts.append(shape("Banister", [rect(6, 60, 72, 2), rect(14 if key == "11" else 34, 40, 2, 22), rect(56, 40, 2, 22)], fill=solid(SIL)))
    if key == "42":  # 4A inner window: the phone's glow, and on Found the raised hand
        glow = anim_targets["glow"] = nid()
        hand = anim_targets["hand"] = nid()
        parts.append(f'<Image x="{WIN_W / 2}" y="{WIN_H - 31}" scaleX="0.42" scaleY="0.42" opacity="0" assetId="0:92" name="Hand" id="{hand}"/>')
        parts.append(shape("Phone glow", [ell(56, 58, 60, 40)], fill=radial(56, 58, 30, "FFCFE6FF", "00CFE6FF"), sid=glow, opacity=0, binds=bind("glow", 18)))
    fill = linear(0, 0, 0, WIN_H, WARM_IN, WARM) if key != "24" else solid("FF203050")
    parts.append(shape("Light", [rect(0, 0, WIN_W, WIN_H)], fill=fill, sid=light_ids[key], opacity=LIT[key] if key != "24" else 0.9))
    parts.append(shape("Glass", [rect(0, 0, WIN_W, WIN_H)], fill=solid(GLASS)))
    parts.append(shape("Frame", [rect(-5, -5, WIN_W + 10, WIN_H + 10)], fill=solid("FF2A2622")))
    return f'<Node x="{x}" y="{y}" name="W{key}">' + "".join(parts) + "</Node>"


def kf(obj, prop, frames):
    """frames: (second, value, interpolation)"""
    k = "".join(f'<KeyFrameDouble value="{v}" interpolationType="{it}" frame="{round(s * FPS)}"/>' for s, v, it in frames)
    return f'<KeyedObject objectId="{obj}"><KeyedProperty propertyKey="{prop}">{k}</KeyedProperty></KeyedObject>'


def onoff(obj, spans, level=0.85, total=LOOP_S, flicker=False):
    """a light switched on for each (start, end) span"""
    fr = [(0, 0, "hold")]
    for a, b in spans:
        if flicker:
            fr += [(a, level, "hold"), (a + 0.08, 0, "hold"), (a + 0.2, level, "hold"), (a + 0.3, 0.1, "hold"), (a + 0.45, level, "hold")]
        else:
            fr.append((a, level, "hold"))
        fr.append((b, 0, "hold"))
    fr.append((total, 0, "hold"))
    return kf(obj, 18, fr)


def build():
    windows = [window(f, c) for f in (4, 3, 2, 1) for c in (1, 2, 3, 4)]
    lens, haze, watcher, back, front = nid(), nid(), nid(), nid(), nid()

    R = 58
    two = ell(-R, 0, 2 * R, 2 * R) + ell(R, 0, 2 * R, 2 * R)
    lens_xml = (
        f'<Node x="400" y="440" name="Lens" id="{lens}">{bind("lensX", 13)}{bind("lensY", 14)}'
        + f'<Shape name="Rims">{two}<Stroke thickness="3" name="Stroke">{solid("FF3A3F48")}</Stroke></Shape>'
        + f'<Shape name="Rim shade">{two}<Stroke thickness="14" name="Shade">{solid("AA000000")}<Feather strength="14" inner="true" name="F"/></Stroke></Shape>'
        + f'<Shape name="Night"><Rectangle width="4000" height="3000" name="R"/>{two}<Fill fillRule="evenOdd" name="Fill">{solid("F4020306")}</Fill></Shape>'
        + f'<Shape opacity="0" name="Haze" id="{haze}">{bind("blur", 18, HAZE_MAP)}{two}<Fill name="Fill">{solid("FF8C97A8")}</Fill></Shape>'
        + "</Node>"
    )
    watcher_xml = (
        f'<Node x="490" y="324" name="Watcher" id="{watcher}">{bind("figX", 13)}{bind("figY", 14)}{bind("figOn", 18)}'
        + f'<Image x="0" y="-34" scaleX="0" scaleY="0.42" assetId="0:91" name="Front" id="{front}"/>'
        + f'<Image x="0" y="-34" scaleX="0.42" scaleY="0.42" assetId="0:90" name="Back" id="{back}"/>'
        + "</Node>"
    )

    wall = (
        shape("Door light", [ell(400, 446, 70, 30)], fill=radial(400, 446, 35, "66E8CC8E", "00E8CC8E"))
        + shape("Door", [rect(372, 452, 56, 68), rect(366, 444, 68, 6)], fill=solid("FF120E0B"))
        + shape("Fanlight", [rect(376, 440, 48, 4)], fill=solid("AAE8CC8E"))
        + shape("Sills", [rect(COLS[c] - 8, FLOORS[f] + WIN_H + 5, WIN_W + 16, 4) for f in FLOORS for c in range(4)], fill=solid("FF3A342D"))
        + shape("Bricks", [rect(120, 30 + i * 14, 560, 1) for i in range(35)], fill=solid("22000000"))
        + shape("Cornice", [rect(110, 18, 580, 12), rect(116, 30, 568, 4)], fill=solid("FF2C2824"))
        + shape("Wall", [rect(120, 30, 560, 490)], fill=linear(0, 30, 0, 520, "FF2A211B", "FF1B1512"))
        + shape("Neighbours", [rect(0, 70, 112, 450), rect(688, 46, 112, 474)], fill=solid("FF14110F"))
        + shape("Sky", [rect(0, 0, W, H)], fill=linear(0, 0, 0, H, "FF0A1020", "FF141A26"))
    )

    T = LOOP_S
    life = (
        onoff(light_ids["33"], [(10, 26)], 0.8)
        + onoff(light_ids["34"], [(11.5, 26)], 0.7)
        + kf(light_ids["21"], 18, [(0, 0.9, "hold"), (15, 0, "hold"), (31, 0.9, "hold"), (T, 0.9, "hold")])
        + onoff(light_ids["11"], [(5, 9), (22, 26)], 0.6)
        + onoff(light_ids["12"], [(5.2, 9), (22.2, 26)], 0.6)
        + onoff(light_ids["44"], [(28, 36)], 0.75, flicker=True)
        + onoff(light_ids["32"], [(17, 18.2)], 0.5, flicker=True)
    )
    a = anim_targets
    tv = kf(a["tv"], 18, [(0, 0.25, "linear"), (0.3, 0.05, "hold"), (0.45, 0.35, "linear"), (0.9, 0.15, "linear"), (1.1, 0.4, "hold"), (1.25, 0.1, "linear"), (1.6, 0.25, "linear")])
    tail = kf(a["tail"], 15, [(0, -0.5, "cubic"), (1.5, 0.35, "cubic"), (3, -0.5, "cubic")])
    lamp = kf(a["lamp"], 15, [(0, -0.06, "cubic"), (2.2, 0.06, "cubic"), (4.4, -0.06, "cubic")])
    walker = kf(a["walker"], 13, [(0, -24, "hold"), (3, -24, "linear"), (6.5, 110, "hold"), (14, 110, "hold")])
    stars = kf(a["stars"], 13, [(0, 0, "linear"), (10, -40, "linear")])
    turn = kf(back, 16, [(0, 0.42, "cubic"), (0.22, 0, "hold"), (0.5, 0, "hold")]) + kf(front, 16, [(0, 0, "hold"), (0.22, 0, "cubic"), (0.5, 0.42, "hold")])
    unturn = kf(back, 16, [(0, 0.42, "hold")]) + kf(front, 16, [(0, 0, "hold")])
    found = (
        kf(light_ids["42"], 18, [(0, 0, "hold"), (0.1, 0.9, "hold"), (0.18, 0, "hold"), (0.36, 0.7, "hold"), (0.44, 0.05, "hold"), (0.62, 0.95, "hold"), (3, 0.95, "hold")])
        + kf(light_ids["41"], 18, [(0, 0, "hold"), (0.62, 0.25, "linear"), (3, 0.3, "hold")])
        + kf(a["hand"], 18, [(0, 0, "hold"), (0.9, 0, "linear"), (1.4, 1, "hold"), (3, 1, "hold")])
    )

    anims = [
        ("Life", T, "loop", life),
        ("TV", 1.6, "loop", tv),
        ("Cat", 3, "loop", tail),
        ("Lamp", 4.4, "loop", lamp),
        ("Walker", 14, "loop", walker),
        ("Stars", 10, "loop", stars),
        ("Back", 0.1, "oneShot", unturn),
        ("Turn", 0.5, "oneShot", turn),
        ("Idle", 0.1, "oneShot", ""),
        ("Found", 3, "oneShot", found),
    ]
    anim_ids = {n: nid() for n, *_ in anims}
    anim_xml = "\n".join(
        f'<LinearAnimation loopValue="{lp}" duration="{round(d * FPS)}" name="{n}" id="{anim_ids[n]}">{body}</LinearAnimation>'
        for n, d, lp, body in anims
    )

    def layer(name, body):
        return f'<StateMachineLayer name="{name}"><AnyState x="200" y="-120"/><ExitState x="400" y="-120"/>{body}</StateMachineLayer>'

    def loop_layer(name, anim):
        st = nid()
        return layer(name, f'<EntryState><StateTransition stateToId="{st}"/></EntryState><AnimationState x="160" y="0" animationId="{anim_ids[anim]}" id="{st}"/>')

    def cond(prop, value):
        return (
            f'<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyNumber>'
            f'<DataBindContext sourcePathIds="{VM}-{P[prop]}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator>'
            f'<TransitionValueNumberComparator value="{value}"/></TransitionViewModelCondition>'
        )

    def toggle_layer(name, prop, off_anim, on_anim):
        s_off, s_on = nid(), nid()
        return layer(
            name,
            f'<EntryState><StateTransition stateToId="{s_off}"/></EntryState>'
            f'<AnimationState x="160" y="0" animationId="{anim_ids[off_anim]}" id="{s_off}"><StateTransition stateToId="{s_on}">{cond(prop, 1)}</StateTransition></AnimationState>'
            f'<AnimationState x="360" y="0" animationId="{anim_ids[on_anim]}" reset="true" id="{s_on}"><StateTransition stateToId="{s_off}">{cond(prop, 0)}</StateTransition></AnimationState>',
        )

    sm = (
        '<StateMachine name="Facade" id="0:7">'
        + "".join(loop_layer(n, n) for n in ("Life", "TV", "Cat", "Lamp", "Walker", "Stars"))
        + toggle_layer("Watcher", "turned", "Back", "Turn")
        + toggle_layer("Found", "found", "Idle", "Found")
        + "</StateMachine>"
    )

    defaults = {"lensX": 400, "lensY": 440, "blur": 0, "glow": 0, "figX": 490, "figY": 324, "figOn": 1, "turned": 0, "found": 0}
    vm_props = "".join(f'<ViewModelPropertyNumber name="{k}" id="{v}"/>' for k, v in P.items())
    vm_vals = "".join(f'<ViewModelInstanceNumber propertyValue="{defaults[k]}" viewModelPropertyId="{v}"/>' for k, v in P.items())

    doc = (
        '<Rive version="1" kind="fragment">\n'
        f'<Artboard defaultStateMachineId="0:7" viewModelId="{VM}" viewModelInstanceId="{VMI}" clip="true" width="{W}" height="{H}" name="Facade" id="0:2">\n'
        f'<Fill name="Background">{solid("FF05070C")}</Fill>\n'
        + lens_xml + "\n" + watcher_xml + "\n" + "\n".join(windows) + "\n" + wall + "\n" + sm + "\n" + anim_xml + "\n"
        + "</Artboard>\n"
        + f'<DataConverterRangeMapper minInput="0" maxInput="1" minOutput="0" maxOutput="0.75" clampLower="true" clampUpper="true" name="Haze" id="{HAZE_MAP}"/>\n'
        + f'<ViewModel defaultInstanceId="{VMI}" name="Facade" id="{VM}">{vm_props}<ViewModelInstance exports="true" name="Default" id="{VMI}">{vm_vals}</ViewModelInstance></ViewModel>\n'
        + '<ImageAsset file="figure_back.png" name="figure_back" id="0:90"/>\n'
        + '<ImageAsset file="figure_front.png" name="figure_front" id="0:91"/>\n'
        + '<ImageAsset file="figure_hand.png" name="figure_hand" id="0:92"/>\n'
        + "</Rive>\n"
    )
    out = Path(__file__).resolve().parent.parent / "rive" / "facade" / "scene.rml"
    out.write_text(doc)
    print(f"wrote {out}")


build()
