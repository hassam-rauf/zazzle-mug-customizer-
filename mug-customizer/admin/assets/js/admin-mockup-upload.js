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

      var $item = $activeBtn.closest('.mug-mockup-item');
      $item.find('input[name="mug_mockup_url[' + variantKey + ']"]').val(url);
      $item.find('.mockup-preview').attr('src', url).show();
      $item.find('.mug-mockup-placeholder').hide();
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
  });

})(jQuery);
