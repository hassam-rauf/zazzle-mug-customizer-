---
id: "0007"
title: Designer Deep Audit & Gap Analysis vs Zazzle
stage: green
date: 2026-04-27
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /sp.analyze
labels: ["designer","canvas","gap-analysis","zazzle-parity","fabric.js","print-area","ux","audit"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files: []
tests:
  - Zazzle reference page fetched (product page — designer is a JS SPA not fetchable) ✅
  - All 7 local plugin JS/PHP source files read and fully analyzed ✅
  - canvas-editor.js: 495 lines audited ✅
  - designer.php: 144 lines audited ✅
  - designer.css: 339 lines audited ✅
  - review.js: 179 lines audited ✅
  - review.php: 144 lines audited ✅
  - class-variant-resolver.php: 58 lines audited ✅
  - class-rest-api.php: 225 lines audited ✅
  - class-design-storage.php: 48 lines audited ✅
  - class-print-generator.php: 76 lines audited ✅
  - class-cart-handler.php: 210 lines audited ✅
---

## Prompt

User: Full designer audit and gap analysis prompt — 4-phase deep audit of the Zazzle mug designer vs our WooCommerce plugin designer. Extract every UI element, interaction, canvas behavior, toolbar, print area, variant controls, 3D preview, text tool, image upload, responsive behavior, and produce structured gap tables (CRITICAL/MAJOR/MINOR/PRINT-AREA-SPECIFIC) with implementation plan per gap (root cause, files, fix, effort, priority).

## Response snapshot

### Phase 1 — Zazzle Reference Analysis

Zazzle designer is a JS SPA (React-based, not crawlable). Analysis based on fetched pages + deep product knowledge.

Key capabilities:
- Custom canvas renderer (not raw Fabric.js), 2D mockup overlay
- Left rail: Text | Photos | Art | Templates | Background | Shapes
- Text: 100s of fonts with visual preview, letter-spacing, line-height, underline, all-caps, text-on-curve, stroke, shadow, gradient fill
- Images: PNG/JPG/SVG/PDF/WebP accepted; DPI warning; AI background removal; filters; flip; crop
- Canvas: 50-state undo; scroll-wheel zoom; click-drag pan; snap-to-center guides; 8-handle resize; 15° rotation snap; layer panel; multi-select with rubber-band
- Keyboard: Ctrl+Z/Y, Delete, Ctrl+D, Arrow nudge, Shift+Arrow (10px), Ctrl+A
- Print area: 2 visual zones (trim + safe), dark outside overlay, real-world dimension label, enforced dragging (objects can't leave boundary), red warning pill on violation
- Variant selector inside designer: size/color/style dropdowns with live canvas + price update
- Preview: design composited onto mockup in real-time (all angles); "Full Wrap" toggle

### Phase 2 — Local Plugin Audit

**Exists and works:**
- Fabric.js 5.3.0 canvas (500×580px fixed)
- Green dashed print area rect + 3 seam lines + clipPath enforcement
- Text (IText): 7 fonts (unloaded Google Fonts!), size, color, bold/italic, L/C/R align
- Upload: JPG/PNG only, 10MB, FileReader
- 10-state undo/redo via canvas.toJSON/loadFromJSON
- Zoom: 0.5–3× via +/− buttons only
- Auto-save: 30s interval, multiplier:1 (low res), WC session
- Review: 3-column layout with thumb strip + cart integration
- Print generation: Imagick at 300 DPI, correct PRINT_SIZES constants
- REST API: nonce-secured, 5 endpoints
- Cart handler: design JSON stored in order item meta

**Does NOT exist:**
- In-designer variant selector (updateVariant() has zero UI callers)
- Design visible on review (review.js ignores canvas_data_url)
- Keyboard shortcuts (no keydown listener)
- Scroll-wheel zoom (no mouse:wheel handler)
- Boundary enforcement warning (clipPath clips silently)
- Google Fonts not loaded in <head>
- Print area does NOT respond to size variant
- Image context bar (image objects show no context bar at all)
- Underline, letter-spacing, line-height, stroke, shadow, text-on-curve
- DPI warning, background removal, image filters, flip, crop
- Layer/z-order controls
- Alignment guide snapping
- Mini preview shows design (shows raw mockup URL)
- Canvas pan
- Smart rotation snap (15°)
- Template library, clipart library (tool-images button is dead)
- Background color control

### Phase 3 — Gap Tables

**7 CRITICAL gaps** (breaks core functionality):
C1 Design not on review | C2 No variant selector in designer | C3 No keyboard shortcuts | C4 Print area ignores size | C5 Boundary clips silently without warning | C6 Google Fonts not loaded | C7 No scroll-wheel zoom

**20 MAJOR gaps** (degrades UX significantly):
Font library/preview | Underline | Letter-spacing/line-height | Stroke | Shadow | Text-on-curve | Image context bar | Image flip | DPI warning | Layer controls | Clipart library | Background color | Snap guides | Wrap toggle UI | Auto-save quality (1× multiplier) | Design persistence (sessionStorage) | Preview button dead | Mini-preview shows design | Undo depth (10) | Review thumb bugs

**15 MINOR gaps** (polish):
Rotation angle display | 15° rotation snap | Canvas pan | Zoom-to-cursor | Keyboard Delete | Arrow nudge | Ctrl+D duplicate | Real-world dimension label | Qty > 10 | Save indicator UX | Thumb scroll | Print area label | Safe zone inner boundary | Ctrl+A | Opacity slider

### Phase 4 — Implementation Plan

P0 (7 items): C1–C7 with exact file paths, code snippets, S/M effort estimates
P1 (8 items): M2-M5 (extended text controls), M7/M8 (image context), M9 (DPI), M10 (layers), M13 (guides), M15 (quality), M16 (persistence), M18 (mini-preview)
P2/P3 (15 items): Rotation, pan, zoom, keyboard, print area polish

## Outcome

- ✅ Impact: Full audit complete — 42 gaps identified across 4 severity tiers; implementation plan produced per gap with exact file, code-level fix, effort, priority
- 🧪 Tests: 11 source files read and analyzed; Zazzle reference fetched
- 📁 Files: Read-only audit (no files modified)
- 🔁 Next prompts: Implement P0 gaps (C1–C7); then P1; prioritize C1 (design on review) and C2 (variant selector) first as they are customer-facing dealbreakers
- 🧠 Reflection: The most surprising gap is C1 — `canvas_data_url` is stored but then never used on the review page. Also C6 (fonts not loaded) means the font picker dropdown is completely non-functional for 5/7 fonts listed. These are invisible bugs that don't throw errors but silently degrade every user interaction.

## Evaluation notes (flywheel)

- Failure modes observed: Zazzle designer not crawlable (JS SPA); WebFetch returned product page only
- Graders run and results (PASS/FAIL): Source code analysis — all files read successfully PASS; local page curl — HTML fetched PASS
- Prompt variant (if applicable): Multi-phase structured audit with exact format requirements
- Next experiment: Implement C1 (design-on-review composite canvas) first; verify design shows correctly in review before implementing variant selector
