# Landing design notes

`index.html` is the product landing; the previous demo moved unchanged to `demo.html`. The brand link in the demo points to `./`, so it now returns to the landing.

## Direction

The landing keeps the demo's warm paper, dark ink and Georgia headings, and borrows the pen UI's one accent: the yellow selection marker. Yellow appears only where the product uses it — a highlighter mark behind the headline, the selected-tool marker, slider fills and the primary button's underline. Everything else is ink on paper.

Copy is Korean-first. Brand and technical identifiers (`mount`, `key`, IndexedDB, Shadow DOM, iframe) stay in their original form.

## Structure

1. Hero: headline, one hand-drawn SVG stroke, the primary CTA to `demo.html`, and the real demo screenshots (desktop plus phone) copied from `evidence/` into `assets/`.
2. Three-step flow: pen at rest, toolbar, settings panel. The small illustrations are rebuilt in HTML/CSS with the same original SVG icons as `src/ui.js`; they are decorative (`aria-hidden`) and described in text.
3. Tools: pen, fountain pen, highlighter, eraser, and pen-only input, next to the mobile screenshot.
4. Saving: 400 ms autosave, 5-second checkpoints, default 50 pages / 50 MB LRU, JSON export, and that browser storage is not a permanent backup.
5. Website frames: sandboxed iframe, many sites refuse embedding, viewport overlay rather than content-anchored ink, not an extension or proxy.
6. Embed: the actual `mount` snippet from README with a copy button. Clipboard failure selects the code and says so.
7. Unverified: real iPad/Android stylus feel.

## Deliberate omissions

No live widget on the landing, so the floating pen cannot compete with the CTAs and no demo storage key or global is touched. No users, testimonials, pricing, benchmarks or license claims (the repository has no license file). No external fonts, CDNs, analytics or forms.

## Accessibility

Skip link, 44px minimum targets, visible focus in the demo's rust colour (yellow on the dark embed section), `prefers-reduced-motion` disables the stroke animation and smooth scrolling, `word-break: keep-all` for Korean, and single-column layout below 900px with no horizontal overflow at 320px by design.
