# Portable Canvas

A small, dependency-free drawing layer for pages you control, plus a local demo. Draw with Apple Pencil, an Android stylus, a finger, or a mouse. All pointer types are enabled by default; Pen only is optional.

## Run

```sh
npm ci
npm test
npm start
```

Requires Node.js 22+ and Python 3 for the development server. Open http://localhost:4173. No build step or runtime dependencies. `fake-indexeddb` is used only in Node tests. Serve over HTTP or HTTPS; opening the HTML directly as a file will not load ES modules reliably.

## Embed

```js
import { mount } from "./src/widget.js";
const canvas = mount({ key: "article:stable-id" });
await canvas.ready;
```

The floating pen and toolbar use Shadow DOM. The canvas occupies the viewport while strokes use document coordinates, so ink follows host-page scrolling. Keep the widget outside transformed or contained ancestors. Dynamic reflow, changing text, nested scrolling containers, browser zoom and responsive layout can shift the underlying content; these are geometric marks, not text annotations.

See [API.md](API.md) and [examples/embed.html](examples/embed.html).

## Local saving

IndexedDB stores strokes and separate small metadata records. Recent-page listings do not load all drawings. Save runs about 400 ms after a stroke and every five seconds while dirty, including partial strokes. “Saved locally” appears only after the transaction completes. Lifecycle saving is best effort: a closed tab or terminated browser cannot guarantee a final save.

Default retention is 50 pages and 50 MB of serialized stroke data, evicting least recently accessed saved pages. Browser database overhead is additional. An oversized active drawing fails without evicting other pages. Export it or increase the budget. A page switch waits for saving and stops on failure. Concurrent writers detect a version conflict instead of overwriting another window silently. Export your unsaved work before reloading to resolve a conflict.

Drawings are bounded to 20,000 strokes and 1,000,000 points per page. The canvas backing bitmap is viewport-sized with device pixel ratio capped at 2. Segments are batched through animation frames. Rendering after a scroll redraws the active drawing only.

Exports contain one drawing. Import validates all records before replacing the active drawing; the demo asks before replacement. Clear saves an empty active drawing and does not remove other pages. Browser storage can be cleared or evicted: keep exports for important work.

## Website frame limitations

The demo accepts only HTTP(S) addresses without credentials and uses a sandboxed iframe. Websites may refuse embedding or require capabilities not granted by the sandbox. External website ink is a **viewport overlay**; it is not attached to content, and navigation inside the iframe cannot be tracked reliably. Open original is always available. This is not a browser extension, proxy, or tool that can inject into arbitrary sites.

## Verification

`npm test` exercises storage round-trips, conflict protection, metadata separation, atomic retention, oversized-save preservation, backup validation and URL restrictions. Browser and physical-device findings are recorded in VERIFICATION.md. Synthetic pointer tests cannot establish real Pencil latency, Android stylus quality or device palm rejection.

## Quiet reading controls

The user's Millie reading-app reference informed the general principle: keep a simple pen button at rest and reveal a useful range of tools when drawing. This is an original interface, not a reproduction of that app. Saved status stays hidden while drawing is off; unsaved work and errors remain visible. Escape exits drawing unless focus is in a text field or another editable control.

Local storage belongs to the browser and website origin. Different devices, browser profiles, ports, or hosts do not share drawings.

For repeatable real-browser checks, install Ego Lite / `ego-browser`, run `npm start`, then `npm run test:browser`. The harness uses its own drawing database and writes results to `evidence/browser-checks.json`. Node tests do not require a browser.
