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
      width:            500,
      height:           580,
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
    const key = buildVariantKey(selectedVariant.style, selectedVariant.size, selectedVariant.color, angle);
    const url  = (mc.mockupMap || {})[key];
    return url || (mc.pluginUrl + 'public/assets/images/placeholder-mug-white.svg');
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
      img.scaleToWidth(canvas.getWidth());
      applyMugTint(img);
      canvas.setBackgroundImage(img, function () {
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
    const cfgMap = mc.printAreaConfig || {};
    const key = selectedVariant.style + '-' + selectedVariant.size;
    const config = cfgMap[key] || cfgMap[selectedVariant.style];
    const cw = canvas.getWidth();
    const ch = canvas.getHeight();

    if (! config) {
      return { left: cw * 0.18, top: ch * 0.22, width: cw * 0.64, height: ch * 0.56, wrapDeg: 140 };
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

    // Outer trim zone (green dashed) — extends 1.7× for wrap preview
    printAreaRect = new fabric.Rect({
      left:            pa.left,
      top:             pa.top,
      width:           pa.width * 1.7,
      height:          pa.height,
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

    // P13 — Safe zone (inner rect, 6px inset on each side, lighter dashed)
    const safeInset = 6;
    const safeZone = new fabric.Rect({
      left:            pa.left  + safeInset,
      top:             pa.top   + safeInset,
      width:           pa.width - safeInset * 2,
      height:          pa.height - safeInset * 2,
      fill:            'transparent',
      stroke:          '#81c784',
      strokeWidth:     1,
      strokeDashArray: [3, 5],
      selectable:      false,
      evented:         false,
      excludeFromExport: true,
    });
    canvas.add(safeZone);
    _printAreaGuides.push(safeZone);

    // Zone divider lines — subtle dotted verticals matching Zazzle's style
    // (no text labels on canvas; zone names only appear in the angle-strip/preview)
    var wrapDeg = pa.wrapDeg || 140;
    var ZONE_ANGLES = [-70, -35, 0, 35, 70, 130];
    for (var zi = 0; zi < ZONE_ANGLES.length - 1; zi++) {
      var boundaryAngle = (ZONE_ANGLES[zi] + ZONE_ANGLES[zi + 1]) / 2;
      var bt = boundaryAngle / wrapDeg + 0.5;
      var bx = Math.round(pa.left + bt * pa.width);
      if (bx <= pa.left || bx > pa.left + pa.width * 1.76) continue;
      var zSeam = new fabric.Line(
        [bx, pa.top, bx, pa.top + pa.height],
        { stroke: '#4caf50', strokeWidth: 1, strokeDashArray: [2, 7], opacity: 0.45, selectable: false, evented: false, excludeFromExport: true }
      );
      canvas.add(zSeam);
      _printAreaGuides.push(zSeam);
    }

    // "Print Area" label at top-left of boundary
    const paLabel = new fabric.Text('Print Area', {
      left:      pa.left + 4,
      top:       pa.top  - 18,
      fontSize:  10,
      fill:      '#4caf50',
      fontFamily: 'Arial, sans-serif',
      selectable: false,
      evented:    false,
      excludeFromExport: true,
    });
    canvas.add(paLabel);
    _printAreaGuides.push(paLabel);

    // P8 — Real-world dimension label (e.g. "9.5″ × 3.5″")
    const dims = PRINT_DIMS_IN[selectedVariant.size] || PRINT_DIMS_IN['11oz'];
    const dimLabel = new fabric.Text(dims.w + '″ × ' + dims.h + '″', {
      left:      pa.left + pa.width + 6,
      top:       pa.top  + pa.height / 2 - 7,
      fontSize:  9,
      fill:      '#888',
      fontFamily: 'Arial, sans-serif',
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

  // ── Add Text ──────────────────────────────────────────────────────────────
  function addTextBox() {
    const pa = getPrintAreaPx();
    const text = new fabric.IText('Your text here', {
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
      fabric.Image.fromURL(e.target.result, function (img) {
        const pa = getPrintAreaPx();
        img.scaleToWidth(Math.min(pa.width * 0.6, img.width));
        img.set({ left: pa.left + 10, top: pa.top + 10 });
        // M9 — store native dimensions for DPI calculation
        img._nativeWidth  = img.width;
        img._nativeHeight = img.height;
        canvas.add(img);
        canvas.setActiveObject(img);
        canvas.requestRenderAll();
        pushHistory();
        checkImageDPI(img);
      });
    };
    reader.readAsDataURL(file);
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

    const isText  = obj.type === 'IText' || obj.type === 'Textbox';
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
    const display = document.getElementById('zoom-display');
    if (display) display.textContent = Math.round(zoom * 100) + '% ▼';
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
      renderWarpPreview();
    });
  }

  // Capture only the design layer: hide mug background AND all print-area
  // guide objects (excludeFromExport) so neither bleeds into the preview/export.
  function _captureDesignLayer(multiplier) {
    const origBg = canvas.backgroundImage;
    const guides = canvas.getObjects().filter(function (o) { return o.excludeFromExport; });
    guides.forEach(function (g) { g.visible = false; });
    let url = '';
    try {
      canvas.backgroundImage = null;
      url = canvas.toDataURL({ format: 'png', multiplier: multiplier || 1 });
    } catch (e) {
      console.warn('[MugCustomizer] capture skipped:', e && e.message);
    } finally {
      canvas.backgroundImage = origBg;
      guides.forEach(function (g) { g.visible = true; });
      canvas.requestRenderAll();
    }
    return url;
  }

  function renderWarpPreview() {
    const previewCanvas = document.getElementById('warp-preview-canvas');
    if (! previewCanvas || ! canvas) return;

    const origBg = canvas.backgroundImage;
    const designUrl = _captureDesignLayer(1);
    if (! designUrl) return;

    const mugEl = origBg && origBg._element;
    if (! mugEl) return;
    // After applyFilters(), _element becomes a <canvas> (no naturalWidth).
    // Fall back to cached dims captured at load time.
    const natW = _mugNaturalW || mugEl.naturalWidth || mugEl.width  || 0;
    const natH = _mugNaturalH || mugEl.naturalHeight || mugEl.height || 0;
    if (! natW || ! natH) return;

    const pa = getPrintAreaPx();

    const designImg = new Image();
    designImg.onload = function () {
      // ── Main preview (selected angle) ───────────────────────────────────
      const pctx = previewCanvas.getContext('2d');
      if (_activeAngleDeg === -999) {
        renderDonutView(pctx, previewCanvas.width, previewCanvas.height, designImg, pa);
      } else {
        renderAngleView(pctx, previewCanvas.width, previewCanvas.height,
                        designImg, mugEl, natW, natH, pa, _activeAngleDeg);
      }

      // ── Thumb strip — render every angle view ────────────────────────
      document.querySelectorAll('#angle-strip .angle-thumb').forEach(function (thumb) {
        var thumbCv = thumb.querySelector('canvas');
        if (! thumbCv) return;
        var tCtx = thumbCv.getContext('2d');
        if (thumb.dataset.isDonut === 'true') {
          renderDonutView(tCtx, thumbCv.width, thumbCv.height, designImg, pa);
        } else {
          renderAngleView(tCtx, thumbCv.width, thumbCv.height,
                          designImg, mugEl, natW, natH, pa,
                          parseFloat(thumb.dataset.angle || '0'));
        }
      });
    };
    designImg.src = designUrl;
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

    for (var ox = 0; ox < cols; ox++) {
      var norm  = (ox - center) / center;
      var theta = viewRad + Math.asin(Math.max(-1, Math.min(1, norm * sinViewHalf)));
      var t     = theta / (2 * halfWrap) + 0.5;
      if (t < 0 || t > 1) continue;  // outside print area
      var srcCol = srcLeft + t * srcW;
      try {
        ctx.drawImage(designImg, srcCol, srcTop, 1, srcH,
                                 paLeft + ox, paTop, 1, paHeight);
      } catch (e) { /* clipped source rect — skip */ }
    }
  }

  // ── Active angle tracker ─────────────────────────────────────────────────
  //
  // Maps the selected object's horizontal centre → cylinder angle →
  // closest PREVIEW_ANGLES entry. Updates the strip highlight and main label
  // so the user sees which angle view best shows their design's position.
  function updateActiveAngle() {
    var obj = canvas.getActiveObject();
    if (! obj) return;
    var pa = getPrintAreaPx();
    var b  = obj.getBoundingRect(true);
    var objCX = b.left + b.width / 2;

    // t=0 → left edge of print area, t=1 → right edge
    var t             = (objCX - pa.left) / (pa.width || 1);
    var designAngleDeg = (t - 0.5) * (pa.wrapDeg || 140);

    // Find the closest angle in the strip (skip Donut — top-down, not lateral)
    var closest = PREVIEW_ANGLES[2];  // default Center
    var minDist = Infinity;
    PREVIEW_ANGLES.forEach(function (v) {
      if (v.isDonut) return;
      var d = Math.abs(v.deg - designAngleDeg);
      if (d < minDist) { minDist = d; closest = v; }
    });

    if (closest.deg === _activeAngleDeg) return;  // no change — skip DOM work
    _activeAngleDeg = closest.deg;

    var label = document.getElementById('preview-angle-label');
    if (label) label.textContent = closest.label;

    document.querySelectorAll('#angle-strip .angle-thumb').forEach(function (th) {
      th.classList.toggle('active', parseFloat(th.dataset.angle) === closest.deg);
    });
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
    var mainCv = document.getElementById('preview-modal-canvas');
    if (!mainCv) return;
    var mCtx = mainCv.getContext('2d');
    var active = modal.querySelector('.preview-modal-thumb.active');
    if (active && active.dataset.isDonut === 'true') {
      renderDonutView(mCtx, mainCv.width, mainCv.height, designImg, pa);
    } else {
      var deg = active ? parseFloat(active.dataset.angle || '0') : 0;
      renderAngleView(mCtx, mainCv.width, mainCv.height, designImg, mugEl,
                      natW, natH, pa, deg);
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
        .then(function () { setSaveStatus('● Saved', '#16a34a'); })
        .catch(function () { setSaveStatus('● Save failed', '#dc2626'); });
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
    canvas.on('object:moving',   function (e) { updateMiniPreview(); updateActiveAngle(); warnIfOutside(e.target); });
    canvas.on('object:scaling',  function (e) { updateMiniPreview(); updateActiveAngle(); });
    canvas.on('object:rotating', function (e) { updateMiniPreview(); });
    canvas.on('object:modified', function ()  { clearGuides(); });

    // C7 — scroll-wheel zoom
    canvas.on('mouse:wheel', function (opt) {
      opt.e.preventDefault();
      opt.e.stopPropagation();
      let zoom = canvas.getZoom() * (opt.e.deltaY > 0 ? 0.95 : 1.05);
      zoom = Math.min(3, Math.max(0.5, zoom));
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), zoom);
      const display = document.getElementById('zoom-display');
      if (display) display.textContent = Math.round(zoom * 100) + '% ▼';
    });

    // P1/P2 — rotation angle display + 15° snap with Shift
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
    // Angle-strip thumbnail click → switch main preview to that view angle
    document.querySelectorAll('#angle-strip .angle-thumb').forEach(function (thumb) {
      thumb.addEventListener('click', function () {
        _activeAngleDeg = parseFloat(this.dataset.angle || '0');
        document.querySelectorAll('#angle-strip .angle-thumb')
          .forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        var lbl = document.getElementById('preview-angle-label');
        if (lbl) lbl.textContent = this.dataset.label || '';
        scheduleWarpPreview();
      });
    });

    // Tool rail
    const toolText    = document.getElementById('tool-text');
    const toolUploads = document.getElementById('tool-uploads');
    const textPanel   = document.getElementById('text-panel');
    const uploadInput = document.getElementById('mug-upload-input');

    if (toolText) {
      toolText.addEventListener('click', function () {
        document.querySelectorAll('.tool-item').forEach(t => t.classList.remove('active'));
        toolText.classList.add('active');
        if (textPanel) textPanel.style.display = 'block';
      });
    }

    if (toolUploads) {
      toolUploads.addEventListener('click', function () {
        document.querySelectorAll('.tool-item').forEach(t => t.classList.remove('active'));
        toolUploads.classList.add('active');
        if (uploadInput) uploadInput.click();
        if (textPanel)   textPanel.style.display = 'none';
      });
    }

    if (document.getElementById('text-panel-close')) {
      document.getElementById('text-panel-close').addEventListener('click', function () {
        if (textPanel) textPanel.style.display = 'none';
      });
    }

    if (document.getElementById('btn-add-text')) {
      document.getElementById('btn-add-text').addEventListener('click', addTextBox);
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

    // Layer-panel toggle (tool rail)
    const toolLayers   = document.getElementById('tool-layers');
    const layerPanel   = document.getElementById('layer-panel');
    if (toolLayers && layerPanel) {
      toolLayers.addEventListener('click', function () {
        const open = layerPanel.style.display !== 'block';
        layerPanel.style.display = open ? 'block' : 'none';
        toolLayers.classList.toggle('active', open);
        if (open) updateLayerPanel();
      });
    }
    const layerPanelClose = document.getElementById('layer-panel-close');
    if (layerPanelClose && layerPanel) {
      layerPanelClose.addEventListener('click', function () {
        layerPanel.style.display = 'none';
        if (toolLayers) toolLayers.classList.remove('active');
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

    // Next: Review
    const nextBtn = document.getElementById('btn-next-review');
    if (nextBtn) {
      nextBtn.addEventListener('click', function (e) {
        e.preventDefault();
        goToReview();
      });
    }
    const reviewTabLink = document.getElementById('review-tab-link');
    if (reviewTabLink) {
      reviewTabLink.addEventListener('click', function (e) {
        e.preventDefault();
        goToReview();
      });
    }

    // Zoom
    const zoomOut = document.getElementById('btn-zoom-out');
    const zoomIn  = document.getElementById('btn-zoom-in');
    const zoomFit = document.getElementById('btn-zoom-fit');
    if (zoomOut) zoomOut.addEventListener('click', function () { setZoom(canvas.getZoom() - 0.1); });
    if (zoomIn)  zoomIn.addEventListener('click',  function () { setZoom(canvas.getZoom() + 0.1); });
    if (zoomFit) zoomFit.addEventListener('click', function () { setZoom(1); });

    // Context bar — text properties
    const ctxFont  = document.getElementById('ctx-font');
    const ctxSize  = document.getElementById('ctx-size');
    const ctxColor = document.getElementById('ctx-color');
    if (ctxFont)  ctxFont.addEventListener('change',  function () { applyTextProp('fontFamily', this.value); });
    if (ctxSize)  ctxSize.addEventListener('change',  function () { applyTextProp('fontSize', parseInt(this.value, 10)); });
    if (ctxColor) ctxColor.addEventListener('input',  function () { applyTextProp('fill', this.value); });

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

    ['left','center','right'].forEach(function (align) {
      const btn = document.getElementById('ctx-align-' + align);
      if (btn) btn.addEventListener('click', function () { applyProp('textAlign', align); });
    });

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

        // Re-render main modal canvas for newly selected view
        var origBg = canvas.backgroundImage;
        var dUrl   = _captureDesignLayer(1);
        if (!dUrl) return;
        var mugEl2 = origBg && origBg._element;
        var natW2  = _mugNaturalW || (mugEl2 && (mugEl2.naturalWidth  || mugEl2.width))  || 0;
        var natH2  = _mugNaturalH || (mugEl2 && (mugEl2.naturalHeight || mugEl2.height)) || 0;
        var pa2    = getPrintAreaPx();

        var dImg = new Image();
        dImg.onload = function () {
          if (!pmCanvas) return;
          var mCtx = pmCanvas.getContext('2d');
          if (thumb.dataset.isDonut === 'true') {
            renderDonutView(mCtx, pmCanvas.width, pmCanvas.height, dImg, pa2);
          } else {
            renderAngleView(mCtx, pmCanvas.width, pmCanvas.height, dImg, mugEl2,
                            natW2, natH2, pa2, parseFloat(thumb.dataset.angle || '0'));
          }
        };
        dImg.src = dUrl;
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
