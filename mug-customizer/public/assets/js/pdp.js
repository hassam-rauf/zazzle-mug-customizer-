/* Mug Customizer — PDP interaction */
(function () {
  'use strict';

  const cfg = window.mugPdpConfig  || {};
  const mc  = window.mugCustomizer || {};

  // Merge mockup map from both sources
  const mockupMap  = cfg.mockupMap  || mc.mockupMap  || {};
  const placeholder = cfg.placeholder || (mc.pluginUrl + 'public/assets/images/placeholder-mug.png');

  let selected = Object.assign({ style: 'classic', size: '11oz', color: 'white' }, cfg.selected || {});

  // ── Helpers ───────────────────────────────────────────────────────────────

  function buildKey(style, size, color, angle) {
    return [style, size, color, angle].join('-').toLowerCase()
      .replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '');
  }

  function getMockupUrl(angle) {
    const key = buildKey(selected.style, selected.size, selected.color, angle);
    return mockupMap[key] || placeholder;
  }

  // ── Image Updates ─────────────────────────────────────────────────────────

  function updateHeroImage(url) {
    const img = document.getElementById('pdp-hero-img');
    if (img) img.src = url || getMockupUrl('front');
  }

  function updateAllThumbs() {
    const angles = ['front', 'back', 'side', 'lifestyle'];
    document.querySelectorAll('.thumb-strip .thumb').forEach(function (el, i) {
      const angle = el.dataset.angle || angles[i] || 'front';
      const url   = getMockupUrl(angle);
      const img   = el.querySelector('img');
      if (img) img.src = url;
      el.dataset.src = url;
    });
  }

  function updatePersonalizeUrls() {
    const base = cfg.designerUrl || '';
    const qs = '&style=' + encodeURIComponent(selected.style)
             + '&size='  + encodeURIComponent(selected.size)
             + '&color=' + encodeURIComponent(selected.color);

    ['btn-personalize', 'btn-sticky-personalize'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.href = base + qs;
    });
  }

  function onVariantChange() {
    updateAllThumbs();
    updateHeroImage(getMockupUrl('front'));
    updatePersonalizeUrls();

    // Update selected label spans
    ['style', 'size', 'color'].forEach(function (opt) {
      const el = document.getElementById('selected-' + opt + '-label');
      if (el) el.textContent = selected[opt];
    });
  }

  // ── Variant Pills ─────────────────────────────────────────────────────────

  function initPills() {
    document.querySelectorAll('.pill[data-option]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        const opt = btn.dataset.option;
        const val = btn.dataset.value || btn.textContent.trim().toLowerCase();
        if (!opt || !(opt in selected)) return;

        // Deselect siblings
        btn.closest('.pill-group').querySelectorAll('.pill').forEach(function (p) {
          p.classList.remove('selected');
        });
        btn.classList.add('selected');

        selected[opt] = val;
        onVariantChange();
      });
    });
  }

  // ── Color Swatches ────────────────────────────────────────────────────────

  function initSwatches() {
    document.querySelectorAll('.swatch').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.swatch').forEach(function (s) {
          s.classList.remove('selected');
        });
        btn.classList.add('selected');
        selected.color = btn.dataset.color || btn.dataset.value || 'white';
        onVariantChange();
      });
    });
  }

  // ── Thumbnail Strip ───────────────────────────────────────────────────────

  function initThumbs() {
    document.querySelectorAll('.thumb-strip .thumb').forEach(function (el) {
      el.addEventListener('click', function () {
        document.querySelectorAll('.thumb-strip .thumb').forEach(function (t) {
          t.classList.remove('active');
        });
        el.classList.add('active');
        const url = el.dataset.src || (el.querySelector('img') || {}).src;
        if (url) updateHeroImage(url);
      });
    });
  }

  // ── Zoom Modal ────────────────────────────────────────────────────────────

  function initZoom() {
    const modal    = document.getElementById('pdp-zoom-modal');
    const zoomImg  = document.getElementById('pdp-zoom-img');
    const closeBtn = document.getElementById('pdp-zoom-close');
    const zoomBtn  = document.getElementById('pdp-zoom-btn');
    const preview  = document.querySelector('.pdp-preview');

    function openZoom() {
      const heroSrc = (document.getElementById('pdp-hero-img') || {}).src || '';
      if (modal && zoomImg) {
        zoomImg.src = heroSrc;
        modal.classList.remove('pdp-zoom-hidden');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeZoom() {
      if (modal) {
        modal.classList.add('pdp-zoom-hidden');
        document.body.style.overflow = '';
      }
    }

    if (zoomBtn)  zoomBtn.addEventListener('click', function (e) { e.stopPropagation(); openZoom(); });
    if (preview)  preview.addEventListener('click', openZoom);
    if (closeBtn) closeBtn.addEventListener('click', closeZoom);
    if (modal)    modal.addEventListener('click', function (e) { if (e.target === modal) closeZoom(); });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeZoom();
    });
  }

  // ── Sticky Bar ────────────────────────────────────────────────────────────

  function initStickyBar() {
    const bar   = document.getElementById('pdp-sticky-bar');
    const cta   = document.querySelector('.pdp-cta-block');
    if (!bar || !cta) return;

    const observer = new IntersectionObserver(function (entries) {
      const visible = entries[0].isIntersecting;
      bar.classList.toggle('pdp-sticky-visible', !visible);
      bar.classList.toggle('pdp-sticky-hidden',   visible);
    }, { threshold: 0.1 });

    observer.observe(cta);
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init() {
    initPills();
    initSwatches();
    initThumbs();
    initZoom();
    initStickyBar();
    updatePersonalizeUrls();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
