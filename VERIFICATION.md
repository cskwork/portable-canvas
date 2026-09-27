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
