# Portable Canvas

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users and purpose

People drawing notes over a web page with Apple Pencil, an Android stylus, fingers, or a mouse. A pen icon switches drawing on and restores the page's saved marks.

## Agreed scope

Embeddable drawing widget plus standalone demo. Local IndexedDB storage, compact stroke data, autosave after drawing and periodic checkpoints, visible save status, undo/redo, eraser, color and width, optional pen-only input, export/import. Configurable retention defaults to 50 recently used pages and 50 MB, evicting least recently used saved drawings. Only the active page's strokes are loaded in memory.

An iframe workspace supports sites that allow embedding. Cross-origin drawings are viewport overlays, not content-anchored annotations, and internal navigation cannot be tracked reliably. No extension, proxy, cloud account, or hosted deployment is included. Delivery is a new private cskwork/portable-canvas GitHub repository with verified commit and push.

## Stack

Implementation choice: plain JavaScript modules, HTML and CSS to keep the embeddable runtime independent of frameworks. The user approved the scope and asked to complete without further routine check-ins.

## Success checks

Browser checks cover input, restoration after reload, page isolation, retention, backups and storage failure. Physical stylus quality is unverified until tested on iPad and Android hardware.

## Principles

Keep drawing responsive. Report failed saves explicitly. Preserve unsaved work during failures. Local browser storage is not a permanent backup.

## Reading experience reference

The user likes the simple drawing icon and tool variety in Millie's reading app. Apply that general principle with an original interface: one pen button at rest, with color, four widths, eraser, undo and redo available while drawing. Keep errors and unsaved status visible, and hide the routine saved message when drawing is off.
