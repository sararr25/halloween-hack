#!/usr/bin/env python3
"""Builds the images of IMG_0418 (rive/photo) from public/photos/IMG_0413.jpg.

- plate_sharp.jpg / plate_soft.jpg: the street without the figure. The figure is painted
  out with the brick wall just to its right (same rows, feathered edges).
- figure_sharp.png / figure_soft.png: the figure as a cut-out, with a hand-drawn mask
  (head, hair, coat, boots, reflection). lens.luau places it at x 880 or 259 px left.
- public/photos/IMG_0418.jpg: the grid thumbnail.

Needs Pillow + numpy. Run from the repo root, then `pnpm rive:publish` (Mac).
If IMG_0413 is regenerated, the boxes below have to be measured again.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = "public/photos/IMG_0413.jpg"
src_img = Image.open(SRC).convert("RGB")
src = np.asarray(src_img).astype(float)

# 1. the street without the figure
x0, x1, y0, y1 = 882, 936, 668, 884
SHIFT = 48  # clean wall to the right of the figure
clean = src.copy()
m = np.ones((y1 - y0, x1 - x0))
for i in range(6):
    w = (i + 1) / 7
    m[:, i] *= w; m[:, -1 - i] *= w; m[i, :] *= w; m[-1 - i, :] *= w
clean[y0:y1, x0:x1] = src[y0:y1, x0 + SHIFT:x1 + SHIFT] * m[..., None] + src[y0:y1, x0:x1] * (1 - m[..., None])
plate = Image.fromarray(clean.astype(np.uint8))
plate.save("rive/photo/plate_sharp.jpg", quality=86)
ImageEnhance.Brightness(plate.filter(ImageFilter.GaussianBlur(3.2))).enhance(0.9).save("rive/photo/plate_soft.jpg", quality=84)

# 2. the figure as a cut-out
fx0, fy0, fx1, fy1 = 880, 668, 940, 884
w, h, S = fx1 - fx0, fy1 - fy0, 4
mask = Image.new("L", (w * S, h * S), 0)
d = ImageDraw.Draw(mask)
P = lambda x, y: ((x - fx0) * S, (y - fy0) * S)
d.ellipse([P(909 - 8.5, 689 - 10.5), P(909 + 8.5, 689 + 10.5)], fill=255)  # head
for pts in [
    [(900, 684), (918, 684), (923, 712), (895, 712)],  # hair
    [(893, 711), (925, 711), (930, 722), (931, 790), (887, 790), (888, 722)],  # coat
    [(897, 788), (908, 788), (907, 824), (898, 824)],  # left leg
    [(910, 788), (921, 788), (921, 824), (911, 824)],  # right leg
]:
    d.polygon([P(x, y) for x, y in pts], fill=255)
for i, y in enumerate(range(826, 880)):  # reflection on the wet pavement
    d.line([P(894, y), P(925, y)], fill=int(150 * (1 - i / 54) ** 1.5), width=S)
mask = mask.resize((w, h), Image.LANCZOS).filter(ImageFilter.GaussianBlur(0.7))
alpha = np.asarray(mask).astype(float) / 255 * 0.94
rgb = np.asarray(src_img.crop((fx0, fy0, fx1, fy1))).astype(float)
sprite = Image.fromarray(np.dstack([rgb, alpha * 255]).astype(np.uint8), "RGBA")
sprite.save("rive/photo/figure_sharp.png")
sprite.filter(ImageFilter.GaussianBlur(2.6)).save("rive/photo/figure_soft.png")

# 3. the grid thumbnail
ImageEnhance.Brightness(src_img.filter(ImageFilter.GaussianBlur(3.2))).enhance(0.9).resize((768, 512)).save(
    "public/photos/IMG_0418.jpg", quality=84
)
print("done: rive/photo/plate_*.jpg, figure_*.png, public/photos/IMG_0418.jpg")
