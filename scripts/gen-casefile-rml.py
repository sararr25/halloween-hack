#!/usr/bin/env python3
"""Writes rive/casefile/scene.rml: the case file that takes the screen in the pass-it-on DM
(round 8). Owner's direction: the case-file look (fields and a stamp,
mono, the countdown as data), with thriller motion. Every line types itself on with a Rive
text modifier, the stamp slams down, then a held silence before the two last lines.

The host (components/desktop/InviteDM.tsx) writes the view model "CaseFile":
  case        the case passed on, "CASE 0420" (lib/story/caseno.ts: it moves along the chain)
  from        the name of whoever passed the case on
  remaining   the countdown, "11:59:58"
  play        0 / 1 (1 plays Sequence once)
The timings below are mirrored in InviteDM.tsx (CASE_BEATS) for the sounds.

Run: python3 scripts/gen-casefile-rml.py && pnpm rive:casefile
Draw order in RML: the first element declared paints on top.
"""
from pathlib import Path

FPS = 60
_next = [100]


def nid():
    _next[0] += 1
    return f"0:{_next[0]}"


VM, VMI = "0:10", "0:20"
P = {"from": "0:11", "remaining": "0:12", "play": "0:13", "case": "0:14"}
MONO, ITAL = "0:90", "0:91"
TEXT, MUTED, NEON = "FFE6E8EE", "FF8A91A1", "FF00F0FF"

reveals = []  # (range id, start s, end s)


def text(x, y, value, size, color, font=MONO, spacing=0, bindprop=None, start=None, end=None, origin=(0, 0)):
    t, s, r, rng = nid(), nid(), nid(), nid()
    b = f'<DataBindContext sourcePathIds="{VM}-{P[bindprop]}" propertyKey="268"/>' if bindprop else ""
    mod = ""
    if start is not None:
        # fully hidden until the range sweeps off it (modifyFrom 0 -> 1.05)
        mod = (
            f'<TextModifierGroup modifyOpacity="true" invertOpacity="true" modifyTranslation="true" opacity="0" y="6" name="Type on">'
            f'<TextModifierRange modifyFrom="0" modifyTo="1.05" falloffFrom="0" falloffTo="1.05" name="Sweep" id="{rng}"/></TextModifierGroup>'
        )
        reveals.append((rng, start, end))
    return (
        f'<Text x="{x}" y="{y}" sizingValue="autoWidth" originX="{origin[0]}" originY="{origin[1]}" name="T" id="{t}">'
        f'<TextStylePaint fontSize="{size}" letterSpacing="{spacing}" fontAssetId="{font}" name="S" id="{s}">'
        f'<Fill name="Fill"><SolidColor colorValue="{color}" name="C"/></Fill></TextStylePaint>'
        f'<TextValueRun styleId="{s}" text="{value}" name="Run" id="{r}">{b}</TextValueRun>'
        f"{mod}</Text>"
    )


def kf(prop, frames):
    k = "".join(f'<KeyFrameDouble value="{v}" interpolationType="{it}" frame="{round(s * FPS)}"/>' for s, v, it in frames)
    return f'<KeyedProperty propertyKey="{prop}">{k}</KeyedProperty>'


ROWS = [
    ("status", "reassigned", None, 1.2),
    ("operator", "you", None, 2.2),
    ("previous", "", "from", 3.2),
    ("remaining", "12:00:00", "remaining", 4.2),
]
STAMP_AT = 5.4
LINE1_AT, LINE2_AT = 7.4, 9.4
END_S = 12.5

# two layouts of the same page: landscape for a computer, portrait for a phone (round 8 B1:
# a shared link is mostly opened on a phone)
LAYOUTS = {
    "CaseFile": dict(w=900, h=560, x0=170, header=(92, 36, 8), tag=(730, 104, "right"), rule=(150, 560),
                     row=lambda i: ((170, 182 + i * 44), (400, 182 + i * 44)), label=22, value=22,
                     stamp=(700, 340, 1.0), lines=(392, 452, 44)),
    "CaseFilePortrait": dict(w=420, h=760, x0=40, header=(110, 32, 6), tag=(40, 164, "left"), rule=(196, 340),
                             row=lambda i: ((40, 222 + i * 78), (40, 248 + i * 78)), label=15, value=22,
                             stamp=(290, 556, 0.8), lines=(606, 656, 34)),
}


def artboard(name, ab_id, sm_id, L):
    reveals.clear()
    x0 = L["x0"]
    parts = []
    # the two lines, after a held silence: italic, larger
    y1, y2, ls = L["lines"]
    parts.append(text(x0, y1, "find her.", ls, TEXT, ITAL, 0, None, LINE1_AT, LINE1_AT + 1.0))
    parts.append(text(x0, y2, "or you&apos;re next.", ls, TEXT, ITAL, 0, None, LINE2_AT, LINE2_AT + 1.2))

    # the stamp: a neon box, rotated, slams down from above the page
    stamp = nid()
    sx, sy, sk = L["stamp"]
    parts.append(
        f'<Node x="{sx}" y="{sy}" rotation="-0.16" opacity="0" name="Stamp" id="{stamp}">'
        + f'<Node scaleX="{sk}" scaleY="{sk}" name="Size">'
        + text(0, 0, "ASSIGNED", 30, NEON, MONO, 6, None, None, None, origin=(0.5, 0.5))
        + '<Shape name="Box"><Rectangle width="236" height="64" cornerRadiusTL="6" name="R"/>'
        f'<Stroke thickness="3" name="Stroke"><SolidColor colorValue="{NEON}" name="C"/></Stroke>'
        '<Stroke thickness="10" name="Glow"><SolidColor colorValue="5500F0FF" name="C"/><Feather strength="16" name="F"/></Stroke></Shape>'
        + "</Node></Node>"
    )

    # the fields
    for i, (label, value, bindprop, at) in enumerate(ROWS):
        (lx, ly), (vx, vy) = L["row"](i)
        color = NEON if label == "remaining" else TEXT
        parts.append(text(vx, vy, value or "someone", L["value"], color, MONO, 1, bindprop, at + 0.15, at + 0.75))
        parts.append(text(lx, ly, label, L["label"], MUTED, MONO, 1, None, at, at + 0.4))

    # the header and its rule
    rule = nid()
    ry, rw = L["rule"]
    parts.append(
        f'<Shape x="{x0}" y="{ry}" scaleX="0" name="Rule" id="{rule}"><Rectangle x="0" y="0" width="{rw}" height="1.5" originX="0" originY="0" name="R"/>'
        '<Fill name="Fill"><SolidColor colorValue="66E6E8EE" name="C"/></Fill></Shape>'
    )
    hy, hs, hsp = L["header"]
    parts.append(text(x0, hy, "CASE 0420", hs, TEXT, MONO, hsp, "case", 0.0, 0.7))
    tx, ty, side = L["tag"]
    parts.append(text(tx, ty, "RECOVERY/4", 14, MUTED, MONO, 3, None, 0.4, 0.9, origin=(1 if side == "right" else 0, 0)))

    page = nid()
    body = "".join(parts)

    # the sequence: every range swept off, the rule drawn, the stamp, a jolt of the page
    keyed = "".join(
        f'<KeyedObject objectId="{rng}">{kf(327, [(0, 0, "hold"), (a, 0, "linear"), (b, 1.05, "hold"), (END_S, 1.05, "hold")])}</KeyedObject>'
        for rng, a, b in reveals
    )
    keyed += f'<KeyedObject objectId="{rule}">{kf(16, [(0, 0, "hold"), (0.5, 0, "cubic"), (1.0, 1, "hold"), (END_S, 1, "hold")])}</KeyedObject>'
    s = STAMP_AT
    keyed += (
        f'<KeyedObject objectId="{stamp}">'
        + kf(18, [(0, 0, "hold"), (s - 0.12, 0, "linear"), (s, 1, "hold"), (END_S, 1, "hold")])
        + kf(16, [(0, 2.6, "hold"), (s - 0.12, 2.6, "cubic"), (s, 1, "cubic"), (s + 0.08, 1.06, "cubic"), (s + 0.2, 1, "hold"), (END_S, 1, "hold")])
        + kf(17, [(0, 2.6, "hold"), (s - 0.12, 2.6, "cubic"), (s, 1, "cubic"), (s + 0.08, 0.94, "cubic"), (s + 0.2, 1, "hold"), (END_S, 1, "hold")])
        + "</KeyedObject>"
    )
    keyed += (
        f'<KeyedObject objectId="{page}">'
        + kf(13, [(0, 0, "hold"), (s, 0, "linear"), (s + 0.04, -9, "linear"), (s + 0.09, 7, "linear"), (s + 0.15, -4, "linear"), (s + 0.22, 0, "hold"), (END_S, 0, "hold")])
        + kf(14, [(0, 0, "hold"), (s, 0, "linear"), (s + 0.04, 6, "linear"), (s + 0.09, -5, "linear"), (s + 0.15, 2, "linear"), (s + 0.22, 0, "hold"), (END_S, 0, "hold")])
        + "</KeyedObject>"
    )
    seq, idle, s_idle, s_seq = nid(), nid(), nid(), nid()
    cond = (
        '<TransitionViewModelCondition opValue="equal"><TransitionPropertyViewModelComparator><BindablePropertyNumber>'
        f'<DataBindContext sourcePathIds="{VM}-{P["play"]}" propertyKey="636"/></BindablePropertyNumber></TransitionPropertyViewModelComparator>'
        '<TransitionValueNumberComparator value="1"/></TransitionViewModelCondition>'
    )
    # Idle keeps every range at 0 (hidden), the stamp invisible and the rule undrawn
    idle_keys = "".join(f'<KeyedObject objectId="{rng}">{kf(327, [(0, 0, "hold")])}</KeyedObject>' for rng, *_ in reveals)
    idle_keys += f'<KeyedObject objectId="{stamp}">{kf(18, [(0, 0, "hold")])}</KeyedObject>'
    idle_keys += f'<KeyedObject objectId="{rule}">{kf(16, [(0, 0, "hold")])}</KeyedObject>'

    return (
        f'<Artboard defaultStateMachineId="{sm_id}" viewModelId="{VM}" viewModelInstanceId="{VMI}" clip="true" width="{L["w"]}" height="{L["h"]}" name="{name}" id="{ab_id}">\n'
        f'<Node x="0" y="0" name="Page" id="{page}">{body}</Node>\n'
        f'<StateMachine name="{name}" id="{sm_id}"><StateMachineLayer name="Play">'
        '<AnyState x="200" y="-120"/><ExitState x="400" y="-120"/>'
        f'<EntryState><StateTransition stateToId="{s_idle}"/></EntryState>'
        f'<AnimationState x="160" y="0" animationId="{idle}" id="{s_idle}"><StateTransition stateToId="{s_seq}">{cond}</StateTransition></AnimationState>'
        f'<AnimationState x="360" y="0" animationId="{seq}" reset="true" id="{s_seq}"/>'
        "</StateMachineLayer></StateMachine>\n"
        f'<LinearAnimation loopValue="oneShot" duration="6" name="Idle" id="{idle}">{idle_keys}</LinearAnimation>\n'
        f'<LinearAnimation loopValue="oneShot" duration="{round(END_S * FPS)}" name="Sequence" id="{seq}">{keyed}</LinearAnimation>\n'
        "</Artboard>\n"
    )


def build():
    doc = (
        '<Rive version="1" kind="fragment">\n'
        + artboard("CaseFile", "0:2", "0:7", LAYOUTS["CaseFile"])
        + artboard("CaseFilePortrait", "0:3", "0:8", LAYOUTS["CaseFilePortrait"])
        + f'<ViewModel defaultInstanceId="{VMI}" name="CaseFile" id="{VM}">'
        f'<ViewModelPropertyString name="from" id="{P["from"]}"/><ViewModelPropertyString name="remaining" id="{P["remaining"]}"/>'
        f'<ViewModelPropertyNumber name="play" id="{P["play"]}"/>'
        f'<ViewModelPropertyString name="case" id="{P["case"]}"/>'
        f'<ViewModelInstance exports="true" name="Default" id="{VMI}">'
        f'<ViewModelInstanceString propertyValue="someone · released" viewModelPropertyId="{P["from"]}"/>'
        f'<ViewModelInstanceString propertyValue="12:00:00" viewModelPropertyId="{P["remaining"]}"/>'
        f'<ViewModelInstanceNumber propertyValue="0" viewModelPropertyId="{P["play"]}"/>'
        f'<ViewModelInstanceString propertyValue="CASE 0420" viewModelPropertyId="{P["case"]}"/>'
        "</ViewModelInstance></ViewModel>\n"
        f'<FontAsset file="JetBrainsMono.ttf" name="JetBrains Mono" id="{MONO}"/>\n'
        f'<FontAsset file="JetBrainsMono-Italic.ttf" name="JetBrains Mono Italic" id="{ITAL}"/>\n'
        "</Rive>\n"
    )
    out = Path(__file__).resolve().parent.parent / "rive" / "casefile" / "scene.rml"
    out.write_text(doc)
    print(f"wrote {out}")


build()
