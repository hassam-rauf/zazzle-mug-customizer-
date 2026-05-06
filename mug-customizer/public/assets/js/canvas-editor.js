/* Mug Customizer — Fabric.js canvas editor */
(function () {
  'use strict';

  const mc  = window.mugCustomizer       || {};
  const cfg = window.mugDesignerConfig   || {};

  // ── State ────────────────────────────────────────────────────────────────
  let canvas;
  let printAreaRect;
  let historyStack  = [];
  let historyIndex  = -1;
  let isHistoryLock = false;

  // Mug background metadata (native PNG dims drive print-area math)
  let _mugImg          = null;
  let _mugNaturalW     = 2000;
  let _mugNaturalH     = 2000;
  let _warpRafPending  = false;
  let _warpMugEl       = null;  // raw HTMLImageElement captured before color filter

  // Three.js preview state
  var _three       = null;   // { renderer, scene, camera, mugGroup, bodyMat, bottomMat, designTex }
  var _threeInited = false;

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
      // Zazzle approach: bleed visually covers mug FRONT FACE + ~50% side
      // extension (NOT the full unrolled 9.5"×3.5" wrap). Backend export still
      // produces full 9.5×3.5 print at 300 DPI — this is purely UI proportion.
      // Canvas 720×420; mug ~277h × ~387w at left:30, top:~71 → front face
      // approx x=110-417. Bleed: x=165 (after handle, on front face) to x=575.
      printArea: {
        x:         165,
        y:         100,
        width:     410,
        height:    220,
        pngWidth:  720,
        pngHeight: 420,
        wrapDeg:   360,
        rx:        18,
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
  // get infinite colors from a single asset. 'black' is intentionally #2a2a2a
  // rather than pure black so subtle ceramic shading isn't crushed to flat.
  var COLOR_HEX_MAP = {
    black:  '#2a2a2a',
    white:  '#ffffff',
    red:    '#dc2626',
    blue:   '#2563eb',
    green:  '#16a34a',
    navy:   '#1e3a5f',
    pink:   '#ec4899',
    yellow: '#fbbf24',
    purple: '#7c3aed',
    grey:   '#6b7280',
    gray:   '#6b7280',
  };

  function applyMugTint(img) {
    if (! img || ! fabric.Image || ! fabric.Image.filters) return;
    const hex = COLOR_HEX_MAP[(selectedVariant.color || '').toLowerCase()] || '#ffffff';
    img.filters = [];
    if (hex.toLowerCase() !== '#ffffff') {
      img.filters.push(new fabric.Image.filters.BlendColor({
        color: hex, mode: 'multiply', alpha: 1,
      }));
    }
    img.applyFilters();
  }

  // ── Canvas Init ───────────────────────────────────────────────────────────
  function initCanvas() {
    canvas = new fabric.Canvas('mug-canvas', {
      width:            720,
      height:           420,
      backgroundColor:  '#f5f5f7',
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

    // Outer bleed zone (green dashed, rounded corners — Zazzle parity)
    var bleedRx = (typeof pa.rx === 'number') ? pa.rx : 10;
    printAreaRect = new fabric.Rect({
      left:            pa.left,
      top:             pa.top,
      width:           pa.width,
      height:          pa.height,
      rx:              bleedRx,
      ry:              bleedRx,
      fill:            'rgba(76,175,80,0.03)',
      stroke:          '#4caf50',
      strokeWidth:     1.8,
      strokeDashArray: [6, 4],
      selectable:      false,
      evented:         false,
      excludeFromExport: true,
    });
    canvas.add(printAreaRect);
    _printAreaGuides.push(printAreaRect);

    // Safe zone — inset from bleed (Zazzle ratio: safe=8.5/9.5 of bleed width)
    var safeWFrac = 0.895;
    var safeHFrac = 0.897;
    var safeW     = Math.round(pa.width  * safeWFrac);
    var safeH     = Math.round(pa.height * safeHFrac);
    var safeLeft  = pa.left + Math.round((pa.width  - safeW) / 2);
    var safeTop   = pa.top  + Math.round((pa.height - safeH) / 2);
    var safeRx = Math.max(4, bleedRx - 2);
    var safeZone  = new fabric.Rect({
      left:            safeLeft,
      top:             safeTop,
      width:           safeW,
      height:          safeH,
      rx:              safeRx,
      ry:              safeRx,
      fill:            'transparent',
      stroke:          '#4caf50',
      strokeWidth:     1,
      strokeDashArray: [3, 5],
      selectable:      false,
      evented:         false,
      excludeFromExport: true,
    });
    canvas.add(safeZone);
    _printAreaGuides.push(safeZone);

    // Vertical fold lines inside safe zone (3 dividers like Zazzle)
    var foldPositions = [0.25, 0.5, 0.75];
    foldPositions.forEach(function(fp) {
      var fx = Math.round(safeLeft + fp * safeW);
      var fLine = new fabric.Line(
        [fx, safeTop, fx, safeTop + safeH],
        { stroke: '#4caf50', strokeWidth: 1, strokeDashArray: [2, 6], opacity: 0.5,
          selectable: false, evented: false, excludeFromExport: true }
      );
      canvas.add(fLine);
      _printAreaGuides.push(fLine);
    });

    // "Safe area" badge — rounded green pill at top-center of safe zone (Zazzle parity)
    var badgeText = new fabric.Text('Safe area', {
      fontSize:   11,
      fill:       '#1b5e20',
      fontFamily: 'Arial, sans-serif',
      fontWeight: '600',
      originX:    'center',
      originY:    'center',
    });
    var badgeBg = new fabric.Rect({
      width:  badgeText.width  + 18,
      height: badgeText.height + 8,
      rx:     11,
      ry:     11,
      fill:   '#dff5e0',
      stroke: '#4caf50',
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

    // Dimension label inside safe zone
    const dims = PRINT_DIMS_IN[selectedVariant.size] || PRINT_DIMS_IN['11oz'];
    const dimLabel = new fabric.Text(dims.w + '″ \xd7 ' + dims.h + '″', {
      left:       safeLeft + safeW / 2,
      top:        safeTop  + safeH / 2 - 6,
      fontSize:   10,
      fill:       '#888',
      fontFamily: 'Arial, sans-serif',
      originX:    'center',
      selectable: false,
      evented:    false,
      excludeFromExport: true,
    });
    canvas.add(dimLabel);
    _printAreaGuides.push(dimLabel);

    // Print-area enforcement is soft (boundary toast + green dashed rect) so
    // the user can see the WHOLE mug while editing. A canvas-level clipPath
    // would hide the mug background outside the print area too — confusing.
    canvas.clipPath = null;

    canvas.requestRenderAll();
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
  function showContextBar(obj) {
    const textBar = document.getElementById('context-bar');
    const imgBar  = document.getElementById('img-context-bar');
    if (!textBar || !imgBar || !obj) return;

    const isText  = obj.type === 'IText' || obj.type === 'Textbox' || obj.type === 'i-text';
    const isImage = obj.type === 'image' || obj.type === 'Image';

    textBar.style.display = isText  ? 'flex' : 'none';
    imgBar.style.display  = isImage ? 'flex' : 'none';

    if (isText) {
      const set = function (id, val) { const el = document.getElementById(id); if (el) el.value = val; };
      set('ctx-font',         obj.fontFamily   || 'Georgia');
      set('ctx-size',         obj.fontSize     || 24);
      set('ctx-color',        obj.fill         || '#222222');
      set('ctx-angle',        Math.round(obj.angle || 0));
      set('ctx-spacing',      obj.charSpacing  || 0);
      set('ctx-lineheight',   Math.round((obj.lineHeight || 1.2) * 100));
      set('ctx-stroke-color', obj.stroke       || '#000000');
      set('ctx-stroke-width', obj.strokeWidth  || 0);

      // Sync new size display span and alignment dropdown
      const sizeVal = document.getElementById('ctx-size-val');
      if (sizeVal) sizeVal.textContent = Math.round(obj.fontSize || 24);

      const alignSel = document.getElementById('ctx-align-select');
      if (alignSel) alignSel.value = obj.textAlign || 'left';

      const syncToggle = function (id, active) {
        const el = document.getElementById(id);
        if (el) el.classList.toggle('ctx-active', !!active);
      };
      syncToggle('ctx-bold',      obj.fontWeight === 'bold');
      syncToggle('ctx-italic',    obj.fontStyle  === 'italic');
      syncToggle('ctx-underline', obj.underline  === true);
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
    if (textBar) textBar.style.display = 'none';
    if (imgBar)  imgBar.style.display  = 'none';
    clearGuides();
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
  // ── CSS 3D preview state ─────────────────────────────────────────────────
  var _previewMugUrl    = '';
  var _previewDesignUrl = '';

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

  // ── CSS 3D cylindrical preview ───────────────────────────────────────────
  //
  // angle = ((objCenterX / printAreaWidth) - 0.5) × wrapAngle
  // Renders: mug PNG + multiply color tint + design overlay with perspective rotateY.
  // No Three.js — GPU-accelerated CSS transforms only.

  function calcWrapAngle(obj) {
    var pa = getPrintAreaPx();
    var b  = obj.getBoundingRect(true);
    var cx = b.left + b.width / 2;
    var t  = (cx - pa.left) / (pa.width || 1);   // 0 = left edge, 1 = right edge
    return (t - 0.5) * 120;                        // ±60° range feels natural
  }

  function positionDesignLayer() {
    var mugBg = document.getElementById('preview-mug-bg');
    if (!mugBg || !mugBg.offsetWidth) return;

    var displayW = mugBg.offsetWidth;
    var displayH = mugBg.offsetHeight;
    var pa       = getPrintAreaPx();

    var mugLeft = _mugImg ? (_mugImg.left || 0) : 30;
    var mugTop  = _mugImg ? (_mugImg.top  || 0) : 0;
    var mugW    = _mugImg ? _mugImg.getScaledWidth()  : 313;
    var mugH    = _mugImg ? _mugImg.getScaledHeight() : 277;

    // Clamp the print area to the mug-on-canvas slice for the live preview.
    // The full bleed extends past the mug (Zazzle wrap metaphor); only the
    // intersection with the mug body shows on the actual mug face.
    var paL = Math.max(pa.left,  mugLeft);
    var paT = Math.max(pa.top,   mugTop);
    var paR = Math.min(pa.left + pa.width,  mugLeft + mugW);
    var paB = Math.min(pa.top  + pa.height, mugTop  + mugH);
    var paW = Math.max(0, paR - paL);
    var paH = Math.max(0, paB - paT);

    var layer = document.getElementById('preview-design-layer');
    if (paW === 0 || paH === 0) {
      if (layer) layer.style.display = 'none';
      return;
    }

    var layerW = (paW / mugW) * displayW;
    var layerH = (paH / mugH) * displayH;

    if (layer) {
      layer.style.display = 'block';
      layer.style.left    = (((paL - mugLeft) / mugW) * displayW) + 'px';
      layer.style.top     = (((paT - mugTop)  / mugH) * displayH) + 'px';
      layer.style.width   = layerW + 'px';
      layer.style.height  = layerH + 'px';
      layer.style.borderRadius = '0';
    }

    // Captured design img covers full editor canvas; scale + offset so the
    // (clamped) print-area slice fills the layer.
    var dImg = document.getElementById('preview-design-img');
    if (dImg) {
      var cw = canvas ? canvas.getWidth()  : 720;
      var ch = canvas ? canvas.getHeight() : 420;
      var sx = layerW / paW;
      var sy = layerH / paH;
      dImg.style.width  = (cw * sx) + 'px';
      dImg.style.height = (ch * sy) + 'px';
      dImg.style.left   = (-paL * sx) + 'px';
      dImg.style.top    = (-paT * sy) + 'px';
    }
  }

  function applyWrapTransform(_angleDeg) {
    // Design stays flat-attached on the mug face — no rotateY flip,
    // no edge shading (user requested clean preview).
    var layer = document.getElementById('preview-design-layer');
    if (layer) layer.style.transform = 'none';

    var shading = document.getElementById('preview-shading');
    if (shading) shading.style.background = 'none';
  }

  function updateCss3dPreview(activeObj) {
    // 1. Mug background image
    var mugUrl = getMugUrl('front');
    var mugBg  = document.getElementById('preview-mug-bg');
    if (mugBg && mugUrl !== _previewMugUrl) {
      _previewMugUrl = mugUrl;
      mugBg.src = mugUrl;
      mugBg.onload = function () { positionDesignLayer(); };
    }

    // 2. Color tint (multiply blend replicates Fabric BlendColor filter)
    var tintEl = document.getElementById('preview-mug-tint');
    if (tintEl) {
      var hex = COLOR_HEX_MAP[(selectedVariant && selectedVariant.color || '').toLowerCase()] || '#ffffff';
      tintEl.style.background = (hex.toLowerCase() === '#ffffff') ? 'transparent' : hex;
    }

    // 3. Capture design (full canvas, no bg) → show only print-area slice via CSS
    var designUrl = _captureDesignLayer(1);
    if (designUrl && designUrl !== _previewDesignUrl) {
      _previewDesignUrl = designUrl;
      var dImg = document.getElementById('preview-design-img');
      if (dImg) dImg.src = designUrl;
    }

    // 4. Align design overlay to print area
    positionDesignLayer();

    // 5. Compute angle from the moving/active object (or caller-supplied obj)
    var obj = activeObj || (canvas && canvas.getActiveObject());
    applyWrapTransform(obj ? calcWrapAngle(obj) : 0);
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

    // Apply color tint so preview matches selected mug color (replicates BlendColor multiply filter)
    var tintHex = (typeof COLOR_HEX_MAP !== 'undefined')
      ? (COLOR_HEX_MAP[(selectedVariant && selectedVariant.color || '').toLowerCase()] || '#ffffff')
      : '#ffffff';
    if (tintHex.toLowerCase() !== '#ffffff') {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = tintHex;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.restore();
    }

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

  function _renderFullPreview(modal) {
    var origBg    = canvas.backgroundImage;
    var designUrl = _captureDesignLayer(1);
    var mugEl     = origBg && origBg._element;
    if (!designUrl) return;
    var natW = _mugNaturalW || (mugEl && (mugEl.naturalWidth  || mugEl.width))  || 0;
    var natH = _mugNaturalH || (mugEl && (mugEl.naturalHeight || mugEl.height)) || 0;
    var pa   = getPrintAreaPx();

    var designImg = new Image();
    designImg.onload = function () {
      // Render all modal thumbnails
      modal.querySelectorAll('.preview-modal-thumb').forEach(function (thumb) {
        var cv = thumb.querySelector('canvas');
        if (!cv) return;
        var tCtx = cv.getContext('2d');
        if (thumb.dataset.isDonut === 'true') {
          renderDonutView(tCtx, cv.width, cv.height, designImg, pa);
        } else {
          renderAngleView(tCtx, cv.width, cv.height, designImg, mugEl,
                          natW, natH, pa, parseFloat(thumb.dataset.angle || '0'));
        }
      });

      // Render main canvas for currently active thumb
      _renderModalMainCanvas(modal, designImg, mugEl, natW, natH, pa);
    };
    designImg.src = designUrl;
  }

  function _renderModalMainCanvas(modal, designImg, mugEl, natW, natH, pa) {
    var active  = modal.querySelector('.preview-modal-thumb.active');
    var isDonut = active && active.dataset.isDonut === 'true';

    if (isDonut) {
      _showThreeView(false);
      var mainCv = document.getElementById('preview-modal-canvas');
      if (!mainCv) return;
      renderDonutView(mainCv.getContext('2d'), mainCv.width, mainCv.height, designImg, pa);
    } else {
      _showThreeView(true);
      var deg = active ? parseFloat(active.dataset.angle || '0') : 0;
      createMugPreview(designImg, deg);
    }
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

  // ── Navigate to Review ────────────────────────────────────────────────────
  function goToReview() {
    const design = serializeDesign(true); // 4× high-res

    if (! design.canvas_json.objects || design.canvas_json.objects.length === 0) {
      showToast('Please add at least one design element before reviewing.');
      return;
    }

    saveToSession(design);
    window.location.href = cfg.reviewUrl;
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
    canvas.on('object:added',    function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:modified', function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:removed',  function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); updateLayerPanel(); setSaveStatus('● Unsaved', '#f59e0b'); });

    canvas.on('selection:created', function (e) { showContextBar(e.selected[0]); updateLayerPanel(); });
    canvas.on('selection:updated', function (e) { showContextBar(e.selected[0]); updateLayerPanel(); });
    canvas.on('selection:cleared', function ()  { hideContextBar(); updateLayerPanel(); });

    // Free drag/scale/rotate — no snapping, no hard clamp.
    // A soft toast fires once when the design leaves the print area.
    canvas.on('object:moving',   function (e) { updateCss3dPreview(e.target); warnIfOutside(e.target); });
    canvas.on('object:scaling',  function (e) { updateCss3dPreview(e.target); });
    canvas.on('object:modified', function ()  { clearGuides(); });

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
      'tool-text':    'text-panel',
      'tool-uploads': 'uploads-panel',
      'tool-images':  'images-panel',
      'tool-layers':  'layer-panel',
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
      if (tool) tool.addEventListener('click', function () { openPanel(toolId); });
    });

    // Panel close buttons
    ['text-panel-close', 'uploads-panel-close', 'images-panel-close', 'layer-panel-close'].forEach(function (id) {
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

    // ── Top-bar tab switching (Design / Options / Review) ──────────────
    let activeTab = 'design';
    const tabEls       = document.querySelectorAll('.topbar-tabs .tab');
    const optsPanel    = document.getElementById('options-panel');
    const tabToolRail  = document.getElementById('tool-rail');
    const tabTextPanel = document.getElementById('text-panel');
    const variantPn    = document.getElementById('variant-panel');
    const canvasEl     = document.getElementById('canvas-container');
    const zoomCtrls    = document.getElementById('zoom-controls');
    const nextBtn      = document.getElementById('btn-next-review');

    function setTab(tab) {
      activeTab = tab;
      tabEls.forEach(function (el) {
        el.classList.toggle('active', el.dataset.tab === tab);
      });
      const designVisible = (tab === 'design');
      const optsVisible   = (tab === 'options');
      if (tabToolRail)  tabToolRail.style.display  = designVisible ? '' : 'none';
      if (tabTextPanel && designVisible === false) tabTextPanel.style.display = 'none';
      if (canvasEl)  canvasEl.style.display  = designVisible ? '' : 'none';
      if (zoomCtrls) zoomCtrls.style.display = designVisible ? '' : 'none';
      if (variantPn) variantPn.style.display = designVisible ? '' : 'none';
      if (optsPanel) optsPanel.style.display = optsVisible ? '' : 'none';
      if (nextBtn) {
        const lbl = (tab === 'design')
          ? nextBtn.dataset.designLabel
          : nextBtn.dataset.optionsLabel;
        if (lbl) nextBtn.textContent = lbl;
      }
    }

    tabEls.forEach(function (el) {
      el.addEventListener('click', function (e) {
        const tab = el.dataset.tab;
        if (tab === 'review') { e.preventDefault(); goToReview(); return; }
        e.preventDefault();
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

    // Zoom
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomIn  = document.getElementById('btn-zoom-in');
    const zoomFit = document.getElementById('btn-zoom-fit');
    if (zoomOut) zoomOut.addEventListener('click', function () { setZoom(canvas.getZoom() - 0.25); });
    if (zoomIn)  zoomIn.addEventListener('click',  function () { setZoom(canvas.getZoom() + 0.25); });
    if (zoomFit) zoomFit.addEventListener('click', function () { setZoom(1); });

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
    const ctxFont  = document.getElementById('ctx-font');
    const ctxSize  = document.getElementById('ctx-size');   // hidden, kept for compat
    const ctxColor = document.getElementById('ctx-color');
    if (ctxFont)  ctxFont.addEventListener('change',  function () { applyTextProp('fontFamily', this.value); });
    if (ctxSize)  ctxSize.addEventListener('change',  function () { applyTextProp('fontSize', parseInt(this.value, 10)); });
    if (ctxColor) ctxColor.addEventListener('input',  function () { applyTextProp('fill', this.value); });

    // "Edit text" button — enters IText editing mode
    const ctxEditText = document.getElementById('ctx-edit-text');
    if (ctxEditText) {
      ctxEditText.addEventListener('click', function () {
        const obj = canvas.getActiveObject();
        if (obj && obj.enterEditing) { obj.enterEditing(); canvas.requestRenderAll(); }
      });
    }

    // Font size — and + buttons
    const ctxSizeVal   = document.getElementById('ctx-size-val');
    const ctxSizeMinus = document.getElementById('ctx-size-minus');
    const ctxSizePlus  = document.getElementById('ctx-size-plus');
    function _changeFontSize(delta) {
      const obj = canvas.getActiveObject();
      if (!obj) return;
      const s = Math.min(200, Math.max(8, (obj.fontSize || 24) + delta));
      applyProp('fontSize', s);
      if (ctxSizeVal) ctxSizeVal.textContent = s;
      if (ctxSize)    ctxSize.value = s;
    }
    if (ctxSizeMinus) ctxSizeMinus.addEventListener('click', function () { _changeFontSize(-2); });
    if (ctxSizePlus)  ctxSizePlus.addEventListener('click',  function () { _changeFontSize(+2); });

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

    // "More options" toggle
    const ctxMoreToggle = document.getElementById('ctx-more-toggle');
    const ctxMorePanel  = document.getElementById('ctx-more-panel');
    if (ctxMoreToggle && ctxMorePanel) {
      ctxMoreToggle.addEventListener('click', function () {
        const open = ctxMorePanel.style.display !== 'flex';
        ctxMorePanel.style.display = open ? 'flex' : 'none';
        ctxMoreToggle.classList.toggle('ctx-active', open);
      });
    }

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

    // Thumbnail clicks inside preview modal
    document.querySelectorAll('.preview-modal-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        document.querySelectorAll('.preview-modal-thumb')
          .forEach(function (t) { t.classList.remove('active'); });
        thumb.classList.add('active');
        if (pmLabel) pmLabel.textContent = thumb.dataset.label || '';

        var isDonut = thumb.dataset.isDonut === 'true';
        var deg     = parseFloat(thumb.dataset.angle || '0');

        if (isDonut) {
          // Donut: canvas 2D fallback
          _showThreeView(false);
          var dUrl = _captureDesignLayer(1);
          if (!dUrl || !pmCanvas) return;
          var pa2  = getPrintAreaPx();
          var dImg = new Image();
          dImg.onload = function () {
            renderDonutView(pmCanvas.getContext('2d'), pmCanvas.width, pmCanvas.height, dImg, pa2);
          };
          dImg.src = dUrl;
        } else if (_threeInited) {
          // Three.js: just rotate the existing scene — no re-capture needed
          _showThreeView(true);
          _renderThreeScene(deg);
        } else {
          // Three.js not yet loaded: capture + init + render
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
