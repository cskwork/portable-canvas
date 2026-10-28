# 0001. Viewport-sized canvases with a per-stroke mask

Status: Accepted (implemented in commit c3ab392, 2026-09-27)

## Context

Marks must follow host-page scrolling, and pages can be very tall. A canvas the size of the whole document would use
memory proportional to page height times the square of the device pixel ratio. Version 2 also added translucent tools
(highlighter at 35% opacity by default). If each segment is stroked with `globalAlpha`, the stroke darkens wherever
segments overlap, at joints and self-crossings.

## Decision

`src/widget.js` keeps three canvases sized to the viewport, with the device pixel ratio capped at 2:

- `committed` holds finished strokes.
- `mask` holds the stroke being drawn, opaque.
- The visible canvas shows `committed` plus the mask composited once (`present`, `composite`).

Strokes are stored in document coordinates. The context transform subtracts `scrollX/scrollY`, and `render()`
replays history on scroll or resize. Replayed modern strokes are composited only within their clipped bounds.

## Consequences

- Bitmap memory depends on the viewport, not the page length.
- Opacity is uniform within a stroke. VERIFICATION.md records alpha 89 both along a 35% highlighter line and at its
  self-crossing.
- Scrolling replays all strokes of the page (one animation frame at most per scroll burst). Cost grows with stroke
  count, which the 20,000-stroke and 1,000,000-point caps bound.
- Strokes without `brushVersion` or `opacity` are still drawn straight into `committed`, so old drawings look the same.

## Alternatives considered

- A document-sized canvas: no replay on scroll, but unbounded memory. Not chosen; the README states that bitmaps
  are viewport-sized.
- `globalAlpha` per segment: simpler, but double-darkens overlaps. Replaced in c3ab392.
