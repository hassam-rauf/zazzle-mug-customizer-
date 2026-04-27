<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php esc_html_e('Review Your Mug', 'mug-customizer'); ?> — <?php bloginfo('name'); ?></title>
<?php wp_head(); ?>
</head>
<body class="mug-review-body">

<?php
$product_id   = (int) ($_GET['product_id']   ?? 0);
$variation_id = (int) ($_GET['variation_id'] ?? 0);
$product      = $product_id ? wc_get_product($product_id) : null;
$pdp_url      = $product ? get_permalink($product_id) : home_url('/');
$designer_url = home_url('/mug-designer/?product_id=' . $product_id . '&variation_id=' . $variation_id);
$base_price   = $product ? wc_get_price_to_display($product) : 0;
?>

<div id="review-wrap">

  <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
  <div id="designer-topbar">
    <a href="<?php echo esc_url($pdp_url); ?>" class="topbar-exit">✕ <?php esc_html_e('Save and Exit', 'mug-customizer'); ?></a>
    <span class="topbar-product"><?php esc_html_e('Mug', 'mug-customizer'); ?></span>
    <span class="topbar-saved">● <?php esc_html_e('Saved', 'mug-customizer'); ?></span>

    <div class="topbar-tabs">
      <a href="<?php echo esc_url($designer_url); ?>" class="tab"><?php esc_html_e('Design', 'mug-customizer'); ?></a>
      <span class="tab active"><?php esc_html_e('Review', 'mug-customizer'); ?></span>
    </div>
  </div>

  <!-- ── Review Grid: thumbs | main | options ────────────────────────────── -->
  <div id="review-grid">

    <!-- Left: Vertical Thumbnail Strip -->
    <div id="review-thumbs">
      <div class="review-thumb active" data-angle="front">
        <img id="thumb-front" src="" alt="Front">
        <span class="thumb-label">Left</span>
      </div>
      <div class="review-thumb" data-angle="back">
        <img id="thumb-back" src="" alt="Back">
        <span class="thumb-label">Right</span>
      </div>
      <div class="review-thumb" data-angle="side">
        <img id="thumb-side" src="" alt="Side">
        <span class="thumb-label">Handle</span>
      </div>
      <div class="review-thumb" data-angle="lifestyle">
        <img id="thumb-lifestyle" src="" alt="Lifestyle">
        <span class="thumb-label">Style</span>
      </div>
      <div class="review-thumb" data-angle="front">
        <img id="thumb-top" src="" alt="Top">
        <span class="thumb-label">Top</span>
      </div>
      <div class="review-thumb" data-angle="back">
        <img id="thumb-full" src="" alt="Full">
        <span class="thumb-label">Full</span>
      </div>
      <div class="review-thumbs-scroll">↓</div>
    </div>

    <!-- Center: Main Mug Image -->
    <div id="review-main">
      <img id="review-main-img" src="" alt="<?php esc_attr_e('Your custom mug', 'mug-customizer'); ?>">
    </div>

    <!-- Right: Options + Price + Cart -->
    <div id="review-options">
      <div class="review-options-header">
        <span>🏷</span>
        <strong><?php esc_html_e('Your selected options:', 'mug-customizer'); ?></strong>
      </div>

      <ul id="review-options-list">
        <li id="review-opt-style">• <?php esc_html_e('Style: —', 'mug-customizer'); ?></li>
        <li id="review-opt-size">• <?php esc_html_e('Size: —', 'mug-customizer'); ?></li>
        <li id="review-opt-color">• <?php esc_html_e('Color: —', 'mug-customizer'); ?></li>
        <li id="review-opt-addons">• <?php esc_html_e('Turn Your Mug into a Sweet Gift: None', 'mug-customizer'); ?></li>
      </ul>

      <div class="review-signin-prompt">
        <?php esc_html_e('Save your work!', 'mug-customizer'); ?>
        <a href="<?php echo esc_url(wp_login_url()); ?>"><?php esc_html_e('Click to sign in', 'mug-customizer'); ?></a>
      </div>

      <div class="review-shipping">
        <span>🚚</span>
        <div>
          <div><?php esc_html_e('Order today and get it by', 'mug-customizer'); ?> <strong><?php echo esc_html(date('M j', strtotime('+5 days'))); ?></strong>.</div>
          <div style="color:var(--muted);margin-top:4px;font-size:12px;"><?php echo esc_html(sprintf(__('Get it by %s with standard', 'mug-customizer'), date('M j', strtotime('+10 days')))); ?></div>
        </div>
      </div>

      <div class="review-price-row">
        <span class="review-price-left"><?php esc_html_e('Subtotal:', 'mug-customizer'); ?></span>
        <div class="review-price-right">
          <span id="review-price" class="review-price-amount">—</span>
          <div class="review-price-note"><?php esc_html_e('per mug', 'mug-customizer'); ?></div>
        </div>
      </div>

      <div class="review-cart-row">
        <select id="qty-select" class="qty-select">
          <?php for ($i = 1; $i <= 10; $i++) : ?>
            <option value="<?php echo $i; ?>">Qty: <?php echo $i; ?></option>
          <?php endfor; ?>
          <option value="24">Qty: 24</option>
          <option value="48">Qty: 48</option>
          <option value="100">Qty: 100</option>
        </select>
        <button type="button" id="btn-add-to-cart" class="btn-add-to-cart">
          <?php esc_html_e('Add to Cart', 'mug-customizer'); ?>
        </button>
      </div>

      <div id="cart-error" class="cart-error" style="display:none;"></div>

      <div class="review-guarantee">
        <?php esc_html_e('100% Satisfaction Guaranteed', 'mug-customizer'); ?>
      </div>
    </div>

  </div><!-- /#review-grid -->
</div><!-- /#review-wrap -->

<!-- Mobile notice -->
<div id="mobile-notice" style="display:none;">
  <p><?php esc_html_e('For the best design experience, please use a desktop browser.', 'mug-customizer'); ?></p>
</div>

<script>
window.mugReviewConfig = {
  productId:   <?php echo (int) $product_id; ?>,
  variationId: <?php echo (int) $variation_id; ?>,
  basePrice:   <?php echo (float) $base_price; ?>,
  designerUrl: <?php echo wp_json_encode($designer_url); ?>,
};
</script>

<?php wp_footer(); ?>
</body>
</html>
