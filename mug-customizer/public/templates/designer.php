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
      <a href="<?php echo esc_url($review_url); ?>" class="tab" data-tab="review" id="review-tab-link"><?php esc_html_e('Review', 'mug-customizer'); ?></a>
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

    <!-- Text Context Bar (shows when text object selected) — Zazzle style -->
    <div id="context-bar" style="display:none;">
      <!-- Primary row: Edit text | Font | Size — val + | Color | B I U | Align | Delete | More -->
      <button type="button" id="ctx-edit-text" class="ctx-edit-text-btn" title="<?php esc_attr_e('Enter edit mode', 'mug-customizer'); ?>"><?php esc_html_e('Edit text', 'mug-customizer'); ?></button>
      <div class="ctx-sep"></div>

      <span class="ctx-label"><?php esc_html_e('Font:', 'mug-customizer'); ?></span>
      <select id="ctx-font" title="Font family">
        <option value="Georgia">Georgia</option>
        <option value="Roboto">Roboto</option>
        <option value="Montserrat">Montserrat</option>
        <option value="Oswald">Oswald</option>
        <option value="Dancing Script">Dancing Script</option>
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
      </select>
      <div class="ctx-sep"></div>

      <span class="ctx-label"><?php esc_html_e('Font size', 'mug-customizer'); ?></span>
      <div class="ctx-size-group">
        <button type="button" id="ctx-size-minus" title="Decrease size">−</button>
        <span id="ctx-size-val">24</span>
        <button type="button" id="ctx-size-plus"  title="Increase size">+</button>
      </div>
      <div class="ctx-sep"></div>

      <input type="color" id="ctx-color" value="#222222" title="<?php esc_attr_e('Text color', 'mug-customizer'); ?>">
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-bold"      title="<?php esc_attr_e('Bold', 'mug-customizer'); ?>"><strong>B</strong></button>
      <button type="button" id="ctx-italic"    title="<?php esc_attr_e('Italic', 'mug-customizer'); ?>"><em>I</em></button>
      <button type="button" id="ctx-underline" title="<?php esc_attr_e('Underline', 'mug-customizer'); ?>"><u>U</u></button>
      <div class="ctx-sep"></div>

      <span class="ctx-label"><?php esc_html_e('Alignment', 'mug-customizer'); ?></span>
      <select id="ctx-align-select" title="<?php esc_attr_e('Text alignment', 'mug-customizer'); ?>" class="ctx-align-select">
        <option value="left">&#8676; <?php esc_html_e('Left', 'mug-customizer'); ?></option>
        <option value="center">&#8801; <?php esc_html_e('Center', 'mug-customizer'); ?></option>
        <option value="right">&#8677; <?php esc_html_e('Right', 'mug-customizer'); ?></option>
      </select>
      <div class="ctx-sep"></div>

      <button type="button" id="ctx-delete" title="<?php esc_attr_e('Delete', 'mug-customizer'); ?>" class="ctx-delete-btn">&#x1F5D1;</button>

      <!-- Overflow: advanced options hidden behind toggle -->
      <button type="button" id="ctx-more-toggle" class="ctx-more-btn" title="<?php esc_attr_e('More options', 'mug-customizer'); ?>">&#9656;</button>
      <div id="ctx-more-panel" style="display:none;" class="ctx-more-panel">
        <label class="ctx-slider-label" title="Rotation angle">
          <span>&#8635;</span>
          <input type="number" id="ctx-angle" value="0" min="-360" max="360" step="1" style="width:46px;" title="Rotation (°)">
          <span>°</span>
        </label>
        <div class="ctx-sep"></div>
        <label class="ctx-slider-label" title="Letter spacing">
          <span>AV</span>
          <input type="range" id="ctx-spacing" min="-200" max="800" value="0" step="10" style="width:60px;">
        </label>
        <label class="ctx-slider-label" title="Line height">
          <span>&#8645;</span>
          <input type="range" id="ctx-lineheight" min="50" max="300" value="120" step="5" style="width:60px;">
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

      <!-- Hidden align buttons kept for JS compat, not displayed -->
      <button type="button" id="ctx-align-left"   style="display:none;"></button>
      <button type="button" id="ctx-align-center" style="display:none;"></button>
      <button type="button" id="ctx-align-right"  style="display:none;"></button>
      <!-- Hidden number input kept so existing showContextBar JS still works -->
      <input type="number" id="ctx-size" value="24" min="8" max="200" style="display:none;">
    </div>

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

    <!-- Mug Canvas (centered) -->
    <div id="canvas-container">
      <canvas id="mug-canvas"></canvas>
    </div>

    <!-- Variant Panel (floating, top-right) — live preview only (Zazzle parity) -->
    <div id="variant-panel">
      <div class="live-preview-section">
        <div id="preview-3d-wrap">
          <img id="preview-mug-bg" src="" alt="" draggable="false">
          <div id="preview-mug-tint"></div>
          <div id="preview-design-layer">
            <img id="preview-design-img" src="" alt="" draggable="false">
            <div id="preview-shading"></div>
          </div>
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
      <button type="button" id="btn-zoom-settings" class="zc-circle" aria-label="<?php esc_attr_e('Settings', 'mug-customizer'); ?>" title="<?php esc_attr_e('Settings', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
      </button>
      <button type="button" id="btn-zoom-help" class="zc-circle" aria-label="<?php esc_attr_e('Help', 'mug-customizer'); ?>" title="<?php esc_attr_e('Help', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
      </button>
      <button type="button" id="btn-zoom-fit" class="zc-circle" aria-label="<?php esc_attr_e('Share', 'mug-customizer'); ?>" title="<?php esc_attr_e('Share / Fit to screen', 'mug-customizer'); ?>">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
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

</div><!-- /#designer-wrap -->

<!-- ── Full Preview Modal (Zazzle-style: thumb strip + large view) ─────── -->
<div id="preview-modal" role="dialog" aria-modal="true" aria-label="<?php esc_attr_e('Mug Preview', 'mug-customizer'); ?>">
  <div id="preview-modal-dialog">

    <button type="button" id="preview-modal-close" title="<?php esc_attr_e('Close preview', 'mug-customizer'); ?>">✕</button>

    <div id="preview-modal-inner">

      <!-- Left thumbnail strip (7 views) -->
      <?php $pu = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/'; ?>
      <div id="preview-modal-strip">
        <div class="preview-modal-thumb active" data-angle="-70" data-label="Left">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-left.jpg'); ?>" class="thumb-photo" alt="Left">
          <span><?php esc_html_e('Left', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="-35" data-label="Front L">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-front-left.jpg'); ?>" class="thumb-photo" alt="Front L">
          <span><?php esc_html_e('Front L', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="0" data-label="Center">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-front-left.jpg'); ?>" class="thumb-photo" alt="Center">
          <span><?php esc_html_e('Center', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="35" data-label="Front R">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-front-right.jpg'); ?>" class="thumb-photo" alt="Front R">
          <span><?php esc_html_e('Front R', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="70" data-label="Right">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-right.jpg'); ?>" class="thumb-photo" alt="Right">
          <span><?php esc_html_e('Right', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="130" data-label="Handle">
          <canvas width="72" height="60"></canvas>
          <img src="<?php echo esc_url($pu . 'mug-handle.jpg'); ?>" class="thumb-photo" alt="Handle">
          <span><?php esc_html_e('Handle', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-thumb" data-angle="-999" data-label="Donut" data-is-donut="true">
          <canvas width="72" height="60"></canvas>
          <span><?php esc_html_e('Donut', 'mug-customizer'); ?></span>
        </div>
        <div class="preview-modal-strip-scroll">▼</div>
      </div>

      <!-- Right large preview area -->
      <div id="preview-modal-main">
        <!-- Three.js WebGL view (all non-donut angles) -->
        <div id="preview-modal-threejs"></div>
        <!-- Fallback canvas 2D: donut view only -->
        <canvas id="preview-modal-canvas" width="500" height="440" style="display:none;"></canvas>
        <div id="preview-modal-label"><?php esc_html_e('Left', 'mug-customizer'); ?></div>
      </div>

    </div>
  </div>
</div>

<!-- Three.js — loaded before plugin JS so it is available at DOMContentLoaded -->
<script src="https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js"></script>

<!-- Hidden data for JS -->
<script>
window.mugDesignerConfig = {
  productId:   <?php echo (int) $product_id; ?>,
  variationId: <?php echo (int) $variation_id; ?>,
  style:       <?php echo wp_json_encode($style); ?>,
  size:        <?php echo wp_json_encode($size); ?>,
  color:       <?php echo wp_json_encode($color); ?>,
  reviewUrl:   <?php echo wp_json_encode($review_url); ?>,
};
</script>

<?php wp_footer(); ?>
</body>
</html>
