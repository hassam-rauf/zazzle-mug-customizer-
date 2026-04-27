<?php
defined('ABSPATH') || exit;

$mugs_url     = get_term_link('mugs', 'product_cat');
$mugs_url     = is_wp_error($mugs_url) ? get_permalink(wc_get_page_id('shop')) : $mugs_url;

// Get featured/recent mug products
$products = wc_get_products([
    'limit'    => 4,
    'status'   => 'publish',
    'orderby'  => 'date',
    'order'    => 'DESC',
]);
?>

<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.wp-block-post-title, .entry-title, h1.page-title').forEach(function(el) {
    el.style.display = 'none';
  });
});
</script>
<div class="mug-landing-page">

  <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
  <div class="mug-topbar">
    <div class="mug-logo"><?php bloginfo('name'); ?></div>
    <form class="mug-search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
      <input type="text" name="s" placeholder="<?php esc_attr_e('Search mugs, designs, themes…', 'mug-customizer'); ?>" value="<?php echo esc_attr(get_search_query()); ?>">
      <input type="hidden" name="post_type" value="product">
      <button type="submit"><?php esc_html_e('Search', 'mug-customizer'); ?></button>
    </form>
    <div class="mug-top-actions">
      <?php if (is_user_logged_in()): ?>
        <a href="<?php echo esc_url(wc_get_account_endpoint_url('dashboard')); ?>"><?php esc_html_e('My Account', 'mug-customizer'); ?></a>
      <?php else: ?>
        <a href="<?php echo esc_url(wc_get_page_permalink('myaccount')); ?>"><?php esc_html_e('Sign in', 'mug-customizer'); ?></a>
      <?php endif; ?>
      <a href="<?php echo esc_url(wc_get_cart_url()); ?>">
        <?php esc_html_e('Cart', 'mug-customizer'); ?>
        (<?php echo WC()->cart ? WC()->cart->get_cart_contents_count() : 0; ?>)
      </a>
    </div>
  </div>

  <!-- ── Nav Categories ──────────────────────────────────────────────────── -->
  <nav class="mug-nav-cats">
    <a href="<?php echo esc_url(home_url('/')); ?>" class="active"><?php esc_html_e('Home', 'mug-customizer'); ?></a>
    <a href="<?php echo esc_url(get_permalink(wc_get_page_id('shop'))); ?>"><?php esc_html_e('All Mugs', 'mug-customizer'); ?></a>
    <a href="<?php echo esc_url($mugs_url); ?>"><?php esc_html_e('Custom Designs', 'mug-customizer'); ?></a>
    <a href="#"><?php esc_html_e('Collections', 'mug-customizer'); ?></a>
    <a href="#"><?php esc_html_e('Occasions', 'mug-customizer'); ?></a>
  </nav>

  <!-- ── Hero ────────────────────────────────────────────────────────────── -->
  <div class="mug-hero">
    <h1><?php esc_html_e("Design a Mug That's Truly Yours", 'mug-customizer'); ?></h1>
    <p><?php esc_html_e('Upload photos, add text, pick a style — we print, we ship.', 'mug-customizer'); ?></p>
    <a href="<?php echo esc_url($mugs_url); ?>" class="mug-hero-btn">
      <?php esc_html_e('Start Designing →', 'mug-customizer'); ?>
    </a>
  </div>

  <!-- ── Shop by Category ────────────────────────────────────────────────── -->
  <h2 class="mug-section-title"><?php esc_html_e('Shop by Category', 'mug-customizer'); ?></h2>
  <div class="mug-cat-grid">
    <a href="<?php echo esc_url($mugs_url); ?>" class="mug-cat-tile highlight">
      <div class="mug-cat-icon">☕</div>
      <h4><?php esc_html_e('Mugs', 'mug-customizer'); ?></h4>
    </a>
    <div class="mug-cat-tile">
      <div class="mug-cat-icon">👕</div>
      <h4><?php esc_html_e('Apparel', 'mug-customizer'); ?></h4>
    </div>
    <div class="mug-cat-tile">
      <div class="mug-cat-icon">📱</div>
      <h4><?php esc_html_e('Phone Cases', 'mug-customizer'); ?></h4>
    </div>
    <div class="mug-cat-tile">
      <div class="mug-cat-icon">💌</div>
      <h4><?php esc_html_e('Invitations', 'mug-customizer'); ?></h4>
    </div>
    <div class="mug-cat-tile">
      <div class="mug-cat-icon">🎁</div>
      <h4><?php esc_html_e('Gifts', 'mug-customizer'); ?></h4>
    </div>
    <div class="mug-cat-tile">
      <div class="mug-cat-icon">🖼️</div>
      <h4><?php esc_html_e('Wall Art', 'mug-customizer'); ?></h4>
    </div>
  </div>

  <!-- ── Popular Mug Designs ─────────────────────────────────────────────── -->
  <h2 class="mug-section-title"><?php esc_html_e('Popular Mug Designs', 'mug-customizer'); ?></h2>
  <div class="mug-prod-grid">
    <?php foreach ($products as $product): ?>
      <a href="<?php echo esc_url($product->get_permalink()); ?>" class="mug-prod-card">
        <div class="mug-prod-img">
          <?php if ($product->get_image_id()): ?>
            <img src="<?php echo esc_url(wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail')); ?>"
                 alt="<?php echo esc_attr($product->get_name()); ?>">
          <?php else: ?>
            <img src="<?php echo esc_url(MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png'); ?>"
                 alt="<?php echo esc_attr($product->get_name()); ?>">
          <?php endif; ?>
        </div>
        <div class="mug-prod-info">
          <h5><?php echo esc_html($product->get_name()); ?></h5>
          <div class="mug-prod-price"><?php echo wp_kses_post($product->get_price_html()); ?></div>
        </div>
      </a>
    <?php endforeach; ?>

    <?php if (empty($products)): ?>
      <!-- Fallback card -->
      <a href="<?php echo esc_url($mugs_url); ?>" class="mug-prod-card" style="border:2px solid var(--accent);">
        <div class="mug-prod-img" style="background:#fff4e6; display:flex; align-items:center; justify-content:center;">
          <div style="text-align:center; color:var(--accent);">
            <div style="font-size:40px;">＋</div>
            <div style="font-size:12px; text-transform:uppercase; letter-spacing:1px;"><?php esc_html_e('Start Blank', 'mug-customizer'); ?></div>
          </div>
        </div>
        <div class="mug-prod-info">
          <h5 style="color:var(--accent);"><?php esc_html_e('Create Your Own', 'mug-customizer'); ?></h5>
          <div class="mug-prod-price"><?php esc_html_e('From $14.95', 'mug-customizer'); ?></div>
        </div>
      </a>
    <?php endif; ?>
  </div>

</div><!-- /.mug-landing-page -->
