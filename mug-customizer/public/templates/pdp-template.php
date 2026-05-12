<?php
defined('ABSPATH') || exit;

// ── Product data ─────────────────────────────────────────────────────────────
$product_id = (int) get_queried_object_id();
$product    = $product_id ? wc_get_product($product_id) : null;

if (! $product) {
    wp_redirect(home_url('/'));
    exit;
}

// Variation attributes — keys are the attribute display name (e.g. 'Style', 'Size', 'Color')
$variation_attrs = $product->get_variation_attributes();
// Normalise to lowercase keys so lookup is case-insensitive
$attrs_lc = [];
foreach ($variation_attrs as $k => $v) {
    $attrs_lc[strtolower($k)] = array_values((array) $v);
}
$styles = $attrs_lc['style'] ?? [];
$sizes  = $attrs_lc['size']  ?? [];
$colors = $attrs_lc['color'] ?? [];

// Initial selection: from URL params or first option
$sel_style = sanitize_text_field($_GET['style'] ?? ($styles[0] ?? 'classic'));
$sel_size  = sanitize_text_field($_GET['size']  ?? ($sizes[0]  ?? '11oz'));
$sel_color = sanitize_text_field($_GET['color'] ?? ($colors[0] ?? 'white'));

// Mockup map & resolver
$resolver   = new Mug_Customizer_Variant_Resolver();
$mockup_map = $resolver->get_mockup_map($product_id);
$placeholder = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png';

function mug_pdp_mockup_url($mockup_map, $style, $size, $color, $angle, $placeholder) {
    $key = strtolower(implode('-', [
        sanitize_title($style),
        sanitize_title($size),
        sanitize_title($color),
        sanitize_title($angle),
    ]));
    return $mockup_map[$key] ?? $placeholder;
}

// Real angle photos shipped with the plugin in public/assets/images/.
// Used as a fallback whenever the admin hasn't uploaded a variant-specific
// mockup via the product meta box. Order here = order in the thumb strip.
$images_base = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/';
$default_angle_imgs = [
    'front'       => $images_base . 'mug-center.jpg',
    'front-left'  => $images_base . 'mug-front-left.jpg',
    'front-right' => $images_base . 'mug-front-right.jpg',
    'left'        => $images_base . 'mug-left.jpg',
    'right'       => $images_base . 'mug-right.jpg',
    'handle'      => $images_base . 'mug-handle.jpg',
    'lifestyle'   => $images_base . 'mug-donut.jpg',
];
$angle_labels = [
    'front'       => 'Front',
    'front-left'  => 'Front Left',
    'front-right' => 'Front Right',
    'left'        => 'Left',
    'right'       => 'Right',
    'handle'      => 'Handle',
    'lifestyle'   => 'Lifestyle',
];
$angles = array_keys($default_angle_imgs);

$thumb_urls = [];
foreach ($angles as $angle) {
    // Variant-specific mockup wins; otherwise fall back to the angle photo.
    $variant_url = mug_pdp_mockup_url($mockup_map, $sel_style, $sel_size, $sel_color, $angle, '');
    $thumb_urls[$angle] = $variant_url !== '' ? $variant_url : $default_angle_imgs[$angle];
}
$main_img_url = $thumb_urls['front'];

// Prices
$regular_price  = (float) $product->get_regular_price();
$sale_price_raw = (float) $product->get_sale_price();
$is_on_sale     = $product->is_on_sale() && $sale_price_raw > 0;
$display_price  = $is_on_sale ? wc_get_price_to_display($product) : wc_get_price_to_display($product, ['price' => $regular_price]);

// Rating
$rating_count = $product->get_rating_count();
$average      = $product->get_average_rating();

// Breadcrumb
$cats    = get_the_terms($product_id, 'product_cat');
$cat     = (! is_wp_error($cats) && ! empty($cats)) ? $cats[0] : null;
$cat_name = $cat ? $cat->name : 'Mugs';
$cat_url  = $cat ? get_term_link($cat) : home_url('/mugs/');

// Permalink for designer
$designer_base = home_url('/mug-designer/?product_id=' . $product_id);

// Color → hex map
$color_hex = [
    'black'   => '#111111',
    'white'   => '#f5f5f5',
    'red'     => '#dc2626',
    'blue'    => '#2563eb',
    'green'   => '#16a34a',
    'yellow'  => '#f59e0b',
    'pink'    => '#ec4899',
    'purple'  => '#7c3aed',
    'orange'  => '#f97316',
    'gray'    => '#9ca3af',
    'grey'    => '#9ca3af',
    'navy'    => '#1e3a5f',
];
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo('charset'); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title><?php echo esc_html($product->get_name()); ?> — <?php bloginfo('name'); ?></title>
<?php wp_head(); ?>
</head>
<body class="mug-pdp-body">

<div id="mug-pdp-wrap">

  <!-- ── Site Header ──────────────────────────────────────────────────────── -->
  <header id="pdp-site-header">
    <div id="pdp-header-inner">
      <a href="<?php echo esc_url(home_url('/')); ?>" class="pdp-logo">
        <?php bloginfo('name'); ?>
      </a>

      <div class="pdp-header-search">
        <form role="search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
          <input type="search" name="s" placeholder="<?php esc_attr_e('Search products…', 'mug-customizer'); ?>" value="<?php echo esc_attr(get_search_query()); ?>">
          <button type="submit"><?php esc_html_e('Search', 'mug-customizer'); ?></button>
        </form>
      </div>

      <nav class="pdp-header-nav">
        <a href="<?php echo esc_url(home_url('/mugs/')); ?>"><?php esc_html_e('Mugs', 'mug-customizer'); ?></a>
        <a href="<?php echo esc_url(wc_get_account_endpoint_url('dashboard')); ?>"><?php esc_html_e('Sign In', 'mug-customizer'); ?></a>
        <a href="<?php echo esc_url(wc_get_cart_url()); ?>" class="pdp-cart-link">
          <?php esc_html_e('Cart', 'mug-customizer'); ?>
          <?php $count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0; ?>
          <?php if ($count > 0) : ?>
            <span class="pdp-cart-badge"><?php echo esc_html($count); ?></span>
          <?php endif; ?>
        </a>
      </nav>
    </div>
  </header>

  <!-- ── Promo Banner ─────────────────────────────────────────────────────── -->
  <div id="pdp-promo-banner">
    <?php esc_html_e('🎉 Free shipping on orders over $35 — Limited time offer', 'mug-customizer'); ?>
  </div>

  <!-- ── Breadcrumb ───────────────────────────────────────────────────────── -->
  <nav id="pdp-breadcrumb" aria-label="Breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>"><?php esc_html_e('Home', 'mug-customizer'); ?></a>
    <span>›</span>
    <?php if ($cat) : ?>
      <a href="<?php echo esc_url($cat_url); ?>"><?php echo esc_html($cat_name); ?></a>
      <span>›</span>
    <?php else : ?>
      <a href="<?php echo esc_url(home_url('/mugs/')); ?>"><?php esc_html_e('Mugs', 'mug-customizer'); ?></a>
      <span>›</span>
    <?php endif; ?>
    <span><?php echo esc_html($product->get_name()); ?></span>
  </nav>

  <!-- ── PDP Grid: thumbs | preview | info ────────────────────────────────── -->
  <div id="pdp-grid" class="mug-customizer-pdp">

    <!-- Left: Vertical Thumb Strip -->
    <div class="thumb-strip">
      <?php foreach ($angles as $i => $angle) :
        $label = $angle_labels[$angle] ?? ucfirst(str_replace('-', ' ', $angle));
      ?>
        <div class="thumb <?php echo $i === 0 ? 'active' : ''; ?>"
             data-angle="<?php echo esc_attr($angle); ?>"
             data-src="<?php echo esc_url($thumb_urls[$angle]); ?>"
             title="<?php echo esc_attr($label); ?>">
          <img src="<?php echo esc_url($thumb_urls[$angle]); ?>"
               alt="<?php echo esc_attr($product->get_name() . ' — ' . $label); ?>"
               loading="<?php echo $i === 0 ? 'eager' : 'lazy'; ?>">
        </div>
      <?php endforeach; ?>
    </div>

    <!-- Center: Hero Preview -->
    <div class="pdp-preview">
      <img id="pdp-hero-img"
           class="hero-mug"
           src="<?php echo esc_url($main_img_url); ?>"
           alt="<?php echo esc_attr($product->get_name()); ?>">
      <div class="design-ghost">
        <div class="big"><?php esc_html_e('Your Design', 'mug-customizer'); ?></div>
        <div class="small"><?php esc_html_e('Appears Here', 'mug-customizer'); ?></div>
      </div>
      <button type="button" id="pdp-zoom-btn" class="pdp-zoom-btn" aria-label="Zoom">
        <span>&#10021;</span>
      </button>
    </div>

    <!-- Right: Info Panel -->
    <div class="pdp-info" id="pdp-info-panel">

      <!-- Title + Sold by -->
      <div class="pdp-title-block">
        <h1><?php echo esc_html($product->get_name()); ?></h1>
        <span class="pdp-sold-by"><?php esc_html_e('Sold by', 'mug-customizer'); ?> <strong><?php bloginfo('name'); ?></strong></span>
      </div>

      <!-- Rating -->
      <div class="pdp-rating">
        <?php
        $stars = round($average * 2) / 2;
        for ($s = 1; $s <= 5; $s++) {
            $class = $s <= $stars ? 'star-full' : ($s - 0.5 <= $stars ? 'star-half' : 'star-empty');
            echo '<span class="star ' . esc_attr($class) . '">★</span>';
        }
        ?>
        <a href="#pdp-reviews" class="rating-count">
          <?php echo $rating_count > 0
            ? sprintf(esc_html__('(%s reviews)', 'mug-customizer'), number_format($rating_count))
            : esc_html__('Be the first to review', 'mug-customizer'); ?>
        </a>
      </div>

      <!-- Price -->
      <div class="pdp-price-block">
        <?php if ($is_on_sale) : ?>
          <div class="price-row">
            <span class="price-big price-sale"><?php echo wc_price($display_price); ?></span>
            <span class="price-original"><?php echo wc_price(wc_get_price_to_display($product, ['price' => $regular_price])); ?></span>
            <span class="price-save-badge"><?php
              $pct = round((1 - $display_price / $regular_price) * 100);
              printf(esc_html__('Save %d%%', 'mug-customizer'), $pct);
            ?></span>
          </div>
        <?php else : ?>
          <div class="price-row">
            <span class="price-big"><?php echo wc_price($display_price); ?></span>
          </div>
        <?php endif; ?>
        <div class="price-unit"><?php esc_html_e('per mug', 'mug-customizer'); ?></div>
        <div class="pdp-promo-line">
          <?php
          $promo_code = apply_filters('mug_pdp_promo_code', get_option('mc_promo_code', 'MAY15'));
          /* translators: %s = promo code */
          printf(esc_html__('Save 15%% with code %s', 'mug-customizer'), '<strong>' . esc_html($promo_code) . '</strong>');
          ?>
        </div>
        <div class="price-shipping"><?php esc_html_e('Free shipping on orders over $35', 'mug-customizer'); ?></div>
      </div>

      <!-- Style — visual swatch selector with photo thumbnails + upgrade prices -->
      <?php if (! empty($styles)) : ?>
      <div class="option-block" data-option="style">
        <div class="opt-heading">
          <?php esc_html_e('Style', 'mug-customizer'); ?>
          <span class="opt-selected-label" id="selected-style-label"><?php echo esc_html($sel_style); ?></span>
        </div>
        <div class="pdp-style-swatches">
          <?php
          // Static upgrade-price overlay — production version should pull
          // from each variation's actual price delta over the base SKU.
          $style_upgrade = [
            'classic'  => 0,
            'travel'   => 1.75,
            'espresso' => 2.50,
            'two-tone' => 4.35,
          ];
          // Map each style to a representative photo. We only have Classic
          // photos shipped; other styles re-use the same hero so the swatch
          // is recognisable but distinguished by label + upgrade chip.
          $style_thumb = [
            'classic'  => $default_angle_imgs['front-left'],
            'travel'   => $default_angle_imgs['handle'],
            'espresso' => $default_angle_imgs['front-right'],
            'two-tone' => $default_angle_imgs['left'],
          ];
          foreach ($styles as $style_opt) :
            $skey    = strtolower($style_opt);
            $upgrade = $style_upgrade[$skey] ?? 0;
            $thumb   = $style_thumb[$skey] ?? $default_angle_imgs['front'];
            $is_sel  = $skey === strtolower($sel_style);
          ?>
            <button type="button"
                    class="pdp-style-swatch pill<?php echo $is_sel ? ' selected' : ''; ?>"
                    data-option="style"
                    data-value="<?php echo esc_attr($skey); ?>"
                    aria-pressed="<?php echo $is_sel ? 'true' : 'false'; ?>"
                    title="<?php echo esc_attr($style_opt); ?>">
              <span class="pdp-ss-thumb">
                <img src="<?php echo esc_url($thumb); ?>" alt="<?php echo esc_attr($style_opt); ?>" loading="lazy">
              </span>
              <span class="pdp-ss-name"><?php echo esc_html($style_opt); ?></span>
              <span class="pdp-ss-upgrade">
                <?php
                // wc_price() returns HTML like <span class="woocommerce-Price-amount">...
                // wp_strip_all_tags strips it to a plain "$1.75" suitable for the chip.
                echo $upgrade > 0
                    ? '+' . esc_html(wp_strip_all_tags(wc_price($upgrade)))
                    : '&mdash;';
                ?>
              </span>
            </button>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>

      <!-- Size -->
      <?php if (! empty($sizes)) : ?>
      <div class="option-block" data-option="size">
        <div class="opt-heading">
          <?php esc_html_e('Size', 'mug-customizer'); ?>
          <span class="opt-selected-label" id="selected-size-label"><?php echo esc_html($sel_size); ?></span>
        </div>
        <div class="pill-group">
          <?php foreach ($sizes as $size_opt) : ?>
            <button type="button"
                    class="pill<?php echo strtolower($size_opt) === strtolower($sel_size) ? ' selected' : ''; ?>"
                    data-option="size"
                    data-value="<?php echo esc_attr(strtolower($size_opt)); ?>">
              <?php echo esc_html($size_opt); ?>
            </button>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>

      <!-- Color -->
      <?php if (! empty($colors)) : ?>
      <div class="option-block" data-option="color">
        <div class="opt-heading">
          <?php esc_html_e('Color', 'mug-customizer'); ?>
          <span class="opt-selected-label" id="selected-color-label"><?php echo esc_html($sel_color); ?></span>
        </div>
        <div class="pdp-swatches">
          <?php foreach ($colors as $color_opt) : ?>
            <?php
            $color_key = strtolower($color_opt);
            $hex       = $color_hex[$color_key] ?? '#cccccc';
            $is_light  = in_array($color_key, ['white', 'yellow', 'gray', 'grey']);
            ?>
            <button type="button"
                    class="swatch<?php echo $color_key === strtolower($sel_color) ? ' selected' : ''; ?>"
                    data-color="<?php echo esc_attr($color_key); ?>"
                    title="<?php echo esc_attr($color_opt); ?>"
                    style="background:<?php echo esc_attr($hex); ?>;<?php echo $is_light ? 'border-color:#ccc;' : ''; ?>">
            </button>
          <?php endforeach; ?>
        </div>
      </div>
      <?php endif; ?>

      <!-- Delivery estimate -->
      <div class="pdp-delivery">
        <span class="pdp-delivery-icon">🚚</span>
        <div>
          <div class="pdp-delivery-fast">
            <?php
            $fast_date = date_i18n('M j', strtotime('+5 days'));
            printf(esc_html__('Order today — get it by %s with expedited', 'mug-customizer'), $fast_date);
            ?>
          </div>
          <div class="pdp-delivery-std">
            <?php
            $std_date = date_i18n('M j', strtotime('+10 days'));
            printf(esc_html__('Get it by %s with standard shipping', 'mug-customizer'), $std_date);
            ?>
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div class="pdp-cta-block">
        <a id="btn-personalize"
           href="<?php echo esc_url($designer_base . '&style=' . urlencode(strtolower($sel_style)) . '&size=' . urlencode(strtolower($sel_size)) . '&color=' . urlencode(strtolower($sel_color))); ?>"
           class="mug-cta-primary">
          <?php esc_html_e('Customize It →', 'mug-customizer'); ?>
        </a>
        <button type="button" class="mug-cta-secondary">
          <?php esc_html_e('Choose a Template Instead', 'mug-customizer'); ?>
        </button>
      </div>

      <!-- Trust badges (inline, near CTA) -->
      <div class="pdp-trust-inline">
        <span>✓ <?php esc_html_e('100% Love It Guarantee', 'mug-customizer'); ?></span>
        <span>✓ <?php esc_html_e('Secure SSL Checkout', 'mug-customizer'); ?></span>
        <span>✓ <?php esc_html_e('Free Returns', 'mug-customizer'); ?></span>
      </div>

      <!-- Features list -->
      <ul class="pdp-features">
        <li><?php esc_html_e('Printed at 300 DPI — crisp detail', 'mug-customizer'); ?></li>
        <li><?php esc_html_e('Microwave &amp; dishwasher safe', 'mug-customizer'); ?></li>
        <li><?php esc_html_e('FDA food/beverage safety certified', 'mug-customizer'); ?></li>
        <li><?php esc_html_e('Strong ceramic construction', 'mug-customizer'); ?></li>
      </ul>

    </div><!-- /.pdp-info -->
  </div><!-- /#pdp-grid -->

  <!-- ── Trust Badges Section ──────────────────────────────────────────────── -->
  <section id="pdp-promise">
    <h2 class="pdp-section-title"><?php esc_html_e('The Mugly Promise', 'mug-customizer'); ?></h2>
    <div class="pdp-promise-cards">
      <div class="promise-card">
        <div class="promise-icon">💛</div>
        <h3><?php esc_html_e('Love It Guarantee', 'mug-customizer'); ?></h3>
        <p><?php esc_html_e("Don't love it? We'll take it back. Enjoy our 100% Love It Guarantee.", 'mug-customizer'); ?></p>
      </div>
      <div class="promise-card">
        <div class="promise-icon">🚚</div>
        <h3><?php esc_html_e('Free Shipping', 'mug-customizer'); ?></h3>
        <p><?php esc_html_e('Free shipping on orders over $35. Fast production and reliable delivery.', 'mug-customizer'); ?></p>
      </div>
      <div class="promise-card">
        <div class="promise-icon">🔒</div>
        <h3><?php esc_html_e('Secure Shopping', 'mug-customizer'); ?></h3>
        <p><?php esc_html_e('100% secure payment with SSL encryption. Your data is always protected.', 'mug-customizer'); ?></p>
      </div>
    </div>
  </section>

  <!-- ── About / Specs Section ────────────────────────────────────────────── -->
  <section id="pdp-about">
    <h2 class="pdp-section-title"><?php esc_html_e('About This Mug', 'mug-customizer'); ?></h2>
    <div class="pdp-about-grid">
      <div class="pdp-about-text">
        <p><?php esc_html_e('Give a made-to-order mug to someone special. Choose from millions of designs or upload your own photos and text. Every mug is printed on demand with museum-quality inks and shipped directly to your door.', 'mug-customizer'); ?></p>
        <p><?php esc_html_e('Perfect for birthdays, holidays, offices, and everyday moments. Customise with names, photos, quotes, or logos.', 'mug-customizer'); ?></p>
      </div>
      <div class="pdp-specs">
        <h3><?php esc_html_e('Product Specs', 'mug-customizer'); ?></h3>
        <table class="pdp-specs-table">
          <tr><th><?php esc_html_e('Classic 11oz', 'mug-customizer'); ?></th><td>3.2" D × 3.8" H</td></tr>
          <tr><th><?php esc_html_e('Classic 15oz', 'mug-customizer'); ?></th><td>3.4" D × 4.5" H</td></tr>
          <tr><th><?php esc_html_e('Material', 'mug-customizer'); ?></th><td><?php esc_html_e('Ceramic', 'mug-customizer'); ?></td></tr>
          <tr><th><?php esc_html_e('Care', 'mug-customizer'); ?></th><td><?php esc_html_e('Microwave &amp; dishwasher safe', 'mug-customizer'); ?></td></tr>
          <tr><th><?php esc_html_e('Print', 'mug-customizer'); ?></th><td><?php esc_html_e('300 DPI, full wrap', 'mug-customizer'); ?></td></tr>
          <tr><th><?php esc_html_e('Safety', 'mug-customizer'); ?></th><td><?php esc_html_e('FDA certified', 'mug-customizer'); ?></td></tr>
          <tr><th><?php esc_html_e('Produced in', 'mug-customizer'); ?></th><td><?php esc_html_e('USA', 'mug-customizer'); ?></td></tr>
        </table>
      </div>
    </div>
  </section>

  <!-- ── Customer Reviews ──────────────────────────────────────────────────── -->
  <section id="pdp-reviews">
    <h2 class="pdp-section-title">
      <?php esc_html_e('Customer Reviews', 'mug-customizer'); ?>
      <?php if ($rating_count > 0) : ?>
        <span class="section-rating">
          <?php echo number_format($average, 1); ?> ★ &middot; <?php echo number_format($rating_count); ?> <?php esc_html_e('reviews', 'mug-customizer'); ?>
        </span>
      <?php endif; ?>
    </h2>
    <div class="pdp-reviews-body">
      <?php
      // WC review template needs $product global set as WC_Product object
      global $product;
      $product = wc_get_product($product_id);
      if ($product && $product->get_reviews_allowed()) {
          comments_template();
      } else {
          echo '<p class="pdp-no-reviews">' . esc_html__('Reviews are not available for this product.', 'mug-customizer') . '</p>';
      }
      ?>
    </div>
  </section>

</div><!-- /#mug-pdp-wrap -->

<!-- ── Sticky CTA Bar (shows on scroll) ─────────────────────────────────── -->
<div id="pdp-sticky-bar" class="pdp-sticky-hidden">
  <div class="pdp-sticky-inner">
    <div class="pdp-sticky-title"><?php echo esc_html($product->get_name()); ?></div>
    <div class="pdp-sticky-price"><?php echo wc_price($display_price); ?></div>
    <a id="btn-sticky-personalize"
       href="<?php echo esc_url($designer_base); ?>"
       class="mug-cta-primary pdp-sticky-cta">
      <?php esc_html_e('Customize It →', 'mug-customizer'); ?>
    </a>
  </div>
</div>

<!-- ── Zoom Modal ────────────────────────────────────────────────────────── -->
<div id="pdp-zoom-modal" class="pdp-zoom-hidden">
  <button type="button" id="pdp-zoom-close">✕</button>
  <img id="pdp-zoom-img" src="" alt="">
</div>

<!-- JS config -->
<script>
window.mugPdpConfig = {
  productId:     <?php echo (int) $product_id; ?>,
  designerUrl:   <?php echo wp_json_encode($designer_base); ?>,
  mockupMap:     <?php echo wp_json_encode($mockup_map); ?>,
  defaultAngles: <?php echo wp_json_encode($default_angle_imgs); ?>,
  placeholder:   <?php echo wp_json_encode($placeholder); ?>,
  selected: {
    style: <?php echo wp_json_encode(strtolower($sel_style)); ?>,
    size:  <?php echo wp_json_encode(strtolower($sel_size)); ?>,
    color: <?php echo wp_json_encode(strtolower($sel_color)); ?>,
  },
};
</script>

<?php wp_footer(); ?>
</body>
</html>
