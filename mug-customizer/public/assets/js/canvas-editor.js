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
    return url || (mc.pluginUrl + 'public/assets/images/placeholder-mug.png');
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
      img.scaleToWidth(canvas.getWidth());
      canvas.setBackgroundImage(img, function () {
        canvas.requestRenderAll();
        updateMiniPreview();
        if (callback) callback();
      });
    }, { crossOrigin: 'anonymous' });
  }

  // ── Print Area + ClipPath ─────────────────────────────────────────────────
  function getPrintAreaPx() {
    const cfgMap = mc.printAreaConfig || {};
    // Look up by style-size first, fall back to style only, then hardcoded default
    const key = selectedVariant.style + '-' + selectedVariant.size;
    const config = cfgMap[key] || cfgMap[selectedVariant.style] || { top: 22, left: 18, width: 64, height: 56 };
    const w = canvas.getWidth();
    const h = canvas.getHeight();
    return {
      top:    Math.round(h * config.top    / 100),
      left:   Math.round(w * config.left   / 100),
      width:  Math.round(w * config.width  / 100),
      height: Math.round(h * config.height / 100),
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

    // Seam lines at 25%, 50%, 75% of wrap width
    [0.25, 0.50, 0.75].forEach(function (pct) {
      const seam = new fabric.Line(
        [pa.left + pa.width * 1.7 * pct, pa.top, pa.left + pa.width * 1.7 * pct, pa.top + pa.height],
        { stroke: '#4caf50', strokeWidth: 1.5, strokeDashArray: [4, 3], opacity: 0.65, selectable: false, evented: false, excludeFromExport: true }
      );
      canvas.add(seam);
      _printAreaGuides.push(seam);
    });

    // P12 — "Print Area" label at top-left of boundary
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

    // ClipPath constrains objects to the actual (non-wrap) print area
    canvas.clipPath = new fabric.Rect({
      left:   pa.left,
      top:    pa.top,
      width:  pa.width,
      height: pa.height,
      absolutePositioned: true,
    });

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
    loadMugBackground();
    setupPrintArea();
    updateMiniPreview();
  }

  // ── Mini Preview — composite design onto mockup ───────────────────────────
  function updateMiniPreview() {
    const img = document.getElementById('mini-preview-img');
    if (!img || !canvas) return;
    // Show the canvas content (includes mug background + design) at reduced res
    img.src = canvas.toDataURL({ format: 'png', multiplier: 0.3 });
  }

  // ── Auto Save ─────────────────────────────────────────────────────────────
  function serializeDesign(highRes) {
    return {
      canvas_json:     canvas.toJSON(['excludeFromExport']),
      canvas_data_url: canvas.toDataURL({ format: 'png', multiplier: highRes ? 4 : 2 }),
      variant:         selectedVariant,
      addons:          selectedAddons,
      canvas_width:    500,
      canvas_height:   580,
      version:         '1.0',
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
      if (design && design.canvas_json && design.canvas_json.objects && design.canvas_json.objects.length > 0) {
        canvas.loadFromJSON(design.canvas_json, function () {
          canvas.requestRenderAll();
          pushHistory();
        });
      }
      if (design.variant) selectedVariant = design.variant;
      if (design.addons)  selectedAddons  = design.addons;
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
  let _boundaryWarningTimer = null;

  function bindCanvasEvents() {
    canvas.on('object:added',    function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:modified', function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); setSaveStatus('● Unsaved', '#f59e0b'); });
    canvas.on('object:removed',  function () { if (!isHistoryLock) pushHistory(); updateMiniPreview(); setSaveStatus('● Unsaved', '#f59e0b'); });

    canvas.on('selection:created', function (e) { showContextBar(e.selected[0]); });
    canvas.on('selection:updated', function (e) { showContextBar(e.selected[0]); });
    canvas.on('selection:cleared', function ()  { hideContextBar(); });

    // C5 — boundary warning + M13 snap guides on drag/scale
    canvas.on('object:moving',  function (e) { checkBoundary(e); snapGuides(e); });
    canvas.on('object:scaling', checkBoundary);
    canvas.on('object:modified', function () { clearGuides(); });

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

  function checkBoundary(e) {
    const pa  = getPrintAreaPx();
    const obj = e.target;
    const b   = obj.getBoundingRect(true);
    const outside = b.left < pa.left || b.top < pa.top ||
                    b.left + b.width > pa.left + pa.width ||
                    b.top  + b.height > pa.top  + pa.height;

    if (printAreaRect) {
      printAreaRect.set({ stroke: outside ? '#dc2626' : '#4caf50' });
      canvas.requestRenderAll();
    }

    if (outside) {
      clearTimeout(_boundaryWarningTimer);
      _boundaryWarningTimer = setTimeout(function () {
        showToast('⚠️ Part of your design is outside the print area');
        if (printAreaRect) { printAreaRect.set({ stroke: '#4caf50' }); canvas.requestRenderAll(); }
      }, 600);
    }
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

    // Upload
    if (uploadInput) {
      uploadInput.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          handleFileUpload(this.files[0]);
          this.value = '';
        }
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
