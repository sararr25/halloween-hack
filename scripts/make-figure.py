"""Builds the S9 figure's pieces for rive/story (round 10) from the owner's silhouettes,
assets/hand down.svg and assets/hand up.svg (a backlit person, posterized: black core,
grey layers where the light catches the edges).

The figure has to be unisex, so the long hair is cut short and messy above the ears, and the
jaw, the ears and the neck below the cut are drawn here (with the same kind of rim light).
The torso is lengthened so the figure stands to below the sill. The raised forearm and hand
of `hand up` is cut out as its own piece, rounded at the elbow, so across.luau can turn it
towards the player's hand.

Writes into rive/story/: fig_head.png, fig_body.png, fig_arm.png and a blurred *_soft.png
of each (the figure is seen out of focus while the camera is far), a quarter of the size
and padded by SOFT_PAD. Anchors are printed for across.luau. Needs rsvg-convert.

  python3 scripts/make-figure.py
"""

import math
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "rive" / "story"
# work at 916 x 1145 (the SVGs' own size); the head is ~475 px tall at this size
W, H = 916, 1145
CX = 457
# the torso is continued down to here so it always reaches past the sill
TALL = 2600
SS = 4  # supersampling for the shapes drawn here
# the soft pieces are padded by this (sharp px) before they are shrunk to a quarter and blurred
SOFT_PAD = 64


def raster(svg: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as d:
        out = Path(d) / "x.png"
        subprocess.run(["rsvg-convert", "-w", str(W), str(ROOT / "assets" / svg), "-o", str(out)], check=True)
        return np.array(Image.open(out).convert("L")).astype(np.float32) / 255


def ink(lum: np.ndarray) -> np.ndarray:
    """RGBA from a silhouette on white: the white goes, black and the grey rims stay."""
    a = np.clip((0.93 - lum) / 0.12, 0, 1)
    rgba = np.zeros(lum.shape + (4,), np.float32)
    # the lit edges take the cool light of the room behind
    rgba[..., 0] = lum * 0.86
    rgba[..., 1] = lum * 0.9
    rgba[..., 2] = lum
    rgba[..., 3] = a
    return rgba


def smooth(points: list[tuple[float, float]], steps: int = 14) -> list[tuple[float, float]]:
    """A closed Catmull-Rom curve through the points."""
    out = []
    n = len(points)
    for i in range(n):
        p0, p1, p2, p3 = (points[(i + k - 1) % n] for k in range(4))
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            out.append(
                tuple(
                    0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)
                    for j in range(2)
                )
            )
    return out


def fill(poly: list[tuple[float, float]], size: tuple[int, int]) -> np.ndarray:
    big = Image.new("L", (size[0] * SS, size[1] * SS), 0)
    ImageDraw.Draw(big).polygon([(x * SS, y * SS) for x, y in poly], fill=255)
    return np.array(big.resize(size, Image.LANCZOS)).astype(np.float32) / 255


def mirror(right: list[tuple[float, float]]) -> list[tuple[float, float]]:
    """A symmetric outline from its right half, listed top to bottom."""
    left = [(2 * CX - x, y) for x, y in reversed(right)]
    return right + left


def rim(mask: np.ndarray, width: int, strength: float) -> np.ndarray:
    """Light caught along the inside of an edge, strongest at the outline."""
    m = Image.fromarray((mask * 255).astype(np.uint8))
    inner = np.array(m.filter(ImageFilter.MinFilter(width * 2 + 1)).filter(ImageFilter.GaussianBlur(width * 0.8))).astype(np.float32) / 255
    return np.clip(mask - inner, 0, 1) * strength


def over(dst: np.ndarray, src: np.ndarray) -> np.ndarray:
    a = src[..., 3:4]
    out = dst.copy()
    out[..., 3:4] = a + dst[..., 3:4] * (1 - a)
    out[..., :3] = (src[..., :3] * a + dst[..., :3] * dst[..., 3:4] * (1 - a)) / np.maximum(out[..., 3:4], 1e-4)
    return out


def main() -> None:
    down = ink(raster("hand down.svg"))
    up = ink(raster("hand up.svg"))
    ys, xs = np.mgrid[0:H, 0:W].astype(np.float32)

    # ── the head: messy hair cut short above the ears, a drawn face, ears and neck ──
    # where the hair ends: about the top of the ears, uneven, strands of different lengths
    tips = 12 * np.sin(xs * 0.11) + 9 * np.sin(xs * 0.047 + 1.3) + 16 * np.abs(np.sin(xs * 0.023 + 0.4)) ** 3
    # shorter at the sides, over the ears, longer at the back of the head
    hairline = 330 + tips - np.clip(np.abs(xs - CX) - 100, 0, None) * 1.5
    hair = down.copy()
    hair[..., 3] *= 1 - np.clip((ys - hairline) / 10, 0, 1)

    # the face below the hair, the ears, the jaw, the neck and the slope to the shoulders,
    # right half from the temple down
    right = [
        (CX + 4, 240),
        (CX + 140, 240),
        (CX + 158, 284),
        (CX + 157, 326),
        (CX + 162, 352),  # ear
        (CX + 158, 392),
        (CX + 146, 414),
        (CX + 140, 440),  # jaw
        (CX + 118, 488),
        (CX + 82, 526),
        (CX + 70, 546),  # under the jaw, the neck
        (CX + 76, 570),
        (CX + 104, 586),
        (CX + 170, 597),  # trapezius, down into the shoulders
        (CX + 232, 612),
        (CX + 300, 650),
        (CX + 300, 700),
        (CX + 4, 700),
    ]
    face = fill(smooth(mirror(right)), (W, H))
    face_rgba = np.zeros((H, W, 4), np.float32)
    face_rgba[..., :3] = (0.03, 0.035, 0.045)
    face_rgba[..., 3] = face

    shoulders = down.copy()
    shoulders[..., 3] *= np.clip((ys - 600) / 30, 0, 1)  # the original from the shoulders down
    whole = over(over(np.zeros_like(down), shoulders), face_rgba)
    whole = over(whole, hair)
    # the light from the room behind catches the drawn edges (ears, jaw, neck) the way the
    # original's grey layers catch the hair and shoulders: measured on the whole outline, so
    # no seam shows where the pieces meet
    drawn = face * (1 - hair[..., 3]) * (1 - shoulders[..., 3])
    lit = rim(whole[..., 3], 5, 0.34) * drawn * np.clip((600 - ys) / 300, 0.3, 1)
    whole[..., 0] += lit * 0.86
    whole[..., 1] += lit * 0.9
    whole[..., 2] += lit

    # head and body are separate pieces so the head can turn: they overlap at the neck
    neck_y = 575
    head = whole[:640].copy()
    head[..., 3] *= np.clip((620 - ys[:640]) / 30, 0, 1)
    body = np.zeros((TALL, W, 4), np.float32)
    body[:H] = whole
    body[:H, :, 3] *= np.clip((ys - (neck_y - 40)) / 20, 0, 1)
    # the torso goes on down past the sill: the last rows, narrowing a little to the waist,
    # the light along its edges carried down with it so no seam shows
    last = whole[H - 8 : H].mean(axis=0)
    for y in range(H, TALL):
        k = min(1, (y - H) / 700)
        squeeze = 1 - 0.09 * k * k * (3 - 2 * k)
        src = np.clip(((np.arange(W) - CX) / squeeze + CX).astype(int), 0, W - 1)
        body[y] = last[src]
        body[y, :, :3] *= 1 - 0.6 * k  # and the light fades lower down

    # ── the forearm and hand, from `hand up` ──
    # elbow (the pivot) and the sleeve's outline, measured on hand up.svg at this size
    elbow = (826, 985)
    outline = [
        (674, 310), (700, 250), (760, 240), (850, 280), (912, 330),
        (914, 700), (900, 900), (880, 990), (826, 1050), (770, 1020),
        (760, 900), (756, 640), (690, 560), (660, 430),
    ]
    arm_mask = fill(smooth(outline, 10), (W, H))
    # round the elbow end so the cut never shows when the forearm turns out from the body
    disc = Image.new("L", (W * SS, H * SS), 0)
    r = 62
    ImageDraw.Draw(disc).ellipse([(elbow[0] - r) * SS, (elbow[1] - r) * SS, (elbow[0] + r) * SS, (elbow[1] + r) * SS], fill=255)
    disc_a = np.array(disc.resize((W, H), Image.LANCZOS)).astype(np.float32) / 255
    arm_mask = np.where(ys > elbow[1], np.minimum(arm_mask, disc_a), arm_mask)
    arm = up.copy()
    arm[..., 3] *= arm_mask

    def save(name: str, img: np.ndarray, anchor: tuple[int, int]) -> None:
        ys_, xs_ = np.where(img[..., 3] > 0.004)
        x0, x1, y0, y1 = xs_.min(), xs_.max() + 1, ys_.min(), ys_.max() + 1
        out = Image.fromarray((np.clip(img[y0:y1, x0:x1], 0, 1) * 255).astype(np.uint8), "RGBA")
        sharp = out.resize((out.width // 2, out.height // 2), Image.LANCZOS)
        sharp.save(OUT / f"{name}.png", optimize=True)
        # the soft one: padded by SOFT_PAD on every side (so the blur is not cut), a quarter size
        padded = Image.new("RGBA", (sharp.width + 2 * SOFT_PAD, sharp.height + 2 * SOFT_PAD), (0, 0, 0, 0))
        padded.paste(sharp, (SOFT_PAD, SOFT_PAD))
        soft = padded.resize((padded.width // 4, padded.height // 4), Image.LANCZOS).filter(ImageFilter.GaussianBlur(9))
        soft.save(OUT / f"{name}_soft.png", optimize=True)
        print(f"{name}: {sharp.size} at half scale; anchor in the piece at 916-scale ({anchor[0] - x0}, {anchor[1] - y0})")

    save("fig_head", head, (CX, neck_y))
    save("fig_body", body, (CX, neck_y))
    save("fig_arm", arm, elbow)
    print("hand centre from the elbow:", 790 - elbow[0], 430 - elbow[1], "length", round(math.hypot(790 - elbow[0], 430 - elbow[1])))


if __name__ == "__main__":
    main()
