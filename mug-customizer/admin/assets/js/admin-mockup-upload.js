/* Mug Customizer — Admin mockup upload via WP Media Library */
(function ($) {
  'use strict';

  var $activeBtn = null;

  function openMediaUploader(btn) {
    $activeBtn = $(btn);

    var mediaUploader = wp.media({
      title:    'Select Mockup Image',
      button:   { text: 'Use This Image' },
      multiple: false,
      library:  { type: 'image' },
    });

    mediaUploader.on('select', function () {
      var attachment = mediaUploader.state().get('selection').first().toJSON();
      var url        = attachment.url;
      var variantKey = $activeBtn.data('variantKey');

      var $row = $activeBtn.closest('tr');
      $row.find('input[name="mug_mockup_url[' + variantKey + ']"]').val(url);
      $row.find('.mockup-preview').attr('src', url).show();
      $row.find('.mug-mockup-placeholder').hide();

      // Update visual print area editor background if this is a front PNG
      if (variantKey && variantKey.indexOf('-front') !== -1) {
        var style = variantKey.split('-')[0];
        var $editor = $('.mug-pae-editor[data-style="' + style + '"]');
        if ($editor.length) {
          $editor.find('.mug-pae-canvas').css('background-image', 'url(' + url + ')');
        }
      }
    });

    mediaUploader.open();
  }

  // ── Batch upload: upload multiple mockups at once ─────────────────────────
  function openBatchUploader() {
    var batchUploader = wp.media({
      title:    'Upload Mockup Images (Batch)',
      button:   { text: 'Add Images' },
      multiple: true,
      library:  { type: 'image' },
    });

    batchUploader.on('select', function () {
      var attachments = batchUploader.state().get('selection').toJSON();
      attachments.forEach(function (attachment) {
        var url      = attachment.url;
        var filename = attachment.filename || '';
        // Try to auto-match filename to variant key
        // Expected filename format: {style}-{size}-{color}-{angle}.png
        var key = filename.replace(/\.[^.]+$/, '').toLowerCase();
        var $input = $('input[name="mug_mockup_url[' + key + ']"]');
        if ($input.length) {
          $input.val(url);
          var $item = $input.closest('.mug-mockup-item');
          $item.find('.mockup-preview').attr('src', url).show();
          $item.find('.mug-mockup-placeholder').hide();
          $item.find('.mockup-url').text(url);
          // Flash the item
          $item.css('border-color', '#00a32a').delay(1000).queue(function (next) {
            $(this).css('border-color', '');
            next();
          });
        }
      });
    });

    batchUploader.open();
  }

  // ── Print area live validation ────────────────────────────────────────────
  function validatePrintArea(input) {
    var val = parseFloat($(input).val());
    var min = parseFloat($(input).attr('min') || 0);
    var max = parseFloat($(input).attr('max') || 100);
    if (isNaN(val) || val < min || val > max) {
      $(input).css('border-color', '#d63638');
    } else {
      $(input).css('border-color', '');
    }
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  $(document).ready(function () {

    // Single mockup upload button
    $(document).on('click', '.btn-upload-mockup', function (e) {
      e.preventDefault();
      openMediaUploader(this);
    });

    // Batch upload button
    $(document).on('click', '#btn-batch-upload-mockups', function (e) {
      e.preventDefault();
      openBatchUploader();
    });

    // Print area input validation
    $(document).on('change blur', '.mug-print-area-table input[type="number"]', function () {
      validatePrintArea(this);
    });

    // Addon price: only allow non-negative values
    $(document).on('change blur', '.mug-addon-table input[type="number"]', function () {
      var val = parseFloat($(this).val());
      if (isNaN(val) || val < 0) {
        $(this).val('0.00');
      } else {
        $(this).val(val.toFixed(2));
      }
    });

    // Confirm before clearing all mockups
    $(document).on('click', '#btn-clear-all-mockups', function (e) {
      if (!confirm('Clear all mockup URLs for this product? This cannot be undone.')) {
        e.preventDefault();
      }
    });

    // ── Visual Print Area Editor ──────────────────────────────────────────────
    document.querySelectorAll('.mug-pae-editor').forEach(function (editor) {
      var canvas = editor.querySelector('.mug-pae-canvas');
      var box    = editor.querySelector('.mug-pae-box');
      var handle = editor.querySelector('.mug-pae-handle');

      var inp = {
        top:    editor.querySelector('.mug-pae-top'),
        left:   editor.querySelector('.mug-pae-left'),
        width:  editor.querySelector('.mug-pae-width'),
        height: editor.querySelector('.mug-pae-height'),
      };

      var drag = { on: false, mode: 'move', ox: 0, oy: 0, snap: {} };

      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

      function pctFromBox() {
        return {
          top:    parseFloat(box.style.top)    || 0,
          left:   parseFloat(box.style.left)   || 0,
          width:  parseFloat(box.style.width)  || 10,
          height: parseFloat(box.style.height) || 10,
        };
      }

      function applyBox(p) {
        box.style.top    = p.top    + '%';
        box.style.left   = p.left   + '%';
        box.style.width  = p.width  + '%';
        box.style.height = p.height + '%';
        inp.top.value    = Math.round(p.top);
        inp.left.value   = Math.round(p.left);
        inp.width.value  = Math.round(p.width);
        inp.height.value = Math.round(p.height);
      }

      box.addEventListener('mousedown', function (e) {
        if (e.target === handle) return;
        drag.on   = true;
        drag.mode = 'move';
        drag.ox   = e.clientX;
        drag.oy   = e.clientY;
        drag.snap = pctFromBox();
        e.preventDefault();
      });

      handle.addEventListener('mousedown', function (e) {
        drag.on   = true;
        drag.mode = 'resize';
        drag.ox   = e.clientX;
        drag.oy   = e.clientY;
        drag.snap = pctFromBox();
        e.preventDefault();
        e.stopPropagation();
      });

      document.addEventListener('mousemove', function (e) {
        if (!drag.on) return;
        var cw = canvas.offsetWidth;
        var ch = canvas.offsetHeight;
        var dx = ((e.clientX - drag.ox) / cw) * 100;
        var dy = ((e.clientY - drag.oy) / ch) * 100;
        var s  = drag.snap;

        if (drag.mode === 'move') {
          applyBox({
            top:    clamp(s.top  + dy, 0, 100 - s.height),
            left:   clamp(s.left + dx, 0, 100 - s.width),
            width:  s.width,
            height: s.height,
          });
        } else {
          applyBox({
            top:    s.top,
            left:   s.left,
            width:  clamp(s.width  + dx, 5, 100 - s.left),
            height: clamp(s.height + dy, 5, 100 - s.top),
          });
        }
      });

      document.addEventListener('mouseup', function () { drag.on = false; });

      // Sync manual input → box
      [inp.top, inp.left, inp.width, inp.height].forEach(function (el) {
        el.addEventListener('input', function () {
          box.style.top    = inp.top.value    + '%';
          box.style.left   = inp.left.value   + '%';
          box.style.width  = inp.width.value  + '%';
          box.style.height = inp.height.value + '%';
        });
      });
    });

  });

})(jQuery);
