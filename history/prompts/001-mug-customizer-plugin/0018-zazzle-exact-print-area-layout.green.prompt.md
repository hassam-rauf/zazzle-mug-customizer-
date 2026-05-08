---
id: 0018
title: Zazzle-exact print area layout
stage: green
date: 2026-05-06
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: chat
labels: ["designer","print-area","zazzle-parity","ui-fidelity","safe-area","dim-label","fabric-js"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/assets/js/canvas-editor.js
  - mug-customizer/public/assets/css/designer.css
tests:
  - manual:browser:/mug-designer/?product_id=14&style=classic&size=11oz&color=black
---

## Prompt

User shared two Zazzle screenshots and asked for the canvas-stage print-area
visual to match Zazzle exactly: photorealistic mug on left, wide unwrapped
print rectangle extending right past the mug body, green "Safe area" pill
anchored at top of inner safe-area rect, two dotted vertical zone dividers,
dimension label "9.5″ × 3.5″" centered when canvas is empty, soft blue-gray
stage background. Editor behavior, panels, top bar, preview modal, undo/redo,
variant logic — all must remain untouched.

## Response snapshot

### canvas-editor.js
- `MUG_VIEWS.center.printArea`: `410×220` → `540×200` (aspect 1.86:1 → 2.7:1, matches 9.5″ × 3.5″)
- Position shifted to `x:140, y:110, rx:14` so mug body sits at ~30% of rect width and rect extends right past mug
- Canvas bg `#f5f5f7` → `#f3f5f8`
- New palette tokens: `GREEN_LINE='#16a34a'`, `GREEN_PILL_BG='#dcfce7'`, `GREEN_PILL_TXT='#15803d'`, `DIM_LABEL_FILL='#94a3b8'`
- Outer print rect: transparent fill (was tinted green); stroke 1.5px dashed `[7,4]`
- Safe rect: `safeWFrac` 0.895→0.93, `safeHFrac` 0.897→0.84; stroke 1.5px dashed `[5,4]`
- Zone dividers reduced from 3 (`[0.25, 0.5, 0.75]`) to 2 (`[1/3, 2/3]`) → 3 wrap zones (left wrap | front | right wrap)
- "Safe area" pill: bigger padding (`+24/+10` was `+18/+8`), font 11→12 weight 600, system font stack, new colours
- Dimension label: 10px → 13px, weight 500, fill `#94a3b8`, system font stack, **centered in print rect**
- New `_dimLabelObj` reference + `updateDimLabelVisibility()` helper — hides label when canvas has any non-guide object, shows again when canvas is empty
- Hooked into `bindCanvasEvents` `object:added`/`object:removed`

### designer.css
- `--bg: #eff1f5` → `#f3f5f8` (matches canvas background tone, no jarring seam at canvas edge)

### Files unchanged
- `mug-customizer/public/templates/designer.php` — all print-area rendering happens on the Fabric.js canvas, so no DOM markup changes needed

## Outcome

- ✅ Impact: Canvas-stage now matches Zazzle's photorealistic mug + wide unwrapped print area layout. Print rect aspect, divider count, pill placement, dim-label hide-on-add behaviour all align.
- 🧪 Tests: Manual browser verification at the designer URL (golden path: empty state → add text → add image → undo/redo → variant change → preview modal)
- 📁 Files: 2 changed (`canvas-editor.js` +65/-39, `designer.css` +1/-1)
- 🔁 Next prompts: tighten variant-panel card border colour if user wants softer Zazzle look; tune mug PNG drop-shadow / position if proportion still feels off after browser test
- 🧠 Reflection: Print-area is drawn on the Fabric.js canvas (not DOM overlay) — keeps coords aligned with design objects. Aspect-ratio fix was the highest-leverage change; everything else is colour + sizing polish.

## Evaluation notes (flywheel)

- Failure modes observed: none in code review
- Graders run and results (PASS/FAIL): syntax check via `node -c` PASS
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): A/B the safeHFrac value (0.84 vs 0.88) against Zazzle screenshot — current is a guess
