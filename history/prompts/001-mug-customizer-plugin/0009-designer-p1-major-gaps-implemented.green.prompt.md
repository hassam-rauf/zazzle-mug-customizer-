---
id: "0009"
title: Designer P1 Major Gaps — All Implemented
stage: green
date: 2026-04-27
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /sp.implement
labels: ["designer","canvas","text-controls","image-context-bar","dpi","layers","snap-guides","undo","localStorage","underline","letter-spacing","stroke","shadow","flip"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/templates/designer.php (expanded text context bar + new image context bar HTML)
  - mug-customizer/public/assets/js/canvas-editor.js (M2-M5 text controls, M7/M8 image bar, M9 DPI, M10 layers, M13 snap guides, M16 localStorage, M19 50-state undo, M18/P10 misc)
  - mug-customizer/public/assets/js/review.js (localStorage replace)
  - mug-customizer/public/assets/css/designer.css (context bar styles, slider labels, DPI badges, active states)
tests:
  - All 11 new HTML element IDs present in served designer page ✅
  - 35 P1 function references confirmed in synced canvas-editor.js ✅
  - ctx-underline, ctx-spacing, ctx-lineheight, ctx-stroke present ✅
  - img-context-bar, ctx-img-flip, ctx-img-opacity, ctx-img-layer present ✅
  - ctx-dpi, ctx-duplicate, ctx-layer-up present ✅
  - localStorage used in canvas-editor.js and review.js ✅
---

## Prompt

User: "ok" (proceed with P1 major gaps after P0 confirmed complete)

## Response snapshot

### M2 — Underline
`ctx-underline` button in context bar; toggles `obj.underline`; `ctx-active` class synced in `showContextBar()`.

### M3 — Letter-spacing + Line-height
`ctx-spacing` range (−200→800, step 10) → `charSpacing`; `ctx-lineheight` range (50→300, step 5, stored as int ÷ 100) → `lineHeight`. Both update live on `input` event.

### M4 — Stroke color + width
`ctx-stroke-color` color picker → `stroke`; `ctx-stroke-width` number input → `strokeWidth`. Both wired via `applyProp()`.

### M7/M8 — Image context bar + flip
New `#img-context-bar` (identical positioning to text bar): Flip H (`flipX`), Flip V (`flipY`), opacity range (10–100%), DPI badge, layer controls (up/down/front/back), duplicate, delete. `showContextBar()` now branches on `obj.type`: shows text bar for IText/Textbox, image bar for image/Image, hides both otherwise.

### M9 — DPI warning
`checkImageDPI(img)`: reads `img._nativeWidth` (stored at upload time), computes `dpi = round((nativeW / scaledW) * 96)`. Below 72: red "Very low quality" badge + toast. 72–150: amber "Low quality" badge + toast. Above 150: badge hidden. Called on upload + when image selected.

### M10 — Layer / z-order
`layerOp(op)`: wraps `canvas.bringForward/sendBackwards/bringToFront/sendToBack`. On `sendToBack`: print area guides re-sent to back afterward. Wired to 4 buttons in both text and image context bars.

### M13 — Snap guides
`snapGuides(e)`: checks if object center is within 8px of print area center X or Y. If so, draws a dashed blue `fabric.Line` guide (excludeFromExport) and snaps object position. `clearGuides()` called on `object:modified` and `hideContextBar()`.

### M16 — localStorage
Replaced all `sessionStorage` references with `localStorage` in both canvas-editor.js and review.js. Design now survives browser close for guest users.

### M19 — 50-state undo
`historyStack.length > 50` (was 10). No other changes needed.

### applyProp refactor
Renamed `applyTextProp` to `applyProp` (works on any Fabric object property); old name kept as alias so no callers break.

### duplicateActive helper
Extracted from keyboard handler into standalone `duplicateActive()`. Used by keyboard Ctrl+D, text bar duplicate button, image bar duplicate button.

### Context bar CSS
Both bars share the same CSS rules via comma selector. Added: `.ctx-slider-label` flex wrapper for range inputs; `.ctx-active` for toggled states; `.ctx-dpi-warn/.ctx-dpi-bad` pill badges; scrollable overflow-x with hidden scrollbar for narrow screens.

## Outcome

- ✅ Impact: Designer now has Underline, Letter-spacing, Line-height, Stroke color+width; image objects get their own context bar with Flip H/V, Opacity, DPI warning, Layer controls; snap-to-center guides; design survives browser close; 50-step undo
- 🧪 Tests: 11/11 HTML element checks PASS; 35 JS function references confirmed
- 📁 Files: 4 files modified
- 🔁 Next prompts: P2/P3 minor gaps (rotation snap, canvas pan, real-world print area label, safe zone, preview modal); OR start mobile QA / staging sync
- 🧠 Reflection: Shared `applyProp()` over the old `applyTextProp()` removes the implicit text-only assumption — opacity/flipX/flipY on image objects now work through the same codepath
