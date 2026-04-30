---
id: "0014"
title: Zazzle Preview Zones Donut Modal
stage: green
date: 2026-04-30
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /resume
labels: ["preview-modal","donut-view","zone-labels","angle-strip","zazzle-parity"]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/assets/js/canvas-editor.js
  - mug-customizer/public/assets/css/designer.css
  - mug-customizer/public/templates/designer.php
tests:
  - Manual: open Preview modal, verify 7 thumbs render (Left/Front L/Center/Front R/Right/Handle/Donut)
  - Manual: click Donut thumb — main canvas shows top-down ring view
  - Manual: print area flat canvas shows zone seam lines + labels (Left,Front L,Center,Front R,Right,Handle)
  - Manual: angle-strip side panel shows 7 thumbs including Donut in 3-column grid
---

## Prompt

current woo commerce mug customization main cutomize mug mai jo print area or jo mug mai hmara uski dimension print area means phele left, then front left,center, front right,right, Handle and last with donut. for example main ne yeh zazzle par image upload ki screenshot dekho & screenshot 1 (zazzle editor). Ab uska preview dekho kesa araha hai & screenshot 2 (zazzle preview modal) yeh phele analysis kro or hmari approach bilkul aise he fix kro same as it koi aspect miss na ho ab fix kro.

## Response snapshot

Analyzed both Zazzle screenshots:
1. Screenshot 1: Zazzle edit canvas shows flat print area with dashed boundary + zone divider lines
2. Screenshot 2: Zazzle preview modal — left vertical strip with 7 angle thumbnails (Left→Donut), right large main canvas with label underneath

Implemented all missing Zazzle parity items:

**canvas-editor.js**
- PREVIEW_ANGLES: renamed 'Front' → 'Center', added `{ deg: -999, label: 'Donut', isDonut: true }`
- `setupPrintArea()`: replaced 3 arbitrary seam lines with 5 zone-boundary seams (at midpoints between -70,-35,0,35,70,130°) + 6 zone labels (Left/Front L/Center/Front R/Right/Handle) near bottom of print area
- `renderWarpPreview()`: both main warp canvas and thumb strip now branch on `isDonut` → `renderDonutView()`
- `updateActiveAngle()`: skips Donut entry during auto-selection (top-down view has no lateral position)
- Added `renderDonutView()`: renders the flat design as a radial ring (annular band) viewed top-down — each slice samples a column of the flat design, rotated radially
- Added `openPreviewModal()`, `closePreviewModal()`, `_renderFullPreview()`, `_renderModalMainCanvas()`
- `bindUI()`: wired Preview button → `openPreviewModal`, modal close button, overlay click-to-close, and 7 modal thumbnail click handlers that re-render the main canvas per selected view

**designer.php**
- Angle-strip: renamed 'Front' → 'Center', added 7th Donut thumb (`data-is-donut="true"`)
- Added full preview modal HTML outside `#designer-wrap`: 7 `.preview-modal-thumb` items in left strip, `#preview-modal-canvas` (500×440) + `#preview-modal-label` in right main area

**designer.css**
- Added full preview modal styles: `#preview-modal` fixed overlay, `#preview-modal-dialog` (700×580 rounded card), left strip with scrollable thumbs, right main area with large canvas

## Outcome

- ✅ Impact: Full Zazzle parity for preview modal (7-view thumb strip + large render), zone labels on flat print area, Donut top-down view
- 🧪 Tests: Manual verification required (no automated tests)
- 📁 Files: 3 files modified
- 🔁 Next prompts: Fine-tune donut ring proportions; add mug color tint to donut background
- 🧠 Reflection: Donut view uses radial column-slice rendering — same cylindrical math but mapped onto an annular ring instead of a projected rectangle

## Evaluation notes (flywheel)

- Failure modes observed: none yet
- Graders run and results (PASS/FAIL): pending manual QA
- Prompt variant (if applicable): null
- Next experiment: adjust outerR/innerR ratio for donut to better match Zazzle's proportions
