/* Mug Customizer — Review tab */
(function () {
  'use strict';

  const mc  = window.mugCustomizer    || {};
  const cfg = window.mugReviewConfig  || {};

  let design  = null;
  let qty     = 1;

  // ── Load design from localStorage ──────────────────────────────────────
  function loadDesign() {
    try {
      const raw = localStorage.getItem('mugDesign_' + cfg.productId);
      if (! raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function buildVariantKey(style, size, color, angle) {
    return [style, size, color, angle].join('-').toLowerCase();
  }

  // ── Composite design onto mockup ─────────────────────────────────────────
  function compositeOntoMockup(mockupUrl, designDataUrl, callback) {
    if (! designDataUrl) {
      callback(mockupUrl);
      return;
    }

    var offscreen = document.createElement('canvas');
    offscreen.width  = 500;
    offscreen.height = 580;
    var ctx = offscreen.getContext('2d');

    var mockupImg = new Image();
    mockupImg.crossOrigin = 'anonymous';
    mockupImg.onload = function () {
      ctx.drawImage(mockupImg, 0, 0, offscreen.width, offscreen.height);

      var designImg = new Image();
      designImg.onload = function () {
        // Design canvas already includes the mug background — draw it at full size
        ctx.drawImage(designImg, 0, 0, offscreen.width, offscreen.height);
        try {
          callback(offscreen.toDataURL('image/png'));
        } catch (e) {
          // CORS issue — fall back to plain mockup
          callback(mockupUrl);
        }
      };
      designImg.onerror = function () { callback(mockupUrl); };
      designImg.src = designDataUrl;
    };
    mockupImg.onerror = function () { callback(mockupUrl); };
    mockupImg.src = mockupUrl;
  }

  // ── Populate review UI ────────────────────────────────────────────────────
  function populateReview() {
    design = loadDesign();

    if (! design || ! design.variant) {
      if (cfg.designerUrl) {
        window.location.href = cfg.designerUrl;
      }
      return;
    }

    const variant     = design.variant || {};
    const addons      = design.addons  || [];
    const addonPrices = mc.addonPrices || {};
    const mockupMap   = mc.mockupMap   || {};
    // v1.1+ uses `mockup_data_url`; legacy designs may still have `canvas_data_url`.
    const designData  = design.mockup_data_url || design.canvas_data_url || null;

    // Populate options list
    setText('review-opt-style',  '• Style: '   + ucFirst(variant.style  || '—'));
    setText('review-opt-size',   '• Size: '    + (variant.size  || '—'));
    setText('review-opt-color',  '• Color: '   + ucFirst(variant.color  || '—'));
    setText('review-opt-addons', '• Add-ons: ' + (addons.length ? addons.map(ucFirst).join(', ') : 'None'));

    // Set angle thumbnails (plain mockup for non-front angles)
    ['front', 'back', 'side', 'lifestyle'].forEach(function (angle) {
      const key = buildVariantKey(variant.style, variant.size, variant.color, angle);
      const url = mockupMap[key] || (mc.pluginUrl + 'public/assets/images/placeholder-mug.png');
      const thumbImg = document.getElementById('thumb-' + angle);
      if (thumbImg) thumbImg.src = url;
    });

    // Main image — prefer the full mockup snapshot from the designer (already
    // tinted + design composited). Fall back to legacy mockup+overlay path.
    const frontKey = buildVariantKey(variant.style, variant.size, variant.color, 'front');
    const frontUrl = mockupMap[frontKey] || (mc.pluginUrl + 'public/assets/images/placeholder-mug-white.svg');
    const mainImg  = document.getElementById('review-main-img');
    const frontThumb = document.getElementById('thumb-front');

    if (design.mockup_data_url) {
      if (mainImg)    mainImg.src    = design.mockup_data_url;
      if (frontThumb) frontThumb.src = design.mockup_data_url;
    } else {
      compositeOntoMockup(frontUrl, designData, function (compositeUrl) {
        if (mainImg)    mainImg.src    = compositeUrl;
        if (frontThumb) frontThumb.src = compositeUrl;
      });
    }

    // Price
    let total = parseFloat(cfg.basePrice || 0);
    addons.forEach(function (a) {
      total += parseFloat(addonPrices[a] || 0);
    });
    const priceEl = document.getElementById('review-price');
    if (priceEl) priceEl.textContent = '$' + total.toFixed(2);
  }

  // ── Add to Cart ───────────────────────────────────────────────────────────
  function addToCart() {
    if (! design) {
      showError('No design found. Please go back and design your mug.');
      return;
    }

    const canvasObjects = (design.canvas_json && design.canvas_json.objects) ? design.canvas_json.objects : [];
    if (canvasObjects.length === 0) {
      showError('Please add at least one design element before adding to cart.');
      return;
    }

    const btn = document.getElementById('btn-add-to-cart');
    if (btn) {
      btn.disabled     = true;
      btn.textContent  = 'Adding…';
    }

    fetch(mc.apiRoot + 'cart/add', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': mc.nonce },
      body:    JSON.stringify({
        product_id:   cfg.productId,
        variation_id: cfg.variationId,
        quantity:     qty,
        design:       design,
      }),
    })
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (data.success) {
          // Clear session design
          try { localStorage.removeItem('mugDesign_' + cfg.productId); } catch (e) {}
          window.location.href = data.cart_url || mc.cartUrl;
        } else {
          showError(data.message || 'Could not add to cart. Please try again.');
          if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart'; }
        }
      })
      .catch(function () {
        showError('Network error. Please check your connection and try again.');
        if (btn) { btn.disabled = false; btn.textContent = 'Add to Cart'; }
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function ucFirst(str) {
    str = str || '';
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
  }

  function showError(msg) {
    const el = document.getElementById('cart-error');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    populateReview();

    // Thumb strip click → update main image
    document.querySelectorAll('.review-thumb').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.review-thumb').forEach(t => t.classList.remove('active'));
        el.classList.add('active');

        const angle   = el.dataset.angle || 'front';
        const variant = (design && design.variant) || {};
        const key     = buildVariantKey(variant.style, variant.size, variant.color, angle);
        const url     = (mc.mockupMap || {})[key] || (mc.pluginUrl + 'public/assets/images/placeholder-mug.png');

        const mainImg = document.getElementById('review-main-img');
        if (mainImg) mainImg.src = url;
      });
    });

    // Qty select
    const qtySelect = document.getElementById('qty-select');
    if (qtySelect) {
      qtySelect.addEventListener('change', function () {
        qty = parseInt(this.value, 10) || 1;
      });
    }

    // Add to cart button
    const addBtn = document.getElementById('btn-add-to-cart');
    if (addBtn) addBtn.addEventListener('click', addToCart);

    // Mobile check
    if (window.innerWidth < 768) {
      const notice = document.getElementById('mobile-notice');
      if (notice) notice.style.display = 'block';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
