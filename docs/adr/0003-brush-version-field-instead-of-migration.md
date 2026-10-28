# 0003. Version strokes with `brushVersion` instead of migrating stored data

Status: Accepted (implemented in commit c3ab392, 2026-09-27)

## Context

The first release rendered all strokes with a pressure-scaled width, `width × (0.35 + 0.65 × pressure)`, and saved
backups as format version 1. The toolbar update added per-tool brushes. The pen and highlighter now draw at a constant
width, the fountain pen scales with a sensitivity setting, and there is an opacity field. Existing IndexedDB drawings
and exported backups had to keep looking the same.

## Decision

New strokes carry `brushVersion: 2` and optional `opacity` and `sensitivity`. `strokeWidth` in `src/model.js` branches
on `brushVersion`, and `render` in `src/widget.js` keeps the original drawing path for strokes without these
fields. `validateDrawing` accepts both shapes. It rejects any `brushVersion` other than 2, and any `opacity` or
`sensitivity` outside 0 to 1. The backup format stays version 1, and the IndexedDB schema version stays 1.

## Consequences

- No migration code and no rewrite of stored data. `tests/model.test.js` checks that legacy strokes keep their exact
  widths, and that modern strokes round-trip through validation.
- Two rendering paths have to be maintained in `render`.
- A future brush change can add `brushVersion: 3` the same way. Older builds will then reject those backups, which
  is the intended failure mode.

## Alternatives considered

- Bump the IndexedDB version and rewrite every stroke in `onupgradeneeded`: risky with multiple open tabs (a blocked
  upgrade rejects), and it would change how old drawings look.
- Bump the backup format to version 2: would make new exports unreadable by older builds without adding information.
