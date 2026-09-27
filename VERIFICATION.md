# Verification

Verified on 2026-09-27 with Node.js 22 and Ego Lite Chromium on macOS.

## Repeatable checks

- `npm run check`: application syntax check passed.
- `npm test`: 12 passing tests. Covers atomic IndexedDB storage rules with fake-indexeddb, access/count/byte retention, oversized drawing preservation, stale-writer protection, malformed backups/settings, queued saves with mid-write edits, failed switches/loads, transition guards and partial-stroke dirty status.
- `npm run test:browser`: 13 passing browser checks using real IndexedDB in a separate test database. Covers browser-delivered pen pressure, finger touch, pen-only filtering, eraser/undo/redo, backup validation, injected quota failure and retry, least-recently-used retention and an actual competing writer. Receipt: `evidence/browser-checks.json`.
- The 20,000-point sample import, render and committed save took 65 ms in the recorded desktop run. This is one local measurement, not an iPad/Android latency guarantee.

## Additional browser checks

- Real mouse input produced visible ink, autosaved and restored the exact strokes after reload.
- Switching between reading and blank pages preserved page isolation and restored the saved drawing.
- The embedding example retained the same document coordinates while scrolling; ink moved with the content, while the bitmap stayed viewport-sized.
- The external `https://example.com/` iframe actually rendered. Unsafe URL input was rejected without changing the frame. Cross-origin restrictions remain clearly stated in the interface.
- Actual JSON download and file-input import preserved the drawing.
- Escape closed the drawing toolbar. Idle saved status was hidden; save errors remain visible.
- Desktop and 390 × 844 mobile screenshots were inspected. The mobile page has no horizontal overflow, the toolbar and toggle fit the viewport, and status does not overlap the header. Screenshots are in `evidence/`.
- Automated design inspection identified small text and contrast issues; those were corrected in a single pass. Paper colors and system fonts were retained as deliberate dependency-free choices.

Rendering checks compare exact stroke data plus a 0.1% raster-edge tolerance: repeated canvas readback can change GPU/CPU antialiasing by one edge pixel. Erasure must visibly reduce ink, and undo must restore the exact source strokes.

## Limits

Physical Apple Pencil and Android stylus latency, pressure behavior and palm rejection have not been tested. Synthetic inputs establish browser event handling, not hardware quality. Safari/WebKit was not exercised in this session. Coalesced pointer events have a fallback.

Cross-origin iframe marks are screen overlays and cannot reliably follow internal navigation or scrolling. Some websites forbid embedding. The host widget uses geometric document coordinates, not text anchors; layout changes can move content beneath existing marks.

Browser storage is origin/profile/device specific and can be cleared or evicted. Shutdown saves are best effort. Exports are the backup mechanism. No public site was deployed.

## Confirmed drawing-UI revision

The user confirmed the Millie-supplied UI screenshot published on 2024-12-18: https://www.donga.com/news/Economy/article/all/20241218/130672732/2 . The reference was inspected visually; the current Millie app was not operated. The implementation follows the shown white icon bar, yellow slider controls, per-tool panels and round palette. The third-party reference image is not distributed in this repository.

- Current Node suite: 17 passing tests, adding optional brush fields, legacy width behavior, isolated tool preferences and per-stroke compositing checks.
- Existing 13 browser regressions passed with the new toolbar. The new 9-case brush/UI suite passed: panel toggling, keyboard/range controls, per-tool reload persistence, real highlighter/eraser input, pressure sensitivity and styled-drawing restoration. `npm run test:browser` now runs both suites.
- A legacy pen/eraser drawing saved before the change was loaded afterward with identical stroke data and identical total raster alpha (4,056,529) at the captured viewport.
- A self-crossing 35% highlighter stroke produced alpha 89 both along the line and at its crossing, and restored the same value after reload.
- Pen sample widths were 40/40 device pixels at low/high pressure; a sensitive fountain sample produced 8/40, and sensitivity zero returned 40/40.
- The final 20,000-point styled sample import/render/save completed in 65 ms in the local run. This is a desktop observation, not a hardware latency guarantee.
- Desktop and 390px phone screenshots were inspected. At 390px the toolbar remained one 52px-high row. At 320px it scrolls internally; the close control remains pinned. The settings pane stays within a 390px-high landscape viewport and scrolls internally. No horizontal page overflow at any checked size.

Latest evidence: `evidence/pen-ui-checks.json`, `evidence/pen-ui-layouts.json`, `evidence/pen-ui-desktop.png`, and `evidence/pen-ui-mobile.png`.

## Landing and public delivery preparation

Landing UI/UX was delegated to `claude-opus-5-5` with `--effort medium`, as requested. The delegate produced the landing, its CSS/JS, favicon, product screenshots and design notes. The coordinator verified the generated files and confirmed `demo.html` is byte-identical to the former demo `index.html` at commit 21f8aa6.

Desktop and phone landing screenshots were inspected. All product screenshots loaded; 320px and390px viewports had no horizontal overflow. The primary CTA opened the working drawing demo. Copy-code success and permission-failure fallback were tested with controlled clipboard implementations. No third-party reference image, credentials or environment file is included in the static build. `npm run build` copies an explicit public-asset list into `dist/`.
