<?php
// Designer is a full-screen surface — hide WP admin bar to prevent layout shift / scrollbars
if (function_exists('show_admin_bar')) { show_admin_bar(false); }
add_filter('show_admin_bar', '__return_false');
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?> class="mug-designer-html">
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php esc_html_e('Design Your Mug', 'mug-customizer'); ?> — <?php bloginfo('name'); ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;700&family=Montserrat:ital,wght@0,400;0,700;1,400&family=Oswald:wght@400;700&family=Roboto:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
<?php wp_head(); ?>
</head>
<body class="mug-designer-body">

<?php
$product_id   = (int) ($_GET['product_id']   ?? 0);
$variation_id = (int) ($_GET['variation_id'] ?? 0);
$style        = sanitize_text_field($_GET['style']  ?? 'classic');
$size         = sanitize_text_field($_GET['size']   ?? '11oz');
$color        = sanitize_text_field($_GET['color']  ?? 'black');

$pdp_url      = $product_id ? get_permalink($product_id) : home_url('/');
$review_url   = home_url('/mug-review/?product_id=' . $product_id . '&variation_id=' . $variation_id);
?>

<div id="designer-wrap">

  <!-- ── Top Bar ─── Zazzle-parity header (LEFT / CENTER / RIGHT zones) ──── -->
  <div id="designer-topbar">

    <!-- LEFT zone -->
    <div class="topbar-left">
      <a href="<?php echo esc_url($pdp_url); ?>" class="topbar-exit" aria-label="<?php esc_attr_e('Save and Exit', 'mug-customizer'); ?>">
        <svg class="tb-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
        <span><?php esc_html_e('Save and Exit', 'mug-customizer'); ?></span>
      </a>
      <span class="topbar-saved" id="save-status" aria-live="polite"></span>
      <span class="topbar-divider" aria-hidden="true"></span>
    </div>

    <!-- CENTER zone (step tabs) -->
    <nav class="topbar-tabs" aria-label="<?php esc_attr_e('Design steps', 'mug-customizer'); ?>">
      <span class="tab active" data-tab="design" role="link" tabindex="0" aria-current="step"><?php esc_html_e('Design', 'mug-customizer'); ?></span>
      <span class="tab" data-tab="options" role="link" tabindex="0"><?php esc_html_e('Options', 'mug-customizer'); ?></span>
      <span class="tab" data-tab="review" role="link" tabindex="0" id="review-tab-link"><?php esc_html_e('Review', 'mug-customizer'); ?></span>
    </nav>

    <!-- RIGHT zone -->
    <div class="topbar-right">
      <span class="topbar-divider" aria-hidden="true"></span>
      <div class="topbar-undo-group">
        <button type="button" id="btn-undo" class="tb-circle-btn" aria-label="<?php esc_attr_e('Undo', 'mug-customizer'); ?>" disabled aria-disabled="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7v6h6"></path><path d="M3 13a9 9 0 1 0 3-7.7L3 8"></path></svg>
        </button>
        <button type="button" id="btn-redo" class="tb-circle-btn" aria-label="<?php esc_attr_e('Redo', 'mug-customizer'); ?>" disabled aria-disabled="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 7v6h-6"></path><path d="M21 13a9 9 0 1 1-3-7.7L21 8"></path></svg>
        </button>
      </div>
      <span class="topbar-divider" aria-hidden="true"></span>
      <span class="topbar-preview" id="btn-preview" role="button" tabindex="0" aria-label="<?php esc_attr_e('Preview mug', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle></svg>
        <span><?php esc_html_e('Preview', 'mug-customizer'); ?></span>
      </span>
      <a href="<?php echo esc_url($review_url); ?>" class="topbar-next-btn" id="btn-next-review" data-design-label="<?php esc_attr_e('Next: Options', 'mug-customizer'); ?>" data-options-label="<?php esc_attr_e('Next: Review', 'mug-customizer'); ?>">
        <span><?php esc_html_e('Next: Options', 'mug-customizer'); ?></span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
      </a>
    </div>
  </div>

  <!-- ── Canvas Stage (full area, all panels float inside) ──────────────── -->
  <div id="canvas-stage">

    <!-- Text Context Bar (shows when text object selected) — Zazzle floating pill style -->
    <div id="context-bar" data-anchor="below">
      <span class="ctx-notch" aria-hidden="true"></span>

      <button type="button" id="ctx-edit-text" class="ctx-edit-text-btn" title="<?php esc_attr_e('Enter edit mode', 'mug-customizer'); ?>"><?php esc_html_e('Edit text', 'mug-customizer'); ?></button>
      <div class="ctx-sep"></div>

      <div class="ctx-font-group" title="<?php esc_attr_e('Font family', 'mug-customizer'); ?>">
        <span class="ctx-label"><?php esc_html_e('Font:', 'mug-customizer'); ?></span>
        <span id="ctx-font-preview" class="ctx-font-preview" style="font-family:Georgia;">Georgia</span>
        <select id="ctx-font" class="ctx-font-select" title="Font family">
          <option value="Georgia"           style="font-family:Georgia;">Georgia</option>
          <option value="Roboto"            style="font-family:Roboto;">Roboto</option>
          <option value="Montserrat"        style="font-family:Montserrat;">Montserrat</option>
          <option value="Oswald"            style="font-family:Oswald;">Oswald</option>
          <option value="Dancing Script"    style="font-family:'Dancing Script';">Dancing Script</option>
          <option value="Arial"             style="font-family:Arial;">Arial</option>
          <option value="Times New Roman"   style="font-family:'Times New Roman';">Times New Roman</option>
        </select>
      </div>
      <div class="ctx-sep"></div>

      <span class="ctx-label"><?php esc_html_e('Font size', 'mug-customizer'); ?></span>
      <div class="ctx-size-group">
        <button type="button" id="ctx-size-minus" class="ctx-size-step" title="Decrease size">&minus;</button>
        <input type="number" id="ctx-size-input" class="ctx-size-input" value="24" min="6" max="200" step="0.01" title="Font size">
        <button type="button" id="ctx-size-plus"  class="ctx-size-step" title="Increase size">+</button>
      </div>
      <div class="ctx-sep"></div>

      <span class="ctx-color-wrap" title="<?php esc_attr_e('Text color', 'mug-customizer'); ?>">
        <input type="color" id="ctx-color" value="#222222">
      </span>
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-bold"   class="ctx-icon-btn" title="<?php esc_attr_e('Bold', 'mug-customizer'); ?>"><strong>B</strong></button>
      <button type="button" id="ctx-italic" class="ctx-icon-btn" title="<?php esc_attr_e('Italic', 'mug-customizer'); ?>"><em>I</em></button>
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-spacing-toggle" class="ctx-icon-btn ctx-with-chevron" title="<?php esc_attr_e('Line & letter spacing', 'mug-customizer'); ?>" aria-haspopup="true" aria-expanded="false">
        <span class="ctx-3lines" aria-hidden="true">&#9776;</span><span class="ctx-chevron" aria-hidden="true">&#9662;</span>
      </button>
      <div id="ctx-spacing-panel" class="ctx-popover" hidden>
        <label class="ctx-popover-row">
          <span class="ctx-popover-label"><?php esc_html_e('Letter spacing', 'mug-customizer'); ?></span>
          <input type="range" id="ctx-spacing" min="-200" max="800" value="0" step="10">
        </label>
        <label class="ctx-popover-row">
          <span class="ctx-popover-label"><?php esc_html_e('Line height', 'mug-customizer'); ?></span>
          <input type="range" id="ctx-lineheight" min="50" max="300" value="120" step="5">
        </label>
      </div>
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-delete" class="ctx-icon-btn ctx-delete-btn" title="<?php esc_attr_e('Delete', 'mug-customizer'); ?>">&#x1F5D1;</button>
      <div class="ctx-sep"></div>

      <div class="ctx-align-wrap" title="<?php esc_attr_e('Alignment', 'mug-customizer'); ?>">
        <button type="button" id="ctx-align-toggle" class="ctx-align-trigger" aria-haspopup="true" aria-expanded="false">
          <span class="ctx-label"><?php esc_html_e('Alignment', 'mug-customizer'); ?></span>
          <span class="ctx-chevron" aria-hidden="true">&#9662;</span>
        </button>
        <div id="ctx-align-popover" class="ctx-popover ctx-align-popover" hidden>
          <!-- Align section -->
          <div class="ctx-pop-section">
            <div class="ctx-pop-title"><?php esc_html_e('Align', 'mug-customizer'); ?></div>
            <div class="ctx-align-grid">
              <button type="button" class="ctx-pop-btn ctx-align-h" data-align="left"   title="<?php esc_attr_e('Align left', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="4" x2="4" y2="20"/><rect x="6" y="6.5" width="13" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="6" y="14.5" width="9"  height="3" rx="0.5" fill="currentColor" stroke="none"/></svg></button>
              <button type="button" class="ctx-pop-btn ctx-align-h" data-align="center" title="<?php esc_attr_e('Align center', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="12" y1="4" x2="12" y2="20"/><rect x="5.5" y="6.5" width="13" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="7.5" y="14.5" width="9"  height="3" rx="0.5" fill="currentColor" stroke="none"/></svg></button>
              <button type="button" class="ctx-pop-btn ctx-align-h" data-align="right"  title="<?php esc_attr_e('Align right', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="20" y1="4" x2="20" y2="20"/><rect x="5"  y="6.5" width="13" height="3" rx="0.5" fill="currentColor" stroke="none"/><rect x="9"  y="14.5" width="9"  height="3" rx="0.5" fill="currentColor" stroke="none"/></svg></button>
              <button type="button" class="ctx-pop-btn ctx-align-v" data-align="top"    title="<?php esc_attr_e('Align top', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="4" x2="20" y2="4"/><rect x="6.5" y="6"  width="3" height="13" rx="0.5" fill="currentColor" stroke="none"/><rect x="14.5" y="6"  width="3" height="9"  rx="0.5" fill="currentColor" stroke="none"/></svg></button>
              <button type="button" class="ctx-pop-btn ctx-align-v" data-align="middle" title="<?php esc_attr_e('Align middle', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="12" x2="20" y2="12"/><rect x="6.5" y="5.5" width="3" height="13" rx="0.5" fill="currentColor" stroke="none"/><rect x="14.5" y="7.5" width="3" height="9"  rx="0.5" fill="currentColor" stroke="none"/></svg></button>
              <button type="button" class="ctx-pop-btn ctx-align-v" data-align="bottom" title="<?php esc_attr_e('Align bottom', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><line x1="4" y1="20" x2="20" y2="20"/><rect x="6.5" y="5"  width="3" height="13" rx="0.5" fill="currentColor" stroke="none"/><rect x="14.5" y="9"  width="3" height="9"  rx="0.5" fill="currentColor" stroke="none"/></svg></button>
            </div>
          </div>

          <div class="ctx-pop-row ctx-pop-row-2col">
            <div class="ctx-pop-section">
              <div class="ctx-pop-title"><?php esc_html_e('Distribute', 'mug-customizer'); ?></div>
              <div class="ctx-pop-row">
                <button type="button" class="ctx-pop-btn" id="ctx-distribute-h" title="<?php esc_attr_e('Stretch horizontally', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="2" y="6" width="3" height="12"/><rect x="10.5" y="6" width="3" height="12"/><rect x="19" y="6" width="3" height="12"/></svg></button>
                <button type="button" class="ctx-pop-btn" id="ctx-distribute-v" title="<?php esc_attr_e('Stretch vertically', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="6" y="2" width="12" height="3"/><rect x="6" y="10.5" width="12" height="3"/><rect x="6" y="19" width="12" height="3"/></svg></button>
              </div>
            </div>
            <div class="ctx-pop-section ctx-pop-divider-left">
              <div class="ctx-pop-title"><?php esc_html_e('Align to', 'mug-customizer'); ?></div>
              <label class="ctx-radio"><input type="radio" name="ctx-align-to" value="selection"><span><?php esc_html_e('Selection', 'mug-customizer'); ?></span></label>
              <label class="ctx-radio"><input type="radio" name="ctx-align-to" value="artboard" checked><span><?php esc_html_e('Artboard', 'mug-customizer'); ?></span></label>
            </div>
          </div>

          <hr class="ctx-pop-hr">

          <div class="ctx-pop-row ctx-pop-row-2col">
            <div class="ctx-pop-section">
              <div class="ctx-pop-title"><?php esc_html_e('Flip', 'mug-customizer'); ?></div>
              <div class="ctx-pop-row">
                <button type="button" class="ctx-pop-btn" id="ctx-flip-h" title="<?php esc_attr_e('Flip horizontal', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><polygon points="10,6 4,12 10,18" fill="currentColor"/><polygon points="14,6 20,12 14,18"/><line x1="12" y1="3" x2="12" y2="21" stroke-dasharray="2 2"/></svg></button>
                <button type="button" class="ctx-pop-btn" id="ctx-flip-v" title="<?php esc_attr_e('Flip vertical', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"><polygon points="6,10 12,4 18,10" fill="currentColor"/><polygon points="6,14 12,20 18,14"/><line x1="3" y1="12" x2="21" y2="12" stroke-dasharray="2 2"/></svg></button>
              </div>
            </div>
            <div class="ctx-pop-section">
              <div class="ctx-pop-title"><?php esc_html_e('Scale', 'mug-customizer'); ?></div>
              <div class="ctx-pop-row">
                <button type="button" class="ctx-pop-btn" id="ctx-scale-down" title="<?php esc_attr_e('Scale down', 'mug-customizer'); ?>">&minus;</button>
                <button type="button" class="ctx-pop-btn" id="ctx-scale-up"   title="<?php esc_attr_e('Scale up', 'mug-customizer'); ?>">+</button>
              </div>
            </div>
          </div>

          <div class="ctx-pop-section">
            <div class="ctx-pop-title"><?php esc_html_e('Rotate', 'mug-customizer'); ?></div>
            <div class="ctx-pop-row ctx-rotate-row">
              <button type="button" class="ctx-pop-btn" id="ctx-rotate-ccw" title="<?php esc_attr_e('Rotate left', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 4 3 9 8 9"/></svg></button>
              <div class="ctx-rotate-input-wrap">
                <input type="number" id="ctx-rotate-input" value="0" min="-360" max="360" step="1" class="ctx-pop-input">
                <span class="ctx-deg">&deg;</span>
              </div>
              <button type="button" class="ctx-pop-btn" id="ctx-rotate-cw" title="<?php esc_attr_e('Rotate right', 'mug-customizer'); ?>"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 4 21 9 16 9"/></svg></button>
            </div>
          </div>
        </div>
      </div>
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-effects-toggle" class="ctx-effects-btn" title="<?php esc_attr_e('Text effects', 'mug-customizer'); ?>">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 0 0 0 18c1.1 0 2-.9 2-2 0-.5-.2-1-.6-1.4-.4-.4-.6-.9-.6-1.4 0-1.1.9-2 2-2H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="6.5" cy="11.5" r="1" fill="currentColor"/><circle cx="9.5"  cy="7"   r="1" fill="currentColor"/><circle cx="14.5" cy="7"   r="1" fill="currentColor"/><circle cx="17.5" cy="11.5" r="1" fill="currentColor"/></svg>
        <span><?php esc_html_e('Effects', 'mug-customizer'); ?></span>
      </button>

      <button type="button" id="ctx-more-toggle" class="ctx-more-btn" title="<?php esc_attr_e('More options', 'mug-customizer'); ?>" aria-expanded="false">&#9656;</button>
      <div id="ctx-more-panel" hidden class="ctx-more-panel">
        <label class="ctx-slider-label" title="Rotation angle">
          <span>&#8635;</span>
          <input type="number" id="ctx-angle" value="0" min="-360" max="360" step="1" style="width:46px;" title="Rotation (°)">
          <span>°</span>
        </label>
        <div class="ctx-sep"></div>
        <input type="color" id="ctx-stroke-color" value="#000000" title="Stroke color">
        <input type="number" id="ctx-stroke-width" min="0" max="20" value="0" title="Stroke width" style="width:42px;">
        <div class="ctx-sep"></div>
        <button type="button" id="ctx-layer-up"    title="Bring forward">&#8679;</button>
        <button type="button" id="ctx-layer-down"  title="Send backward">&#8681;</button>
        <button type="button" id="ctx-layer-front" title="To front">&#10514;</button>
        <button type="button" id="ctx-layer-back"  title="To back">&#10515;</button>
        <div class="ctx-sep"></div>
        <button type="button" id="ctx-duplicate"   title="Duplicate (Ctrl+D)">&#10697;</button>
      </div>

      <!-- Hidden legacy elements kept for JS compat -->
      <button type="button" id="ctx-underline"    style="display:none;"></button>
      <button type="button" id="ctx-align-left"   style="display:none;"></button>
      <button type="button" id="ctx-align-center" style="display:none;"></button>
      <button type="button" id="ctx-align-right"  style="display:none;"></button>
      <input  type="number" id="ctx-size"         value="24" min="8" max="200" style="display:none;">
      <span   id="ctx-size-val"                   style="display:none;">24</span>
      <select id="ctx-align-select"               style="display:none;"><option value="left"></option><option value="center"></option><option value="right"></option></select>
    </div>

    <!-- Effects flyout panel (Zazzle parity) — opens via toolbar Effects button -->
    <aside id="effects-panel" class="floating-panel" hidden role="dialog" aria-labelledby="effects-panel-title">
      <div class="panel-header">
        <h3 id="effects-panel-title"><?php esc_html_e('Text Effects', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="effects-panel-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
        </button>
      </div>

      <!-- Opacity -->
      <section class="fx-section" data-section="opacity">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Opacity', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-row">
            <input type="range" id="fx-opacity" min="0" max="100" value="100" class="fx-slider">
            <input type="number" id="fx-opacity-input" min="0" max="100" value="100" class="fx-num">
          </div>
        </div>
      </section>

      <!-- Tiling (UI scaffold; engine TBD in v1.1) -->
      <section class="fx-section is-collapsed" data-section="tiling">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Tiling', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-tile-grid">
            <button type="button" class="fx-tile is-active" data-tiling="none"><div class="fx-tile-art"><span class="fx-tile-dot">&#10003;</span></div><span class="fx-tile-label"><?php esc_html_e('None', 'mug-customizer'); ?></span></button>
            <button type="button" class="fx-tile" data-tiling="basic"><div class="fx-tile-art fx-tile-basic"><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span></div><span class="fx-tile-label"><?php esc_html_e('Basic', 'mug-customizer'); ?></span></button>
            <button type="button" class="fx-tile" data-tiling="halfbrick"><div class="fx-tile-art fx-tile-brick"><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span></div><span class="fx-tile-label"><?php esc_html_e('Half Brick', 'mug-customizer'); ?></span></button>
            <button type="button" class="fx-tile" data-tiling="halfdrop"><div class="fx-tile-art fx-tile-drop"><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span><span>&#10003;</span></div><span class="fx-tile-label"><?php esc_html_e('Half Drop', 'mug-customizer'); ?></span></button>
            <button type="button" class="fx-tile" data-tiling="mirror"><div class="fx-tile-art fx-tile-mirror"><span>&#10003;</span><span>&#10003;</span><span>&#9650;</span><span>&#9650;</span></div><span class="fx-tile-label"><?php esc_html_e('Mirror', 'mug-customizer'); ?></span></button>
          </div>
        </div>
      </section>

      <!-- Shadow -->
      <section class="fx-section" data-section="shadow">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Shadow', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <label class="fx-toggle-row">
            <span id="fx-shadow-state"><?php esc_html_e('Text Shadow: off', 'mug-customizer'); ?></span>
            <span class="fx-switch"><input type="checkbox" id="fx-shadow"><span class="fx-switch-track"></span></span>
          </label>
        </div>
      </section>

      <!-- Stroke -->
      <section class="fx-section" data-section="stroke">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Stroke', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <label class="fx-toggle-row">
            <span id="fx-stroke-state"><?php esc_html_e('Text Stroke: off', 'mug-customizer'); ?></span>
            <span class="fx-switch"><input type="checkbox" id="fx-stroke"><span class="fx-switch-track"></span></span>
          </label>
          <div class="fx-stroke-controls" hidden>
            <div class="fx-row">
              <span class="fx-mini-label"><?php esc_html_e('Color', 'mug-customizer'); ?></span>
              <input type="color" id="fx-stroke-color" value="#000000" class="fx-color">
            </div>
            <div class="fx-row">
              <span class="fx-mini-label"><?php esc_html_e('Width', 'mug-customizer'); ?></span>
              <input type="range" id="fx-stroke-width" min="0" max="10" step="0.5" value="1" class="fx-slider">
              <input type="number" id="fx-stroke-width-input" min="0" max="10" step="0.5" value="1" class="fx-num">
            </div>
          </div>
        </div>
      </section>

      <!-- Line spacing -->
      <section class="fx-section" data-section="linespacing">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Line spacing', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-row">
            <input type="range" id="fx-line-spacing" min="0.5" max="3" step="0.05" value="1" class="fx-slider">
            <input type="number" id="fx-line-spacing-input" min="0.5" max="3" step="0.05" value="1" class="fx-num">
          </div>
        </div>
      </section>

      <!-- Letter spacing -->
      <section class="fx-section" data-section="letterspacing">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Letter spacing', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-row">
            <input type="range" id="fx-letter-spacing" min="-200" max="800" step="10" value="0" class="fx-slider">
            <input type="number" id="fx-letter-spacing-input" min="-200" max="800" step="10" value="0" class="fx-num">
          </div>
        </div>
      </section>

      <!-- Curved text (UI scaffold; engine TBD in v1.1) -->
      <section class="fx-section is-collapsed" data-section="curved">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Curved text', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-row">
            <span class="fx-mini-label"><?php esc_html_e('Curve', 'mug-customizer'); ?></span>
            <input type="range" id="fx-curve" min="-180" max="180" step="5" value="0" class="fx-slider">
            <input type="number" id="fx-curve-input" min="-180" max="180" step="5" value="0" class="fx-num">
          </div>
        </div>
      </section>

      <!-- Text orientation -->
      <section class="fx-section" data-section="orientation">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Text orientation', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="fx-orient-grid">
            <button type="button" class="fx-orient is-active" data-orient="horizontal">
              <div class="fx-orient-art fx-orient-h">abc</div>
              <span class="fx-orient-label"><?php esc_html_e('Horizontal', 'mug-customizer'); ?></span>
            </button>
            <button type="button" class="fx-orient" data-orient="vertical">
              <div class="fx-orient-art fx-orient-v"><span>a</span><span>b</span><span>c</span></div>
              <span class="fx-orient-label"><?php esc_html_e('Vertical', 'mug-customizer'); ?></span>
            </button>
          </div>
        </div>
      </section>
    </aside>

    <!-- Image Context Bar (shows when image object selected) -->
    <div id="img-context-bar" style="display:none;">
      <span class="ctx-label"><?php esc_html_e('Image', 'mug-customizer'); ?></span>
      <button type="button" id="ctx-img-fit" title="Fit to print area">&#10696;</button>
      <button type="button" id="ctx-img-flip-h" title="Flip horizontal">&#8596;</button>
      <button type="button" id="ctx-img-flip-v" title="Flip vertical">&#8597;</button>
      <div class="ctx-sep"></div>
      <label class="ctx-slider-label" title="Opacity">
        <span>&#9680;</span>
        <input type="range" id="ctx-img-opacity" min="10" max="100" value="100" step="5" style="width:60px;">
        <span id="ctx-img-opacity-val">100%</span>
      </label>
      <div class="ctx-sep"></div>
      <label class="ctx-slider-label" title="Rotation angle">
        <span>&#8635;</span>
        <input type="number" id="ctx-img-angle" value="0" min="-360" max="360" step="1" style="width:46px;" title="Rotation (°)">
        <span>°</span>
      </label>
      <div class="ctx-sep"></div>
      <span id="ctx-img-dpi" class="ctx-dpi-badge" style="display:none;"></span>
      <div class="ctx-sep"></div>
      <button type="button" id="ctx-img-layer-up"    title="Bring forward">&#8679;</button>
      <button type="button" id="ctx-img-layer-down"  title="Send backward">&#8681;</button>
      <button type="button" id="ctx-img-layer-front" title="To front">&#10514;</button>
      <button type="button" id="ctx-img-layer-back"  title="To back">&#10515;</button>
      <div class="ctx-sep"></div>
      <button type="button" id="ctx-img-duplicate" title="Duplicate (Ctrl+D)">&#10697;</button>
      <button type="button" id="ctx-img-delete" title="Delete (Del)">&#x1F5D1;</button>
    </div>

    <!-- Left Tool Rail (floating white card) — Zazzle parity -->
    <div id="tool-rail" role="toolbar" aria-label="<?php esc_attr_e('Design tools', 'mug-customizer'); ?>">
      <div class="tool-item" id="tool-text" role="button" tabindex="0" aria-pressed="false" title="Add Text">
        <span class="tool-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
        </span>
        <span class="tool-label"><?php esc_html_e('Add Text', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-uploads" role="button" tabindex="0" aria-pressed="false" title="Upload Image">
        <span class="tool-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </span>
        <span class="tool-label"><?php esc_html_e('Uploads', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-images" role="button" tabindex="0" aria-pressed="false" title="Images">
        <span class="tool-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
        </span>
        <span class="tool-label"><?php esc_html_e('Images', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-background" role="button" tabindex="0" aria-pressed="false" title="Background">
        <span class="tool-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><path d="M4 16l4-4 3 3 5-5 4 4"></path><circle cx="9" cy="9" r="1.2"></circle></svg>
        </span>
        <span class="tool-label"><?php esc_html_e('Background', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-layers" role="button" tabindex="0" aria-pressed="false" title="Layers">
        <span class="tool-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"></polygon><polyline points="2 17 12 22 22 17"></polyline><polyline points="2 12 12 17 22 12"></polyline></svg>
        </span>
        <span class="tool-label"><?php esc_html_e('Layers', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-rail-more" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </div>
    </div>

    <!-- Layer Panel (floating, toggled by Layers tool) -->
    <div id="layer-panel" style="display:none;">
      <div class="panel-header">
        <h3><?php esc_html_e('Layers', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="layer-panel-close">✕</button>
      </div>
      <div id="lp-list"></div>
    </div>

    <!-- Drag-drop upload overlay -->
    <div id="drop-overlay">
      <div class="drop-overlay-inner">
        <div class="drop-icon">⬆</div>
        <div class="drop-text"><?php esc_html_e('Drop image to upload', 'mug-customizer'); ?></div>
        <div class="drop-hint"><?php esc_html_e('JPG or PNG, up to', 'mug-customizer'); ?> <?php echo esc_html(defined('MUG_CUSTOMIZER_MAX_UPLOAD_MB') ? MUG_CUSTOMIZER_MAX_UPLOAD_MB : 10); ?>MB</div>
      </div>
    </div>

    <!-- Add Text Panel (floating, shows when text tool active) — Zazzle parity -->
    <div id="text-panel" class="floating-panel" style="display:none;" role="dialog" aria-labelledby="text-panel-title">
      <div class="panel-header">
        <h3 id="text-panel-title"><?php esc_html_e('Add text to your design', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="text-panel-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
        </button>
      </div>
      <p class="panel-sub"><?php esc_html_e('Click the button below to add text to your design', 'mug-customizer'); ?></p>
      <button type="button" class="btn-add-text" id="btn-add-text">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
        <span><?php esc_html_e('Add a text box', 'mug-customizer'); ?></span>
      </button>
    </div>

    <!-- Uploads Panel (floating, shows when uploads tool active) -->
    <div id="uploads-panel" class="floating-panel" style="display:none;" role="dialog" aria-labelledby="uploads-panel-title">
      <div class="panel-header">
        <h3 id="uploads-panel-title"><?php esc_html_e('Your uploads', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="uploads-panel-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
        </button>
      </div>
      <div id="uploads-dropzone" class="uploads-dropzone">
        <div class="uploads-dropzone-icon" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <div class="uploads-dropzone-text"><?php esc_html_e('Drag &amp; drop image here', 'mug-customizer'); ?></div>
        <div class="uploads-dropzone-sub"><?php esc_html_e('JPG or PNG, up to', 'mug-customizer'); ?> <?php echo esc_html(defined('MUG_CUSTOMIZER_MAX_UPLOAD_MB') ? MUG_CUSTOMIZER_MAX_UPLOAD_MB : 10); ?>MB</div>
      </div>
      <button type="button" class="btn-add-text" id="btn-uploads-pick">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        <span><?php esc_html_e('Upload from device', 'mug-customizer'); ?></span>
      </button>
      <div class="uploads-grid-label"><?php esc_html_e('Recent uploads', 'mug-customizer'); ?></div>
      <div id="uploads-grid" class="uploads-grid"></div>
    </div>

    <!-- Images Panel (floating, shows when images tool active) — clipart library -->
    <div id="images-panel" class="floating-panel" style="display:none;" role="dialog" aria-labelledby="images-panel-title">
      <div class="panel-header">
        <h3 id="images-panel-title"><?php esc_html_e('Add an image', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="images-panel-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
        </button>
      </div>
      <p class="panel-sub"><?php esc_html_e('Click an icon to add it to your design', 'mug-customizer'); ?></p>
      <div id="images-grid" class="images-grid">
        <button type="button" class="clipart-btn" data-clipart="heart"  title="Heart">♥</button>
        <button type="button" class="clipart-btn" data-clipart="star"   title="Star">★</button>
        <button type="button" class="clipart-btn" data-clipart="circle" title="Circle">●</button>
        <button type="button" class="clipart-btn" data-clipart="square" title="Square">■</button>
        <button type="button" class="clipart-btn" data-clipart="triangle" title="Triangle">▲</button>
        <button type="button" class="clipart-btn" data-clipart="diamond" title="Diamond">◆</button>
        <button type="button" class="clipart-btn" data-clipart="arrow"  title="Arrow">➜</button>
        <button type="button" class="clipart-btn" data-clipart="check"  title="Check">✓</button>
        <button type="button" class="clipart-btn" data-clipart="cross"  title="Cross">✕</button>
        <button type="button" class="clipart-btn" data-clipart="flower" title="Flower">❀</button>
        <button type="button" class="clipart-btn" data-clipart="sun"    title="Sun">☀</button>
        <button type="button" class="clipart-btn" data-clipart="cloud"  title="Cloud">☁</button>
      </div>
    </div>

    <!-- Background Panel (floating, shows when background tool active) — Zazzle parity -->
    <div id="background-panel" class="floating-panel" style="display:none;" role="dialog" aria-labelledby="background-panel-title">
      <div class="panel-header">
        <h3 id="background-panel-title"><?php esc_html_e('Background', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="background-panel-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"></line><line x1="6" y1="18" x2="18" y2="6"></line></svg>
        </button>
      </div>

      <!-- Search bar -->
      <div class="bg-search">
        <input type="text" id="bg-search-input" placeholder="<?php esc_attr_e('Search for backgrounds', 'mug-customizer'); ?>">
        <button type="button" id="bg-search-btn" class="bg-search-btn" aria-label="<?php esc_attr_e('Search', 'mug-customizer'); ?>">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/></svg>
        </button>
      </div>

      <!-- Background Image upload -->
      <section class="bg-section" data-section="upload">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Background Image', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="bg-upload-row">
            <div id="bg-uploaded-thumb" class="bg-uploaded-thumb" title="<?php esc_attr_e('Current background image', 'mug-customizer'); ?>">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.4" fill="currentColor"/><polyline points="21 15 16 10 5 21"/></svg>
            </div>
            <button type="button" id="bg-upload-btn" class="bg-upload-btn"><?php esc_html_e('Upload Image', 'mug-customizer'); ?></button>
            <input type="file" id="bg-upload-input" accept="image/jpeg,image/png" hidden>
          </div>
        </div>
      </section>

      <!-- Background color (active preview + Remove) -->
      <section class="bg-section" data-section="color">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Background color', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="bg-color-row">
            <div id="bg-color-preview" class="bg-color-preview is-transparent" title="<?php esc_attr_e('Active background', 'mug-customizer'); ?>"></div>
            <button type="button" id="bg-remove-btn" class="bg-remove-btn-outline"><?php esc_html_e('Remove', 'mug-customizer'); ?></button>
          </div>
          <div class="bg-custom-row">
            <button type="button" id="bg-eyedropper-btn" class="bg-eyedropper-btn" title="<?php esc_attr_e('Pick colour', 'mug-customizer'); ?>">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21l4-1 11-11-3-3L4 17l-1 4z"/><path d="M14 6l3 3"/></svg>
            </button>
            <div class="bg-hex-wrap">
              <span class="bg-hex-checker" aria-hidden="true"></span>
              <input type="text" id="bg-hex-input" class="bg-hex-input" value="#00FFFFFF" maxlength="9" spellcheck="false">
            </div>
          </div>
        </div>
      </section>

      <!-- Swatches -->
      <section class="bg-section" data-section="swatches">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Swatches', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="bg-swatch-grid">
            <button type="button" class="bg-swatch is-transparent is-active" data-color="transparent" title="Transparent"></button>
            <button type="button" class="bg-swatch" style="background:#ffffff" data-color="#ffffff" title="White"></button>
            <button type="button" class="bg-swatch" style="background:#9ca3af" data-color="#9ca3af" title="Grey"></button>
            <button type="button" class="bg-swatch" style="background:#000000" data-color="#000000" title="Black"></button>
            <button type="button" class="bg-swatch" style="background:#7dd3fc" data-color="#7dd3fc" title="Light blue"></button>
            <button type="button" class="bg-swatch" style="background:#0ea5e9" data-color="#0ea5e9" title="Blue"></button>
            <button type="button" class="bg-swatch" style="background:#7c3aed" data-color="#7c3aed" title="Purple"></button>
            <button type="button" class="bg-swatch" style="background:#fbcfe8" data-color="#fbcfe8" title="Pink"></button>
            <button type="button" class="bg-swatch" style="background:#ec4899" data-color="#ec4899" title="Magenta"></button>
            <button type="button" class="bg-swatch" style="background:#dc2626" data-color="#dc2626" title="Red"></button>
            <button type="button" class="bg-swatch" style="background:#f97316" data-color="#f97316" title="Orange"></button>
            <button type="button" class="bg-swatch" style="background:#92400e" data-color="#92400e" title="Brown"></button>
          </div>
          <button type="button" id="bg-expand-btn" class="bg-expand-btn">+ <?php esc_html_e('Expand', 'mug-customizer'); ?></button>
        </div>
      </section>

      <!-- Additional colors (collapsed by default) -->
      <section class="bg-section is-collapsed" data-section="additional">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Additional colors', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div class="bg-swatch-grid">
            <button type="button" class="bg-swatch" style="background:#fef3c7" data-color="#fef3c7" title="Cream"></button>
            <button type="button" class="bg-swatch" style="background:#facc15" data-color="#facc15" title="Yellow"></button>
            <button type="button" class="bg-swatch" style="background:#84cc16" data-color="#84cc16" title="Lime"></button>
            <button type="button" class="bg-swatch" style="background:#16a34a" data-color="#16a34a" title="Green"></button>
            <button type="button" class="bg-swatch" style="background:#0d9488" data-color="#0d9488" title="Teal"></button>
            <button type="button" class="bg-swatch" style="background:#1e3a8a" data-color="#1e3a8a" title="Navy"></button>
            <button type="button" class="bg-swatch" style="background:#4c1d95" data-color="#4c1d95" title="Indigo"></button>
            <button type="button" class="bg-swatch" style="background:#831843" data-color="#831843" title="Maroon"></button>
            <button type="button" class="bg-swatch" style="background:#451a03" data-color="#451a03" title="Dark brown"></button>
            <button type="button" class="bg-swatch" style="background:#1c1917" data-color="#1c1917" title="Charcoal"></button>
            <button type="button" class="bg-swatch" style="background:#d4d4d8" data-color="#d4d4d8" title="Light grey"></button>
            <button type="button" class="bg-swatch" style="background:#fafafa" data-color="#fafafa" title="Off-white"></button>
          </div>
        </div>
      </section>

      <!-- Print-Friendly / Web tabs -->
      <div class="bg-tab-group" role="tablist">
        <button type="button" class="bg-tab is-active" data-kind="print" role="tab" aria-selected="true"><?php esc_html_e('Print-Friendly', 'mug-customizer'); ?></button>
        <button type="button" class="bg-tab" data-kind="web" role="tab" aria-selected="false"><?php esc_html_e('Web', 'mug-customizer'); ?></button>
      </div>

      <!-- Backgrounds preset grid -->
      <section class="bg-section" data-section="presets">
        <header class="fx-section-header">
          <span class="fx-section-title"><?php esc_html_e('Backgrounds', 'mug-customizer'); ?></span>
          <span class="fx-section-chevron" aria-hidden="true">&#9662;</span>
        </header>
        <div class="fx-section-body">
          <div id="bg-preset-grid" class="bg-preset-grid"><!-- Populated by JS from _BG_PRESETS --></div>
        </div>
      </section>
    </div>

    <!-- Mug Canvas (centered) -->
    <div id="canvas-container">
      <canvas id="mug-canvas"></canvas>
    </div>

    <!-- Variant Panel (floating, top-right) — photorealistic mug + cylindrically-wrapped design (Zazzle parity) -->
    <div id="variant-panel">
      <div class="live-preview-section">
        <div id="preview-3d-wrap">
          <canvas id="preview-live-canvas" width="312" height="280"></canvas>
        </div>
        <div class="live-preview-label"><?php esc_html_e('Text &amp; Images', 'mug-customizer'); ?></div>
      </div>
    </div>

    <?php
    $wc_product = $product_id ? wc_get_product($product_id) : null;
    $styles  = ['classic' => 'Classic', 'travel' => 'Travel', 'espresso' => 'Espresso', 'two-tone' => 'Two-Tone'];
    $sizes   = ['11oz' => '11 oz', '15oz' => '15 oz'];
    $colors  = ['black' => 'Black', 'white' => 'White', 'red' => 'Red', 'blue' => 'Blue', 'green' => 'Green'];
    if ($wc_product && $wc_product->is_type('variable')) {
        $attrs = $wc_product->get_variation_attributes();
        foreach ($attrs as $attr_name => $attr_values) {
            $key = strtolower($attr_name);
            if (strpos($key, 'color') !== false && ! empty($attr_values)) {
                $colors = array_combine(array_map('strtolower', $attr_values), $attr_values);
            }
            if (strpos($key, 'size') !== false && ! empty($attr_values)) {
                $sizes = array_combine(array_map('strtolower', $attr_values), $attr_values);
            }
        }
    }
    $color_map = [
      'black' => '#222', 'white' => '#fff', 'red' => '#dc2626',
      'blue' => '#2563eb', 'green' => '#16a34a', 'navy' => '#1e3a5f',
      'pink' => '#ec4899', 'yellow' => '#fbbf24', 'purple' => '#7c3aed',
    ];
    ?>

    <!-- Options Panel — full canvas overlay, shown when "Options" tab active -->
    <div id="options-panel" style="display:none;">
      <div class="options-panel-inner">
        <h2 class="options-panel-heading"><?php esc_html_e('Product Options', 'mug-customizer'); ?></h2>
        <p class="options-panel-sub"><?php esc_html_e('Choose your mug style, size, and color.', 'mug-customizer'); ?></p>

        <div class="options-grid">
          <div class="options-field">
            <label for="variant-style" class="options-label"><?php esc_html_e('Style', 'mug-customizer'); ?></label>
            <select id="variant-style" class="options-select">
              <?php foreach ($styles as $val => $label) : ?>
                <option value="<?php echo esc_attr($val); ?>" <?php selected($style, $val); ?>><?php echo esc_html($label); ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="options-field">
            <label for="variant-size" class="options-label"><?php esc_html_e('Size', 'mug-customizer'); ?></label>
            <select id="variant-size" class="options-select">
              <?php foreach ($sizes as $val => $label) : ?>
                <option value="<?php echo esc_attr($val); ?>" <?php selected($size, $val); ?>><?php echo esc_html($label); ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="options-field">
            <span class="options-label"><?php esc_html_e('Color', 'mug-customizer'); ?></span>
            <div class="variant-color-swatches">
              <?php foreach ($colors as $val => $label) :
                $hex = $color_map[strtolower($val)] ?? '#888';
                $active = (strtolower($color) === strtolower($val)) ? ' active' : '';
              ?>
              <button type="button"
                class="color-swatch<?php echo $active; ?>"
                data-color="<?php echo esc_attr(strtolower($val)); ?>"
                title="<?php echo esc_attr($label); ?>"
                style="background:<?php echo esc_attr($hex); ?>;<?php echo $hex === '#fff' ? 'border-color:#ccc;' : ''; ?>">
              </button>
              <?php endforeach; ?>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden file input for uploads -->
    <input type="file" id="mug-upload-input" accept="image/jpeg,image/png" style="display:none;">

    <!-- Zoom Controls (centered bottom) — Zazzle parity -->
    <div id="zoom-controls" role="toolbar" aria-label="<?php esc_attr_e('Canvas controls', 'mug-customizer'); ?>">
      <button type="button" id="btn-zoom-out" class="zc-circle" aria-label="<?php esc_attr_e('Zoom out', 'mug-customizer'); ?>" title="<?php esc_attr_e('Zoom out', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button type="button" id="zoom-display" class="zc-pill" aria-haspopup="listbox" aria-expanded="false" title="<?php esc_attr_e('Zoom level', 'mug-customizer'); ?>">
        <span id="zoom-display-value">100%</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>
      <ul id="zoom-menu" role="listbox" aria-label="<?php esc_attr_e('Zoom level', 'mug-customizer'); ?>" hidden>
        <li role="option" data-zoom="50">50%</li>
        <li role="option" data-zoom="75">75%</li>
        <li role="option" data-zoom="100" aria-selected="true">100%</li>
        <li role="option" data-zoom="125">125%</li>
        <li role="option" data-zoom="150">150%</li>
        <li role="option" data-zoom="200">200%</li>
        <li role="option" data-zoom="fit"><?php esc_html_e('Fit', 'mug-customizer'); ?></li>
      </ul>
      <button type="button" id="btn-zoom-in" class="zc-circle" aria-label="<?php esc_attr_e('Zoom in', 'mug-customizer'); ?>" title="<?php esc_attr_e('Zoom in', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      </button>
      <button type="button" id="btn-zoom-settings" class="zc-circle" aria-label="<?php esc_attr_e('Settings', 'mug-customizer'); ?>" title="<?php esc_attr_e('Settings', 'mug-customizer'); ?>" aria-haspopup="true" aria-expanded="false">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
      <div id="settings-popover" class="settings-popover" hidden role="dialog" aria-label="<?php esc_attr_e('Designer settings', 'mug-customizer'); ?>">
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Enable dark mode', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Apply dark theme to reduce eye strain in low-light settings.', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-dark-mode"><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Lock aspect ratio', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Maintains the aspect ratio of all canvas objects', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-lock-aspect" checked><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Enable snapping', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Snaps objects to the grid for easier alignment', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-snapping" checked><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Show all guidelines', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Displays bleed, cut, and print lines of the design', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-guidelines" checked><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Show gridlines', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Overlays a grid pattern over the canvas', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-gridlines"><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Show bleed mask', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Renders the visible area of print', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-bleed-mask"><span class="fx-switch-track"></span></span>
        </label>
        <label class="set-row">
          <div class="set-text">
            <span class="set-title"><?php esc_html_e('Show transparency', 'mug-customizer'); ?></span>
            <span class="set-desc"><?php esc_html_e('Renders a checkboard grid on the canvas.', 'mug-customizer'); ?></span>
          </div>
          <span class="fx-switch"><input type="checkbox" id="set-transparency"><span class="fx-switch-track"></span></span>
        </label>
      </div>
      <button type="button" id="btn-zoom-help" class="zc-circle" aria-label="<?php esc_attr_e('Help', 'mug-customizer'); ?>" title="<?php esc_attr_e('Help', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </button>
    </div>

    <!-- Floating Help Widget (bottom-right) — Zazzle parity -->
    <button type="button" id="help-widget" title="<?php esc_attr_e('Need help?', 'mug-customizer'); ?>" aria-label="<?php esc_attr_e('Open help', 'mug-customizer'); ?>">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
      </svg>
      <span class="help-widget-spark">✨</span>
    </button>

    <!-- Help Popup (shown when widget clicked) -->
    <div id="help-popup" style="display:none;">
      <div class="help-popup-header">
        <h3><?php esc_html_e('Designer Help', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="help-popup-close">✕</button>
      </div>
      <div class="help-popup-body">
        <div class="help-section">
          <strong><?php esc_html_e('Keyboard Shortcuts', 'mug-customizer'); ?></strong>
          <ul>
            <li><kbd>Ctrl</kbd>+<kbd>Z</kbd> — <?php esc_html_e('Undo', 'mug-customizer'); ?></li>
            <li><kbd>Ctrl</kbd>+<kbd>Y</kbd> — <?php esc_html_e('Redo', 'mug-customizer'); ?></li>
            <li><kbd>Ctrl</kbd>+<kbd>D</kbd> — <?php esc_html_e('Duplicate selected', 'mug-customizer'); ?></li>
            <li><kbd>Del</kbd> — <?php esc_html_e('Delete selected', 'mug-customizer'); ?></li>
          </ul>
        </div>
        <div class="help-section">
          <strong><?php esc_html_e('Tips', 'mug-customizer'); ?></strong>
          <ul>
            <li><?php esc_html_e('Drag &amp; drop images directly onto the canvas', 'mug-customizer'); ?></li>
            <li><?php esc_html_e('Stay inside the green Safe area for best print quality', 'mug-customizer'); ?></li>
            <li><?php esc_html_e('Click Preview anytime to see your mug in 3D', 'mug-customizer'); ?></li>
          </ul>
        </div>
      </div>
    </div>

  </div><!-- /#canvas-stage -->

  <!-- ── Review Page (Zazzle parity) — shown when Review tab active ───────── -->
  <?php
  $review_wc        = $product_id ? wc_get_product($product_id) : null;
  $review_price     = $review_wc ? (float) $review_wc->get_price() : 15.05;
  $review_reg_price = $review_wc ? (float) $review_wc->get_regular_price() : 17.70;
  $on_sale          = $review_wc ? $review_wc->is_on_sale() : ($review_price < $review_reg_price);
  $promo_code       = get_option('mc_promo_code', 'MAYDEALS4YOU');
  $promo_pct        = (int) get_option('mc_promo_pct', 15);
  $review_pluginurl = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/';
  ?>
  <section id="review-page" hidden aria-labelledby="review-headline">
    <div class="review-grid">

      <!-- LEFT: thumbnail strip -->
      <aside class="review-thumb-strip" aria-label="<?php esc_attr_e('Mug angles', 'mug-customizer'); ?>">
        <div class="review-thumb active" data-angle-key="left" data-label="Left">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Left', 'mug-customizer'); ?></span>
        </div>
        <div class="review-thumb" data-angle-key="frontLeft" data-label="Front L">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Front L', 'mug-customizer'); ?></span>
        </div>
        <div class="review-thumb" data-angle-key="center" data-label="Center">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Center', 'mug-customizer'); ?></span>
        </div>
        <div class="review-thumb" data-angle-key="frontRight" data-label="Front R">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Front R', 'mug-customizer'); ?></span>
        </div>
        <div class="review-thumb" data-angle-key="right" data-label="Right">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Right', 'mug-customizer'); ?></span>
        </div>
        <div class="review-thumb" data-angle-key="handle" data-label="Handle">
          <canvas width="120" height="120"></canvas>
          <span><?php esc_html_e('Handle', 'mug-customizer'); ?></span>
        </div>
        <button type="button" class="review-thumb-scroll" aria-label="<?php esc_attr_e('Scroll thumbnails', 'mug-customizer'); ?>">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
        </button>
      </aside>

      <!-- CENTER: large preview -->
      <div class="review-preview-wrap">
        <canvas id="review-main-canvas" width="640" height="640"></canvas>
        <div id="review-main-label"><?php esc_html_e('Left', 'mug-customizer'); ?></div>
      </div>

      <!-- RIGHT: purchase rail -->
      <aside class="review-rail" data-unit-price="<?php echo esc_attr($review_price); ?>" data-reg-price="<?php echo esc_attr($review_reg_price); ?>">
        <div class="review-sellbuy" role="tablist" aria-label="<?php esc_attr_e('Sell or Buy', 'mug-customizer'); ?>">
          <button type="button" class="review-sb-btn" data-sb="sell" role="tab" aria-selected="false"><?php esc_html_e('Sell', 'mug-customizer'); ?></button>
          <button type="button" class="review-sb-btn is-active" data-sb="buy" role="tab" aria-selected="true"><?php esc_html_e('Buy', 'mug-customizer'); ?></button>
        </div>

        <h2 id="review-headline" class="review-headline"><?php esc_html_e('Let’s make sure it’s just right', 'mug-customizer'); ?></h2>
        <p class="review-subhead"><?php esc_html_e('Review your design before continuing.', 'mug-customizer'); ?></p>

        <hr class="review-hr">

        <div class="review-shipping">
          <span class="review-truck" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
          </span>
          <div class="review-ship-text">
            <div><?php esc_html_e('Order today and get it by', 'mug-customizer'); ?> <span class="ship-date-fast" id="ship-date-fast"></span> <?php esc_html_e('with', 'mug-customizer'); ?> <strong><?php esc_html_e('expedited shipping', 'mug-customizer'); ?></strong></div>
            <div class="muted"><?php esc_html_e('Get it by', 'mug-customizer'); ?> <span class="ship-date-std" id="ship-date-std"></span> <?php esc_html_e('with standard', 'mug-customizer'); ?></div>
          </div>
        </div>

        <div class="review-price-row">
          <span class="review-subtotal-label"><?php esc_html_e('Subtotal', 'mug-customizer'); ?></span>
          <div class="review-price-block">
            <span class="review-price" id="review-price">$<?php echo number_format($review_price, 2); ?></span>
            <?php if ($on_sale) : ?>
              <span class="review-comp">$<?php echo number_format($review_reg_price, 2); ?></span>
              <span class="review-comp-label"><?php esc_html_e('Comp. value', 'mug-customizer'); ?></span>
            <?php endif; ?>
          </div>
        </div>
        <div class="review-per-mug"><?php esc_html_e('per mug', 'mug-customizer'); ?></div>
        <?php if (!empty($promo_code)) : ?>
          <div class="review-promo"><?php
            /* translators: %1$d = percent, %2$s = code */
            printf(esc_html__('Save %1$d%% with code %2$s', 'mug-customizer'), (int) $promo_pct, '<strong>' . esc_html($promo_code) . '</strong>');
          ?></div>
        <?php endif; ?>

        <div class="review-qty-row">
          <label class="review-qty-label" for="review-qty"><?php esc_html_e('Qty', 'mug-customizer'); ?></label>
          <div class="review-qty-stepper">
            <button type="button" class="review-qty-btn" id="review-qty-minus" aria-label="<?php esc_attr_e('Decrease quantity', 'mug-customizer'); ?>">−</button>
            <input type="number" id="review-qty" class="review-qty-input" value="1" min="1" max="99">
            <button type="button" class="review-qty-btn" id="review-qty-plus" aria-label="<?php esc_attr_e('Increase quantity', 'mug-customizer'); ?>">+</button>
          </div>
        </div>

        <button type="button" id="review-add-to-cart" class="review-add-to-cart">
          <span><?php esc_html_e('Add to Cart', 'mug-customizer'); ?></span>
        </button>

        <div class="review-trust"><?php esc_html_e('100% Satisfaction Guaranteed', 'mug-customizer'); ?></div>
      </aside>

    </div>
  </section>

</div><!-- /#designer-wrap -->

<!-- ── "Just added to your cart!" mini-modal (Zazzle parity) ───────────── -->
<div id="just-added-backdrop" hidden></div>
<div id="just-added-modal" role="dialog" aria-modal="true" aria-labelledby="just-added-title" hidden>
  <button type="button" class="ja-close" id="just-added-close" aria-label="<?php esc_attr_e('Close', 'mug-customizer'); ?>">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="6" y1="18" x2="18" y2="6"/></svg>
  </button>
  <h2 id="just-added-title" class="ja-title"><?php esc_html_e('Just added to your cart!', 'mug-customizer'); ?></h2>

  <div class="ja-row">
    <div class="ja-thumb-wrap">
      <canvas id="just-added-thumb" width="200" height="200"></canvas>
    </div>
    <div class="ja-info">
      <div class="ja-name"><?php esc_html_e('Mug', 'mug-customizer'); ?></div>
      <div class="ja-price" id="just-added-price">$0.00</div>
      <div class="ja-qty"><?php esc_html_e('Qty', 'mug-customizer'); ?> <span id="just-added-qty">1</span></div>
    </div>
    <div class="ja-actions">
      <a href="<?php echo esc_url(function_exists('wc_get_cart_url') ? wc_get_cart_url() : '#'); ?>" id="just-added-view-cart" class="ja-cta-cart"><?php esc_html_e('View Cart + Check Out', 'mug-customizer'); ?></a>
      <button type="button" id="just-added-continue" class="ja-continue"><?php esc_html_e('Continue shopping', 'mug-customizer'); ?></button>
    </div>
  </div>
</div>

<!-- ── Full Preview Modal (Zazzle-style: thumb strip + large view) ─────── -->
<div id="preview-modal" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e('Mug Preview', 'mug-customizer'); ?>">
  <div id="preview-modal-dialog">

    <button type="button" id="preview-modal-close" title="<?php esc_attr_e('Close preview', 'mug-customizer'); ?>">✕</button>

    <div id="preview-modal-inner">

      <!-- Left thumbnail strip — 7 photographed angles (Zazzle parity) -->
      <?php $pu = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/'; ?>
      <div id="preview-modal-strip">
        <div class="preview-modal-thumb" data-angle-key="left" data-angle="-70" data-label="Left">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-left.jpg'); ?>" class="thumb-photo" alt="Left">
          <span><?php esc_html_e('Left', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle-key="frontLeft" data-angle="-35" data-label="Front L">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-front-left.jpg'); ?>" class="thumb-photo" alt="Front L">
          <span><?php esc_html_e('Front L', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb active" data-angle-key="center" data-angle="0" data-label="Center">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-center.jpg'); ?>" class="thumb-photo" alt="Center">
          <span><?php esc_html_e('Center', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle-key="frontRight" data-angle="35" data-label="Front R">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-front-right.jpg'); ?>" class="thumb-photo" alt="Front R">
          <span><?php esc_html_e('Front R', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle-key="right" data-angle="70" data-label="Right">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-right.jpg'); ?>" class="thumb-photo" alt="Right">
          <span><?php esc_html_e('Right', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle-key="handle" data-angle="130" data-label="Handle">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-handle.jpg'); ?>" class="thumb-photo" alt="Handle">
          <span><?php esc_html_e('Handle', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle-key="donut" data-angle="-999" data-label="Top View" data-is-donut="true">
          <canvas width="80" height="80"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-donut.jpg'); ?>" class="thumb-photo" alt="Top View">
          <span><?php esc_html_e('Top View', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-strip-scroll">▼</div>
      </div>

      <!-- Right large preview area — canvas-2D for ALL angles using real photos -->
      <div id="preview-modal-main">
        <!-- Three.js view kept for backwards-compat but hidden — real-photo
             pipeline below replaces it. -->
        <div id="preview-modal-threejs" style="display:none;"></div>
        <canvas id="preview-modal-canvas" width="640" height="640"></canvas>
        <div id="preview-modal-label"><?php esc_html_e('Center', 'mug-customizer'); ?></div>
      </div>

    </div>
  </div>
</div>

<!-- Three.js — loaded before plugin JS so it is available at DOMContentLoaded -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>

<!-- Hidden data for JS -->
<script>
window.mugDesignerConfig = {
  productId:    <?php echo (int) $product_id; ?>,
  variationId:  <?php echo (int) $variation_id; ?>,
  style:        <?php echo wp_json_encode($style); ?>,
  size:         <?php echo wp_json_encode($size); ?>,
  color:        <?php echo wp_json_encode($color); ?>,
  reviewUrl:    <?php echo wp_json_encode($review_url); ?>,
  cartUrl:      <?php echo wp_json_encode(function_exists('wc_get_cart_url') ? wc_get_cart_url() : '/cart/'); ?>,
  addToCartUrl: <?php echo wp_json_encode(function_exists('WC') ? WC_AJAX::get_endpoint('add_to_cart') : '/?wc-ajax=add_to_cart'); ?>,
};
</script>

<?php wp_footer(); ?>
</body>
</html>
