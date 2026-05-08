---
id: 0019
title: WebGL live preview cylinder wrap
stage: green
date: 2026-05-06
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: chat
labels: ["three.js","webgl","live-preview","cylinder-wrap","zazzle-parity","texture-mapping"]
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
  - manual:browser:/mug-designer/?product_id=14&style=classic&size=11oz&color=black
---

## Prompt

User shared two screenshots: Zazzle's live-preview thumbnail (image wrapped
around cylinder with foreshortening + shading) vs ours (image rendered flat
on top of mug photo). Request: replace the CSS3D simulation with proper
WebGL cylinder rendering so the thumbnail matches Zazzle's wrapping.

## Response snapshot

### Approach
Replaced the CSS3D pipeline (mug PNG + multiply tint + flat design overlay)
with a dedicated Three.js mini-scene. Reuses the existing `_buildMugTexture`
function from the preview modal so live-preview and modal share one
texture-wrap pipeline.

### canvas-editor.js
- Added state: `_liveThree`, `_liveThreeInited`, `_livePreviewImg` (reused Image element)
- New `_initLivePreviewScene()` — 156×140 WebGL canvas mounted into `#preview-3d-canvas-wrap`:
  - PerspectiveCamera fov=30, position (0, 0.6, 7.0)
  - AmbientLight 0.55 + DirectionalLight sun 1.15 + fill 0.35 (matches modal)
  - CylinderGeometry(1.05, 0.95, 2.4, 64) with same material setup as modal
  - mugGroup.rotation.y = -0.22 → subtle 3/4 angle for cylinder visibility in small thumb
  - Handle on **-X side (left)** — matches photorealistic mug photo orientation in editor
  - Inner ceramic disc + bottom disc + handle TubeGeometry
- New `_updateLiveMugColor()` — syncs body/bottom/handle materials to `selectedVariant.color`
- Rewrote `updateCss3dPreview(_activeObj)` body — now:
  1. Lazy-init `_liveThree` if needed
  2. Capture design via `_captureDesignLayer(1)` → load into reused Image
  3. On image load: build texture via `_buildMugTexture(img, pa)` → assign to `designTex` → render
  4. Empty canvas branch: render mug with just colour fill (no design)
- Removed dead code: `calcWrapAngle`, `positionDesignLayer`, `applyWrapTransform`, `_previewMugUrl`, `_previewDesignUrl` (200+ lines of CSS3D pipeline)
- All callsites untouched — `scheduleWarpPreview` → `updateCss3dPreview` chain preserved

### designer.php
- Replaced `#preview-3d-wrap` inner DOM:
  - Removed `#preview-mug-bg`, `#preview-mug-tint`, `#preview-design-layer`, `#preview-design-img`, `#preview-shading`
  - Added `<div id="preview-3d-canvas-wrap"></div>` mount point

### designer.css
- Updated `#preview-3d-wrap`: flexbox center, `#f4f5f7` bg, 144px height, 4px vertical padding
- Added `#preview-3d-canvas-wrap`: 156×140 WebGL container
- Removed dead CSS for old DOM IDs (`#preview-mug-bg`, `#preview-mug-tint`, `#preview-design-layer`, `#preview-design-img`, `#preview-shading`)

### Why this approach
- Zazzle's preview wraps design around cylinder with proper perspective foreshortening + lighting + edge shading. CSS3D rotateY can't match this because it lacks per-vertex perspective division and lighting falloff.
- Three.js was already loaded for the preview modal — reusing it eliminates a parallel pipeline.
- `_buildMugTexture` is now the single source of truth for "flat design → cylinder texture", used by both live preview and preview modal.

### XAMPP sync
rsync'd `mug-customizer/` → `/mnt/c/xampp/htdocs/mug_store_Zazzle/wp-content/plugins/mug-customizer/`. All 3 files verified in sync.

## Outcome

- ✅ Impact: Live preview thumb now renders the design wrapped around a real cylinder with per-pixel foreshortening, ambient + directional lighting, and ACES tone mapping. Matches Zazzle's wrap behaviour.
- 🧪 Tests: Manual browser verification — empty canvas, add image, drag image left/right, scale, rotate, change color, change size, undo/redo, open preview modal (independent scene)
- 📁 Files: 3 changed (`canvas-editor.js` +120/-220 net via rewrite, `designer.css` -25/+15, `designer.php` -7/+2)
- 🔁 Next prompts: tune `mugGroup.rotation.y` if user wants more or less angle; consider sharing geometry/lighting between modal and live scenes via factory function
- 🧠 Reflection: WebGL replaces 200+ lines of geometry + tint + perspective math with 90 lines of scene setup. Texture wrap math (`_buildMugTexture`) is now load-bearing for two scenes — any bug there affects both.

## Evaluation notes (flywheel)

- Failure modes observed: none in code review. Possible edge cases:
  - First render before THREE loads → guarded by `window.THREE` check
  - `_captureDesignLayer` returns empty when canvas tainted by cross-origin images → empty branch renders just the mug
  - Rapid drag → debounced via existing `scheduleWarpPreview` rAF
- Graders run and results (PASS/FAIL): `node -c canvas-editor.js` PASS; orphan-ref grep PASS
- Prompt variant (if applicable): n/a
- Next experiment (smallest change to try): A/B `mugGroup.rotation.y` between -0.15 and -0.30 to find the most Zazzle-like angle
