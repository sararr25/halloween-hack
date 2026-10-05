#!/usr/bin/env python3
"""Writes app/opengraph-image.png (1200 x 630): the link preview in chats and DMs (round 8 B2).
Same case-file language as the pass-it-on DM (rive/casefile): mono, black, one neon.
The case number is redacted: one image serves every link, and the number moves along the chain
(lib/story/caseno.ts), so the game says it, not the preview.
Run: python3 scripts/make-og.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "rive" / "casefile" / "JetBrainsMono.ttf"
ITAL = ROOT / "rive" / "casefile" / "JetBrainsMono-Italic.ttf"
W, H = 1200, 630
BG, TEXT, MUTED, NEON = (5, 7, 12), (230, 232, 238), (138, 145, 161), (0, 240, 255)


def font(path, size):
    return ImageFont.truetype(str(path), size)


img = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(img)
x0 = 110
head = font(FONT, 64)
d.text((x0, 110), "CASE ", font=head, fill=TEXT)
# a redaction bar where the digits would be
bx = x0 + d.textlength("CASE ", font=head)
l, t, r, b = d.textbbox((bx, 110), "0420", font=head)
d.rectangle((l - 4, t - 6, r + 4, b + 6), fill=TEXT)
d.text((W - 110, 132), "RECOVERY/4", font=font(FONT, 22), fill=MUTED, anchor="ra")
d.rectangle((x0, 205, W - 110, 207), fill=(80, 84, 92))
rows = [("missing", "E.V. · 7 days"), ("status", "open"), ("operator", "unassigned")]
for i, (label, value) in enumerate(rows):
    y = 245 + i * 52
    d.text((x0, y), label, font=font(FONT, 30), fill=MUTED)
    d.text((x0 + 300, y), value, font=font(FONT, 30), fill=NEON if label == "operator" else TEXT)
d.text((x0, 450), "look carefully.", font=font(ITAL, 56), fill=TEXT)

# the stamp, with a soft neon glow under it
stamp = Image.new("RGBA", (420, 130), (0, 0, 0, 0))
s = ImageDraw.Draw(stamp)
s.rounded_rectangle((20, 20, 400, 110), radius=10, outline=NEON + (255,), width=5)
s.text((210, 66), "WATCHED", font=font(FONT, 48), fill=NEON + (255,), anchor="mm")
glow = stamp.filter(ImageFilter.GaussianBlur(12))
stamp = Image.alpha_composite(glow, stamp).rotate(9, expand=True, resample=Image.BICUBIC)
img.paste(stamp, (W - 110 - stamp.width + 20, 400), stamp)

out = ROOT / "app" / "opengraph-image.png"
img.save(out, optimize=True)
(ROOT / "app" / "opengraph-image.alt.txt").write_text("Case number redacted. E.V., missing for 7 days. Status open, operator unassigned. Look carefully.")
print(f"wrote {out}")
