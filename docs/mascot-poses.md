# TruCost mascot: extra poses

The app swaps the mascot image to match what is happening. Only the idle pose exists today. Add any of the four files below next to `index.html` and the build picks them up. A missing file simply falls back to the idle pose.

| File | When it shows |
|---|---|
| `mascot-thinking.webp` | While the generator is computing |
| `mascot-shrug.webp` | A dial is missing (error) |
| `mascot-cheer.webp` | Result under 8 hours of life (cheap) |
| `mascot-shock.webp` | Result of 160 hours or more (about 20 working days) |

## Base character prompt (use with the existing image as the reference)

A retro cartoon robot cat mascot. Silver riveted metal body with brass trim, orange ears, flying goggles with green lenses, green LED-pixel eyes, a segmented tail with cyan bands, and a small amber light on the chest. Thick black outlines, flat cel shading, warm 1930s-meets-arcade look. The cat leans over a brushed-steel control panel with dials marked COST, HOURS and CALCULATE, and a small green CRT screen beside it. Transparent background. Same canvas ratio as the reference (about 1312 x 1199). Keep the character, panel, outline weight and colours identical to the reference; change only the pose and expression.

## Pose lines (add to the base prompt)

- **Thinking:** one paw on its chin, eyes looking up and to the side, the screen showing three dots. Small gears or a question mark above the head.
- **Shrug:** both paws out, shoulders up, eyes as flat dashes, screen showing "?". A small "Oi!" speech burst is optional.
- **Cheer:** both paws in the air, big smiling LED eyes, ears perked, a few sparkles. Screen showing a tick.
- **Shock:** paws on cheeks, LED eyes as wide circles, ears flat, goggles pushed up. Screen showing a big hours figure with an exclamation mark.

## Tips

- Use image-to-image or "edit with reference" in your tool so the character stays the same across poses.
- Export PNG with a transparent background. Upload the files in chat and they can be cleaned, cropped to the same frame and compressed to WebP.
- Keep the panel and screen in the same position in every pose so the swap looks like one character moving, not four different pictures.
