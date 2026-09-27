# Embedding API

`mount(options)` returns a `PortableCanvas` instance.

Options: `target` (default `document.body`), `key` (default current URL without hash), `mode` (`document` default or `viewport`), `store` (a `DrawingStore` instance), and `onStatus(text)`.

Use a stable page key chosen by the host. Query strings are included by default; fragments are excluded. SPAs must explicitly call and await `setPage(nextKey)` before replacing page content. Internal navigation is not monitored automatically. Independent widgets share storage by default and use optimistic version checks; use a custom database name for separate collections.

- `ready`: resolves true when loading succeeds, false on storage failure. A visible failure allows export of any work kept in memory.
- `toggle(enabled?)`: enable or disable drawing. Drawing mode captures primary pointer input, including touch; disable it to interact with the underlying page.
- `setPage(key)`: resolves true after saving and loading the next page, false if blocked. Do not navigate the host on false. Do not call during initial loading; await `ready` first.
- `save()`: queued save, resolves boolean. Failures remain visible and retain in-memory strokes.
- `undo()`, `redo()`: active-page history; history is not persisted.
- `clear()`: clear active drawing and schedule saving. Host should confirm destructive intent first.
- `export()`: return a JSON-compatible single-drawing backup.
- `import(data)`: validate and replace the active drawing, then save; resolves boolean. Host should confirm replacement and offer export first.
- `setRetention(maxPages, maxBytes)`: update settings. New limits apply to the next changed save.
- `destroy()`: finish and save, then remove listeners, timers and widget. Resolves false and leaves the widget available if save fails. Host must preserve the page or offer export when false.

`new DrawingStore(databaseName)` supports `load(key)`, `recents()`, `save(key, strokes, expectedVersion, settings)`, and `close()`. Store writes are atomic and versions must match. Raw storage records are implementation details; use backup format version 1 for interchange.
