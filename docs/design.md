# Cove frontend design (Phase 4)

Concept: **a photographer's infinity cove**. A pale, softly lit studio wall that curves into the floor, one
car at a time sitting in a pool of soft shadow. The interface stays quiet so the cars carry the page.
Phase 4 draws the cars as SVG 2.5D illustrations (a flat side view with a floor shadow and a wheel
ellipse that hints at depth). No 3D libraries are installed.

## The one idea

The accent colour follows the paint of the car in focus. Choosing a paint swatch on a card re-tints that
card's price, focus ring and Buy button. Every accent passes through `pickAccent()`, which darkens the paint
until it reaches 4.5:1 against the surface it sits on, and falls back to Lacquer Blue if it cannot.

## Palette (named, light only)

| Name           | Hex       | Role                                                    |
| -------------- | --------- | ------------------------------------------------------- |
| Cove Wall      | `#EFEAE2` | Page background, the lit studio wall                    |
| Cove Floor     | `#E2DBD0` | Cards and panels, the floor the cars stand on           |
| Studio Ink     | `#1C2127` | Body text (13.5:1 on Cove Wall, 11.8:1 on Cove Floor)                     |
| Soft Graphite  | `#505862` | Secondary text (6.0:1 on Cove Wall, 5.2:1 on Cove Floor)                 |
| Shadow Line    | `#8F887C` | Decorative dividers only (2.9:1 on Cove Wall); input borders use Soft Graphite                |
| Lacquer Blue   | `#1D4ED8` | Default accent and the safe fallback for any paint (5.6:1 on Cove Wall, 4.9:1 on Cove Floor; white text on it is 6.7:1)      |

Status colours are always paired with text: Stock Green `#166534`, Low Amber `#92400E`, Sold Red `#B42318`
(all at least 4.8:1 on both surfaces; ratios computed with the WCAG formula, not estimated). Dark mode is cut for this deadline.

## Type roles

- Display: **Bricolage Grotesque**, 600 weight, for the logo, page titles and the car name. Self-hosted through `@fontsource` (SIL OFL).
- Body and UI: **Instrument Sans**, 400 and 600, for everything else. Self-hosted through `@fontsource` (SIL OFL).
- Scale (about 1.25 ratio): 0.875, 1, 1.25, 1.563, 1.953, 2.441 rem. Prices use tabular figures.

## Tokens

CSS variables on `:root`, exposed to Tailwind through `@theme`: colours above, `--accent`, `--accent-ink`
(text on an accent fill), two radii (`--radius-card` 18px for cars and panels, `--radius-control` 8px for
inputs and buttons), and a shadow that falls down and to the left, away from a key light at upper right.
Motion durations are 120ms (hover) and 220ms (dialogs); `prefers-reduced-motion` turns both off.

## Layout sketch

```
Showroom (>= 1024px)                                      Showroom (< 768px)
+----------------------------------------------------+    +--------------------+
| [logo] Cove     Showroom  My orders  Admin   Sign out|    | [logo] Cove   [=]  |
+----------------------------------------------------+    +--------------------+
| h1 Showroom                          12 cars found  |    | h1 Showroom        |
| [ search make or model ........ ] [Sort v]          |    | [search.........]  |
| (All)(Hatchback)(Sedan)(SUV)(Coupe)...              |    | (All)(Hatch)(SUV)> |
| Min Rs [____]  Max Rs [____]  [x] In stock only     |    | Min [__] Max [__]  |
+----------------------------------------------------+    | [x] In stock only  |
| +---------+ +---------+ +---------+                |    | +----------------+ |
| |  ___    | |  ___    | |  ___    |  cars sit on a |    | |   car on cove  | |
| | /car\   | | /car\   | | /car\   |  shadow ellipse | |   | Honda City     | |
| | ~~~~~~~ | | ~~~~~~~ | | ~~~~~~~ |                | |   | Rs 12,50,000   | |
| | Honda   | | ...     | | ...     |                | |   | (o)(o)(o) [Buy]| |
| | Rs 12.5L| |         | |         |                | |   +----------------+ |
| | (o)(o)  | |         | |         |                | |   ...              |
| | [Buy]   | |         | |         |                | |                    |
| +---------+ +---------+ +---------+                | +--------------------+
|                   < Previous   Page 1 of 3   Next >  |
+----------------------------------------------------+

Admin: summary tiles (vehicles, units, low stock, sold out), an inventory table
(cards under 768px) with Edit / Restock / Delete, an "Add to inventory" dialog, and the recent-events feed.
```

## Critique against the brief, and what changed

- First draft used a tracked all-caps eyebrow above each heading. Removed; headings stand alone.
- First draft used identical rounded cards. Cards now differ in what matters: the car is drawn directly on the cove floor with no inner frame, and only the information block sits in a panel.
- Silhouettes are distinct per body style (hatchback, sedan, SUV, coupe, convertible, truck, EV, sports) so a card is recognisable without reading it.
- The dual-handle price slider is replaced by two labelled number inputs in rupees. It is easier to make accessible in the time available and is honest about the trade-off.
- No fake urgency: "Low stock" appears only when `quantity <= 3`, computed from the real number.
- Footer says plainly that purchases are simulated inventory actions, not real sales.
