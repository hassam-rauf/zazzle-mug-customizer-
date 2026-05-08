---
id: 0021
title: Alignment popover + Effects flyout panel
stage: green
date: 2026-05-08
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: implement-feature
labels: ["ui", "designer", "alignment", "effects", "zazzle-parity"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/templates/designer.php
  - mug-customizer/public/assets/css/designer.css
  - mug-customizer/public/assets/js/canvas-editor.js
tests:
  - manual: Alignment ▾ opens rich popover with Align grid, Distribute, Align to, Flip, Scale, Rotate
  - manual: 6 align buttons reposition active text relative to print-area artboard
  - manual: Flip H/V toggles obj.flipX/flipY
  - manual: Scale −/+ multiplies scaleX/scaleY by 0.9 / 1.1
  - manual: Rotate CCW/CW step 15°, input accepts arbitrary value
  - manual: Effects button opens left flyout panel with 8 sections
  - manual: Sections collapse/expand by clicking header
  - manual: Opacity / Line spacing / Letter spacing sliders update live
  - manual: Shadow / Stroke toggles enable fabric props
  - manual: Tiling tiles + Vertical orientation show "Coming soon" toast
---

## Prompt

(screenshots dropped: Alignment dropdown panel content, Text Effects panel
sections — Opacity/Tiling/Shadow/Stroke/Line spacing/Letter spacing/Curved
text/Text orientation, plus full Zazzle layout showing Effects panel open
with toolbar Effects button)

jub hum allignment par click kr rahay hai to aise option arhay hain or jub
hum effects par krain gay then upar wale option aise dekhain ge analysis
kro thk se then yeh fix kro issue

## Response snapshot

Analyzed all 8 screenshots and produced a plan:
- Alignment dropdown should open a RICH popover anchored below the toolbar
  trigger, containing Align grid (6 buttons), Distribute (2 stub), Align to
  (Selection/Artboard radio), Flip H/V, Scale −/+, Rotate CCW/input/CW
- "Effects" toolbar button should open a LEFT-SIDE FLYOUT PANEL with 8
  collapsible sections: Opacity, Tiling, Shadow, Stroke, Line spacing,
  Letter spacing, Curved text, Text orientation
- Skipped "Selling Op" — Zazzle marketplace feature, not in plugin scope

After approval, implemented end-to-end.

### HTML (designer.php)
- Replaced `<select id="ctx-align-select">` with custom `#ctx-align-toggle`
  pill button + `#ctx-align-popover` (rich panel content)
- Added `#ctx-effects-toggle` toolbar button between Alignment and More
- Added new `<aside id="effects-panel">` flyout with 8 sections
- Kept hidden legacy `<select id="ctx-align-select">` for JS compat
- Inline SVG icons for align grid (L/C/R/T/M/B), flip H/V, distribute,
  rotate CCW/CW, palette (Effects)

### CSS (designer.css)
- New popover styling: 320px wide, `.ctx-pop-section`, `.ctx-pop-row-2col`,
  `.ctx-align-grid` (6-col), `.ctx-pop-btn` (38×38 with hover/active/disabled)
- Custom `.ctx-radio` styling for Align-to radios
- `.ctx-rotate-input-wrap` with absolute °  marker
- Effects panel: 360px wide, position absolute matching existing
  `#text-panel`/`#uploads-panel` pattern (top:24, left:132)
- `.fx-section` with collapsible body + chevron rotation
- iOS-style `.fx-switch` toggle
- `.fx-tile` (Tiling) and `.fx-orient` (orientation) tile grids
- `#canvas-stage.fx-open { padding-left: 520px; }` to push canvas right
  when Effects panel is open

### JS (canvas-editor.js)
- `syncEffectsPanel(obj)` hoisted to module level — called from showContextBar
  when text selection changes while Effects panel is open
- Alignment popover toggle wired with mutual-exclusion vs spacing/more popovers
- `_getArtboardRect()` returns print-area constants for alignment frame
- `_alignActive(direction)` repositions active object inside artboard for
  L/C/R/T/M/B (Selection ref is no-op for single object — TBD for groups)
- Flip H/V → `obj.flipX/flipY`
- Scale −/+ → `scaleX/Y *= 0.9 / 1.1`, clamped 0.1–8
- Rotate CCW/CW → ±15° step; input box accepts manual angle, normalized 0-360
- Effects panel open closes other left flyouts and adds `.fx-open` to stage
- Section headers toggle `.is-collapsed` class
- `_bindRangeInput(rangeId, inputId, fn)` helper binds slider+input pair to
  applyProp callback (opacity, lineHeight, charSpacing, strokeWidth)
- Shadow toggle creates/clears `fabric.Shadow`; stroke toggle sets
  `stroke`/`strokeWidth` and reveals controls
- Tiling tiles + Vertical orientation set active state but show toast
  "Coming in v1.1" (engine deferred to next phase)

## Outcome

- ✅ Impact: Alignment dropdown is now a Zazzle-parity rich panel; Effects
  is a full left flyout panel with all 8 sections; toolbar has new Effects
  button.
- 🧪 Tests: Manual browser verification pending (designer URL).
- 📁 Files: 3 modified (template, css, js).
- 🔁 Next prompts: browser-verify; if Tiling/Curved/Vertical features are
  prioritized, implement engine in v1.1.
- 🧠 Reflection: Two distinct interaction patterns — popover vs flyout —
  required separate styling/JS scaffolding. Hoisting `syncEffectsPanel`
  to module level made selection-change auto-sync clean.

## Evaluation notes (flywheel)

- Failure modes observed: none yet — pending browser verification.
- Graders run and results (PASS/FAIL): n/a
- Prompt variant (if applicable): n/a
- Next experiment: if multi-select alignment is needed, implement the
  "Selection" radio option (currently no-op for single object).
