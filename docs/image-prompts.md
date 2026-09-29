# Image prompts

Prompts for an AI image generator: every photo and graphic the desktop needs. All generated and wired (2026-09-29). IMG_0418 has no prompt: it is built from IMG_0413 (`scripts/make-photo-plates.py`); if IMG_0413 is regenerated, rerun the script and re-measure its boxes.

## How to use them

1. Paste the **style block** at the start of every prompt, then the photo's prompt.
2. Paste the **negative prompt** where the tool has a field for it. If it has none, add "Avoid: …" with the same list at the end.
3. Generate the **Harrow Street** photos (0401, 0404, 0407, 0413, 0417, 0419) with the same seed or the same reference image. It has to be the same street every time.
4. **E.V.'s face never appears in full**: hidden, from behind, cropped or out of focus. It's a story choice. Anyone could be E.V., the user included.
5. Save them with the exact names below. Tell me when they're in and I'll wire them up.

| Type | Size | Folder |
|---|---|---|
| Photos | 1500 × 1000 (3:2), JPG | `public/photos/` |
| Wallpaper | 2560 × 1440 (16:9), JPG | `public/wallpaper/` |
| Polaroid | 1000 × 1000 (1:1), JPG | `public/photos/` |

### Style block (always)

```
35mm film photograph, shot on Kodak Portra 800 pushed one stop, visible film grain, slightly soft focus, natural available light only, cool blue-grey palette with bone-white highlights, muted desaturated colours, candid and unposed, realistic, London, late autumn, 2020s
```

### Negative prompt (always)

```
text, letters, readable signs, watermark, logo, signature, frame, border, oversaturated, HDR, illustration, painting, 3d render, cartoon, anime, CGI look, orange tint, red tint, warm golden hour, halloween, pumpkins, gore, blood, horror makeup, face looking at camera, sharp detailed face of the main woman
```

## The hidden details

Some photos hide something you only find by looking closely. Keep it small and in the background: you should notice it on the second look, never the first.

| Detail | Where |
|---|---|
| **The Sign**: a small circle with a dot inside, on top of a vertical line with a crossbar and two short legs (like an eye that is also a standing figure). If the tool can't draw it, leave it out and I'll add it in post | 0390 (painted on a chimney), 0407 (scratched into the wall) |
| **The figure on the street**: a person standing still, out of focus, looking up | 0413, 0419 |
| **The other presence**: a second reflection or silhouette where nobody should be | 0397, 0411 |

## Wallpaper (the "perfect life")

**`public/wallpaper/ev-home.jpg`**

```
wide photograph of a young woman seen from behind, sitting on a deep windowsill in a small cosy London flat at night, knees up, wrapped in a grey wool blanket, a ceramic mug beside her, a soft neutral reading lamp inside, looking out through a large sash window at out-of-focus city lights and the dark facade of the terraced house across the street, calm, safe, content, the life she wanted, lots of empty space on the right side of the frame
```

**`public/wallpaper/ev-home-3.jpg`**: the same image with one change. Use inpainting on the first one, don't generate it from scratch.

```
same image; in the house across the street one window on the second floor is now lit with cold white light, and a dark human silhouette stands in it, facing the woman, perfectly still
```

## Photos

### IMG_0371 · kitchen, morning light

```
small tidy London flat kitchen in soft grey morning light, steam rising from a single mug on the counter, thin white curtains moving slightly, a few houseplants on the windowsill, a film camera left on the table, quiet and ordinary
```

### IMG_0374 · Mara, laughing at something I said

```
woman in her early thirties with curly dark hair laughing hard, caught mid-laugh and turning her face away from the camera, in a dim old London pub, pint glasses on the table, background soft and dark, warmth between two friends
```

### IMG_0380 · Theo's dog, refusing the bath

```
scruffy grey lurcher dog standing in a white bathtub looking deeply offended, wet fur, tiled bathroom, direct on-camera flash, a man's hand holding the shower head at the edge of the frame
```

### IMG_0385 · flowers, Saturday market

```
buckets of white and pale blue flowers at a Saturday street market, overcast sky, wet cobbles, a vendor's hands wrapping a bunch in brown paper, shallow depth of field
```

### IMG_0390 · rooftop, Mara, two fingers up

This is the photo that suggests the gesture for backup_you, so the V sign must be clear.

```
woman on a London rooftop at dusk holding up two fingers in a clear V sign toward the camera, her hand and wind-blown hair hiding most of her face, chimneys and television aerials around her, city skyline in blue haze behind, small strange symbol painted in white on the side of a distant chimney
```

### IMG_0392 · my desk, finally tidy

```
tidy wooden desk seen from above at an angle, a closed laptop with a small piece of black tape over its webcam, a stack of photographic contact sheets, a loupe, a mug, a small plant, a blank sticky note, calm daylight
```

### IMG_0397 · bus window, rain

```
view through a rain-streaked London bus window at night, blurred city lights and headlights, the faint reflection of a woman in the glass looking out, and behind her reflection, barely visible, a second shape standing too close, as if someone is behind her on the bus
```

### IMG_0401 · Harrow St, dusk (1/12)

```
quiet London street of Victorian terraced houses at blue hour, photographed from a first-floor window straight across the street, wet pavement, streetlamps just turning on, two parked cars, symmetrical composition, all windows across the street dark, no people
```

### IMG_0404 · Harrow St (2/12)

```
the same terraced street later at night from the same first-floor window, same composition, rain has stopped, one window on the second floor of the house across is lit with cold white light, no people
```

### IMG_0407 · Harrow St (3/12)

```
the same terraced street at night from the same window, a grey cat sitting on the low brick front wall across the street, looking up toward the camera, a small strange symbol scratched into the brickwork beside the cat, all windows dark
```

### IMG_0411 · self-portrait, hallway mirror

```
self-portrait of a woman in a narrow hallway mirror, holding a film camera up in front of her face so the camera completely hides it, direct flash bouncing in the mirror, coats on hooks; in the mirror behind her the front door at the end of the hallway is slightly open onto darkness
```

### IMG_0413 · Harrow St (4/12)

```
the same terraced street late at night from the same first-floor window, empty and wet, a single person standing perfectly still under the streetlamp on the far pavement, out of focus, face lifted toward the camera, too far to see who it is
```

### IMG_0416 · cat on the wall, no. 14

```
grey tabby cat sitting on a low brick wall next to a house number 14 plaque, night, direct on-camera flash, the cat's eyes reflecting the flash, dark garden behind
```

### IMG_0417 · window across (5/12)

```
the facade of the Victorian terraced house across the street at night, photographed from a first-floor window, long lens, every window dark except one on the second floor lit with cold white light, blinds half down, nobody visible, stillness
```

### IMG_0419 · source: unknown device

This one appears on its own at stage 2. It's taken from the other side of the street: whoever was watching E.V.

```
photograph taken from across the street at night looking up at a first-floor window of a Victorian terraced house, long telephoto lens compression, slight motion blur, through a dirty pane of glass; in the lit window a woman stands with her back half turned, holding a camera pointed out at the street; surveillance photo, cold, voyeuristic, the photographer is hidden
```

## Polaroid on the desktop

**`public/photos/polaroid.jpg`** (square, the picture area only: I draw the white border and the handwriting myself)

```
square instant photo, the dark facade of a terraced house across the street at night, one lit window on the second floor with cold white light, harsh flash falloff in the foreground, faded instant-film colours, slight colour shift toward blue, dust
```

## Not needed from the generator

- **IMG_0418**: IMG_0413 with its figure lifted out as a cut-out (`scripts/make-photo-plates.py`), composed in Rive (`rive/photo`).
- **The Sign, the cracked glass, the camera lens, the silhouette in the boot**: drawn in code (SVG / Rive).
- **Chat avatars**: I use initials, so no faces.
