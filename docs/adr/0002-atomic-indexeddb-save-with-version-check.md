# 0002. Atomic IndexedDB save with optimistic version check and LRU retention

Status: Accepted (implemented in commit 5ac6169, 2026-09-27)

## Context

Drawings are saved automatically and often, from several triggers (debounce, interval, page hide). The same page
can be open in two windows. Storage must stay within a user-set budget of pages and bytes, and a failed save must
never lose other pages or the user's in-memory work.

## Decision

`DrawingStore.save` in `src/storage.js` does everything inside one `readwrite` transaction over `drawings` and
`meta`:

1. Read the stored `version`. If it differs from the version this window loaded, abort with "Another window changed
   this drawing".
2. Read all `meta` rows and call `retentionPlan` (`src/model.js`). It throws if the active drawing alone exceeds the
   byte budget. Otherwise it returns the least recently accessed other pages to delete until both limits fit.
3. Delete those pages, then write the drawing and its metadata with `version + 1`.

Metadata lives in its own store so `recents()` never loads stroke arrays. In the widget, saves are serialized through a
promise queue, and each save records the `revision` it captured.

## Consequences

- An eviction and its write commit together or not at all. `tests/storage.test.js` checks that an oversized save
  leaves other pages in place.
- Two windows cannot silently overwrite each other. The losing window keeps its strokes in memory and asks the user
  to export.
- A page evicted by another window also appears as a conflict to a window that still has it open.
- `load` uses a `readwrite` transaction to update `accessed`, so opening a page counts as use for LRU.

## Alternatives considered

- `localStorage`: synchronous and limited to a few MB of strings. Used only for small settings.
- Last-writer-wins without versions: simpler, but loses work across windows.
- Separate eviction pass after saving: could leave the store over budget, or delete pages for a save that then fails.
