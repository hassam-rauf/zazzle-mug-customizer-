---
name: Three.js Mug Preview Modal
description: Replaced flat canvas-2D main preview with WebGL Three.js cylinder scene — realistic cylindrical texture wrap, real lighting, handle geometry
type: green
stage: green
date: 2026-05-01
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: chat
labels: ["three.js","webgl","cylinder","texture-mapping","preview-modal","3d","zazzle-parity"]
---

## Prompt

Upgrade the WooCommerce mug designer preview to Zazzle-style realistic curved mug rendering using Three.js. IMPORTANT: DO NOT rebuild editor. ONLY replace the preview/review rendering system. Full spec provided.

## Response

### Architecture

- **Thumbnails** (72×60): unchanged — `renderAngleView` canvas 2D (fast, small)
- **Main view** (non-donut): Three.js WebGL scene — `#preview-modal-threejs` div
- **Donut view**: falls back to `renderDonutView` canvas 2D (unchanged)

### Three.js scene (`_initThreeScene`)

- `WebGLRenderer` with `alpha:true`, ACES filmic tone mapping, PCFSoft shadows
- `PerspectiveCamera(32°, 460/400)` at (0, 1.0, 7.5) looking at origin
- Lights: AmbientLight(0.5) + DirectionalLight sun(1.2) at (3,6,4) + fill(0.35) at (-3,2,2)
- `CylinderGeometry(1.05, 0.95, 2.4, 64)` — slight taper (mug tapers inward at base)
- Inner top `CircleGeometry` (dark ceramic 0x1a1a1a)
- Bottom `CircleGeometry` (mug colour)
- Top rim `TorusGeometry(1.05, 0.065, 8, 64)`
- Handle `TubeGeometry` along `CatmullRomCurve3` on +X side (20 pts, semi-circle arc)
- Ground `ShadowMaterial` plane for soft shadow under mug

### Texture mapping (`_buildMugTexture`)

1024×512 offscreen canvas:
- Fill with `COLOR_HEX_MAP[selectedVariant.color]` hex
- Design (captured via `_captureDesignLayer`) cropped to print-area, drawn centred at px 512 covering `wrapDeg/360 * 1024` pixels wide
- `designTex.offset.x = 0.5` → aligns design centre to the front face (geom-U=0 = +Z in CylinderGeometry)
- `wrapS = RepeatWrapping` so colour wraps seamlessly around back

### Angle switching

`mugGroup.rotation.y = -deg * PI/180`
- deg=0 → front facing camera
- deg=-70 → left view (left edge of design faces camera)
- deg=130 → handle-side view
- Donut (deg=-999) → switch to canvas-2D fallback

### Performance

Thumbnail clicks for non-donut views: **no re-capture**. Just `_renderThreeScene(deg)` rotates the existing scene and re-renders. Design capture only happens on `openPreviewModal` (once) or if Three.js hasn't been initialised yet.

### Files modified

- `mug-customizer/public/assets/js/canvas-editor.js` — Three.js module + modified `_renderModalMainCanvas` + thumbnail click handler
- `mug-customizer/public/templates/designer.php` — Three.js CDN script tag + `#preview-modal-threejs` div
- `mug-customizer/public/assets/css/designer.css` — `#preview-modal-threejs` sizing styles
