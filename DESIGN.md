# Design direction

The demo remains a quiet reading desk with warm paper and editorial headings. Drawing controls follow the approved Millie screenshot: white surfaces, thin dark original SVG icons, restrained borders and shadow, yellow selection and slider accents, and a circular color palette.

One pen icon remains at rest. Drawing mode reveals a single toolbar row. A tool tap selects it and opens its settings above the toolbar; tapping the selected tool toggles that panel. The panel has a Korean tool title, close control, pixel width, opacity, circular colors and custom color input. Fountain pen adds pressure sensitivity; eraser shows width only. Pen-only input is in the panel. Closing the panel keeps drawing enabled; closing drawing returns to the single pen icon.

Controls have 44px tap targets and visible keyboard focus. At 390px the toolbar fits one row; at 320px it scrolls horizontally with the close control pinned at the right. The palette can scroll on the narrowest screens. The panel stays within the viewport and scrolls vertically in short landscape windows. Save failures remain visible in a live region. No external fonts or runtime dependencies are required.
