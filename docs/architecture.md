# Architecture

Portable Canvas is a set of plain ES modules with no runtime dependencies. The widget is a custom element
(`<portable-canvas>`) with an open Shadow DOM root, fixed over the viewport (`z-index: 2147483000`).

## Components

| Path | Role |
| --- | --- |
| `src/widget.js` | `PortableCanvas` class and `mount()`: toolbar events, pointer input, rendering, undo/redo, save queue, import/export, lifecycle. |
| `src/model.js` | Pure logic: `pageKey`, `safeAddress`, `bytes`, `validateDrawing`, `retentionPlan`, `validatedSettings`, `toolSettings`, `strokeWidth`. |
| `src/storage.js` | `DrawingStore`: IndexedDB database `portable-canvas-v1` with `drawings` and `meta` object stores. |
| `src/ui.js` | Shadow DOM markup, icons, palette and tool labels. |
| `app.js` + `demo.html` | Demo shell: reading/blank/website pages, recent pages, import/export, clear, retention settings. |
| `index.html`, `landing.css`, `landing.js` | Static landing page. |
| `scripts/build.mjs` | Copies an explicit list of public assets into `dist/` (Vercel output, see `vercel.json`). |
| `scripts/browser-check.mjs`, `scripts/pen-ui-check.mjs` | Real-browser regressions driven through the `ego-browser` CLI (`npm run test:browser`). |

## Data model

A drawing is an array of strokes:
`{ tool, color, width, points: [[x, y, pressure], ...], opacity?, sensitivity?, brushVersion? }`.
`x`/`y` are rounded to 0.1 CSS px. In `document` mode they include `scrollX/scrollY`. In `viewport` mode (used for
website frames) they do not. Pressure is `PointerEvent.pressure` rounded to 0.01, or 0.5 when the device reports 0.

IndexedDB records:
- `drawings`: `{ key, strokes, version }`
- `meta`: `{ key, bytes, accessed, version }`. This lets `recents()` list pages without loading strokes.

Settings (color, width, input mode, `maxPages`, `maxBytes`, per-tool brush settings) live in `localStorage` under
`portable-canvas-settings` and pass through `validatedSettings`/`toolSettings` on read.

## Input flow (`src/widget.js`)

1. `toggle(true)` sets the canvas to `pointer-events: auto` and `touch-action: none`. The host page stops
   scrolling under the pen until drawing mode is turned off.
2. `down`: drawing starts only when the page is not loading, no other pointer is active, drawing is on, the button
   is primary (`button === 0`), and, in *Pen only* mode, `pointerType === "pen"`. The canvas then calls
   `setPointerCapture`, pushes the new stroke, clears the redo stack and draws a dot into the mask.
3. `move`: it reads `getCoalescedEvents()` when available and drops points closer than 0.4 px. It also enforces the
   1,000,000-point limit and queues segments. One `requestAnimationFrame` draws the queued segments into the mask
   and presents.
4. `up`, `pointercancel` and `lostpointercapture` call `finish`. That composites the mask into the committed
   canvas and schedules a save.

There is no palm-rejection heuristic. The single-active-pointer guard and *Pen only* mode are the only filters.

## Rendering

- Three canvases sized to `innerWidth × innerHeight × min(devicePixelRatio, 2)`: the visible canvas, `committed`
  (finished strokes) and `mask` (one stroke at a time).
- `present()` clears the visible canvas, draws `committed`, then composites the active stroke's mask.
- `composite()` uses `globalAlpha = opacity` for ink and `destination-out` for the eraser. Opacity is applied once per
  stroke.
- `render()` replays every stroke into `committed`. It runs on resize, on scroll (throttled to one animation frame),
  load, undo/redo, clear and import. Modern strokes are drawn into the mask and composited only within their clipped
  bounding box. Strokes off screen are skipped. Legacy strokes (no `brushVersion`, no `opacity`) are drawn
  directly, as before.
- Width: `strokeWidth()`. Legacy strokes use `width × (0.35 + 0.65 × pressure)`. Version-2 pen and highlighter use
  constant width. The fountain pen uses `width × (1 − sensitivity × (1 − pressure) × 0.9)`.

## Persistence and undo

- Each edit increments `revision`. A save records the revision it captured, so edits made during a write keep the
  page dirty and the next queued save writes them.
- Saves are serialized through a promise chain (`this.queue`). Triggers: 400 ms after `changed()`, a 5 s interval
  while dirty, `visibilitychange` to hidden, `pagehide`, the Save button, and before `setPage`/`destroy`.
- `DrawingStore.save` runs one `readwrite` transaction. It reads the current version and aborts with a conflict
  error on mismatch, computes `retentionPlan` over all `meta` rows, deletes evicted pages, and writes both records.
  Any error aborts the whole transaction, so nothing is half written.
- Undo pops the last stroke onto a redo stack. Redo pushes it back. A new stroke, clear or import empties the redo
  stack. History is not persisted.

## Failure handling

- Save failure (quota, conflict, oversized) leaves the in-memory strokes and dirty state intact and shows
  `Not saved: … Export your work before leaving.`. `setPage` and `destroy` return `false` and do not switch or
  unmount.
- A load failure keeps the previous key and strokes, and `ready` resolves `false`.
- Import runs `validateDrawing` on everything before replacing the active drawing. That covers format/version, tools,
  colors, numeric ranges, the 20,000-stroke and 1,000,000-point limits, and 50 MB.
- An IndexedDB `versionchange` closes the connection, and the next operation reopens it. A blocked upgrade rejects with
  "Close other tabs".
- `safeAddress` rejects non-HTTP(S) and credential-bearing URLs before they reach the sandboxed iframe.

## External dependencies

- Runtime: none. The code uses browser APIs only (Canvas 2D, Pointer Events, IndexedDB, Shadow DOM, localStorage).
- Development: `fake-indexeddb` for Node tests. The browser suite needs the `ego-browser` CLI.
- Hosting: Vercel runs `npm run build` and serves `dist/` (`vercel.json`).
