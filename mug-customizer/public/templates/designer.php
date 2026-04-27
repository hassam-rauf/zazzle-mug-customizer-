<!DOCTYPE html>
<html <?php language_attributes(); ?>>
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

  <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
  <div id="designer-topbar">
    <a href="<?php echo esc_url($pdp_url); ?>" class="topbar-exit">✕ <?php esc_html_e('Save and Exit', 'mug-customizer'); ?></a>
    <span class="topbar-product"><?php esc_html_e('Mug', 'mug-customizer'); ?></span>
    <span class="topbar-saved" id="save-status">● <?php esc_html_e('Saved', 'mug-customizer'); ?></span>

    <div class="topbar-tabs">
      <span class="tab active"><?php esc_html_e('Design', 'mug-customizer'); ?></span>
      <a href="<?php echo esc_url($review_url); ?>" class="tab" id="review-tab-link"><?php esc_html_e('Review', 'mug-customizer'); ?></a>
    </div>

    <div class="topbar-undo-group">
      <button type="button" id="btn-undo" title="Undo" disabled>↶</button>
      <button type="button" id="btn-redo" title="Redo" disabled>↷</button>
    </div>

    <span class="topbar-preview" id="btn-preview">👁 <?php esc_html_e('Preview', 'mug-customizer'); ?></span>
    <a href="<?php echo esc_url($review_url); ?>" class="topbar-next-btn" id="btn-next-review">
      <?php esc_html_e('Next: Review →', 'mug-customizer'); ?>
    </a>
  </div>

  <!-- ── Canvas Stage (full area, all panels float inside) ──────────────── -->
  <div id="canvas-stage">

    <!-- Text Context Bar (shows when text object selected) -->
    <div id="context-bar" style="display:none;">
      <span class="ctx-label"><?php esc_html_e('Font', 'mug-customizer'); ?></span>
      <select id="ctx-font" title="Font family">
        <option value="Georgia">Georgia</option>
        <option value="Roboto">Roboto</option>
        <option value="Montserrat">Montserrat</option>
        <option value="Oswald">Oswald</option>
        <option value="Dancing Script">Dancing Script</option>
        <option value="Arial">Arial</option>
        <option value="Times New Roman">Times New Roman</option>
      </select>
      <input type="number" id="ctx-size" value="24" min="8" max="200" title="Font size" style="width:52px;">
      <input type="color" id="ctx-color" value="#222222" title="Text color">
      <button type="button" id="ctx-bold"      title="Bold"><strong>B</strong></button>
      <button type="button" id="ctx-italic"    title="Italic"><em>I</em></button>
      <button type="button" id="ctx-underline" title="Underline"><u>U</u></button>
      <div class="ctx-sep"></div>
      <button type="button" id="ctx-align-left"   title="Align left">&#8676;</button>
      <button type="button" id="ctx-align-center" title="Align center">&#8801;</button>
      <button type="button" id="ctx-align-right"  title="Align right">&#8677;</button>
      <div class="ctx-sep"></div>
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
      <span class="ctx-label">&#x2605;</span>
      <button type="button" id="ctx-layer-up"   title="Bring forward">&#8679;</button>
      <button type="button" id="ctx-layer-down" title="Send backward">&#8681;</button>
      <button type="button" id="ctx-layer-front" title="To front">&#10514;</button>
      <button type="button" id="ctx-layer-back"  title="To back">&#10515;</button>
      <div class="ctx-sep"></div>
      <button type="button" id="ctx-duplicate" title="Duplicate (Ctrl+D)">&#10697;</button>
      <button type="button" id="ctx-delete" title="Delete (Del)">&#x1F5D1;</button>
    </div>

    <!-- Image Context Bar (shows when image object selected) -->
    <div id="img-context-bar" style="display:none;">
      <span class="ctx-label"><?php esc_html_e('Image', 'mug-customizer'); ?></span>
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

    <!-- Left Tool Rail (floating white card) -->
    <div id="tool-rail">
      <div class="tool-item active" id="tool-text" title="Add Text">
        <span class="tool-icon">T</span>
        <span class="tool-label"><?php esc_html_e('Add Text', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-uploads" title="Upload Image">
        <span class="tool-icon">☁</span>
        <span class="tool-label"><?php esc_html_e('Uploads', 'mug-customizer'); ?></span>
      </div>
      <div class="tool-item" id="tool-images" title="Images">
        <span class="tool-icon">🖼</span>
      </div>
      <div class="tool-rail-more">▼</div>
    </div>

    <!-- Add Text Panel (floating, shows when text tool active) -->
    <div id="text-panel" class="floating-panel">
      <div class="panel-header">
        <h3><?php esc_html_e('Add text to your design', 'mug-customizer'); ?></h3>
        <button type="button" class="panel-close" id="text-panel-close">✕</button>
      </div>
      <p><?php esc_html_e('Click the button below to add text to your design', 'mug-customizer'); ?></p>
      <button type="button" class="btn-add-text" id="btn-add-text">
        <span>T</span> <?php esc_html_e('Add a text box', 'mug-customizer'); ?>
      </button>
    </div>

    <!-- Mug Canvas (centered) -->
    <div id="canvas-container">
      <canvas id="mug-canvas"></canvas>
    </div>

    <!-- Variant Panel (floating, top-right) — C2 fix -->
    <div id="variant-panel">
      <div class="variant-panel-title"><?php esc_html_e('Product Options', 'mug-customizer'); ?></div>

      <?php
      $wc_product = $product_id ? wc_get_product($product_id) : null;
      $styles  = ['classic' => 'Classic', 'travel' => 'Travel', 'espresso' => 'Espresso', 'two-tone' => 'Two-Tone'];
      $sizes   = ['11oz' => '11 oz', '15oz' => '15 oz'];
      $colors  = ['black' => 'Black', 'white' => 'White', 'red' => 'Red', 'blue' => 'Blue', 'green' => 'Green'];
      // Pull available colors from WC variations if product exists
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
      ?>

      <label class="variant-label"><?php esc_html_e('Style', 'mug-customizer'); ?>
        <select id="variant-style" class="variant-select">
          <?php foreach ($styles as $val => $label) : ?>
            <option value="<?php echo esc_attr($val); ?>" <?php selected($style, $val); ?>><?php echo esc_html($label); ?></option>
          <?php endforeach; ?>
        </select>
      </label>

      <label class="variant-label"><?php esc_html_e('Size', 'mug-customizer'); ?>
        <select id="variant-size" class="variant-select">
          <?php foreach ($sizes as $val => $label) : ?>
            <option value="<?php echo esc_attr($val); ?>" <?php selected($size, $val); ?>><?php echo esc_html($label); ?></option>
          <?php endforeach; ?>
        </select>
      </label>

      <div class="variant-label"><?php esc_html_e('Color', 'mug-customizer'); ?>
        <div class="variant-color-swatches">
          <?php
          $color_map = [
            'black' => '#222', 'white' => '#fff', 'red' => '#dc2626',
            'blue' => '#2563eb', 'green' => '#16a34a', 'navy' => '#1e3a5f',
            'pink' => '#ec4899', 'yellow' => '#fbbf24', 'purple' => '#7c3aed',
          ];
          foreach ($colors as $val => $label) :
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

      <div class="mini-preview-wrap">
        <img id="mini-preview-img" src="" alt="<?php esc_attr_e('Mug preview', 'mug-customizer'); ?>">
        <div class="mini-label"><?php esc_html_e('Your design', 'mug-customizer'); ?></div>
      </div>
    </div>

    <!-- Hidden file input for uploads -->
    <input type="file" id="mug-upload-input" accept="image/jpeg,image/png" style="display:none;">

    <!-- Zoom Controls (centered bottom) -->
    <div id="zoom-controls">
      <button type="button" id="btn-zoom-out">−</button>
      <div id="zoom-display">100% ▼</div>
      <button type="button" id="btn-zoom-in">+</button>
      <button type="button" id="btn-zoom-settings" title="Settings">⚙</button>
      <button type="button" id="btn-zoom-help" title="Help">?</button>
      <button type="button" id="btn-zoom-fit" title="Fit to screen">⤴</button>
    </div>

  </div><!-- /#canvas-stage -->

</div><!-- /#designer-wrap -->

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
