/* Mug Customizer — Fabric.js canvas editor */
(function () {
  'use strict';

  const mc  = window.mugCustomizer       || {};
  const cfg = window.mugDesignerConfig   || {};

  // ── State ────────────────────────────────────────────────────────────────
  let canvas;
  let printAreaRect;
  let _dimLabelObj  = null;   // fabric Text — hidden once user adds any object
  let historyStack  = [];
  let historyIndex  = -1;
  let isHistoryLock = false;

  // Mug background metadata (native PNG dims drive print-area math)
  let _mugImg          = null;
  let _mugNaturalW     = 2000;
  let _mugNaturalH     = 2000;
  let _warpRafPending  = false;
  let _warpMugEl       = null;  // raw HTMLImageElement captured before color filter

  // Three.js preview state — modal scene (large, multi-angle thumbnails)
  var _three       = null;   // { renderer, scene, camera, mugGroup, bodyMat, bottomMat, designTex }
  var _threeInited = false;

  // Live preview offscreen canvases — reused per-frame to avoid GC churn:
  //  _liveSnapCanvas   = full-canvas snapshot of fabric design layer
  //  _liveDesignCanvas = cylinder-projected design composited with shading
  var _liveSnapCanvas   = null;
  var _liveDesignCanvas = null;

  // Multi-angle preview — matches Zazzle's angle-strip UX.
  // viewHalf (65°): angular half-FOV of the virtual camera; controls how much
  // of the cylinder is visible in each thumbnail. Higher = wider view, more
  // compression at edges. Lower = tighter / less foreshortening.
  var PREVIEW_ANGLES = [
    { deg: -70,  label: 'Left'    },
    { deg: -35,  label: 'Front L' },
    { deg:   0,  label: 'Center'  },
    { deg:  35,  label: 'Front R' },
    { deg:  70,  label: 'Right'   },
    { deg: 130,  label: 'Handle'  },
    { deg: -999, label: 'Donut', isDonut: true },
  ];
  var VIEW_HALF_DEG   = 65;   // camera half-FOV in degrees
  var _activeAngleDeg = 0;    // currently selected view angle (degrees)

  // ── Multi-view print areas ────────────────────────────────────────────────
  // Each view = { mug image, print-area rect on the canvas }. Switching views
  // swaps the background and re-positions guides; user design objects shift
  // by the (oldPA.left, oldPA.top) → (newPA.left, newPA.top) delta so they
  // keep their relative position inside the print area.
  // Mug-relative schema: percentages are of the DRAWN mug image's bounding box,
  // so the print area sticks to the cylinder face regardless of canvas size or
  // image aspect. `rx` adds rounded corners for a natural-feeling pill.
  // `widthScale` (<1) trims a hair off width to follow the cylinder curvature
  // (the visible printable arc is slightly narrower than the body silhouette).
  var MUG_VIEWS = {
    center: {
      label:    'Center',
      mugFile:  'mug-classic-white.png',
      mugLeft:  30,
      // Calibrated to industry-standard 11oz ceramic mug, anchored to the
      // photographed mug PNG (mug-relative percentages — survives canvas
      // resize and per-variant photo replacement).
      //
      // Real-world print spec: 9.5″ × 3.5″ (aspect 2.714 : 1) full-wrap.
      // The unwrap rectangle covers FRONT FACE (~33%) + RIGHT WRAP (~33%)
      // + BACK WRAP (~33%) — visualised by two dotted vertical zone dividers
      // inside `setupPrintArea()`.
      //
      // Anchor (relative to drawn mug bounds, after scaleToHeight 0.66·H):
      //   leftPct  = 0.42  → starts just past the handle joint (left edge of body face)
      //   topPct   = 0.14  → 14% inset from rim, clears top shadow
      //   widthPct = 1.95  → 195% of mug width — extends past mug right edge
      //                      to communicate the wrap-around (Zazzle metaphor)
      //   heightPct = 0.72 → 72% of mug height — clears base shadow
      //   widthScale = 1   → no curvature trim (full unwrap is rectangular)
      //
      // For a 277×277 scaled mug at left:30, top:71 these resolve to:
      //   pa = { left: 146, top: 110, width: 540, height: 199 }  (≈ 9.5″×3.5″)
      printArea: {
        relTo:      'mug',
        leftPct:    0.42,
        topPct:     0.14,
        widthPct:   1.95,
        heightPct:  0.72,
        widthScale: 1,
        wrapDeg:    360,
        rx:         14,
      },
    },
  };
  var _activeView = 'center';

  // P3 — canvas pan state
  let _spaceDown = false;
  let _isPanning = false;
  let _panLastX  = 0;
  let _panLastY  = 0;

  let selectedVariant = {
    style: cfg.style || 'classic',
    size:  cfg.size  || '11oz',
    color: cfg.color || 'black',
  };
  let selectedAddons = [];

  // Hex per color name — drives the multiply tint on the white mug PNG so we
  // get infinite colors from a single asset. Tint is applied via a TRUE
  // multiply blend on an off-screen canvas, then re-masked to the mug shape
  // (multiply alone would fill transparent pixels). Photo highlights stay as
  // brighter tinted pixels and shadows get even darker — preserving the
  // ceramic look. Hex is the multiply colour; alpha is unused for multiply
  // mode but kept so 0 still flags "no tint" (white).
  var COLOR_TINT_MAP = {
    black:  { hex: '#1a1a1a', alpha: 1 },
    white:  { hex: '#ffffff', alpha: 0 },
    red:    { hex: '#dc2626', alpha: 1 },
    blue:   { hex: '#2563eb', alpha: 1 },
    green:  { hex: '#16a34a', alpha: 1 },
    navy:   { hex: '#1e3a5f', alpha: 1 },
    pink:   { hex: '#ec4899', alpha: 1 },
    yellow: { hex: '#fbbf24', alpha: 1 },
    purple: { hex: '#7c3aed', alpha: 1 },
    grey:   { hex: '#6b7280', alpha: 1 },
    gray:   { hex: '#6b7280', alpha: 1 },
  };
  // Back-compat alias — older code paths just want the hex string.
  var COLOR_HEX_MAP = (function () {
    var m = {};
    Object.keys(COLOR_TINT_MAP).forEach(function (k) { m[k] = COLOR_TINT_MAP[k].hex; });
    return m;
  })();
  function _tintFor(name) {
    return COLOR_TINT_MAP[(name || '').toLowerCase()] || { hex: '#ffffff', alpha: 0 };
  }
  // Default fallback used when alpha isn't known by callers.
  var TINT_ALPHA = 0.85;

  function _hexToRGBA(hex, alpha) {
    var h = (hex || '#000000').replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.substr(0,2),16) || 0;
    var g = parseInt(h.substr(2,2),16) || 0;
    var b = parseInt(h.substr(4,2),16) || 0;
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  // Pre-render the mug photo + colour overlay onto an off-screen canvas, then
  // swap that as the fabric.Image's element. This bypasses fabric.BlendColor
  // (whose multiply mode crushed the placeholder mug to flat black) and gives
  // a deterministic alpha-compositing tint with photo detail preserved.
  // Tinting is disabled while we only have a single placeholder mug photo —
  // attempting to tint a flat-light photo into a believable "black mug" gave
  // a flat silhouette that didn't match the real product. Re-enable per-colour
  // tinting once the client provides photographed black/red/blue/etc. mug
  // PNGs (drop them into mockupMap so getMugUrl returns the right asset and
  // no tint is needed).
  function applyMugTint(img) {
    if (!img) return;
    img.filters = [];
    img.dirty = true;
  }

  // ── Canvas Init ───────────────────────────────────────────────────────────
  function initCanvas() {
    canvas = new fabric.Canvas('mug-canvas', {
      width:            720,
      height:           420,
      backgroundColor:  '#f3f5f8',
      selection:        true,
      preserveObjectStacking: true,
    });

    loadMugBackground();
    setupPrintArea();
    bindCanvasEvents();
    loadSavedDesign();
    startAutoSave();
  }

  // ── Mug Background ────────────────────────────────────────────────────────
  function buildVariantKey(style, size, color, angle) {
    return [style, size, color, angle].join('-').toLowerCase();
  }

  function getMugUrl(angle) {
    angle = angle || 'front';
    // Active view overrides the variant-keyed mockup (multi-angle view switcher)
    var view = MUG_VIEWS[_activeView];
    if (view && view.mugFile) {
      return mc.pluginUrl + 'public/assets/images/' + view.mugFile;
    }
    const key = buildVariantKey(selectedVariant.style, selectedVariant.size, selectedVariant.color, angle);
    const url  = (mc.mockupMap || {})[key];
    return url || (mc.pluginUrl + 'public/assets/images/mug-classic-white.png');
  }

  function loadMugBackground(callback) {
    const url = getMugUrl('front');
    fabric.Image.fromURL(url, function (img) {
      img.set({
        selectable:  false,
        evented:     false,
        hasControls: false,
        hasBorders:  false,
      });
      _mugImg      = img;
      _mugNaturalW = (img._element && img._element.naturalWidth)  || img.width  || _mugNaturalW;
      _mugNaturalH = (img._element && img._element.naturalHeight) || img.height || _mugNaturalH;
      // Capture raw element BEFORE applyFilters() may replace _element with a canvas
      _warpMugEl   = img._element || null;
      // Mug ~66% of canvas height, positioned LEFT — leaves room for wide landscape print area (Zazzle wrap metaphor)
      img.scaleToHeight(Math.round(canvas.getHeight() * 0.66));
      var view = MUG_VIEWS[_activeView] || {};
      img.set({
        left: typeof view.mugLeft === 'number' ? view.mugLeft : 30,
        top:  Math.round((canvas.getHeight() - img.getScaledHeight()) / 2),
      });
      applyMugTint(img);
      canvas.setBackgroundImage(img, function () {
        // Re-run setupPrintArea now that mug bounds are real (mug-relative
        // schema falls back to estimates on first render — refresh here).
        setupPrintArea();
        canvas.requestRenderAll();
        scheduleWarpPreview();
        if (callback) callback();
      });
    }, { crossOrigin: 'anonymous' });
  }

  // ── Print Area + ClipPath ─────────────────────────────────────────────────
  //
  // Two config schemas are supported:
  //   • New (pixel-anchored): { x, y, width, height, pngWidth, pngHeight, wrapDeg }
  //     — coords are in the source mug PNG's native pixels.
  //   • Legacy (percent):     { top, left, width, height } — % of canvas.
  //
  // The new schema gives pixel-accurate alignment that survives canvas resize
  // and matches what a designer calibrates on the actual mug photo.
  function getPrintAreaPx() {
    // View-specific print area takes priority over variant-keyed config
    var view = MUG_VIEWS[_activeView];
    var config;
    if (view && view.printArea) {
      config = view.printArea;
    } else {
      var cfgMap = mc.printAreaConfig || {};
      var key = selectedVariant.style + '-' + selectedVariant.size;
      config = cfgMap[key] || cfgMap[selectedVariant.style];
    }
    const cw = canvas.getWidth();
    const ch = canvas.getHeight();

    if (! config) {
      return { left: cw * 0.18, top: ch * 0.22, width: cw * 0.64, height: ch * 0.56, wrapDeg: 140 };
    }

    // Mug-relative schema: percentages of the drawn mug image's bounds. Falls
    // back to canvas-relative if the mug isn't loaded yet (first render).
    if (config.relTo === 'mug') {
      var mugLeft, mugTop, mugW, mugH;
      if (_mugImg) {
        mugLeft = _mugImg.left || 0;
        mugTop  = _mugImg.top  || 0;
        mugW    = _mugImg.getScaledWidth();
        mugH    = _mugImg.getScaledHeight();
      } else {
        // Fallback to expected mug bounds (left:30, scaleToHeight 0.66*ch)
        var fallbackH = Math.round(ch * 0.66);
        var fallbackW = fallbackH; // square-ish until real image lands
        mugLeft = 30;
        mugTop  = Math.round((ch - fallbackH) / 2);
        mugW    = fallbackW;
        mugH    = fallbackH;
      }
      var rawW   = (config.widthPct  || 0) * mugW;
      var scaleW = config.widthScale || 1;
      var paW    = Math.round(rawW * scaleW);
      var paH    = Math.round((config.heightPct || 0) * mugH);
      // Re-center horizontally after curvature trim
      var paLeft = Math.round(mugLeft + (config.leftPct || 0) * mugW + (rawW - paW) / 2);
      var paTop  = Math.round(mugTop  + (config.topPct  || 0) * mugH);
      return {
        left:    paLeft,
        top:     paTop,
        width:   paW,
        height:  paH,
        wrapDeg: config.wrapDeg || 140,
        rx:      config.rx,
      };
    }

    // New schema: pixel-anchored to source PNG
    if (config.pngWidth && config.x !== undefined) {
      const pngW  = config.pngWidth;
      const scale = cw / pngW;          // background uses scaleToWidth(canvas.getWidth())
      return {
        left:    Math.round(config.x      * scale),
        top:     Math.round(config.y      * scale),
        width:   Math.round(config.width  * scale),
        height:  Math.round(config.height * scale),
        wrapDeg: config.wrapDeg || 140,
        rx:      config.rx,
      };
    }

    // Legacy percent schema
    return {
      top:     Math.round(ch * (config.top    || 0) / 100),
      left:    Math.round(cw * (config.left   || 0) / 100),
      width:   Math.round(cw * (config.width  || 0) / 100),
      height:  Math.round(ch * (config.height || 0) / 100),
      wrapDeg: 140,
    };
  }

  // Real-world print dimensions per size (inches)
  var PRINT_DIMS_IN = {
    '11oz': { w: 9.5, h: 3.5 },
    '15oz': { w: 11.0, h: 4.0 },
    '20oz': { w: 11.5, h: 4.5 },
  };

  var _printAreaGuides = []; // all guide objects for easy cleanup on variant change

  function setupPrintArea() {
    const pa = getPrintAreaPx();

    // Remove all previous guide objects
    _printAreaGuides.forEach(function (o) { canvas.remove(o); });
    _printAreaGuides = [];
    if (printAreaRect) { canvas.remove(printAreaRect); printAreaRect = null; }
    // Also remove any prior design-bg fill — it'll be re-created at the new
    // print area position below
    if (typeof _designBgFill !== 'undefined' && _designBgFill) {
      canvas.remove(_designBgFill);
      _designBgFill = null;
    }

    // Zazzle palette (Tailwind-style greens)
    var GREEN_LINE   = '#16a34a';
    var GREEN_PILL_BG  = '#dcfce7';
    var GREEN_PILL_TXT = '#15803d';
    var DIM_LABEL_FILL = '#94a3b8';

    // Outer bleed zone (green dashed, rounded corners — Zazzle parity)
    var bleedRx = (typeof pa.rx === 'number') ? pa.rx : 10;
    printAreaRect = new fabric.Rect({
      left:            pa.left,
      top:             pa.top,
      width:           pa.width,
      height:          pa.height,
      rx:              bleedRx,
      ry:              bleedRx,
      fill:            'transparent',
      stroke:          GREEN_LINE,
      strokeWidth:     1.5,
      strokeDashArray: [7, 4],
      selectable:      false,
      evented:         false,
      excludeFromExport: true,
    });
    canvas.add(printAreaRect);
    _printAreaGuides.push(printAreaRect);

    // Safe zone — inset ~6% from bleed
    var safeWFrac = 0.93;
    var safeHFrac = 0.84;
    var safeW     = Math.round(pa.width  * safeWFrac);
    var safeH     = Math.round(pa.height * safeHFrac);
    var safeLeft  = pa.left + Math.round((pa.width  - safeW) / 2);
    var safeTop   = pa.top  + Math.round((pa.height - safeH) / 2);
    var safeRx    = Math.max(4, bleedRx - 4);
    var safeZone  = new fabric.Rect({
      left:            safeLeft,
      top:             safeTop,
      width:           safeW,
      height:          safeH,
      rx:              safeRx,
      ry:              safeRx,
      fill:            'transparent',
      stroke:          GREEN_LINE,
      strokeWidth:     1.5,
      strokeDashArray: [5, 4],
      selectable:      false,
      evented:         false,
      excludeFromExport: true,
    });
    canvas.add(safeZone);
    _printAreaGuides.push(safeZone);

    // Vertical zone dividers — 2 dotted lines at 1/3 and 2/3 → 3 wrap zones
    var foldPositions = [1 / 3, 2 / 3];
    foldPositions.forEach(function(fp) {
      var fx = Math.round(safeLeft + fp * safeW);
      var fLine = new fabric.Line(
        [fx, safeTop, fx, safeTop + safeH],
        { stroke: GREEN_LINE, strokeWidth: 1.4, strokeDashArray: [1.5, 5], opacity: 0.55,
          selectable: false, evented: false, excludeFromExport: true }
      );
      canvas.add(fLine);
      _printAreaGuides.push(fLine);
    });

    // "Safe area" badge — rounded green pill anchored at top-center of safe zone
    var badgeText = new fabric.Text('Safe area', {
      fontSize:   12,
      fill:       GREEN_PILL_TXT,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontWeight: '600',
      originX:    'center',
      originY:    'center',
    });
    var badgeBg = new fabric.Rect({
      width:  badgeText.width  + 24,
      height: badgeText.height + 10,
      rx:     12,
      ry:     12,
      fill:   GREEN_PILL_BG,
      stroke: GREEN_LINE,
      strokeWidth: 1,
      originX: 'center',
      originY: 'center',
    });
    var safeLabel = new fabric.Group([badgeBg, badgeText], {
      left:       safeLeft + safeW / 2,
      top:        safeTop,
      originX:    'center',
      originY:    'center',
      selectable: false,
      evented:    false,
      excludeFromExport: true,
    });
    canvas.add(safeLabel);
    _printAreaGuides.push(safeLabel);

    // Dimension label — centered inside print rect; hidden when user adds any object
    const dims = PRINT_DIMS_IN[selectedVariant.size] || PRINT_DIMS_IN['11oz'];
    const dimLabel = new fabric.Text(dims.w + '″ \xd7 ' + dims.h + '″', {
      left:       pa.left + pa.width  / 2,
      top:        pa.top  + pa.height / 2,
      fontSize:   13,
      fill:       DIM_LABEL_FILL,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
      fontWeight: '500',
      originX:    'center',
      originY:    'center',
      selectable: false,
      evented:    false,
      excludeFromExport: true,
    });
    canvas.add(dimLabel);
    _printAreaGuides.push(dimLabel);
    _dimLabelObj = dimLabel;
    updateDimLabelVisibility();

    // Print-area enforcement is soft (boundary toast + green dashed rect) so
    // the user can see the WHOLE mug while editing. A canvas-level clipPath
    // would hide the mug background outside the print area too — confusing.
    canvas.clipPath = null;

    // If user has a design-area bg active, re-apply it at the new print rect
    if (typeof _designBgState !== 'undefined' && _designBgState && _designBgState.type !== 'transparent' && typeof _updateDesignBgFill === 'function') {
      _updateDesignBgFill();
    }

    canvas.requestRenderAll();
  }

  // Hide the dimension label as soon as the user adds anything; show again
  // when canvas is empty. User objects = anything not flagged excludeFromExport.
  function updateDimLabelVisibility() {
    if (! _dimLabelObj || ! canvas) return;
    var userCount = canvas.getObjects().filter(function (o) {
      return ! o.excludeFromExport;
    }).length;
    var shouldShow = userCount === 0;
    if (_dimLabelObj.visible !== shouldShow) {
      _dimLabelObj.visible = shouldShow;
      canvas.requestRenderAll();
    }
  }

  // ── View Switcher (multi-angle) ───────────────────────────────────────────
  function setView(viewKey) {
    if (! MUG_VIEWS[viewKey] || viewKey === _activeView) return;

    var oldPa = getPrintAreaPx();
    _activeView = viewKey;
    var newPa = getPrintAreaPx();

    // Translate user design objects so they keep their RELATIVE position
    // inside the print area (preserves design across view switches).
    var dx = newPa.left - oldPa.left;
    var dy = newPa.top  - oldPa.top;
    if (dx !== 0 || dy !== 0) {
      canvas.getObjects().forEach(function (obj) {
        if (obj.excludeFromExport) return;       // skip guides
        if (obj === printAreaRect) return;
        obj.set({ left: (obj.left || 0) + dx, top: (obj.top || 0) + dy });
        obj.setCoords();
      });
    }

    // Swap mug background — loadMugBackground triggers setupPrintArea once
    // its setBackgroundImage callback fires (mug bounds are real by then).
    loadMugBackground(function () {
      _printAreaGuides.forEach(function (g) { canvas.sendToBack(g); });
      canvas.requestRenderAll();
    });

    // Sync button active state
    var btns = document.querySelectorAll('.view-switch-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-view') === viewKey);
    });

    pushHistory();
  }

  // ── Add Text ──────────────────────────────────────────────────────────────
  function addTextBox() {
    const pa       = getPrintAreaPx();
    const inputEl  = document.getElementById('text-panel-input');
    const textVal  = (inputEl && inputEl.value.trim()) || 'Your text here';

    const text = new fabric.IText(textVal, {
      fontFamily:  'Georgia',
      fontSize:    28,
      fill:        '#222222',
      left:        pa.left + 20,
      top:         pa.top  + 20,
      editable:    true,
    });

    canvas.add(text);
    canvas.setActiveObject(text);
    canvas.requestRenderAll();
    pushHistory();
    if (inputEl) inputEl.value = '';
  }

  // ── Image Upload ──────────────────────────────────────────────────────────
  function handleFileUpload(file) {
    const maxBytes = (mc.maxUploadMB || 10) * 1024 * 1024;

    if (! ['image/jpeg', 'image/png'].includes(file.type)) {
      showToast('Only JPG and PNG files are accepted.');
      return;
    }
    if (file.size > maxBytes) {
      showToast('File is too large. Maximum size: ' + (mc.maxUploadMB || 10) + 'MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
      const dataUrl = e.target.result;
      addImageFromDataUrl(dataUrl, true);
      registerUploadThumb(dataUrl);
    };
    reader.readAsDataURL(file);
  }

  // Add an image (data URL) onto the canvas inside the print area
  function addImageFromDataUrl(dataUrl, makeActive) {
    fabric.Image.fromURL(dataUrl, function (img) {
      const pa = getPrintAreaPx();
      img.scaleToWidth(Math.min(pa.width * 0.6, img.width));
      img.set({ left: pa.left + 10, top: pa.top + 10 });
      img._nativeWidth  = img.width;
      img._nativeHeight = img.height;
      canvas.add(img);
      if (makeActive) canvas.setActiveObject(img);
      canvas.requestRenderAll();
      pushHistory();
      checkImageDPI(img);
    });
  }

  // Track uploaded thumbnails for the Uploads flyout grid
  var _uploadThumbs = [];
  function registerUploadThumb(dataUrl) {
    if (_uploadThumbs.indexOf(dataUrl) !== -1) return;
    _uploadThumbs.push(dataUrl);
    renderUploadThumbs();
  }
  function renderUploadThumbs() {
    const grid = document.getElementById('uploads-grid');
    if (! grid) return;
    if (_uploadThumbs.length === 0) {
      grid.innerHTML = '<div class="uploads-grid-empty">No uploads yet</div>';
      return;
    }
    grid.innerHTML = '';
    _uploadThumbs.forEach(function (dataUrl, idx) {
      const thumb = document.createElement('div');
      thumb.className = 'uploads-thumb';
      thumb.style.backgroundImage = 'url(' + dataUrl + ')';
      thumb.title = 'Click to add to design';
      thumb.addEventListener('click', function (e) {
        if (e.target.classList.contains('uploads-thumb-remove')) return;
        addImageFromDataUrl(dataUrl, true);
      });
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'uploads-thumb-remove';
      rm.textContent = '✕';
      rm.title = 'Remove from uploads';
      rm.addEventListener('click', function (e) {
        e.stopPropagation();
        _uploadThumbs.splice(idx, 1);
        renderUploadThumbs();
      });
      thumb.appendChild(rm);
      grid.appendChild(thumb);
    });
  }

  // Add a clipart glyph as a Fabric IText (centered in print area)
  function addClipart(glyph) {
    const pa = getPrintAreaPx();
    const t = new fabric.IText(glyph, {
      fontFamily: 'Arial, sans-serif',
      fontSize:   80,
      fill:       '#222222',
      left:       pa.left + pa.width / 2,
      top:        pa.top  + pa.height / 2,
      originX:    'center',
      originY:    'center',
      editable:   false,
    });
    canvas.add(t);
    canvas.setActiveObject(t);
    canvas.requestRenderAll();
    pushHistory();
  }

  // ── Auto-fit active image to the print area ──────────────────────────────
  function autoFitToPrintArea() {
    const obj = canvas.getActiveObject();
    if (! obj) return;
    const isImg  = obj.type === 'image' || obj.type === 'Image';
    const isText = obj.type === 'IText' || obj.type === 'Textbox' || obj.type === 'i-text';
    if (! isImg && ! isText) return;

    const pa = getPrintAreaPx();
    const objW = obj.width  * (obj.scaleX || 1) / (obj.scaleX || 1) * 1; // raw width
    const baseW = obj.width  || 1;
    const baseH = obj.height || 1;
    const sx = (pa.width  * 0.95) / baseW;
    const sy = (pa.height * 0.95) / baseH;
    const s  = Math.min(sx, sy);

    obj.set({
      scaleX: s, scaleY: s,
      left: pa.left + pa.width  / 2 - (baseW * s) / 2,
      top:  pa.top  + pa.height / 2 - (baseH * s) / 2,
    });
    obj.setCoords();
    canvas.requestRenderAll();
    pushHistory();
    if (isImg) checkImageDPI(obj);
  }

  // ── Layer Panel ──────────────────────────────────────────────────────────
  // Lists every user-design object (excludes the print-area guides). Supports
  // click-to-select, eye toggle, lock toggle, drag reorder, rename, delete.
  function genObjId() { return 'obj_' + Math.random().toString(36).slice(2, 9); }

  function objectThumbLabel(o) {
    if (o.type === 'IText' || o.type === 'Textbox' || o.type === 'i-text') {
      return (o.text || '').slice(0, 18) || 'Text';
    }
    return 'Image';
  }

  function objectThumbIcon(o) {
    if (o.type === 'IText' || o.type === 'Textbox' || o.type === 'i-text') return 'T';
    return '\u{1F5BC}'; // framed picture
  }

  let _layerDragSrcId = null;

  function updateLayerPanel() {
    const list = document.getElementById('lp-list');
    if (! list || ! canvas) return;

    // Iterate top-down so the visually top-most layer appears first in the panel
    const objs = canvas.getObjects().filter(function (o) { return ! o.excludeFromExport; });
    const reversed = objs.slice().reverse();

    list.innerHTML = '';
    if (reversed.length === 0) {
      list.innerHTML = '<div class="lp-empty">No layers yet — add text or upload an image.</div>';
      return;
    }

    const active = canvas.getActiveObject();

    reversed.forEach(function (o) {
      if (! o._mcId) o._mcId = genObjId();
      const row = document.createElement('div');
      row.className = 'lp-item' + (o === active ? ' lp-active' : '');
      row.draggable = true;
      row.dataset.id = o._mcId;
      row.innerHTML =
        '<span class="lp-grip" title="Drag to reorder">⋮⋮</span>' +
        '<span class="lp-thumb">' + objectThumbIcon(o) + '</span>' +
        '<span class="lp-name" title="Double-click to rename">' + (o.name ? escapeHtml(o.name) : escapeHtml(objectThumbLabel(o))) + '</span>' +
        '<button class="lp-btn lp-vis"  title="Show/hide">'  + (o.visible === false ? '\u{1F441}‍\u{1F5E8}' : '\u{1F441}') + '</button>' +
        '<button class="lp-btn lp-lock" title="Lock/unlock">' + (o.lockMovementX ? '\u{1F512}' : '\u{1F513}') + '</button>' +
        '<button class="lp-btn lp-del"  title="Delete">\u{1F5D1}</button>';
      list.appendChild(row);

      row.addEventListener('click', function (e) {
        if (e.target.classList.contains('lp-btn') ||
            e.target.classList.contains('lp-grip') ||
            e.target.classList.contains('lp-name')) return;
        canvas.setActiveObject(o);
        canvas.requestRenderAll();
      });

      row.querySelector('.lp-vis').addEventListener('click', function (e) {
        e.stopPropagation();
        o.visible = o.visible === false ? true : false;
        canvas.requestRenderAll();
        updateLayerPanel();
        scheduleWarpPreview();
      });

      row.querySelector('.lp-lock').addEventListener('click', function (e) {
        e.stopPropagation();
        const lock = ! o.lockMovementX;
        o.lockMovementX = o.lockMovementY = lock;
        o.lockScalingX  = o.lockScalingY  = lock;
        o.lockRotation  = lock;
        o.selectable    = ! lock;
        canvas.requestRenderAll();
        updateLayerPanel();
      });

      row.querySelector('.lp-del').addEventListener('click', function (e) {
        e.stopPropagation();
        canvas.remove(o);
        canvas.requestRenderAll();
        pushHistory();
      });

      const nameEl = row.querySelector('.lp-name');
      nameEl.addEventListener('dblclick', function () {
        nameEl.contentEditable = 'true';
        nameEl.focus();
        document.execCommand('selectAll', false, null);
      });
      nameEl.addEventListener('blur', function () {
        nameEl.contentEditable = 'false';
        o.name = nameEl.textContent.trim() || objectThumbLabel(o);
      });
      nameEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); nameEl.blur(); }
      });

      // Drag-reorder
      row.addEventListener('dragstart', function (e) {
        _layerDragSrcId = o._mcId;
        row.classList.add('lp-dragging');
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
      });
      row.addEventListener('dragend', function () {
        row.classList.remove('lp-dragging');
        document.querySelectorAll('.lp-item').forEach(function (el) { el.classList.remove('lp-drop-target'); });
        _layerDragSrcId = null;
      });
      row.addEventListener('dragover', function (e) {
        e.preventDefault();
        row.classList.add('lp-drop-target');
      });
      row.addEventListener('dragleave', function () {
        row.classList.remove('lp-drop-target');
      });
      row.addEventListener('drop', function (e) {
        e.preventDefault();
        row.classList.remove('lp-drop-target');
        if (! _layerDragSrcId || _layerDragSrcId === o._mcId) return;
        const all = canvas.getObjects().filter(function (x) { return ! x.excludeFromExport; });
        const src = all.find(function (x) { return x._mcId === _layerDragSrcId; });
        if (! src) return;
        // Panel shows top-to-bottom; canvas stack-index is reverse → drop above target = move higher
        const targetStackIdx = canvas.getObjects().indexOf(o);
        canvas.moveTo(src, targetStackIdx);
        canvas.requestRenderAll();
        pushHistory();
      });
    });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  // M9 — DPI warning
  function checkImageDPI(img) {
    if (!img._nativeWidth) return;
    const scaledWidthPx  = img.getScaledWidth();
    const dpi = Math.round((img._nativeWidth / scaledWidthPx) * 96);
    const badge = document.getElementById('ctx-img-dpi');
    if (badge) {
      if (dpi < 72) {
        badge.textContent = '⚠️ Very low quality (' + dpi + ' DPI)';
        badge.className = 'ctx-dpi-badge ctx-dpi-bad';
        badge.style.display = 'inline-block';
      } else if (dpi < 150) {
        badge.textContent = '⚠️ Low quality (' + dpi + ' DPI)';
        badge.className = 'ctx-dpi-badge ctx-dpi-warn';
        badge.style.display = 'inline-block';
      } else {
        badge.style.display = 'none';
      }
    }
    if (dpi < 72)  showToast('⚠️ Very low quality image — print may appear blurry.');
    else if (dpi < 150) showToast('⚠️ Low resolution image — for best results upload at higher quality.');
  }

  // ── Context Bar ───────────────────────────────────────────────────────────
  // Fonts that ship without bold/italic variants in our default stack.
  // Used to grey out B/I (Zazzle parity) when no real variant exists.
  const FONTS_WITHOUT_BOLD   = ['Dancing Script'];
  const FONTS_WITHOUT_ITALIC = ['Oswald', 'Dancing Script'];

  function showContextBar(obj) {
    const textBar = document.getElementById('context-bar');
    const imgBar  = document.getElementById('img-context-bar');
    if (!textBar || !imgBar || !obj) return;

    const isText  = obj.type === 'IText' || obj.type === 'Textbox' || obj.type === 'i-text';
    const isImage = obj.type === 'image' || obj.type === 'Image';

    // Text bar uses the floating-pill .is-visible class (display managed by CSS).
    textBar.classList.toggle('is-visible', !!isText);
    imgBar.style.display = isImage ? 'flex' : 'none';

    if (isText) {
      const set = function (id, val) { const el = document.getElementById(id); if (el) el.value = val; };
      const font     = obj.fontFamily || 'Georgia';
      const size     = obj.fontSize   || 24;
      const fill     = obj.fill       || '#222222';

      set('ctx-font',         font);
      set('ctx-size',         size);
      set('ctx-size-input',   _formatSize(size));
      set('ctx-color',        fill);
      set('ctx-angle',        Math.round(obj.angle || 0));
      set('ctx-spacing',      obj.charSpacing  || 0);
      set('ctx-lineheight',   Math.round((obj.lineHeight || 1.2) * 100));
      set('ctx-stroke-color', obj.stroke       || '#000000');
      set('ctx-stroke-width', obj.strokeWidth  || 0);

      // Legacy size span (kept hidden but updated for any external readers)
      const sizeVal = document.getElementById('ctx-size-val');
      if (sizeVal) sizeVal.textContent = _formatSize(size);

      // Font name preview — render the name in its own font
      const fontPreview = document.getElementById('ctx-font-preview');
      if (fontPreview) {
        fontPreview.textContent = font;
        fontPreview.style.fontFamily = font;
      }

      // Color swatch tint (the native <input type=color> shows the colour itself)
      const colorEl = document.getElementById('ctx-color');
      if (colorEl) colorEl.style.background = fill;

      const alignSel = document.getElementById('ctx-align-select');
      if (alignSel) alignSel.value = obj.textAlign || 'left';

      const syncToggle = function (id, active) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('ctx-active', !!active);
      };
      syncToggle('ctx-bold',      obj.fontWeight === 'bold');
      syncToggle('ctx-italic',    obj.fontStyle  === 'italic');
      syncToggle('ctx-underline', obj.underline  === true);

      // Disable B/I when current font has no such variant (Zazzle parity)
      const boldBtn   = document.getElementById('ctx-bold');
      const italicBtn = document.getElementById('ctx-italic');
      if (boldBtn)   boldBtn.classList.toggle('is-disabled',   FONTS_WITHOUT_BOLD.indexOf(font) !== -1);
      if (italicBtn) italicBtn.classList.toggle('is-disabled', FONTS_WITHOUT_ITALIC.indexOf(font) !== -1);

      // Anchor the floating pill below (or above) the selected text
      positionContextBar(obj);

      // If Effects panel is open, refresh its controls to match new selection
      syncEffectsPanel(obj);
    } else {
      // Hide spacing/more popovers when bar is dismissed for a non-text selection
      _closePopovers();
    }

    if (isImage) {
      const opEl  = document.getElementById('ctx-img-opacity');
      const opVal = document.getElementById('ctx-img-opacity-val');
      const pct   = Math.round((obj.opacity || 1) * 100);
      if (opEl)  opEl.value    = pct;
      if (opVal) opVal.textContent = pct + '%';
      const angleEl = document.getElementById('ctx-img-angle');
      if (angleEl) angleEl.value = Math.round(obj.angle || 0);
      checkImageDPI(obj);
    }
  }

  function hideContextBar() {
    const textBar = document.getElementById('context-bar');
    const imgBar  = document.getElementById('img-context-bar');
    if (textBar) {
      textBar.classList.remove('is-visible');
      textBar.style.left = '-9999px';
      textBar.style.top  = '-9999px';
    }
    if (imgBar)  imgBar.style.display  = 'none';
    _closePopovers();
    clearGuides();
  }

  // Format a font-size value: keep up to 2 decimals, drop trailing zeros.
  function _formatSize(n) {
    const v = Number(n) || 0;
    return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, '');
  }

  // Module-level Effects panel sync — called when active text changes
  function syncEffectsPanel(obj) {
    const fxPanel = document.getElementById('effects-panel');
    if (!fxPanel || fxPanel.hidden || !obj) return;
    const set = function (id, val) { const el = document.getElementById(id); if (el && el.value !== String(val)) el.value = val; };
    set('fx-opacity',              Math.round((obj.opacity || 1) * 100));
    set('fx-opacity-input',        Math.round((obj.opacity || 1) * 100));
    set('fx-line-spacing',         Number((obj.lineHeight || 1.2).toFixed(2)));
    set('fx-line-spacing-input',   Number((obj.lineHeight || 1.2).toFixed(2)));
    set('fx-letter-spacing',       Number(obj.charSpacing || 0));
    set('fx-letter-spacing-input', Number(obj.charSpacing || 0));

    const shadowOn      = !!obj.shadow;
    const fxShadow      = document.getElementById('fx-shadow');
    const fxShadowState = document.getElementById('fx-shadow-state');
    if (fxShadow) fxShadow.checked = shadowOn;
    if (fxShadowState) fxShadowState.textContent = 'Text Shadow: ' + (shadowOn ? 'on' : 'off');

    const strokeOn      = (obj.strokeWidth || 0) > 0;
    const fxStroke      = document.getElementById('fx-stroke');
    const fxStrokeState = document.getElementById('fx-stroke-state');
    const fxStrokeCtl   = document.querySelector('#effects-panel .fx-stroke-controls');
    if (fxStroke)      fxStroke.checked = strokeOn;
    if (fxStrokeState) fxStrokeState.textContent = 'Text Stroke: ' + (strokeOn ? 'on' : 'off');
    if (fxStrokeCtl)   fxStrokeCtl.hidden = !strokeOn;
    set('fx-stroke-color',       obj.stroke || '#000000');
    set('fx-stroke-width',       obj.strokeWidth || 0);
    set('fx-stroke-width-input', obj.strokeWidth || 0);
  }

  function _closePopovers() {
    const sp  = document.getElementById('ctx-spacing-panel');
    const mp  = document.getElementById('ctx-more-panel');
    const ap  = document.getElementById('ctx-align-popover');
    const spT = document.getElementById('ctx-spacing-toggle');
    const mT  = document.getElementById('ctx-more-toggle');
    const aT  = document.getElementById('ctx-align-toggle');
    if (sp) sp.hidden = true;
    if (mp) mp.hidden = true;
    if (ap) ap.hidden = true;
    if (spT) { spT.classList.remove('ctx-active'); spT.setAttribute('aria-expanded', 'false'); }
    if (mT)  { mT.classList.remove('ctx-active');  mT.setAttribute('aria-expanded', 'false'); }
    if (aT)  { aT.classList.remove('ctx-active');  aT.setAttribute('aria-expanded', 'false'); }
  }

  // Pin the floating pill to the TOP of the canvas-stage, horizontally centred
  // within the available area (Zazzle parity — toolbar does NOT follow the
  // text). When a left-side flyout panel is open, #canvas-stage gets extra
  // padding so the centred bar naturally shifts with the visible area.
  function positionContextBar(/* obj */) {
    const bar   = document.getElementById('context-bar');
    const stage = document.getElementById('canvas-stage');
    if (!bar || !stage) return;

    // Measure the bar (temporarily reveal off-screen if needed)
    const wasHidden = !bar.classList.contains('is-visible');
    if (wasHidden) bar.classList.add('is-visible');
    const barW = bar.offsetWidth || 720;
    if (wasHidden) bar.classList.remove('is-visible');

    const cs       = window.getComputedStyle(stage);
    const padL     = parseFloat(cs.paddingLeft)  || 0;
    const padR     = parseFloat(cs.paddingRight) || 0;
    const stageW   = stage.clientWidth;
    const availW   = stageW - padL - padR;
    const TOP_GAP  = 12;

    // Centre within the visible (un-padded) area of the stage
    let left = padL + (availW - barW) / 2;
    left = Math.max(8, Math.min(stageW - barW - 8, left));

    bar.style.left = left + 'px';
    bar.style.top  = TOP_GAP + 'px';
    bar.removeAttribute('data-anchor');
  }

  function applyProp(prop, value) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.set(prop, value);
    canvas.requestRenderAll();
    pushHistory();
  }

  // Keep old name as alias so existing callers work
  const applyTextProp = applyProp;

  // ── History (50-state) ────────────────────────────────────────────────────
  function pushHistory() {
    if (isHistoryLock) return;
    historyStack = historyStack.slice(0, historyIndex + 1);
    historyStack.push(canvas.toJSON(['excludeFromExport']));
    if (historyStack.length > 50) historyStack.shift();
    historyIndex = historyStack.length - 1;
    updateUndoRedoBtns();
  }

  function undo() {
    if (historyIndex <= 0) return;
    historyIndex--;
    restoreHistory();
  }

  function redo() {
    if (historyIndex >= historyStack.length - 1) return;
    historyIndex++;
    restoreHistory();
  }

  function restoreHistory() {
    isHistoryLock = true;
    canvas.loadFromJSON(historyStack[historyIndex], function () {
      canvas.requestRenderAll();
      isHistoryLock = false;
      updateUndoRedoBtns();
    });
  }

  function updateUndoRedoBtns() {
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.disabled = historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = historyIndex >= historyStack.length - 1;
  }

  // ── Zoom ──────────────────────────────────────────────────────────────────
  function setZoom(zoom) {
    zoom = Math.min(3, Math.max(0.5, zoom));
    canvas.setZoom(zoom);
    canvas.setDimensions({
      width:  500 * zoom,
      height: 580 * zoom,
    });
    const valEl = document.getElementById('zoom-display-value');
    if (valEl) valEl.textContent = Math.round(zoom * 100) + '%';
    const menu = document.getElementById('zoom-menu');
    if (menu) {
      const pct = Math.round(zoom * 100);
      menu.querySelectorAll('li').forEach(function (li) {
        li.setAttribute('aria-selected', String(parseInt(li.getAttribute('data-zoom'), 10) === pct));
      });
    }
  }

  // ── Variant update ────────────────────────────────────────────────────────
  function updateVariant(key, value) {
    selectedVariant[key] = value;
    if (key === 'color' && _mugImg) {
      // Color change is just a multiply re-tint on the same image — no reload.
      applyMugTint(_mugImg);
      canvas.requestRenderAll();
      scheduleWarpPreview();
      return;
    }
    loadMugBackground();
    setupPrintArea();
    scheduleWarpPreview();
  }

  // ── Warp Preview — cylindrical wrap onto mug PNG ─────────────────────────
  //
  // Renders the flat design onto a cylindrical surface so the user sees what
  // the printed mug actually looks like while they edit. Math: each output
  // column at normalized horizontal offset n = ox / halfWidth maps back to a
  // source column whose angle θ on the cylinder satisfies sin(θ)/sin(halfWrap)
  // = n. So θ = asin(n · sin(halfWrap)), and srcCol = (θ/wrapDeg + 0.5)·srcW.
  // Edge columns get sampled from a wider source band → natural foreshortening.
  function scheduleWarpPreview() {
    if (_warpRafPending) return;
    _warpRafPending = true;
    requestAnimationFrame(function () {
      _warpRafPending = false;
      updateCss3dPreview();
    });
  }

  // Capture only the design layer: hide mug background AND all print-area
  // guide objects (excludeFromExport) so neither bleeds into the preview/export.
  function _captureDesignLayer(multiplier) {
    const origBg      = canvas.backgroundImage;
    const origBgColor = canvas.backgroundColor;
    const guides = canvas.getObjects().filter(function (o) { return o.excludeFromExport; });
    guides.forEach(function (g) { g.visible = false; });
    let url = '';
    try {
      canvas.backgroundImage = null;
      canvas.backgroundColor = null;   // transparent capture — no canvas-bg leak through preview tint
      url = canvas.toDataURL({ format: 'png', multiplier: multiplier || 1 });
    } catch (e) {
      console.warn('[MugCustomizer] capture skipped:', e && e.message);
    } finally {
      canvas.backgroundImage = origBg;
      canvas.backgroundColor = origBgColor;
      guides.forEach(function (g) { g.visible = true; });
      canvas.requestRenderAll();
    }
    return url;
  }

  // ── Live preview — photorealistic mug + flat design overlay (Zazzle parity) ──
  //
  // Approach: draw the photorealistic mug photo + colour tint, then overlay
  // the captured design onto the mug-body region of the photo at the correct
  // relative position. NO cylinder projection, NO shading band — Zazzle's
  // live thumbnail is essentially a flat sticker overlay; the mug photo's
  // natural shading provides all depth cues. Print area beyond the mug body
  // (the editor's wrap-zone metaphor) is clamped — only the visible front
  // face renders here.
  //
  // Capture is SYNCHRONOUS via canvas.lowerCanvasEl snapshot. Async Image
  // loading from data URL caused flicker during drag/rotate (60 fps events
  // outpaced 5–10 ms image decode), so we copy the fabric canvas pixels
  // directly into a reused offscreen canvas — zero async, zero flicker.

  function _captureDesignLayerCanvas() {
    if (! canvas) return null;
    var origBg      = canvas.backgroundImage;
    var origBgColor = canvas.backgroundColor;
    var guides      = canvas.getObjects().filter(function (o) { return o.excludeFromExport; });
    guides.forEach(function (g) { g.visible = false; });

    var snap = null;
    try {
      canvas.backgroundImage = null;
      canvas.backgroundColor = null;
      canvas.renderAll();          // sync render (not requestRenderAll → that defers to rAF)

      var src = canvas.lowerCanvasEl;
      if (! _liveSnapCanvas) _liveSnapCanvas = document.createElement('canvas');
      if (_liveSnapCanvas.width  !== src.width)  _liveSnapCanvas.width  = src.width;
      if (_liveSnapCanvas.height !== src.height) _liveSnapCanvas.height = src.height;
      var sctx = _liveSnapCanvas.getContext('2d');
      sctx.clearRect(0, 0, _liveSnapCanvas.width, _liveSnapCanvas.height);
      sctx.drawImage(src, 0, 0);
      snap = _liveSnapCanvas;
    } catch (e) {
      console.warn('[MugCustomizer] sync capture skipped:', e && e.message);
    } finally {
      canvas.backgroundImage = origBg;
      canvas.backgroundColor = origBgColor;
      guides.forEach(function (g) { g.visible = true; });
      canvas.renderAll();
    }
    return snap;
  }

  function updateCss3dPreview(_activeObj) {
    var liveCanvas = document.getElementById('preview-live-canvas');
    if (! liveCanvas) return;
    if (! _warpMugEl) return;   // mug PNG not loaded yet

    var ctx = liveCanvas.getContext('2d');
    var pw  = liveCanvas.width;
    var ph  = liveCanvas.height;

    // 1. Fit-draw the mug photo (preserve aspect ratio, centre in canvas)
    var fit = Math.min(pw / _mugNaturalW, ph / _mugNaturalH);
    var dW  = _mugNaturalW * fit;
    var dH  = _mugNaturalH * fit;
    var dX  = (pw - dW) / 2;
    var dY  = (ph - dH) / 2;
    ctx.clearRect(0, 0, pw, ph);
    ctx.drawImage(_warpMugEl, dX, dY, dW, dH);

    // 2. Colour tint disabled — show the real photographed mug PNG as-is.
    //    (Re-enable once per-colour mug photos are available.)

    // 3. Overlay design onto the mug body — synchronous canvas snapshot
    var snap = _captureDesignLayerCanvas();
    if (! snap) return;

    var pa   = getPrintAreaPx();
    var mugL = _mugImg ? (_mugImg.left || 0) : 30;
    var mugT = _mugImg ? (_mugImg.top  || 0) : 0;
    var mugW = _mugImg ? _mugImg.getScaledWidth()  : 313;
    var mugH = _mugImg ? _mugImg.getScaledHeight() : 277;

    // Clamp print area to mug body — beyond the body is the wrap-zone
    // metaphor for the editor; in the live thumbnail only the visible front
    // face renders.
    var paL = Math.max(pa.left, mugL);
    var paT = Math.max(pa.top,  mugT);
    var paR = Math.min(pa.left + pa.width,  mugL + mugW);
    var paB = Math.min(pa.top  + pa.height, mugT  + mugH);
    var paW = Math.max(0, paR - paL);
    var paH = Math.max(0, paB - paT);
    if (paW === 0 || paH === 0) return;

    var scaleX = dW / mugW;
    var scaleY = dH / mugH;
    var dstX = dX + (paL - mugL) * scaleX;
    var dstY = dY + (paT - mugT) * scaleY;
    var dstW = paW * scaleX;
    var dstH = paH * scaleY;

    // ── Cylinder projection (Zazzle parity) ─────────────────────────────
    // Render the clamped design slice column-by-column with:
    //   - Edge foreshortening:  theta = asin(norm * sin(viewHalf))
    //                           → centre 1:1, edges compressed by sec(viewHalf)
    //   - Banana curve:         vertical height shrinks at edges following cos(theta)
    //                           → top/bottom edges curve inward
    //   - Edge shading:         right side darkens, left brightens (composited
    //                           with source-atop so it only affects design pixels)
    // Render into _liveDesignCanvas first, then drawImage to preview canvas.
    var VIEW_HALF_RAD   = (50 * Math.PI) / 180;     // 50° half-FOV → ~1.56× edge compression
    var HEIGHT_SHRINK   = 0.18;                       // 0–1; how much edges curve inward vertically
    var sinViewHalf     = Math.sin(VIEW_HALF_RAD);
    var cosViewHalf     = Math.cos(VIEW_HALF_RAD);

    var ow = Math.max(1, Math.round(dstW));
    var oh = Math.max(1, Math.round(dstH));
    if (! _liveDesignCanvas) _liveDesignCanvas = document.createElement('canvas');
    if (_liveDesignCanvas.width  !== ow) _liveDesignCanvas.width  = ow;
    if (_liveDesignCanvas.height !== oh) _liveDesignCanvas.height = oh;
    var dctx = _liveDesignCanvas.getContext('2d');
    dctx.clearRect(0, 0, ow, oh);

    var center = ow / 2;
    for (var ox = 0; ox < ow; ox++) {
      var norm  = (ox - center) / center;                          // [-1, +1]
      var theta = Math.asin(Math.max(-1, Math.min(1, norm * sinViewHalf)));
      // Map theta back to a fractional position in the source slice
      var t = (theta / VIEW_HALF_RAD + 1) / 2;                     // [0, 1]
      var srcCol = paL + t * paW;
      // Banana: edges shrink vertically; centre stays full height
      var hFactor = 1 - HEIGHT_SHRINK * (1 - Math.cos(theta));
      var effH    = oh * hFactor;
      var yOff    = (oh - effH) / 2;
      try {
        dctx.drawImage(snap, srcCol, paT, 1, paH, ox, yOff, 1, effH);
      } catch (e) { /* clipped slice — skip */ }
    }

    // Edge shading — only over design pixels via source-atop
    dctx.save();
    dctx.globalCompositeOperation = 'source-atop';
    var shade = dctx.createLinearGradient(0, 0, ow, 0);
    shade.addColorStop(0,    'rgba(255,255,255,0.05)');
    shade.addColorStop(0.45, 'rgba(0,0,0,0)');
    shade.addColorStop(1,    'rgba(0,0,0,0.22)');
    dctx.fillStyle = shade;
    dctx.fillRect(0, 0, ow, oh);
    dctx.restore();

    // Composite the projected design onto the preview canvas
    ctx.drawImage(_liveDesignCanvas, dstX, dstY);
  }

  // ── Per-angle cylindrical renderer ──────────────────────────────────────
  //
  // Projects the flat design onto a cylinder viewed from `viewAngleDeg`
  // degrees away from the mug's front face.
  //
  // Math (one pass, column by column):
  //   norm  = (ox - center) / center          → −1 … +1 across output width
  //   theta = viewRad + asin(norm × sin(viewHalf))
  //           └─ actual cylinder angle that maps to output column ox
  //   t     = theta / (2 × halfWrap) + 0.5   → 0=left edge, 1=right edge of design
  //   srcCol = t × srcW + srcLeft             → source column in flat design
  //
  // Columns where t < 0 or t > 1 are outside the print area — just mug bg.
  // Foreshortening is implicit: asin stretches centre columns and compresses
  // the edges, matching how a cylinder appears from an angle.
  function renderAngleView(ctx, pw, ph, designImg, mugEl, natW, natH, pa, viewAngleDeg) {
    ctx.clearRect(0, 0, pw, ph);

    // Draw mug background, fit-scaled to this canvas
    var fit   = Math.min(pw / natW, ph / natH);
    var drawW = natW * fit;
    var drawH = natH * fit;
    var drawX = (pw - drawW) / 2;
    var drawY = (ph - drawH) / 2;
    ctx.drawImage(mugEl, drawX, drawY, drawW, drawH);

    // Colour tint disabled — show the real photographed mug PNG as-is.

    // Scale print-area coords (main canvas px) → preview canvas px
    var cw      = canvas.getWidth();
    var k       = drawW / cw;
    var paLeft  = drawX + pa.left  * k;
    var paTop   = drawY + pa.top   * k;
    var paWidth = pa.width  * k;
    var paHeight= pa.height * k;

    var halfWrap     = ((pa.wrapDeg || 140) * Math.PI) / 360;
    var viewHalf     = VIEW_HALF_DEG * Math.PI / 180;
    var viewRad      = viewAngleDeg  * Math.PI / 180;
    var sinViewHalf  = Math.sin(viewHalf);
    var cols         = Math.max(1, Math.round(paWidth));
    var center       = cols / 2;
    var srcW         = pa.width;
    var srcH         = pa.height;
    var srcLeft      = pa.left;
    var srcTop       = pa.top;

    // ── Column-by-column cylindrical projection ──────────────────────────
    for (var ox = 0; ox < cols; ox++) {
      var norm  = (ox - center) / center;
      var theta = viewRad + Math.asin(Math.max(-1, Math.min(1, norm * sinViewHalf)));
      var t     = theta / (2 * halfWrap) + 0.5;
      if (t < 0 || t > 1) continue;
      var srcCol = srcLeft + t * srcW;
      try {
        ctx.drawImage(designImg, srcCol, srcTop, 1, srcH,
                                 paLeft + ox, paTop, 1, paHeight);
      } catch (e) { /* clipped source rect — skip */ }
    }

    // ── 3-D cylindrical shading overlays ────────────────────────────────
    // Diffuse lighting: ambient=0.30, diffuse = max(0, cos θ)
    // θ is the surface-normal angle from the viewer direction.
    // At the edges of the visible arc (±viewHalf) surfaces curve away → darker.
    var ambient   = 0.30;
    var thetaL    = viewRad - viewHalf;   // cylinder angle at left output edge
    var thetaR    = viewRad + viewHalf;   // cylinder angle at right output edge
    var diffL     = Math.max(0, Math.cos(thetaL));
    var diffC     = Math.max(0, Math.cos(viewRad));
    var diffR     = Math.max(0, Math.cos(thetaR));
    var darkL     = ((1 - (ambient + (1 - ambient) * diffL)) * 0.80).toFixed(3);
    var darkC     = ((1 - (ambient + (1 - ambient) * diffC)) * 0.80).toFixed(3);
    var darkR     = ((1 - (ambient + (1 - ambient) * diffR)) * 0.80).toFixed(3);

    var shadGrad  = ctx.createLinearGradient(paLeft, 0, paLeft + paWidth, 0);
    shadGrad.addColorStop(0,   'rgba(0,0,0,' + darkL + ')');
    shadGrad.addColorStop(0.5, 'rgba(0,0,0,' + darkC + ')');
    shadGrad.addColorStop(1,   'rgba(0,0,0,' + darkR + ')');
    ctx.fillStyle = shadGrad;
    ctx.fillRect(paLeft, paTop, paWidth, paHeight);

    // Specular highlight — white stripe at the reflection point (theta=0, front)
    // Output x-position of theta=0: norm = -sin(viewRad)/sinViewHalf
    var specNorm  = -Math.sin(viewRad) / (sinViewHalf || 0.001);
    var specX     = Math.max(0.05, Math.min(0.95, 0.5 + specNorm * 0.5));
    var specAlpha = Math.max(0, diffC - 0.4) * 0.22; // only when surface faces viewer
    if (specAlpha > 0.01) {
      var specGrad = ctx.createLinearGradient(paLeft, 0, paLeft + paWidth, 0);
      specGrad.addColorStop(Math.max(0, specX - 0.14), 'rgba(255,255,255,0)');
      specGrad.addColorStop(specX,                     'rgba(255,255,255,' + specAlpha.toFixed(3) + ')');
      specGrad.addColorStop(Math.min(1, specX + 0.14), 'rgba(255,255,255,0)');
      ctx.fillStyle = specGrad;
      ctx.fillRect(paLeft, paTop, paWidth, paHeight);
    }
  }

  // Backwards-compat shim: any old call sites will still work.
  function updateMiniPreview() { scheduleWarpPreview(); }

  // ── Donut (top-down) view renderer ───────────────────────────────────────
  //
  // Projects the flat design around an elliptical ring representing the mug
  // viewed from above. Each slice of the ring samples a column of the flat
  // design, rotated radially to fill the annular band.
  function renderDonutView(ctx, pw, ph, designImg, pa) {
    ctx.clearRect(0, 0, pw, ph);

    var cx = pw / 2;
    var cy = ph / 2;
    var outerR = Math.min(pw, ph) * 0.42;
    var innerR = outerR * 0.54;
    var N = Math.min(240, Math.ceil(2 * Math.PI * outerR));

    // Mug body background
    ctx.save();
    ctx.fillStyle = '#d8d8d8';
    ctx.beginPath();
    ctx.arc(cx, cy, outerR + 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Map design as a band around the outer ring
    for (var i = 0; i < N; i++) {
      var t  = i / N;
      var a1 = t * 2 * Math.PI - Math.PI / 2;
      var a2 = (i + 1) / N * 2 * Math.PI - Math.PI / 2;
      var srcX = Math.round(pa.left + t * pa.width);
      var radLen = outerR - innerR;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, a1, a2);
      ctx.arc(cx, cy, innerR, a2, a1, true);
      ctx.closePath();
      ctx.clip();

      var midA = (a1 + a2) / 2;
      ctx.translate(cx + innerR * Math.cos(midA), cy + innerR * Math.sin(midA));
      ctx.rotate(midA + Math.PI / 2);
      try {
        ctx.drawImage(designImg, srcX, pa.top, 1, Math.max(1, pa.height),
                      0, 0, radLen, radLen);
      } catch (e) {}
      ctx.restore();
    }

    // Inner circle (mug interior / top face)
    ctx.save();
    ctx.fillStyle = '#b8b8b8';
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 1, 0, 2 * Math.PI);
    ctx.fill();
    var grad = ctx.createRadialGradient(cx - innerR * 0.25, cy - innerR * 0.25, 0, cx, cy, innerR);
    grad.addColorStop(0, 'rgba(255,255,255,0.28)');
    grad.addColorStop(1, 'rgba(0,0,0,0.08)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, innerR - 1, 0, 2 * Math.PI);
    ctx.fill();
    ctx.restore();

    // Subtle rim outline
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, outerR, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // ── Three.js Mug Preview ──────────────────────────────────────────────────
  //
  // Replaces the flat canvas-2D main view in the preview modal with a real
  // WebGL cylinder. Thumbnails keep using renderAngleView (fast, small).
  // The donut view falls back to canvas 2D as before.
  //
  // Geometry facts (Three.js CylinderGeometry, default thetaStart=0):
  //   theta=0   → vertex at (0, y, +R) → +Z face → front (U=0 in UV)
  //   theta=π/2 → (+R, y, 0)          → +X right (U=0.25)
  //   theta=π   → (0, y, -R)          → back      (U=0.5)
  //   theta=3π/2→ (-R, y, 0)          → left      (U=0.75)
  //
  // Texture layout (1024×512 canvas):
  //   Fill = mug colour.  Design centred at px 512 (tex-U=0.5), covering
  //   wrapDeg/360 of the width.  texture.offset.x=0.5 shifts the front face
  //   (geom-U=0) to sample tex-U=0.5 → centre of design.
  //
  // Angle rotation: mugGroup.rotation.y = -deg × π/180
  //   deg=0 → front faces camera; deg=-70 → left-side view, etc.

  function _initThreeScene() {
    if (!window.THREE)  return false;
    if (_threeInited)   return true;

    var T         = window.THREE;
    var container = document.getElementById('preview-modal-threejs');
    if (!container) return false;

    var W = 460, H = 400;

    // Renderer
    var renderer = new T.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type    = T.PCFSoftShadowMap;
    renderer.toneMapping       = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    container.appendChild(renderer.domElement);

    // Scene & camera
    var scene  = new T.Scene();
    var camera = new T.PerspectiveCamera(32, W / H, 0.1, 100);
    camera.position.set(0, 1.0, 7.5);
    camera.lookAt(0, 0, 0);

    // Lights
    scene.add(new T.AmbientLight(0xffffff, 0.5));

    var sun = new T.DirectionalLight(0xffffff, 1.2);
    sun.position.set(3, 6, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near   =  0.5;
    sun.shadow.camera.far    = 20;
    sun.shadow.camera.top    =  4;
    sun.shadow.camera.bottom = -4;
    sun.shadow.camera.left   = -4;
    sun.shadow.camera.right  =  4;
    scene.add(sun);

    var fill = new T.DirectionalLight(0xffffff, 0.35);
    fill.position.set(-3, 2, 2);
    scene.add(fill);

    // Mug group — rotate this to change view angle
    var mugGroup = new T.Group();
    scene.add(mugGroup);

    // Design texture — image is replaced on every open/angle-switch
    var designTex      = new T.Texture();
    designTex.wrapS    = T.RepeatWrapping;
    designTex.wrapT    = T.ClampToEdgeWrapping;
    designTex.offset.x = 0.5;  // aligns design centre to the front face (geom-U=0)

    // Mug body (open cylinder — top/bottom capped separately)
    var bodyMat = new T.MeshStandardMaterial({
      map: designTex, roughness: 0.25, metalness: 0.04,
    });
    var bodyMesh = new T.Mesh(
      new T.CylinderGeometry(1.05, 0.95, 2.4, 64, 1, false),
      bodyMat
    );
    bodyMesh.castShadow = true;
    mugGroup.add(bodyMesh);

    // Inner top circle (dark ceramic)
    var inner = new T.Mesh(
      new T.CircleGeometry(0.90, 64),
      new T.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.75 })
    );
    inner.rotation.x = Math.PI / 2;
    inner.position.y = 1.21;
    mugGroup.add(inner);

    // Bottom disc (mug colour — updated with _updateThreeMugColor)
    var bottomMat  = new T.MeshStandardMaterial({ roughness: 0.5 });
    var bottomMesh = new T.Mesh(new T.CircleGeometry(0.95, 64), bottomMat);
    bottomMesh.rotation.x = -Math.PI / 2;
    bottomMesh.position.y = -1.21;
    mugGroup.add(bottomMesh);

    // Ground shadow plane
    var ground = new T.Mesh(
      new T.PlaneGeometry(8, 8),
      new T.ShadowMaterial({ opacity: 0.22 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.22;
    ground.receiveShadow = true;
    scene.add(ground);

    _three = { renderer, scene, camera, mugGroup, bodyMat, bottomMat, designTex };
    _threeInited = true;
    return true;
  }

  // Build a 1024×512 texture canvas: mug colour fill + design in print-area slot.
  function _buildMugTexture(designImg, pa) {
    var texW = 1024, texH = 512;
    var oc   = document.createElement('canvas');
    oc.width  = texW;
    oc.height = texH;
    var tc = oc.getContext('2d');

    // Base colour
    var hex = COLOR_HEX_MAP[(selectedVariant.color || '').toLowerCase()] || '#ffffff';
    tc.fillStyle = hex;
    tc.fillRect(0, 0, texW, texH);

    // Design slot: wrapDeg/360 of texture width, centred at px 512
    var wrapFrac = (pa.wrapDeg || 140) / 360;
    var dstW     = Math.round(wrapFrac * texW);
    var dstX     = Math.round((texW - dstW) / 2);

    tc.drawImage(designImg, pa.left, pa.top, pa.width, pa.height, dstX, 0, dstW, texH);
    return oc;
  }

  function _updateThreeMugColor() {
    if (!_three || !window.THREE) return;
    var hex = COLOR_HEX_MAP[(selectedVariant.color || '').toLowerCase()] || '#ffffff';
    var col = new window.THREE.Color(hex);
    _three.bottomMat.color.copy(col);
  }

  function _renderThreeScene(deg) {
    if (!_three) return;
    _three.mugGroup.rotation.y = -(deg || 0) * Math.PI / 180;
    _three.renderer.render(_three.scene, _three.camera);
  }

  // Public API (used by openPreviewModal and thumbnail clicks)
  function createMugPreview(designImg, deg) {
    if (!_threeInited && !_initThreeScene()) return;
    var pa = getPrintAreaPx();
    _three.designTex.image        = _buildMugTexture(designImg, pa);
    _three.designTex.needsUpdate  = true;
    _three.designTex.anisotropy   = _three.renderer.capabilities.getMaxAnisotropy();
    _updateThreeMugColor();
    _renderThreeScene(deg || 0);
  }

  function updateTexture(designImg) {
    if (!_three) return;
    var pa = getPrintAreaPx();
    _three.designTex.image       = _buildMugTexture(designImg, pa);
    _three.designTex.needsUpdate = true;
    _renderThreeScene(_three.mugGroup.rotation.y * -180 / Math.PI);
  }

  // Show/hide helper: toggle between Three.js container and fallback canvas
  function _showThreeView(show) {
    var tc = document.getElementById('preview-modal-threejs');
    var cv = document.getElementById('preview-modal-canvas');
    if (tc) tc.style.display = show ? '' : 'none';
    if (cv) cv.style.display = show ? 'none' : '';
  }

  // ── Full Preview Modal (Zazzle-style) ─────────────────────────────────────
  function openPreviewModal() {
    var modal = document.getElementById('preview-modal');
    if (!modal) return;
    modal.classList.add('open');
    _renderFullPreview(modal);
  }

  function closePreviewModal() {
    var modal = document.getElementById('preview-modal');
    if (modal) modal.classList.remove('open');
  }

  // ── Real-photo multi-angle preview (Zazzle parity) ─────────────────────
  // Each angle has its own photographed mug image + calibrated print-area
  // (as a percentage of that photo's natural dimensions). The design is
  // projected onto the print-area via cylinder-column slicing — same math
  // as the live thumb, just per-photo.
  var _PREVIEW_ANGLES = [
    { key: 'left',       label: 'Left',     img: 'mug-left.jpg',        angle: -70, paPct: { x: 0.36, y: 0.30, w: 0.42, h: 0.38 } },
    { key: 'frontLeft',  label: 'Front L',  img: 'mug-front-left.jpg',  angle: -35, paPct: { x: 0.36, y: 0.32, w: 0.40, h: 0.34 } },
    { key: 'center',     label: 'Center',   img: 'mug-center.jpg',      angle:   0, paPct: { x: 0.32, y: 0.34, w: 0.40, h: 0.32 } },
    { key: 'frontRight', label: 'Front R',  img: 'mug-front-right.jpg', angle:  35, paPct: { x: 0.26, y: 0.32, w: 0.40, h: 0.34 } },
    { key: 'right',      label: 'Right',    img: 'mug-right.jpg',       angle:  70, paPct: { x: 0.24, y: 0.30, w: 0.42, h: 0.38 } },
    { key: 'handle',     label: 'Handle',   img: 'mug-handle.jpg',      angle: 130, paPct: null },
    { key: 'donut',      label: 'Top View', img: 'mug-donut.jpg',       angle: -999, paPct: null, isDonut: true },
  ];

  var _previewPhotoCache = {};
  function _loadPreviewPhoto(filename, cb) {
    if (_previewPhotoCache[filename]) { cb(_previewPhotoCache[filename]); return; }
    var img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function () { _previewPhotoCache[filename] = img; cb(img); };
    img.onerror = function () { cb(null); };
    img.src = mc.pluginUrl + 'public/assets/images/' + filename;
  }

  function _angleByKey(key) {
    for (var i = 0; i < _PREVIEW_ANGLES.length; i++) {
      if (_PREVIEW_ANGLES[i].key === key) return _PREVIEW_ANGLES[i];
    }
    return null;
  }

  // Render a real-photo angle view: cover-fit photo + project design onto
  // its calibrated print-area via cylinder-column slicing.
  function renderRealAngleView(ctx, pw, ph, designImg, photoEl, paPct, viewAngleDeg) {
    ctx.clearRect(0, 0, pw, ph);

    var natW  = (photoEl && (photoEl.naturalWidth  || photoEl.width))  || 1;
    var natH  = (photoEl && (photoEl.naturalHeight || photoEl.height)) || 1;
    var fit   = Math.min(pw / natW, ph / natH);
    var drawW = natW * fit;
    var drawH = natH * fit;
    var drawX = (pw - drawW) / 2;
    var drawY = (ph - drawH) / 2;
    if (photoEl) ctx.drawImage(photoEl, drawX, drawY, drawW, drawH);

    if (!paPct || !designImg) return;

    // Print-area on the displayed photo (in preview canvas px)
    var paLeft   = drawX + paPct.x * drawW;
    var paTop    = drawY + paPct.y * drawH;
    var paWidth  = paPct.w * drawW;
    var paHeight = paPct.h * drawH;

    // Source = the editor's flat unwrap (canvas px)
    var src      = getPrintAreaPx();
    var halfWrap = ((src.wrapDeg || 360) * Math.PI) / 360;
    var viewHalf = 50 * Math.PI / 180;
    var viewRad  = viewAngleDeg * Math.PI / 180;
    var sinViewHalf = Math.sin(viewHalf);
    var cols     = Math.max(1, Math.round(paWidth));
    var center   = cols / 2;

    for (var ox = 0; ox < cols; ox++) {
      var norm  = (ox - center) / center;
      var theta = viewRad + Math.asin(Math.max(-1, Math.min(1, norm * sinViewHalf)));
      var t     = theta / (2 * halfWrap) + 0.5;
      if (t < 0 || t > 1) continue;
      var srcCol = src.left + t * src.width;
      try {
        ctx.drawImage(designImg, srcCol, src.top, 1, src.height,
                                 paLeft + ox, paTop, 1, paHeight);
      } catch (e) {}
    }

    // Subtle edge shading on top — photo already has lighting, so only a hint
    var ambient = 0.55;
    var thetaL  = viewRad - viewHalf, thetaR = viewRad + viewHalf;
    var darkL   = ((1 - (ambient + (1 - ambient) * Math.max(0, Math.cos(thetaL)))) * 0.45).toFixed(3);
    var darkR   = ((1 - (ambient + (1 - ambient) * Math.max(0, Math.cos(thetaR)))) * 0.45).toFixed(3);
    var grad    = ctx.createLinearGradient(paLeft, 0, paLeft + paWidth, 0);
    grad.addColorStop(0, 'rgba(0,0,0,' + darkL + ')');
    grad.addColorStop(0.5, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,' + darkR + ')');
    ctx.fillStyle = grad;
    ctx.fillRect(paLeft, paTop, paWidth, paHeight);
  }

  function _renderFullPreview(modal) {
    var designUrl = _captureDesignLayer(1);
    if (!designUrl) return;

    var designImg = new Image();
    designImg.onload = function () {
      // Render every thumbnail using its angle-specific photo
      modal.querySelectorAll('.preview-modal-thumb').forEach(function (thumb) {
        var cv = thumb.querySelector('canvas');
        if (!cv) return;
        var tCtx = cv.getContext('2d');
        var key  = thumb.dataset.angleKey || 'center';
        var ang  = _angleByKey(key);
        if (!ang) return;
        if (ang.isDonut) {
          _loadPreviewPhoto(ang.img, function (photoEl) {
            // Donut: still uses canvas-2D ring projection over the donut photo
            tCtx.clearRect(0, 0, cv.width, cv.height);
            if (photoEl) {
              var fit = Math.min(cv.width / photoEl.naturalWidth, cv.height / photoEl.naturalHeight);
              var dW = photoEl.naturalWidth * fit, dH = photoEl.naturalHeight * fit;
              tCtx.drawImage(photoEl, (cv.width - dW)/2, (cv.height - dH)/2, dW, dH);
            }
            // Overlay donut design ring on top
            renderDonutView(tCtx, cv.width, cv.height, designImg, getPrintAreaPx());
          });
        } else {
          _loadPreviewPhoto(ang.img, function (photoEl) {
            renderRealAngleView(tCtx, cv.width, cv.height, designImg, photoEl, ang.paPct, ang.angle);
          });
        }
      });

      _renderModalMainCanvas(modal, designImg);
    };
    designImg.src = designUrl;
  }

  function _renderModalMainCanvas(modal, designImg) {
    var mainCv = document.getElementById('preview-modal-canvas');
    if (!mainCv) return;
    mainCv.style.display = 'block';
    _showThreeView(false); // real-photo pipeline replaces Three.js

    var active = modal.querySelector('.preview-modal-thumb.active');
    var key    = active ? (active.dataset.angleKey || 'center') : 'center';
    var ang    = _angleByKey(key);
    if (!ang) return;
    var ctx    = mainCv.getContext('2d');

    if (ang.isDonut) {
      _loadPreviewPhoto(ang.img, function (photoEl) {
        ctx.clearRect(0, 0, mainCv.width, mainCv.height);
        if (photoEl) {
          var fit = Math.min(mainCv.width / photoEl.naturalWidth, mainCv.height / photoEl.naturalHeight);
          var dW = photoEl.naturalWidth * fit, dH = photoEl.naturalHeight * fit;
          ctx.drawImage(photoEl, (mainCv.width - dW)/2, (mainCv.height - dH)/2, dW, dH);
        }
        renderDonutView(ctx, mainCv.width, mainCv.height, designImg, getPrintAreaPx());
      });
      return;
    }

    _loadPreviewPhoto(ang.img, function (photoEl) {
      renderRealAngleView(ctx, mainCv.width, mainCv.height, designImg, photoEl, ang.paPct, ang.angle);
    });
  }

  // ── Print Export — design-only at production DPI ─────────────────────────
  //
  // The previous serializeDesign exported the full canvas (mug photo + design
  // composite) which is unusable as a production print file. The press needs
  // a transparent PNG containing ONLY the design, cropped to the print area,
  // at ~300 DPI of the real-world print dimensions.
  function exportPrintFile() {
    const pa  = getPrintAreaPx();
    const dim = PRINT_DIMS_IN[selectedVariant.size] || PRINT_DIMS_IN['11oz'];
    const TARGET_DPI = 300;
    const mult = (dim.h * TARGET_DPI) / Math.max(1, pa.height);

    const origBg = canvas.backgroundImage;
    const guides = canvas.getObjects().filter(function (o) { return o.excludeFromExport; });
    guides.forEach(function (g) { g.visible = false; });
    let url = '';
    try {
      canvas.backgroundImage = null;
      url = canvas.toDataURL({
        format:              'png',
        multiplier:          mult,
        left:                pa.left,
        top:                 pa.top,
        width:               pa.width,
        height:              pa.height,
        enableRetinaScaling: false,
      });
    } catch (err) {
      console.warn('[MugCustomizer] print export skipped:', err && err.message);
    } finally {
      canvas.backgroundImage = origBg;
      guides.forEach(function (g) { g.visible = true; });
      canvas.requestRenderAll();
    }
    return {
      data_url:    url,
      width_in:    dim.w,
      height_in:   dim.h,
      width_px:    Math.round(pa.width  * mult),
      height_px:   Math.round(pa.height * mult),
      dpi:         TARGET_DPI,
    };
  }

  // ── Auto Save ─────────────────────────────────────────────────────────────
  function serializeDesign(highRes) {
    let mockupUrl = '';
    try {
      mockupUrl = canvas.toDataURL({ format: 'png', multiplier: highRes ? 2 : 1 });
    } catch (err) {
      console.warn('[MugCustomizer] mockup dataUrl skipped:', err && err.message);
    }
    return {
      canvas_json:     canvas.toJSON(['excludeFromExport']),
      mockup_data_url: mockupUrl,                     // mug + design (cart thumbnail)
      print_file:     highRes ? exportPrintFile() : null, // production-ready (Review only)
      variant:         selectedVariant,
      addons:          selectedAddons,
      canvas_width:    500,
      canvas_height:   580,
      version:         '1.1',
    };
  }

  function saveToSession(design) {
    try {
      localStorage.setItem('mugDesign_' + cfg.productId, JSON.stringify(design));
    } catch (e) {}
  }

  function loadSavedDesign() {
    try {
      const saved = localStorage.getItem('mugDesign_' + cfg.productId);
      if (! saved) return;
      const design = JSON.parse(saved);
      // Variant must be set before setupPrintArea so the print-area config
      // resolves to the saved variant, not the URL-default one.
      if (design.variant) selectedVariant = design.variant;
      if (design.addons)  selectedAddons  = design.addons;
      if (design && design.canvas_json && design.canvas_json.objects && design.canvas_json.objects.length > 0) {
        canvas.loadFromJSON(design.canvas_json, function () {
          // loadFromJSON wipes the canvas before populating, which removes the
          // print-area guides we added earlier. Re-add them and refresh layers.
          setupPrintArea();
          canvas.requestRenderAll();
          pushHistory();
          updateLayerPanel();
          scheduleWarpPreview();
        });
      }
    } catch (e) {}
  }

  function setSaveStatus(text, color) {
    const status = document.getElementById('save-status');
    if (status) { status.textContent = text; status.style.color = color; }
  }

  function startAutoSave() {
    setInterval(function () {
      const design = serializeDesign(false);
      saveToSession(design);

      fetch(mc.apiRoot + 'designs/save', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': mc.nonce },
        body:    JSON.stringify(Object.assign({ product_id: cfg.productId }, design)),
      })
        .then(function () { setSaveStatus('Saved', '#16a34a'); })
        .catch(function () { setSaveStatus('Save failed', '#dc2626'); });
    }, 30000);
  }

  // Bridge to bindUI's setTab (assigned during bindUI())
  var _setActiveTab = null;

  // ── Switch to Review tab (in-page) ─────────────────────────────────────
  function goToReview() {
    const objs = canvas.getObjects().filter(function (o) { return !o.excludeFromExport; });
    if (objs.length === 0) {
      showToast('Please add at least one design element before reviewing.');
      return;
    }
    if (typeof _setActiveTab === 'function') {
      _setActiveTab('review');
    }
  }

  // ── Toast ─────────────────────────────────────────────────────────────────
  function showToast(msg) {
    let toast = document.getElementById('mug-toast');
    if (! toast) {
      toast = document.createElement('div');
      toast.id = 'mug-toast';
      toast.style.cssText = 'position:fixed;bottom:30px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:12px 24px;border-radius:6px;font-size:14px;z-index:9999;';
      document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.style.display = 'block';
    setTimeout(function () { toast.style.display = 'none'; }, 3500);
  }

  // ── Canvas Events ─────────────────────────────────────────────────────────
  function bindCanvasEvents() {
    canvas.on('object:added',    function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); updateDimLabelVisibility(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:modified', function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:removed',  function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); updateDimLabelVisibility(); setSaveStatus('● Unsaved', '#f59e0b'); });

    canvas.on('selection:created', function (e) { showContextBar(e.selected[0]); updateLayerPanel(); });
    canvas.on('selection:updated', function (e) { showContextBar(e.selected[0]); updateLayerPanel(); });
    canvas.on('selection:cleared', function ()  { hideContextBar(); updateLayerPanel(); });

    // Free drag/scale/rotate — no snapping, no hard clamp.
    // A soft toast fires once when the design leaves the print area.
    canvas.on('object:moving',   function (e) { updateCss3dPreview(e.target); warnIfOutside(e.target); positionContextBar(e.target); });
    canvas.on('object:scaling',  function (e) { updateCss3dPreview(e.target); positionContextBar(e.target); });
    canvas.on('object:modified', function (e) { clearGuides(); if (e && e.target) positionContextBar(e.target); });

    // C7 — scroll-wheel zoom
    canvas.on('mouse:wheel', function (opt) {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      let zoom = canvas.getZoom() * (opt.e.deltaY > 0 ? 0.95 : 1.05);
      zoom = Math.min(3, Math.max(0.5, zoom));
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
      const valEl = document.getElementById('zoom-display-value');
      if (valEl) valEl.textContent = Math.round(zoom * 100) + '%';
    });

    // P1/P2 — rotation angle display + 15° snap with Shift; also update CSS 3D preview
    canvas.on('object:rotating', function (e) {
      const obj = e.target;
      if (e.e && e.e.shiftKey) {
        obj.angle = Math.round(obj.angle / 15) * 15;
      }
      const deg = Math.round(obj.angle || 0);
      const a1 = document.getElementById('ctx-angle');
      const a2 = document.getElementById('ctx-img-angle');
      if (a1) a1.value = deg;
      if (a2) a2.value = deg;
      updateCss3dPreview(obj);
      positionContextBar(obj);
    });

    // Reposition floating context bar on viewport resize
    window.addEventListener('resize', function () {
      const obj = canvas.getActiveObject();
      if (obj) positionContextBar(obj);
    });

    // P3 — Space + drag to pan canvas
    canvas.on('mouse:down', function (opt) {
      if (_spaceDown) {
        _isPanning = true;
        canvas.selection = false;
        canvas.defaultCursor = 'grabbing';
        _panLastX = opt.e.clientX;
        _panLastY = opt.e.clientY;
      }
    });
    canvas.on('mouse:move', function (opt) {
      if (_isPanning) {
        canvas.relativePan(new fabric.Point(
          opt.e.clientX - _panLastX,
          opt.e.clientY - _panLastY
        ));
        _panLastX = opt.e.clientX;
        _panLastY = opt.e.clientY;
        canvas.requestRenderAll();
      }
    });
    canvas.on('mouse:up', function () {
      if (_isPanning) {
        _isPanning = false;
        canvas.selection = true;
        canvas.defaultCursor = _spaceDown ? 'grab' : 'default';
      }
    });
  }

  // ── Print-area hard constraints (Zazzle parity) ──────────────────────────
  //
  // Why AABB and not obj.left / obj.top?
  // obj.left/top are the untransformed origin. After rotation the visual extent
  // is larger — clamping the origin alone lets corners escape the boundary.
  // getBoundingRect(true) returns the axis-aligned bounding box in absolute
  // canvas coordinates after all transforms. Shifting obj.left/top by the
  // overflow delta moves the AABB by exactly the same amount — rotation-safe.

  function constrainToPrintArea(obj) {
    var pa = getPrintAreaPx();
    var b  = obj.getBoundingRect(true);  // AABB after all transforms

    var dx = 0, dy = 0;
    if (b.left < pa.left)                              dx =  pa.left               - b.left;
    if (b.top  < pa.top)                               dy =  pa.top                - b.top;
    if (b.left + b.width  > pa.left + pa.width)        dx = (pa.left + pa.width)   - (b.left + b.width);
    if (b.top  + b.height > pa.top  + pa.height)       dy = (pa.top  + pa.height)  - (b.top  + b.height);

    if (dx || dy) {
      obj.left += dx;
      obj.top  += dy;
      obj.setCoords();
    }
  }

  // Clamp scale so the AABB never exceeds print-area dimensions, then
  // re-run position clamp (scaling from a corner can push a side outside).
  function constrainScale(obj) {
    var pa = getPrintAreaPx();
    var b  = obj.getBoundingRect(true);

    if (b.width > pa.width || b.height > pa.height) {
      var ratio = Math.min(pa.width / b.width, pa.height / b.height);
      obj.scaleX *= ratio;
      obj.scaleY *= ratio;
      obj.setCoords();
    }
    constrainToPrintArea(obj);
  }

  // Soft out-of-bounds warning — fires once per drag gesture when the object
  // leaves the print area. No clamping; user retains full drag freedom.
  var _outsideWarned = false;
  function warnIfOutside(obj) {
    var pa = getPrintAreaPx();
    var b  = obj.getBoundingRect(true);
    var outside = b.left < pa.left || b.top < pa.top ||
                  b.left + b.width  > pa.left + pa.width ||
                  b.top  + b.height > pa.top  + pa.height;
    if (outside && !_outsideWarned) {
      _outsideWarned = true;
      showToast('Part of your design is outside the print area.');
    }
    if (!outside) _outsideWarned = false;
  }

  // ── Snap Guides (M13) ────────────────────────────────────────────────────
  let _guides = [];

  function clearGuides() {
    _guides.forEach(function (g) { canvas.remove(g); });
    _guides = [];
    canvas.requestRenderAll();
  }

  function drawGuide(x1, y1, x2, y2) {
    const line = new fabric.Line([x1, y1, x2, y2], {
      stroke: '#0066cc', strokeWidth: 1, strokeDashArray: [4, 3],
      selectable: false, evented: false, excludeFromExport: true,
    });
    canvas.add(line);
    _guides.push(line);
  }

  function snapGuides(e) {
    clearGuides();
    const pa  = getPrintAreaPx();
    const obj = e.target;
    const b   = obj.getBoundingRect(true);
    const objCX = b.left + b.width  / 2;
    const objCY = b.top  + b.height / 2;
    const paCX  = pa.left + pa.width  / 2;
    const paCY  = pa.top  + pa.height / 2;
    const SNAP  = 8;

    if (Math.abs(objCX - paCX) < SNAP) {
      drawGuide(paCX, pa.top, paCX, pa.top + pa.height);
      obj.set('left', paCX - b.width / 2);
    }
    if (Math.abs(objCY - paCY) < SNAP) {
      drawGuide(pa.left, paCY, pa.left + pa.width, paCY);
      obj.set('top', paCY - b.height / 2);
    }
    if (_guides.length) canvas.requestRenderAll();
  }

  // ── Layer helpers ─────────────────────────────────────────────────────────
  function layerOp(op) {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    switch (op) {
      case 'up':    canvas.bringForward(obj);  break;
      case 'down':  canvas.sendBackwards(obj); break;
      case 'front': canvas.bringToFront(obj);  break;
      case 'back':  canvas.sendToBack(obj);
        // Keep print area guides at the very back
        if (printAreaRect) canvas.sendToBack(printAreaRect);
        break;
    }
    canvas.requestRenderAll();
    pushHistory();
  }

  // ── Duplicate helper ──────────────────────────────────────────────────────
  function duplicateActive() {
    const obj = canvas.getActiveObject();
    if (!obj) return;
    obj.clone(function (cloned) {
      cloned.set({ left: obj.left + 20, top: obj.top + 20 });
      canvas.add(cloned);
      canvas.setActiveObject(cloned);
      canvas.requestRenderAll();
      pushHistory();
    });
  }

  // ── UI Event Bindings ─────────────────────────────────────────────────────
  function bindUI() {


    // ── Tool rail — unified flyout panel switching (Zazzle parity) ─────
    const TOOL_PANEL_MAP = {
      'tool-text':       'text-panel',
      'tool-uploads':    'uploads-panel',
      'tool-images':     'images-panel',
      'tool-background': 'background-panel',
      'tool-layers':     'layer-panel',
    };
    const uploadInput = document.getElementById('mug-upload-input');

    const stageEl = document.getElementById('canvas-stage');

    function closeAllPanels() {
      Object.values(TOOL_PANEL_MAP).forEach(function (panelId) {
        const p = document.getElementById(panelId);
        if (p) p.style.display = 'none';
      });
      document.querySelectorAll('.tool-item').forEach(function (t) { t.classList.remove('active'); });
      if (stageEl) stageEl.classList.remove('panel-open');
    }

    function openPanel(toolId) {
      const panelId = TOOL_PANEL_MAP[toolId];
      const panel   = panelId && document.getElementById(panelId);
      const tool    = document.getElementById(toolId);
      if (! panel || ! tool) return;
      const isOpen = panel.style.display === 'block';
      closeAllPanels();
      if (isOpen) return; // toggle off
      panel.style.display = 'block';
      tool.classList.add('active');
      if (stageEl) stageEl.classList.add('panel-open');
      if (toolId === 'tool-layers') updateLayerPanel();
      if (toolId === 'tool-uploads') renderUploadThumbs();
    }

    Object.keys(TOOL_PANEL_MAP).forEach(function (toolId) {
      const tool = document.getElementById(toolId);
      if (tool) tool.addEventListener('click', function () {
        openPanel(toolId);
        if (toolId === 'tool-background') renderBgPresets();
      });
    });

    // Panel close buttons
    ['text-panel-close', 'uploads-panel-close', 'images-panel-close', 'background-panel-close', 'layer-panel-close'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', closeAllPanels);
    });

    // Add Text button
    const btnAddText = document.getElementById('btn-add-text');
    if (btnAddText) btnAddText.addEventListener('click', addTextBox);

    // View switcher (multi-angle: Center / Handle Left)
    document.querySelectorAll('.view-switch-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var v = this.getAttribute('data-view');
        if (v) setView(v);
      });
    });

    // Uploads — file picker & dropzone
    const uploadsDropzone = document.getElementById('uploads-dropzone');
    const uploadsPickBtn  = document.getElementById('btn-uploads-pick');
    if (uploadsPickBtn  && uploadInput) uploadsPickBtn.addEventListener('click',  function () { uploadInput.click(); });
    if (uploadsDropzone && uploadInput) uploadsDropzone.addEventListener('click', function () { uploadInput.click(); });
    if (uploadsDropzone) {
      ['dragenter', 'dragover'].forEach(function (ev) {
        uploadsDropzone.addEventListener(ev, function (e) { e.preventDefault(); uploadsDropzone.classList.add('dragover'); });
      });
      ['dragleave', 'drop'].forEach(function (ev) {
        uploadsDropzone.addEventListener(ev, function (e) { e.preventDefault(); uploadsDropzone.classList.remove('dragover'); });
      });
      uploadsDropzone.addEventListener('drop', function (e) {
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) handleFileUpload(f);
      });
    }

    // Upload (file picker)
    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          handleFileUpload(this.files[0]);
          this.value = '';
        }
      });
    }

    // Clipart buttons
    document.querySelectorAll('.clipart-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { addClipart(btn.textContent); });
    });

    // Floating help widget
    const helpWidget    = document.getElementById('help-widget');
    const helpPopup     = document.getElementById('help-popup');
    const helpPopupClose = document.getElementById('help-popup-close');
    if (helpWidget && helpPopup) {
      helpWidget.addEventListener('click', function () {
        helpPopup.style.display = (helpPopup.style.display === 'block') ? 'none' : 'block';
      });
    }
    if (helpPopupClose && helpPopup) {
      helpPopupClose.addEventListener('click', function () { helpPopup.style.display = 'none'; });
    }
    // Click outside help-popup to close
    document.addEventListener('click', function (e) {
      if (! helpPopup || helpPopup.style.display !== 'block') return;
      if (helpPopup.contains(e.target) || (helpWidget && helpWidget.contains(e.target))) return;
      helpPopup.style.display = 'none';
    });

    // The bottom-bar "?" zoom-help button — also opens the help popup
    const zoomHelpBtn = document.getElementById('btn-zoom-help');
    if (zoomHelpBtn && helpPopup) {
      zoomHelpBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        helpPopup.style.display = 'block';
      });
    }

    // ── Settings popover (gear icon at bottom of canvas) ────────────────────
    const setBtn      = document.getElementById('btn-zoom-settings');
    const setPopover  = document.getElementById('settings-popover');
    if (setBtn && setPopover) {
      setBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = setPopover.hidden;
        setPopover.hidden = !open;
        setBtn.setAttribute('aria-expanded', String(open));
      });
      // Outside click closes
      document.addEventListener('click', function (e) {
        if (setPopover.hidden) return;
        if (setPopover.contains(e.target) || setBtn.contains(e.target)) return;
        setPopover.hidden = true;
        setBtn.setAttribute('aria-expanded', 'false');
      });
    }

    // 1. Dark mode — toggle CSS class on body
    const setDark = document.getElementById('set-dark-mode');
    if (setDark) setDark.addEventListener('change', function () {
      document.body.classList.toggle('mug-dark', this.checked);
    });

    // 2. Lock aspect ratio — toggle uniform scaling on all current + future objects
    const setLockAspect = document.getElementById('set-lock-aspect');
    if (setLockAspect) {
      setLockAspect.addEventListener('change', function () {
        const lock = this.checked;
        canvas.uniScaleKey = null; // disable Shift-toggle behaviour
        canvas.getObjects().forEach(function (o) {
          if (!o.excludeFromExport) o.lockUniScaling = lock;
        });
        // Apply to future objects via a flag
        canvas._mugLockAspect = lock;
      });
      // Initial state — enabled by default
      canvas._mugLockAspect = setLockAspect.checked;
      canvas.on('object:added', function (e) {
        if (canvas._mugLockAspect && e.target && !e.target.excludeFromExport) {
          e.target.lockUniScaling = true;
        }
      });
    }

    // 3. Snapping — soft grid snap during drag (10px grid)
    const setSnap = document.getElementById('set-snapping');
    canvas._mugSnap = setSnap ? setSnap.checked : true;
    if (setSnap) {
      setSnap.addEventListener('change', function () { canvas._mugSnap = this.checked; });
    }
    canvas.on('object:moving', function (e) {
      if (!canvas._mugSnap || !e.target || e.target.excludeFromExport) return;
      const grid = 10;
      e.target.set({
        left: Math.round(e.target.left / grid) * grid,
        top:  Math.round(e.target.top  / grid) * grid,
      });
    });

    // 4. Show all guidelines — toggle visibility of print-area guides
    const setGuides = document.getElementById('set-guidelines');
    if (setGuides) setGuides.addEventListener('change', function () {
      const show = this.checked;
      _printAreaGuides.forEach(function (o) { o.visible = show; });
      canvas.requestRenderAll();
    });

    // 5. Show gridlines — overlay grid div over canvas wrapper
    const setGrid = document.getElementById('set-gridlines');
    if (setGrid) setGrid.addEventListener('change', function () {
      const wrapper = canvas.wrapperEl;
      if (!wrapper) return;
      let grid = wrapper.querySelector('.canvas-gridlines');
      if (this.checked) {
        if (!grid) {
          grid = document.createElement('div');
          grid.className = 'canvas-gridlines';
          grid.style.left   = '0';
          grid.style.top    = '0';
          grid.style.width  = canvas.getWidth()  + 'px';
          grid.style.height = canvas.getHeight() + 'px';
          wrapper.appendChild(grid);
        }
      } else if (grid) {
        grid.remove();
      }
    });

    // 6. Show bleed mask — overlay dashed red rect at print area
    const setBleed = document.getElementById('set-bleed-mask');
    if (setBleed) setBleed.addEventListener('change', function () {
      const wrapper = canvas.wrapperEl;
      if (!wrapper) return;
      let mask = wrapper.querySelector('.canvas-bleed-mask');
      if (this.checked) {
        const pa = getPrintAreaPx();
        if (!mask) {
          mask = document.createElement('div');
          mask.className = 'canvas-bleed-mask';
          wrapper.appendChild(mask);
        }
        mask.style.left   = pa.left   + 'px';
        mask.style.top    = pa.top    + 'px';
        mask.style.width  = pa.width  + 'px';
        mask.style.height = pa.height + 'px';
      } else if (mask) {
        mask.remove();
      }
    });

    // 7. Show transparency — checkboard pattern as canvas background
    const setTrans = document.getElementById('set-transparency');
    if (setTrans) setTrans.addEventListener('change', function () {
      const wrapper = canvas.wrapperEl;
      if (!wrapper) return;
      let checker = wrapper.querySelector('.canvas-checker');
      if (this.checked) {
        if (!checker) {
          checker = document.createElement('div');
          checker.className = 'canvas-checker';
          checker.style.left   = '0';
          checker.style.top    = '0';
          checker.style.width  = canvas.getWidth()  + 'px';
          checker.style.height = canvas.getHeight() + 'px';
          wrapper.insertBefore(checker, wrapper.firstChild);
        }
        canvas.setBackgroundColor('rgba(0,0,0,0)', canvas.requestRenderAll.bind(canvas));
      } else {
        if (checker) checker.remove();
        canvas.setBackgroundColor('#f3f5f8', canvas.requestRenderAll.bind(canvas));
      }
    });

    // Drag-and-drop image upload over the canvas stage
    const stage   = document.getElementById('canvas-stage');
    const dropOv  = document.getElementById('drop-overlay');
    if (stage) {
      let _dragDepth = 0;
      stage.addEventListener('dragenter', function (e) {
        if (! e.dataTransfer || ! Array.from(e.dataTransfer.types || []).includes('Files')) return;
        e.preventDefault();
        _dragDepth++;
        if (dropOv) dropOv.classList.add('active');
      });
      stage.addEventListener('dragover', function (e) {
        if (! e.dataTransfer) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      });
      stage.addEventListener('dragleave', function () {
        _dragDepth = Math.max(0, _dragDepth - 1);
        if (_dragDepth === 0 && dropOv) dropOv.classList.remove('active');
      });
      stage.addEventListener('drop', function (e) {
        e.preventDefault();
        _dragDepth = 0;
        if (dropOv) dropOv.classList.remove('active');
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files[0]) handleFileUpload(files[0]);
      });
    }

    // Undo / Redo
    const undoBtn = document.getElementById('btn-undo');
    const redoBtn = document.getElementById('btn-redo');
    if (undoBtn) undoBtn.addEventListener('click', undo);
    if (redoBtn) redoBtn.addEventListener('click', redo);

    // ── Top-bar tab switching (Design / Options / Review — all in-page) ──
    let activeTab = 'design';
    const tabEls       = document.querySelectorAll('.topbar-tabs .tab');
    const optsPanel    = document.getElementById('options-panel');
    const tabToolRail  = document.getElementById('tool-rail');
    const tabTextPanel = document.getElementById('text-panel');
    const variantPn    = document.getElementById('variant-panel');
    const canvasEl     = document.getElementById('canvas-container');
    const zoomCtrls    = document.getElementById('zoom-controls');
    const nextBtn      = document.getElementById('btn-next-review');
    const canvasStage  = document.getElementById('canvas-stage');
    const reviewPage   = document.getElementById('review-page');

    function setTab(tab) {
      activeTab = tab;
      tabEls.forEach(function (el) {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
      const designVisible = (tab === 'design');
      const optsVisible   = (tab === 'options');
      const reviewVisible = (tab === 'review');

      // Hide tool rail, panels, canvas, zoom controls when not on Design
      if (tabToolRail)  tabToolRail.style.display  = designVisible ? '' : 'none';
      if (tabTextPanel && !designVisible) tabTextPanel.style.display = 'none';
      if (canvasEl)  canvasEl.style.display  = designVisible ? '' : 'none';
      if (zoomCtrls) zoomCtrls.style.display = designVisible ? '' : 'none';
      if (variantPn) variantPn.style.display = designVisible ? '' : 'none';
      if (optsPanel) optsPanel.style.display = optsVisible ? '' : 'none';

      // Swap canvas-stage ↔ review-page sections
      if (canvasStage) canvasStage.style.display = reviewVisible ? 'none' : '';
      if (reviewPage) {
        if (reviewVisible) {
          reviewPage.hidden = false;
          if (typeof renderReviewPage === 'function') renderReviewPage();
        } else {
          reviewPage.hidden = true;
        }
      }

      if (nextBtn) {
        const lbl = (tab === 'design')
          ? nextBtn.dataset.designLabel
          : nextBtn.dataset.optionsLabel;
        if (lbl) nextBtn.textContent = lbl;
        // Hide the Next button on Review (final step)
        nextBtn.style.display = reviewVisible ? 'none' : '';
      }
    }
    // Expose for module-level callers (goToReview)
    _setActiveTab = setTab;

    tabEls.forEach(function (el) {
      el.addEventListener('click', function (e) {
        const tab = el.dataset.tab;
        e.preventDefault();
        if (tab === 'review') { goToReview(); return; }
        setTab(tab);
      });
    });

    // Next button — flows Design → Options → Review
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (activeTab === 'design') { setTab('options'); }
        else { goToReview(); }
      });
    }

    // ── Review page wiring ─────────────────────────────────────────────────
    bindReviewPage();

    // Zoom
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomIn  = document.getElementById('btn-zoom-in');
    if (zoomOut) zoomOut.addEventListener('click', function () { setZoom(canvas.getZoom() - 0.25); });
    if (zoomIn)  zoomIn.addEventListener('click',  function () { setZoom(canvas.getZoom() + 0.25); });

    // Zoom dropdown menu — click pill to toggle, click option to set zoom
    const zoomDisplay = document.getElementById('zoom-display');
    const zoomMenu    = document.getElementById('zoom-menu');
    if (zoomDisplay && zoomMenu) {
      zoomDisplay.addEventListener('click', function (e) {
        e.stopPropagation();
        const isOpen = !zoomMenu.hasAttribute('hidden');
        if (isOpen) {
          zoomMenu.setAttribute('hidden', '');
          zoomDisplay.setAttribute('aria-expanded', 'false');
        } else {
          zoomMenu.removeAttribute('hidden');
          zoomDisplay.setAttribute('aria-expanded', 'true');
        }
      });
      zoomMenu.querySelectorAll('li').forEach(function (li) {
        li.addEventListener('click', function () {
          const v = li.getAttribute('data-zoom');
          if (v === 'fit') {
            setZoom(1);
          } else {
            setZoom(parseInt(v, 10) / 100);
          }
          zoomMenu.setAttribute('hidden', '');
          zoomDisplay.setAttribute('aria-expanded', 'false');
        });
      });
      document.addEventListener('click', function (e) {
        if (zoomMenu.hasAttribute('hidden')) return;
        if (!zoomMenu.contains(e.target) && e.target !== zoomDisplay && !zoomDisplay.contains(e.target)) {
          zoomMenu.setAttribute('hidden', '');
          zoomDisplay.setAttribute('aria-expanded', 'false');
        }
      });
    }

    // Context bar — text properties
    const ctxFont        = document.getElementById('ctx-font');
    const ctxFontPreview = document.getElementById('ctx-font-preview');
    const ctxSize        = document.getElementById('ctx-size');        // legacy hidden
    const ctxSizeInput   = document.getElementById('ctx-size-input');  // visible decimal input
    const ctxColor       = document.getElementById('ctx-color');

    if (ctxFont) {
      ctxFont.addEventListener('change', function () {
        applyTextProp('fontFamily', this.value);
        if (ctxFontPreview) {
          ctxFontPreview.textContent = this.value;
          ctxFontPreview.style.fontFamily = this.value;
        }
        // Re-evaluate B/I disabled state on font change
        const obj = canvas.getActiveObject();
        if (obj) showContextBar(obj);
      });
    }
    if (ctxSize)  ctxSize.addEventListener('change',  function () { applyTextProp('fontSize', parseFloat(this.value) || 24); });
    if (ctxColor) ctxColor.addEventListener('input',  function () {
      applyTextProp('fill', this.value);
      ctxColor.style.background = this.value;
    });

    // "Edit text" button — enters IText editing mode
    const ctxEditText = document.getElementById('ctx-edit-text');
    if (ctxEditText) {
      ctxEditText.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj && obj.enterEditing) { obj.enterEditing(); canvas.requestRenderAll(); }
      });
    }

    // Font size: − / + steppers + decimal input
    const ctxSizeVal   = document.getElementById('ctx-size-val');
    const ctxSizeMinus = document.getElementById('ctx-size-minus');
    const ctxSizePlus  = document.getElementById('ctx-size-plus');
    function _setFontSize(value) {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      const s = Math.min(200, Math.max(6, Number(value) || 0));
      applyProp('fontSize', s);
      if (ctxSizeInput) ctxSizeInput.value = _formatSize(s);
      if (ctxSizeVal)   ctxSizeVal.textContent = _formatSize(s);
      if (ctxSize)      ctxSize.value = s;
    }
    function _changeFontSize(delta) {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      _setFontSize((obj.fontSize || 24) + delta);
    }
    if (ctxSizeMinus) ctxSizeMinus.addEventListener('click', function () { _changeFontSize(-1); });
    if (ctxSizePlus)  ctxSizePlus.addEventListener('click',  function () { _changeFontSize(+1); });
    if (ctxSizeInput) {
      ctxSizeInput.addEventListener('change', function () { _setFontSize(this.value); });
      ctxSizeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { _setFontSize(this.value); this.blur(); }
      });
    }

    // Alignment dropdown (replaces 3 separate buttons)
    const ctxAlignSel = document.getElementById('ctx-align-select');
    if (ctxAlignSel) {
      ctxAlignSel.addEventListener('change', function () { applyProp('textAlign', this.value); });
    }
    // Hidden legacy align buttons — keep working for keyboard/programmatic calls
    ['left','center','right'].forEach(function (align) {
      const btn = document.getElementById('ctx-align-' + align);
      if (btn) btn.addEventListener('click', function () {
        applyProp('textAlign', align);
        if (ctxAlignSel) ctxAlignSel.value = align;
      });
    });

    // Spacing dropdown (☰ ▾) — opens popover with letter-spacing + line-height sliders
    const ctxSpacingToggle = document.getElementById('ctx-spacing-toggle');
    const ctxSpacingPanel  = document.getElementById('ctx-spacing-panel');
    if (ctxSpacingToggle && ctxSpacingPanel) {
      ctxSpacingToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const open = ctxSpacingPanel.hidden;
        // Close other popover
        const mp = document.getElementById('ctx-more-panel');
        const mT = document.getElementById('ctx-more-toggle');
        if (mp) mp.hidden = true;
        if (mT) { mT.classList.remove('ctx-active'); mT.setAttribute('aria-expanded', 'false'); }
        ctxSpacingPanel.hidden = !open;
        ctxSpacingToggle.classList.toggle('ctx-active', open);
        ctxSpacingToggle.setAttribute('aria-expanded', String(open));
      });
    }

    // "More options" (▶) — opens panel with rotation, stroke, layer order, duplicate
    const ctxMoreToggle = document.getElementById('ctx-more-toggle');
    const ctxMorePanel  = document.getElementById('ctx-more-panel');
    if (ctxMoreToggle && ctxMorePanel) {
      ctxMoreToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const open = ctxMorePanel.hidden;
        // Close other popover
        if (ctxSpacingPanel) ctxSpacingPanel.hidden = true;
        if (ctxSpacingToggle) { ctxSpacingToggle.classList.remove('ctx-active'); ctxSpacingToggle.setAttribute('aria-expanded', 'false'); }
        ctxMorePanel.hidden = !open;
        ctxMoreToggle.classList.toggle('ctx-active', open);
        ctxMoreToggle.setAttribute('aria-expanded', String(open));
      });
    }

    // ── Alignment popover (Zazzle parity rich panel) ────────────────────────
    const ctxAlignToggle  = document.getElementById('ctx-align-toggle');
    const ctxAlignPopover = document.getElementById('ctx-align-popover');
    if (ctxAlignToggle && ctxAlignPopover) {
      ctxAlignToggle.addEventListener('click', function (e) {
        e.stopPropagation();
        const open = ctxAlignPopover.hidden;
        if (ctxSpacingPanel) ctxSpacingPanel.hidden = true;
        if (ctxMorePanel)    ctxMorePanel.hidden    = true;
        if (ctxSpacingToggle) { ctxSpacingToggle.classList.remove('ctx-active'); ctxSpacingToggle.setAttribute('aria-expanded', 'false'); }
        if (ctxMoreToggle)    { ctxMoreToggle.classList.remove('ctx-active');    ctxMoreToggle.setAttribute('aria-expanded', 'false'); }
        ctxAlignPopover.hidden = !open;
        ctxAlignToggle.classList.toggle('ctx-active', open);
        ctxAlignToggle.setAttribute('aria-expanded', String(open));
      });
    }

    // Print-area artboard rect — used as the alignment reference frame
    function _getArtboardRect() {
      const pa = (typeof MUG_VIEWS !== 'undefined' && MUG_VIEWS.center && MUG_VIEWS.center.printArea)
        ? MUG_VIEWS.center.printArea
        : { x: 140, y: 110, w: 540, h: 200 };
      return { left: pa.x, top: pa.y, right: pa.x + pa.w, bottom: pa.y + pa.h, w: pa.w, h: pa.h };
    }

    // Resolve alignment reference frame (Artboard = print area, Selection = canvas)
    function _getAlignFrame() {
      const ref = (document.querySelector('input[name="ctx-align-to"]:checked') || {}).value || 'artboard';
      if (ref === 'selection') return { left: 0, top: 0, right: canvas.getWidth(), bottom: canvas.getHeight(), w: canvas.getWidth(), h: canvas.getHeight() };
      return _getArtboardRect();
    }

    // Position-align the active object inside the resolved reference frame.
    // Uses delta-from-bbox math so it works for any origin / rotation / scale.
    function _alignActive(direction) {
      const obj = canvas.getActiveObject();
      if (!obj) return;

      // Defensive: clear tiling clones (so the original text is the visible one
      // being aligned) and make sure object is visible / opaque / on top.
      if (obj._tileClones) _clearTiles(obj);
      obj.visible = true;
      if (!(obj.opacity > 0)) obj.set('opacity', 1);
      canvas.bringToFront(obj);

      const ab = _getAlignFrame();
      const bb = obj.getBoundingRect(true, true);

      let targetLeft = bb.left;
      let targetTop  = bb.top;
      switch (direction) {
        case 'left':   targetLeft = ab.left; break;
        case 'center': targetLeft = ab.left + (ab.w - bb.width)  / 2; break;
        case 'right':  targetLeft = ab.right - bb.width; break;
        case 'top':    targetTop  = ab.top; break;
        case 'middle': targetTop  = ab.top  + (ab.h - bb.height) / 2; break;
        case 'bottom': targetTop  = ab.bottom - bb.height; break;
      }

      // Shift the object by the delta — works regardless of origin/transforms
      const dx = targetLeft - bb.left;
      const dy = targetTop  - bb.top;
      obj.set({ left: obj.left + dx, top: obj.top + dy });
      obj.setCoords();
      canvas.requestRenderAll();
      pushHistory();
      updateCss3dPreview(obj);

      // Visual feedback — brief active highlight on clicked button
      const btn = document.querySelector('#ctx-align-popover .ctx-pop-btn[data-align="' + direction + '"]');
      if (btn) {
        btn.classList.add('is-active');
        setTimeout(function () { btn.classList.remove('is-active'); }, 220);
      }
    }

    // Distribute (single-object stretch to fill reference frame on chosen axis)
    function _distributeActive(axis) {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      const ab = _getAlignFrame();
      const bb = obj.getBoundingRect(true, true);
      if (axis === 'h') {
        const factor = ab.w / bb.width;
        obj.set('scaleX', (obj.scaleX || 1) * factor);
        obj.set('left', ab.left + (obj.left - bb.left) * factor);
      } else {
        const factor = ab.h / bb.height;
        obj.set('scaleY', (obj.scaleY || 1) * factor);
        obj.set('top', ab.top + (obj.top - bb.top) * factor);
      }
      obj.setCoords(); canvas.requestRenderAll(); pushHistory(); updateCss3dPreview(obj);
    }

    // Keep popover open when clicking anywhere inside it
    if (ctxAlignPopover) {
      ctxAlignPopover.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    document.querySelectorAll('#ctx-align-popover .ctx-align-grid .ctx-pop-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        _alignActive(btn.getAttribute('data-align'));
      });
    });

    // Flip H / V
    const ctxFlipH = document.getElementById('ctx-flip-h');
    const ctxFlipV = document.getElementById('ctx-flip-v');
    if (ctxFlipH) ctxFlipH.addEventListener('click', function (e) {
      e.stopPropagation();
      const obj = canvas.getActiveObject(); if (!obj) return;
      obj.set('flipX', !obj.flipX); canvas.requestRenderAll(); pushHistory(); updateCss3dPreview(obj);
    });
    if (ctxFlipV) ctxFlipV.addEventListener('click', function (e) {
      e.stopPropagation();
      const obj = canvas.getActiveObject(); if (!obj) return;
      obj.set('flipY', !obj.flipY); canvas.requestRenderAll(); pushHistory(); updateCss3dPreview(obj);
    });

    // Scale −/+ (10% per click)
    const ctxScaleDown = document.getElementById('ctx-scale-down');
    const ctxScaleUp   = document.getElementById('ctx-scale-up');
    function _scaleBy(factor) {
      const obj = canvas.getActiveObject(); if (!obj) return;
      const sx = (obj.scaleX || 1) * factor;
      const sy = (obj.scaleY || 1) * factor;
      obj.set({ scaleX: Math.min(8, Math.max(0.1, sx)), scaleY: Math.min(8, Math.max(0.1, sy)) });
      obj.setCoords(); canvas.requestRenderAll(); pushHistory(); updateCss3dPreview(obj);
    }
    if (ctxScaleDown) ctxScaleDown.addEventListener('click', function (e) { e.stopPropagation(); _scaleBy(0.9); });
    if (ctxScaleUp)   ctxScaleUp.addEventListener('click',   function (e) { e.stopPropagation(); _scaleBy(1.1); });

    // Distribute (single-object stretch to the chosen reference frame)
    const ctxDistH = document.getElementById('ctx-distribute-h');
    const ctxDistV = document.getElementById('ctx-distribute-v');
    if (ctxDistH) ctxDistH.addEventListener('click', function (e) { e.stopPropagation(); _distributeActive('h'); });
    if (ctxDistV) ctxDistV.addEventListener('click', function (e) { e.stopPropagation(); _distributeActive('v'); });

    // Rotate CCW / input / CW
    const ctxRotateCcw   = document.getElementById('ctx-rotate-ccw');
    const ctxRotateCw    = document.getElementById('ctx-rotate-cw');
    const ctxRotateInput = document.getElementById('ctx-rotate-input');
    function _setAngle(a) {
      const obj = canvas.getActiveObject(); if (!obj) return;
      const norm = ((a % 360) + 360) % 360;
      obj.set('angle', norm); obj.setCoords();
      canvas.requestRenderAll(); pushHistory(); updateCss3dPreview(obj);
      if (ctxRotateInput) ctxRotateInput.value = Math.round(norm);
    }
    if (ctxRotateCcw) ctxRotateCcw.addEventListener('click', function (e) {
      e.stopPropagation();
      const obj = canvas.getActiveObject(); if (!obj) return;
      _setAngle((obj.angle || 0) - 15);
    });
    if (ctxRotateCw) ctxRotateCw.addEventListener('click', function (e) {
      e.stopPropagation();
      const obj = canvas.getActiveObject(); if (!obj) return;
      _setAngle((obj.angle || 0) + 15);
    });
    if (ctxRotateInput) {
      ctxRotateInput.addEventListener('click',  function (e) { e.stopPropagation(); });
      ctxRotateInput.addEventListener('change', function () { _setAngle(parseFloat(this.value) || 0); });
    }

    // ── Effects flyout panel ────────────────────────────────────────────────
    const fxToggle = document.getElementById('ctx-effects-toggle');
    const fxPanel  = document.getElementById('effects-panel');
    const fxClose  = document.getElementById('effects-panel-close');

    function _openEffects() {
      if (!fxPanel) return;
      // Close other left flyouts to avoid overlap
      ['text-panel', 'uploads-panel', 'images-panel'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      });
      fxPanel.hidden = false;
      const stage = document.getElementById('canvas-stage');
      if (stage) stage.classList.add('fx-open');
      if (fxToggle) fxToggle.classList.add('ctx-active');
      _syncEffectsPanel(canvas.getActiveObject());
    }
    function _closeEffects() {
      if (!fxPanel) return;
      fxPanel.hidden = true;
      const stage = document.getElementById('canvas-stage');
      if (stage) stage.classList.remove('fx-open');
      if (fxToggle) fxToggle.classList.remove('ctx-active');
    }
    if (fxToggle) fxToggle.addEventListener('click', function (e) {
      e.stopPropagation();
      if (fxPanel && fxPanel.hidden) _openEffects(); else _closeEffects();
    });
    if (fxClose) fxClose.addEventListener('click', function (e) { e.stopPropagation(); _closeEffects(); });

    // Section collapse/expand — toggle via section header click (works on
    // chevron and title via event bubbling)
    document.querySelectorAll('#effects-panel .fx-section .fx-section-header').forEach(function (h) {
      h.addEventListener('click', function (e) {
        e.stopPropagation();
        h.parentElement.classList.toggle('is-collapsed');
      });
    });

    // Clicks anywhere inside the Effects panel should NOT close toolbar popovers
    if (fxPanel) {
      fxPanel.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    // Sync uses the module-level syncEffectsPanel (so it can be called from
    // showContextBar when selection changes while the panel is open)
    function _syncEffectsPanel(obj) { syncEffectsPanel(obj); }

    // Opacity
    function _bindRangeInput(rangeId, inputId, fn) {
      const r = document.getElementById(rangeId);
      const i = document.getElementById(inputId);
      const apply = function (v) { fn(v); if (r) r.value = v; if (i) i.value = v; };
      if (r) r.addEventListener('input', function () { apply(this.value); });
      if (i) i.addEventListener('change', function () { apply(this.value); });
    }
    _bindRangeInput('fx-opacity', 'fx-opacity-input', function (v) {
      applyProp('opacity', Math.max(0, Math.min(1, parseFloat(v) / 100)));
    });
    _bindRangeInput('fx-line-spacing', 'fx-line-spacing-input', function (v) {
      applyProp('lineHeight', parseFloat(v) || 1);
    });
    _bindRangeInput('fx-letter-spacing', 'fx-letter-spacing-input', function (v) {
      applyProp('charSpacing', parseFloat(v) || 0);
    });
    _bindRangeInput('fx-stroke-width', 'fx-stroke-width-input', function (v) {
      applyProp('strokeWidth', parseFloat(v) || 0);
    });

    // Shadow toggle
    const fxShadow = document.getElementById('fx-shadow');
    if (fxShadow) {
      fxShadow.addEventListener('change', function () {
        const obj = canvas.getActiveObject(); if (!obj) return;
        if (this.checked) {
          obj.set('shadow', new fabric.Shadow({ color: 'rgba(0,0,0,0.4)', blur: 6, offsetX: 2, offsetY: 2 }));
        } else {
          obj.set('shadow', null);
        }
        canvas.requestRenderAll(); pushHistory();
        const lbl = document.getElementById('fx-shadow-state');
        if (lbl) lbl.textContent = 'Text Shadow: ' + (this.checked ? 'on' : 'off');
        updateCss3dPreview(obj);
      });
    }

    // Stroke toggle + color
    const fxStrokeChk   = document.getElementById('fx-stroke');
    const fxStrokeColor = document.getElementById('fx-stroke-color');
    if (fxStrokeChk) {
      fxStrokeChk.addEventListener('change', function () {
        const obj = canvas.getActiveObject(); if (!obj) return;
        const ctl = document.querySelector('#effects-panel .fx-stroke-controls');
        if (this.checked) {
          obj.set({ stroke: fxStrokeColor ? fxStrokeColor.value : '#000000', strokeWidth: 1 });
        } else {
          obj.set({ stroke: null, strokeWidth: 0 });
        }
        if (ctl) ctl.hidden = !this.checked;
        canvas.requestRenderAll(); pushHistory();
        const lbl = document.getElementById('fx-stroke-state');
        if (lbl) lbl.textContent = 'Text Stroke: ' + (this.checked ? 'on' : 'off');
        const w = document.getElementById('fx-stroke-width');
        const wi = document.getElementById('fx-stroke-width-input');
        if (w)  w.value  = obj.strokeWidth || 0;
        if (wi) wi.value = obj.strokeWidth || 0;
        updateCss3dPreview(obj);
      });
    }
    if (fxStrokeColor) fxStrokeColor.addEventListener('input', function () { applyProp('stroke', this.value); });

    // ── Tiling engine ───────────────────────────────────────────────────────
    function _isTextObj(o) {
      return o && (o.type === 'IText' || o.type === 'i-text' || o.type === 'Textbox' || typeof o.text === 'string');
    }
    function _clearTiles(obj) {
      if (!obj || !obj._tileClones) return;
      obj._tileClones.forEach(function (c) { canvas.remove(c); });
      delete obj._tileClones;
    }
    function _applyTiling(pattern) {
      const obj = canvas.getActiveObject();
      if (!_isTextObj(obj) || obj._isTileClone) return;

      _clearTiles(obj);

      if (pattern === 'none') {
        obj.visible = true;
        canvas.requestRenderAll();
        pushHistory();
        return;
      }

      const ab = _getArtboardRect();
      const cols = (pattern === 'halfbrick') ? 3 : 2;
      const rows = (pattern === 'halfdrop')  ? 3 : 2;
      const cellW = ab.w / cols;
      const cellH = ab.h / rows;

      // Hide the original; tiles take its place
      obj.visible = false;

      const baseProps = ['text','fontFamily','fontSize','fontWeight','fontStyle',
        'fill','stroke','strokeWidth','underline','linethrough','overline',
        'charSpacing','lineHeight','textAlign','shadow'];
      const propsObj = {};
      baseProps.forEach(function (k) { propsObj[k] = obj[k]; });

      const clones = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const offsetX = (pattern === 'halfbrick' && r % 2 === 1) ? cellW / 2 : 0;
          const offsetY = (pattern === 'halfdrop'  && c % 2 === 1) ? cellH / 2 : 0;
          const flip    = (pattern === 'mirror' && c % 2 === 1);

          const clone = new fabric.IText(propsObj.text, Object.assign({}, propsObj, {
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            flipX: flip,
            scaleX: 0.45 * (obj.scaleX || 1),
            scaleY: 0.45 * (obj.scaleY || 1)
          }));
          clone._isTileClone = true;
          clone.set({
            left: ab.left + (c + 0.5) * cellW + offsetX,
            top:  ab.top  + (r + 0.5) * cellH + offsetY
          });
          clone.setCoords();
          canvas.add(clone);
          clones.push(clone);
        }
      }
      obj._tileClones = clones;
      // Keep the original in the DOM but hidden — it's still the "active" text
      // so subsequent edits on the popover apply to it
      canvas.bringToFront(obj);
      canvas.requestRenderAll();
      pushHistory();
    }

    document.querySelectorAll('#effects-panel .fx-tile').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        document.querySelectorAll('#effects-panel .fx-tile').forEach(function (x) { x.classList.remove('is-active'); });
        t.classList.add('is-active');
        _applyTiling(t.getAttribute('data-tiling'));
      });
    });

    // ── Curved text engine (text-on-path) ───────────────────────────────────
    function _applyCurve(angleDeg) {
      const obj = canvas.getActiveObject();
      if (!_isTextObj(obj)) return;

      if (!angleDeg || angleDeg === 0) {
        obj.set('path', null);
        obj.setCoords();
        canvas.requestRenderAll();
        pushHistory();
        updateCss3dPreview(obj);
        return;
      }

      const a = Math.max(-180, Math.min(180, angleDeg));
      const sign = a > 0 ? 1 : -1;
      const rad  = Math.abs(a) * Math.PI / 180;
      // Width of straight text (un-curved) — use the original textWidth or render bbox
      const baseW = (obj.path ? (obj._origPathW || 200) : (obj.width * (obj.scaleX || 1))) || 200;
      if (!obj._origPathW) obj._origPathW = baseW;

      // Build a quadratic-bezier arc that bulges by sagitta
      const radius   = baseW / (2 * Math.sin(rad / 2));
      const sagitta  = radius - radius * Math.cos(rad / 2);
      const path = new fabric.Path(
        'M 0 0 Q ' + (baseW / 2) + ' ' + (sign * sagitta * 2) + ' ' + baseW + ' 0',
        { fill: '', stroke: '', visible: false, objectCaching: false }
      );
      obj.set('path', path);
      obj.setCoords();
      canvas.requestRenderAll();
      pushHistory();
      updateCss3dPreview(obj);
    }
    _bindRangeInput('fx-curve', 'fx-curve-input', function (v) {
      _applyCurve(parseFloat(v) || 0);
    });

    // ── Vertical orientation engine ─────────────────────────────────────────
    function _setOrientation(orient) {
      const obj = canvas.getActiveObject();
      if (!_isTextObj(obj)) return;

      if (orient === 'vertical') {
        if (obj._origText == null) obj._origText = obj.text;
        const chars = String(obj._origText).split('');
        obj.set('text', chars.join('\n'));
        obj.set('textAlign', 'center');
      } else {
        if (obj._origText != null) {
          obj.set('text', obj._origText);
          delete obj._origText;
        }
      }
      obj.setCoords();
      canvas.requestRenderAll();
      pushHistory();
      updateCss3dPreview(obj);
    }

    document.querySelectorAll('#effects-panel .fx-orient').forEach(function (t) {
      t.addEventListener('click', function (e) {
        e.stopPropagation();
        document.querySelectorAll('#effects-panel .fx-orient').forEach(function (x) { x.classList.remove('is-active'); });
        t.classList.add('is-active');
        _setOrientation(t.getAttribute('data-orient'));
      });
    });

    // Click anywhere outside the bar → close popovers
    document.addEventListener('click', function (e) {
      const bar = document.getElementById('context-bar');
      if (bar && !bar.contains(e.target)) _closePopovers();
    });

    const ctxBold   = document.getElementById('ctx-bold');
    const ctxItalic = document.getElementById('ctx-italic');
    if (ctxBold) {
      ctxBold.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj) applyTextProp('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
      });
    }
    if (ctxItalic) {
      ctxItalic.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj) applyTextProp('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
      });
    }

    // M2 — Underline
    const ctxUnderline = document.getElementById('ctx-underline');
    if (ctxUnderline) {
      ctxUnderline.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj) applyProp('underline', !obj.underline);
        this.classList.toggle('ctx-active', !!canvas.getActiveObject()?.underline);
      });
    }

    // M3 — Letter spacing
    const ctxSpacing = document.getElementById('ctx-spacing');
    if (ctxSpacing) {
      ctxSpacing.addEventListener('input', function () { applyProp('charSpacing', parseInt(this.value, 10)); });
    }

    // M3 — Line height
    const ctxLineH = document.getElementById('ctx-lineheight');
    if (ctxLineH) {
      ctxLineH.addEventListener('input', function () { applyProp('lineHeight', parseInt(this.value, 10) / 100); });
    }

    // M4 — Stroke color + width
    const ctxStrokeColor = document.getElementById('ctx-stroke-color');
    const ctxStrokeWidth = document.getElementById('ctx-stroke-width');
    if (ctxStrokeColor) ctxStrokeColor.addEventListener('input', function () { applyProp('stroke', this.value); });
    if (ctxStrokeWidth) ctxStrokeWidth.addEventListener('change', function () {
      applyProp('strokeWidth', parseFloat(this.value) || 0);
    });

    // P1/P2 — Rotation angle inputs (text + image bars)
    const ctxAngle    = document.getElementById('ctx-angle');
    const ctxImgAngle = document.getElementById('ctx-img-angle');
    if (ctxAngle)    ctxAngle.addEventListener('change',    function () { applyProp('angle', parseFloat(this.value) || 0); });
    if (ctxImgAngle) ctxImgAngle.addEventListener('change', function () { applyProp('angle', parseFloat(this.value) || 0); });

    // M10 — Layer controls (text bar)
    ['up','down','front','back'].forEach(function (op) {
      const btn = document.getElementById('ctx-layer-' + op);
      if (btn) btn.addEventListener('click', function () { layerOp(op); });
    });

    // Duplicate (text bar)
    const ctxDup = document.getElementById('ctx-duplicate');
    if (ctxDup) ctxDup.addEventListener('click', duplicateActive);

    // Delete (text bar)
    const ctxDelete = document.getElementById('ctx-delete');
    if (ctxDelete) {
      ctxDelete.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.remove(obj); canvas.requestRenderAll(); pushHistory(); }
      });
    }

    // ── Image context bar bindings ──────────────────────────────────────────

    // Auto-fit (image bar)
    const ctxFit = document.getElementById('ctx-img-fit');
    if (ctxFit) ctxFit.addEventListener('click', autoFitToPrintArea);

    // M8 — Flip H / V
    const flipH = document.getElementById('ctx-img-flip-h');
    const flipV = document.getElementById('ctx-img-flip-v');
    if (flipH) flipH.addEventListener('click', function () {
      const obj = canvas.getActiveObject();
      if (obj) { obj.set('flipX', !obj.flipX); canvas.requestRenderAll(); pushHistory(); }
    });
    if (flipV) flipV.addEventListener('click', function () {
      const obj = canvas.getActiveObject();
      if (obj) { obj.set('flipY', !obj.flipY); canvas.requestRenderAll(); pushHistory(); }
    });

    // Opacity
    const ctxOpacity = document.getElementById('ctx-img-opacity');
    const ctxOpacityVal = document.getElementById('ctx-img-opacity-val');
    if (ctxOpacity) {
      ctxOpacity.addEventListener('input', function () {
        applyProp('opacity', parseInt(this.value, 10) / 100);
        if (ctxOpacityVal) ctxOpacityVal.textContent = this.value + '%';
      });
    }

    // M10 — Layer controls (image bar)
    ['up','down','front','back'].forEach(function (op) {
      const btn = document.getElementById('ctx-img-layer-' + op);
      if (btn) btn.addEventListener('click', function () { layerOp(op); });
    });

    // Duplicate (image bar)
    const imgDup = document.getElementById('ctx-img-duplicate');
    if (imgDup) imgDup.addEventListener('click', duplicateActive);

    // Delete (image bar)
    const imgDelete = document.getElementById('ctx-img-delete');
    if (imgDelete) {
      imgDelete.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj) { canvas.remove(obj); canvas.requestRenderAll(); pushHistory(); }
      });
    }

    // C2 — variant panel
    const styleSelect = document.getElementById('variant-style');
    const sizeSelect  = document.getElementById('variant-size');
    if (styleSelect) styleSelect.addEventListener('change', function () { updateVariant('style', this.value); });
    if (sizeSelect)  sizeSelect.addEventListener('change',  function () { updateVariant('size',  this.value); });

    document.querySelectorAll('.color-swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.color-swatch').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        updateVariant('color', btn.dataset.color);
      });
    });

    // ── Full Preview Modal bindings ─────────────────────────────────────────
    var previewBtn   = document.getElementById('btn-preview');
    var previewModal = document.getElementById('preview-modal');
    var pmClose      = document.getElementById('preview-modal-close');
    var pmLabel      = document.getElementById('preview-modal-label');
    var pmCanvas     = document.getElementById('preview-modal-canvas');

    if (previewBtn)   previewBtn.addEventListener('click', openPreviewModal);
    if (pmClose)      pmClose.addEventListener('click', closePreviewModal);
    if (previewModal) {
      previewModal.addEventListener('click', function (e) {
        if (e.target === previewModal) closePreviewModal();
      });
    }

    // Thumbnail clicks inside preview modal — real-photo pipeline only
    document.querySelectorAll('.preview-modal-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        document.querySelectorAll('.preview-modal-thumb')
          .forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        if (pmLabel) pmLabel.textContent = thumb.dataset.label || '';

        var modal = document.getElementById('preview-modal');
        var dUrl  = _captureDesignLayer(1);
        if (!modal || !dUrl) return;
        var dImg = new Image();
        dImg.onload = function () { _renderModalMainCanvas(modal, dImg); };
        dImg.src = dUrl;
        return; // skip the legacy Three.js fallback below

        // (legacy code below intentionally unreachable — kept for diff context)
        var isDonut = thumb.dataset.isDonut === 'true';
        var deg     = parseFloat(thumb.dataset.angle || '0');

        if (isDonut) {
          _showThreeView(false);
          var dUrl0 = _captureDesignLayer(1);
          if (!dUrl0 || !pmCanvas) return;
          var pa2  = getPrintAreaPx();
          var dImg0 = new Image();
          dImg0.onload = function () {
            renderDonutView(pmCanvas.getContext('2d'), pmCanvas.width, pmCanvas.height, dImg0, pa2);
          };
          dImg0.src = dUrl0;
        } else if (_threeInited) {
          _showThreeView(true);
          _renderThreeScene(deg);
        } else {
          _showThreeView(true);
          var dUrl2 = _captureDesignLayer(1);
          if (!dUrl2) return;
          var pa3   = getPrintAreaPx();
          var dImg2 = new Image();
          dImg2.onload = function () { createMugPreview(dImg2, deg); };
          dImg2.src = dUrl2;
        }
      });
    });

    // Mobile notice
    if (window.innerWidth < 768) {
      const notice = document.getElementById('mobile-notice');
      if (notice) notice.style.display = 'block';
    }

    // P3 — Space key tracking for canvas pan
    document.addEventListener('keydown', function (e) {
      if (e.code === 'Space') {
        const tag = (document.activeElement.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && tag !== 'select') {
          e.preventDefault();
          if (!_spaceDown) {
            _spaceDown = true;
            canvas.defaultCursor = 'grab';
            canvas.hoverCursor   = 'grab';
          }
        }
      }
    });
    document.addEventListener('keyup', function (e) {
      if (e.code === 'Space') {
        _spaceDown = false;
        _isPanning = false;
        canvas.defaultCursor = 'default';
        canvas.hoverCursor   = 'move';
      }
    });

    // C3 — keyboard shortcuts
    document.addEventListener('keydown', function (e) {
      const tag = (document.activeElement.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.code === 'Space') return; // handled above

      const obj = canvas.getActiveObject();
      const ctrl = e.ctrlKey || e.metaKey;

      // Undo / Redo
      if (ctrl && e.key === 'z') { e.preventDefault(); undo(); return; }
      if (ctrl && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) { e.preventDefault(); redo(); return; }

      // Delete selected
      if ((e.key === 'Delete' || e.key === 'Backspace') && obj) {
        e.preventDefault();
        canvas.remove(obj);
        canvas.requestRenderAll();
        return;
      }

      // Duplicate
      if (ctrl && e.key === 'd' && obj) { e.preventDefault(); duplicateActive(); return; }

      // Select all (design objects only, exclude print area guides)
      if (ctrl && e.key === 'a') {
        e.preventDefault();
        const objs = canvas.getObjects().filter(function (o) { return !o.excludeFromExport && o !== canvas.backgroundImage; });
        if (objs.length) {
          canvas.setActiveObject(new fabric.ActiveSelection(objs, { canvas: canvas }));
          canvas.requestRenderAll();
        }
        return;
      }

      // Arrow nudge
      if (obj && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const d  = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0;
        const dy = e.key === 'ArrowUp'   ? -d : e.key === 'ArrowDown'  ? d : 0;
        obj.set({ left: obj.left + dx, top: obj.top + dy });
        obj.setCoords();
        canvas.requestRenderAll();
        pushHistory();
      }
    });

    // ── Background panel ────────────────────────────────────────────────────
    bindBackgroundPanel();
  }

  // ── Review page (in-page tab) ──────────────────────────────────────────
  function _formatShipDate(addBizDays) {
    var d = new Date();
    var added = 0;
    while (added < addBizDays) {
      d.setDate(d.getDate() + 1);
      var dow = d.getDay();
      if (dow !== 0 && dow !== 6) added++;
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function renderReviewPage() {
    var page = document.getElementById('review-page');
    if (!page) return;

    // Populate ship dates (5 / 10 business days)
    var fast = document.getElementById('ship-date-fast');
    var std  = document.getElementById('ship-date-std');
    if (fast) fast.textContent = _formatShipDate(5);
    if (std)  std.textContent  = _formatShipDate(10);

    // Capture current design layer
    var designUrl = _captureDesignLayer(1);
    if (!designUrl) return;

    var dImg = new Image();
    dImg.onload = function () {
      // Render every thumbnail with its angle photo + design composited
      page.querySelectorAll('.review-thumb').forEach(function (thumb) {
        var cv  = thumb.querySelector('canvas');
        if (!cv) return;
        var ctx = cv.getContext('2d');
        var key = thumb.dataset.angleKey || 'center';
        var ang = _angleByKey(key);
        if (!ang) return;
        _loadPreviewPhoto(ang.img, function (photoEl) {
          renderRealAngleView(ctx, cv.width, cv.height, dImg, photoEl, ang.paPct, ang.angle);
        });
      });

      // Render main preview for the active angle
      var active = page.querySelector('.review-thumb.active') || page.querySelector('.review-thumb');
      _renderReviewMain(active ? active.dataset.angleKey : 'left', dImg);
    };
    dImg.src = designUrl;
  }

  function _renderReviewMain(angleKey, dImg) {
    var canvasEl = document.getElementById('review-main-canvas');
    var labelEl  = document.getElementById('review-main-label');
    if (!canvasEl) return;
    var ang = _angleByKey(angleKey || 'left');
    if (!ang) return;
    if (labelEl) labelEl.textContent = ang.label;
    var ctx = canvasEl.getContext('2d');

    function paint(designImg) {
      _loadPreviewPhoto(ang.img, function (photoEl) {
        renderRealAngleView(ctx, canvasEl.width, canvasEl.height, designImg, photoEl, ang.paPct, ang.angle);
      });
    }
    if (dImg) { paint(dImg); return; }
    var url = _captureDesignLayer(1);
    if (!url) { paint(null); return; }
    var img = new Image();
    img.onload = function () { paint(img); };
    img.src = url;
  }

  function bindReviewPage() {
    var page = document.getElementById('review-page');
    if (!page) return;

    // Thumbnail clicks → re-render main
    page.querySelectorAll('.review-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        page.querySelectorAll('.review-thumb').forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        _renderReviewMain(thumb.dataset.angleKey);
      });
    });

    // Sell / Buy toggle (visual only V1)
    page.querySelectorAll('.review-sb-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        page.querySelectorAll('.review-sb-btn').forEach(function (b) {
          b.classList.remove('is-active');
          b.setAttribute('aria-selected', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-selected', 'true');
      });
    });

    // Quantity stepper + live subtotal
    var qtyInput = document.getElementById('review-qty');
    var qtyMinus = document.getElementById('review-qty-minus');
    var qtyPlus  = document.getElementById('review-qty-plus');
    var rail     = page.querySelector('.review-rail');
    var priceEl  = document.getElementById('review-price');
    var unit     = rail ? parseFloat(rail.dataset.unitPrice) || 15.05 : 15.05;

    function updateSubtotal() {
      var q = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
      qtyInput.value = q;
      if (priceEl) priceEl.textContent = '$' + (unit * q).toFixed(2);
    }
    if (qtyInput) qtyInput.addEventListener('change', updateSubtotal);
    if (qtyInput) qtyInput.addEventListener('input',  updateSubtotal);
    if (qtyMinus) qtyMinus.addEventListener('click', function () {
      qtyInput.value = Math.max(1, (parseInt(qtyInput.value, 10) || 1) - 1);
      updateSubtotal();
    });
    if (qtyPlus) qtyPlus.addEventListener('click', function () {
      qtyInput.value = Math.min(99, (parseInt(qtyInput.value, 10) || 1) + 1);
      updateSubtotal();
    });

    // Add to Cart — serialise design + delegate to existing flow
    var atc = document.getElementById('review-add-to-cart');
    if (atc) atc.addEventListener('click', function () {
      var qty = Math.max(1, Math.min(99, parseInt(qtyInput.value, 10) || 1));
      atc.classList.add('is-loading');
      atc.querySelector('span').textContent = 'Adding…';
      try {
        var design = serializeDesign(true);
        saveToSession(design);
        // Reuse existing review URL flow if present, otherwise emit event
        if (cfg && cfg.reviewUrl) {
          window.location.href = cfg.reviewUrl + '&qty=' + qty;
        } else {
          showToast('Added to cart');
        }
      } catch (e) {
        atc.classList.remove('is-loading');
        atc.querySelector('span').textContent = 'Add to Cart';
        showToast('Couldn’t add — try again');
      }
    });

    // Re-render main when window resizes (handles responsive layout shift)
    window.addEventListener('resize', function () {
      if (page.hidden) return;
      var active = page.querySelector('.review-thumb.active');
      if (active) _renderReviewMain(active.dataset.angleKey);
    });
  }

  // Preset background library — V1 uses CSS gradients/patterns inline. Real
  // photo presets can be appended once asset files land in
  // public/assets/images/backgrounds/.
  var _BG_PRESETS = [
    { id: 'p01', kind: 'print', name: 'Black geometric',  css: 'repeating-linear-gradient(45deg, #1a1a1a 0 8px, #2a2a2a 8px 16px)', tags: ['pattern','dark'] },
    { id: 'p02', kind: 'print', name: 'White marble',     css: 'linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 40%, #d1d5db 60%, #f3f4f6 100%)', tags: ['marble','light'] },
    { id: 'p03', kind: 'web',   name: 'Rainbow bokeh',    css: 'radial-gradient(circle at 30% 20%, #fbcfe8 0, transparent 18%), radial-gradient(circle at 70% 60%, #a5b4fc 0, transparent 22%), radial-gradient(circle at 50% 80%, #fde68a 0, transparent 20%), linear-gradient(135deg, #fbcfe8, #a5b4fc)', tags: ['bokeh'] },
    { id: 'p04', kind: 'print', name: 'Grey marble',      css: 'linear-gradient(135deg, #d1d5db 0%, #9ca3af 50%, #d1d5db 100%)', tags: ['marble'] },
    { id: 'p05', kind: 'web',   name: 'Sunset',           css: 'linear-gradient(180deg, #fbbf24, #ec4899, #6d28d9)', tags: ['gradient','sunset'] },
    { id: 'p06', kind: 'print', name: 'Linen',            css: 'repeating-linear-gradient(0deg, #f5f5dc 0 2px, #ede8c8 2px 4px)', tags: ['texture','light'] },
    { id: 'p07', kind: 'web',   name: 'Ocean',            css: 'linear-gradient(180deg, #0c4a6e, #0ea5e9, #7dd3fc)', tags: ['gradient','blue'] },
    { id: 'p08', kind: 'print', name: 'Kraft paper',      css: 'linear-gradient(135deg, #d4a574, #b88a5d)', tags: ['texture'] },
    { id: 'p09', kind: 'web',   name: 'Mint dots',        css: 'radial-gradient(#a7f3d0 1.5px, transparent 2px) 0 0/14px 14px, #ecfdf5', tags: ['pattern','green'] },
    { id: 'p10', kind: 'print', name: 'Charcoal',         css: 'linear-gradient(180deg, #1c1917, #292524)', tags: ['solid','dark'] },
    { id: 'p11', kind: 'web',   name: 'Coral wave',       css: 'linear-gradient(135deg, #fbcfe8, #f97316, #ec4899)', tags: ['gradient','warm'] },
    { id: 'p12', kind: 'print', name: 'Stripes',          css: 'repeating-linear-gradient(90deg, #ffffff 0 12px, #f3f4f6 12px 24px)', tags: ['pattern','light'] },
    { id: 'p13', kind: 'web',   name: 'Galaxy',           css: 'radial-gradient(circle at 60% 30%, #6d28d9 0, transparent 40%), radial-gradient(circle at 30% 70%, #1e3a8a 0, transparent 50%), #0f172a', tags: ['space','dark'] },
    { id: 'p14', kind: 'print', name: 'Cream solid',      css: '#fef3c7', tags: ['solid','light'] },
    { id: 'p15', kind: 'web',   name: 'Pastel grid',      css: 'linear-gradient(#7dd3fc 1px, transparent 1px) 0 0/20px 20px, linear-gradient(90deg, #7dd3fc 1px, transparent 1px) 0 0/20px 20px, #ecfdf5', tags: ['pattern'] },
    { id: 'p16', kind: 'print', name: 'Forest',           css: 'linear-gradient(180deg, #064e3b, #166534)', tags: ['gradient','green'] },
  ];

  // ── Design-area background fill ─────────────────────────────────────────
  // The bg fills ONLY the print-area rectangle (Zazzle behaviour) — not the
  // whole canvas. Mug photo and all guides remain visible outside the rect.
  // We persist a single fabric object (`_designBgFill`) at z-index 0
  // (deepest among objects, but ABOVE the canvas backgroundImage = mug photo).
  var _designBgFill  = null;
  var _designBgState = null; // { type:'transparent'|'color'|'image'|'preset', value/css }

  function setMugBackground(state) {
    _designBgState = state || { type: 'transparent' };
    _updateDesignBgFill();
    _refreshBgPreview();
  }

  function _updateDesignBgFill() {
    if (!canvas) return;

    // Remove prior fill
    if (_designBgFill) {
      canvas.remove(_designBgFill);
      _designBgFill = null;
    }

    var state = _designBgState;
    if (!state || state.type === 'transparent') {
      canvas.requestRenderAll();
      return;
    }

    var pa = getPrintAreaPx();
    var rx = pa.rx || 0;

    function _placeAndPushBack(obj) {
      _designBgFill = obj;
      canvas.add(obj);
      // Send to back, then re-send guides to back so guides render OVER the fill
      canvas.sendToBack(obj);
      _printAreaGuides.forEach(function (g) { canvas.bringForward(g); });
      canvas.requestRenderAll();
    }

    if (state.type === 'color') {
      var rect = new fabric.Rect({
        left: pa.left, top: pa.top,
        width: pa.width, height: pa.height,
        rx: rx, ry: rx,
        fill: state.value || '#ffffff',
        selectable: false, evented: false,
        excludeFromExport: false,
      });
      _placeAndPushBack(rect);
      return;
    }

    if (state.type === 'image' && state.value) {
      fabric.Image.fromURL(state.value, function (img) {
        if (!img) return;
        var sx = pa.width  / img.width;
        var sy = pa.height / img.height;
        var s  = Math.max(sx, sy); // cover-fit
        img.set({
          left: pa.left + pa.width / 2,
          top:  pa.top  + pa.height / 2,
          originX: 'center', originY: 'center',
          scaleX: s, scaleY: s,
          selectable: false, evented: false,
          excludeFromExport: false,
          clipPath: new fabric.Rect({
            width:  pa.width  / s,
            height: pa.height / s,
            rx: rx / s, ry: rx / s,
            originX: 'center', originY: 'center',
          }),
        });
        _placeAndPushBack(img);
      }, { crossOrigin: 'anonymous' });
      return;
    }

    if (state.type === 'preset' && state.css) {
      _renderCssToImage(state.css, pa.width, pa.height, function (htmlImg) {
        if (!htmlImg) return;
        var img = new fabric.Image(htmlImg, {
          left: pa.left, top: pa.top,
          originX: 'left', originY: 'top',
          selectable: false, evented: false,
          excludeFromExport: false,
        });
        // Apply rounded-corner clip
        if (rx > 0) {
          img.set({
            clipPath: new fabric.Rect({
              width:  pa.width,
              height: pa.height,
              rx: rx, ry: rx,
              originX: 'center', originY: 'center',
            }),
          });
        }
        _placeAndPushBack(img);
      });
    }
  }

  // CSS string → HTMLImage via SVG foreignObject. Used to render preset
  // gradient/pattern CSS into a real image we can hand to fabric.
  function _renderCssToImage(css, w, h, cb) {
    try {
      var safeCss = String(css).replace(/"/g, "'");
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
        '<foreignObject width="100%" height="100%">' +
        '<div xmlns="http://www.w3.org/1999/xhtml" style="width:' + w + 'px;height:' + h + 'px;background:' + safeCss + '"></div>' +
        '</foreignObject></svg>';
      var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      var url  = URL.createObjectURL(blob);
      var img  = new Image();
      img.onload  = function () { URL.revokeObjectURL(url); cb(img); };
      img.onerror = function () { URL.revokeObjectURL(url); cb(null); };
      img.src = url;
    } catch (e) { cb(null); }
  }

  // Refresh the small "Background color" preview tile in the panel
  function _refreshBgPreview() {
    var prev = document.getElementById('bg-color-preview');
    if (!prev) return;
    var s = _designBgState || { type: 'transparent' };
    prev.classList.remove('is-transparent', 'is-image');
    if (s.type === 'transparent' || !s.type) {
      prev.classList.add('is-transparent');
      prev.style.background = '';
    } else if (s.type === 'color') {
      prev.style.background = s.value || '#ffffff';
    } else if (s.type === 'image' && s.value) {
      prev.classList.add('is-image');
      prev.style.background = 'url(' + s.value + ') center/cover';
    } else if (s.type === 'preset' && s.css) {
      prev.style.background = s.css;
    }
  }

  // _ensureCanvasChecker stays for the Settings → "Show transparency" toggle
  function _ensureCanvasChecker(on) {
    var wrapper = canvas && canvas.wrapperEl; if (!wrapper) return;
    var el = wrapper.querySelector('.canvas-checker');
    if (on) {
      if (!el) {
        el = document.createElement('div');
        el.className = 'canvas-checker';
        el.style.left = '0'; el.style.top = '0';
        el.style.width  = canvas.getWidth()  + 'px';
        el.style.height = canvas.getHeight() + 'px';
        wrapper.insertBefore(el, wrapper.firstChild);
      }
    } else if (el) { el.remove(); }
  }
  function _clearPresetLayer() { /* no-op (legacy callers retained) */ }

  function renderBgPresets() {
    var grid = document.getElementById('bg-preset-grid');
    if (!grid) return;
    var activeKind = (document.querySelector('.bg-tab.is-active') || {}).getAttribute && document.querySelector('.bg-tab.is-active').getAttribute('data-kind') || 'print';
    var query = (document.getElementById('bg-search-input') || {}).value || '';
    query = String(query).trim().toLowerCase();

    grid.innerHTML = '';
    _BG_PRESETS.forEach(function (p) {
      if (p.kind !== activeKind) return;
      if (query) {
        var hay = (p.name + ' ' + (p.tags || []).join(' ')).toLowerCase();
        if (hay.indexOf(query) === -1) return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'bg-preset';
      btn.setAttribute('data-id', p.id);
      btn.style.background = p.css;
      btn.title = p.name;
      var lbl = document.createElement('span');
      lbl.className = 'bg-preset-name';
      lbl.textContent = p.name;
      btn.appendChild(lbl);
      btn.addEventListener('click', function () {
        document.querySelectorAll('#bg-preset-grid .bg-preset').forEach(function (x) { x.classList.remove('is-active'); });
        btn.classList.add('is-active');
        _setActiveSwatch(null);
        setMugBackground({ type: 'preset', css: p.css });
        _persistBgState({ type: 'preset', presetId: p.id });
      });
      grid.appendChild(btn);
    });
  }

  function _setActiveSwatch(color) {
    document.querySelectorAll('#background-panel .bg-swatch').forEach(function (s) {
      s.classList.toggle('is-active', s.getAttribute('data-color') === color);
    });
  }
  function _persistBgState(s) {
    try { localStorage.setItem('mugBgState', JSON.stringify(s)); } catch (e) {}
  }
  function _restoreBgState() {
    try {
      var s = JSON.parse(localStorage.getItem('mugBgState') || 'null');
      if (!s) return;
      if (s.type === 'preset' && s.presetId) {
        var p = _BG_PRESETS.find(function (x) { return x.id === s.presetId; });
        if (p) setMugBackground({ type: 'preset', css: p.css });
        return;
      }
      if (s.type === 'image' && s.value) { setMugBackground({ type: 'image', value: s.value }); return; }
      if (s.type === 'color' && s.value) {
        setMugBackground({ type: 'color', value: s.value });
        var input = document.getElementById('bg-hex-input'); if (input) input.value = s.value;
        _setActiveSwatch(s.value);
      }
    } catch (e) {}
  }

  function bindBackgroundPanel() {
    var panel = document.getElementById('background-panel');
    if (!panel) return;

    // Section collapse/expand
    panel.querySelectorAll('.bg-section .fx-section-header').forEach(function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('is-collapsed'); });
    });

    // Search — live-filter preset grid
    var searchInput = document.getElementById('bg-search-input');
    if (searchInput) searchInput.addEventListener('input', renderBgPresets);

    // Tabs
    panel.querySelectorAll('.bg-tab').forEach(function (t) {
      t.addEventListener('click', function () {
        panel.querySelectorAll('.bg-tab').forEach(function (x) {
          x.classList.remove('is-active');
          x.setAttribute('aria-selected', 'false');
        });
        t.classList.add('is-active');
        t.setAttribute('aria-selected', 'true');
        renderBgPresets();
      });
    });

    // Upload
    var uploadBtn   = document.getElementById('bg-upload-btn');
    var uploadInput = document.getElementById('bg-upload-input');
    var uploadThumb = document.getElementById('bg-uploaded-thumb');
    if (uploadBtn && uploadInput) {
      uploadBtn.addEventListener('click', function () { uploadInput.click(); });
      uploadInput.addEventListener('change', function (e) {
        var file = e.target.files && e.target.files[0]; if (!file) return;
        if (file.size > 10 * 1024 * 1024) { showToast('Image too large (max 10 MB).'); return; }
        if (!['image/jpeg','image/png'].includes(file.type)) { showToast('Only JPG and PNG accepted.'); return; }
        var fr = new FileReader();
        fr.onload = function (ev) {
          var url = ev.target.result;
          if (uploadThumb) {
            uploadThumb.classList.add('has-image');
            uploadThumb.style.backgroundImage = 'url(' + url + ')';
            uploadThumb.style.backgroundSize  = 'cover';
            uploadThumb.style.backgroundPosition = 'center';
          }
          setMugBackground({ type: 'image', value: url });
          _setActiveSwatch(null);
          document.querySelectorAll('#bg-preset-grid .bg-preset').forEach(function (x) { x.classList.remove('is-active'); });
          _persistBgState({ type: 'image', value: url });
        };
        fr.readAsDataURL(file);
      });
    }

    // Custom hex
    var hexInput = document.getElementById('bg-hex-input');
    if (hexInput) {
      var applyHex = function () {
        var v = (hexInput.value || '').trim();
        if (!/^#([0-9a-f]{6}|[0-9a-f]{8})$/i.test(v)) return;
        var color = v;
        if (v.length === 9) {
          var hh = v.substring(1);
          var r = parseInt(hh.substring(0,2),16);
          var g = parseInt(hh.substring(2,4),16);
          var b = parseInt(hh.substring(4,6),16);
          var a = parseInt(hh.substring(6,8),16) / 255;
          color = 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
          if (a < 0.02) {
            setMugBackground({ type: 'transparent' });
            _setActiveSwatch('transparent');
            _persistBgState({ type: 'transparent' });
            _clearPresetLayer();
            return;
          }
        }
        setMugBackground({ type: 'color', value: color });
        _setActiveSwatch(v.toLowerCase());
        document.querySelectorAll('#bg-preset-grid .bg-preset').forEach(function (x) { x.classList.remove('is-active'); });
        _clearPresetLayer();
        _persistBgState({ type: 'color', value: color });
      };
      hexInput.addEventListener('change', applyHex);
      hexInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') { applyHex(); this.blur(); } });
    }

    // Eyedropper (Chromium 95+)
    var eyeBtn = document.getElementById('bg-eyedropper-btn');
    if (eyeBtn) eyeBtn.addEventListener('click', function () {
      if (typeof EyeDropper === 'undefined') { showToast('Eyedropper not supported in this browser'); return; }
      try {
        var ed = new EyeDropper();
        ed.open().then(function (res) {
          var sRGBHex = res.sRGBHex;
          var hi = document.getElementById('bg-hex-input');
          if (hi) { hi.value = sRGBHex; hi.dispatchEvent(new Event('change')); }
        }).catch(function () {});
      } catch (e) {}
    });

    // Swatches
    panel.querySelectorAll('.bg-swatch').forEach(function (s) {
      s.addEventListener('click', function () {
        var color = s.getAttribute('data-color');
        _setActiveSwatch(color);
        document.querySelectorAll('#bg-preset-grid .bg-preset').forEach(function (x) { x.classList.remove('is-active'); });
        _clearPresetLayer();
        if (color === 'transparent') {
          setMugBackground({ type: 'transparent' });
          _persistBgState({ type: 'transparent' });
        } else {
          setMugBackground({ type: 'color', value: color });
          _persistBgState({ type: 'color', value: color });
          var hi = document.getElementById('bg-hex-input');
          if (hi) hi.value = color;
        }
      });
    });

    // + Expand toggles "Additional colors" section
    var expandBtn = document.getElementById('bg-expand-btn');
    if (expandBtn) {
      expandBtn.addEventListener('click', function () {
        var sec = panel.querySelector('.bg-section[data-section="additional"]');
        if (sec) sec.classList.remove('is-collapsed');
        sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    }

    // Remove background — clears every kind of bg (image / preset / colour)
    // and resets UI state to "Transparent".
    var removeBtn = document.getElementById('bg-remove-btn');
    if (removeBtn) {
      removeBtn.addEventListener('click', function () {
        // Clear canvas-side
        _clearPresetLayer();
        setMugBackground({ type: 'transparent' });

        // Reset UI: upload thumb, preset highlight, hex input, swatch ring
        var thumb = document.getElementById('bg-uploaded-thumb');
        if (thumb) {
          thumb.classList.remove('has-image');
          thumb.style.removeProperty('background-image');
          thumb.style.removeProperty('background-size');
          thumb.style.removeProperty('background-position');
        }
        var fileInput = document.getElementById('bg-upload-input');
        if (fileInput) fileInput.value = '';

        document.querySelectorAll('#bg-preset-grid .bg-preset').forEach(function (x) { x.classList.remove('is-active'); });
        var hi = document.getElementById('bg-hex-input');
        if (hi) hi.value = '#00FFFFFF';
        _setActiveSwatch('transparent');

        // Persist + toast
        try { localStorage.removeItem('mugBgState'); } catch (e) {}
        showToast('Background removed');
      });
    }

    // Render initial preset grid + restore last bg state
    renderBgPresets();
    _restoreBgState();
  }

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  function boot() {
    if (typeof fabric === 'undefined') {
      console.error('[MugCustomizer] Fabric.js not loaded.');
      return;
    }
    initCanvas();
    bindUI();
    pushHistory(); // initial empty state
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
