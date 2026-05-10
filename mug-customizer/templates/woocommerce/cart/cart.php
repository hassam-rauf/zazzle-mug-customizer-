<?php
/**
 * Cart page (Zazzle parity)
 *
 * Overrides woocommerce/cart/cart.php via woocommerce_locate_template filter.
 * Renders the cart with the Zazzle-style 2-column layout: items + sticky
 * payment / subtotal rail on the right.
 *
 * @package Mug_Customizer
 */
defined('ABSPATH') || exit;

// Helper: returns localised "May 12" style date N business days from today.
// Defined here BEFORE first use so PHP doesn't trip on undefined-function
// when the template is included via wc_get_template() at runtime.
if (!function_exists('mc_cart_business_date')) {
    function mc_cart_business_date(int $days): string {
        $d = new DateTime('now');
        $added = 0;
        while ($added < $days) {
            $d->modify('+1 day');
            $dow = (int) $d->format('w');
            if ($dow !== 0 && $dow !== 6) $added++;
        }
        return $d->format('M j');
    }
}

do_action('woocommerce_before_cart');

$current_user = wp_get_current_user();
$first_name   = $current_user->ID ? ($current_user->first_name ?: $current_user->display_name) : '';
$promo_code   = get_option('mc_promo_code', 'MAYDEALS4YOU');
?>
<div id="mc-cart-wrap">

  <!-- Header -->
  <div class="mc-cart-header">
    <h1 class="mc-cart-title">
      <?php esc_html_e('Your Shopping Cart', 'mug-customizer'); ?>
      <span class="mc-cart-count">(<?php echo (int) WC()->cart->get_cart_contents_count(); ?> <?php echo (WC()->cart->get_cart_contents_count() === 1) ? esc_html__('item', 'mug-customizer') : esc_html__('items', 'mug-customizer'); ?>)</span>
    </h1>
    <?php if ($first_name) : ?>
      <div class="mc-cart-user">
        <?php
        /* translators: %s = first name */
        printf(esc_html__('Not %s? ', 'mug-customizer'), esc_html($first_name));
        ?>
        <a href="<?php echo esc_url(wp_logout_url(home_url())); ?>"><?php esc_html_e('(Sign out)', 'mug-customizer'); ?></a>
      </div>
    <?php endif; ?>
  </div>

  <!-- Trust banner -->
  <div class="mc-cart-trust">
    <span class="mc-trust-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C.5 8 3.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 6.5 4 4.5 8C19 16.5 12 21 12 21z"/></svg>
    </span>
    <strong><?php esc_html_e('100% Satisfaction, Returns Guaranteed!', 'mug-customizer'); ?></strong>
    <a href="#" class="mc-trust-learn"><?php esc_html_e('Learn more', 'mug-customizer'); ?></a>
  </div>

  <form class="woocommerce-cart-form" action="<?php echo esc_url(wc_get_cart_url()); ?>" method="post" id="mc-cart-form">
    <?php do_action('woocommerce_before_cart_table'); ?>

    <div class="mc-cart-grid">

      <!-- LEFT: items column -->
      <div class="mc-cart-items">

        <?php foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) :
          $product   = apply_filters('woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key);
          $product_id = apply_filters('woocommerce_cart_item_product_id', $cart_item['product_id'], $cart_item, $cart_item_key);
          if (!$product || !$product->exists() || $cart_item['quantity'] <= 0 || !apply_filters('woocommerce_cart_item_visible', true, $cart_item, $cart_item_key)) continue;

          $product_permalink = apply_filters('woocommerce_cart_item_permalink', $product->is_visible() ? $product->get_permalink($cart_item) : '', $cart_item, $cart_item_key);
          $thumbnail         = apply_filters('woocommerce_cart_item_thumbnail', $product->get_image('woocommerce_thumbnail'), $cart_item, $cart_item_key);
          $product_name      = apply_filters('woocommerce_cart_item_name', $product->get_name(), $cart_item, $cart_item_key);

          // Mug design preview thumbnail — ONLY use the saved file URL.
          // The inline `mockup_data_url` fallback was removed in v2.0.7 because
          // legacy cart items (added before v2.0.5) carry pre-fix data URLs that
          // contain editor chrome (green dashed outline, Safe-area pill, dim
          // labels, "Your text here" placeholder). If `preview_url` is missing,
          // fall through to the default WC product image instead of leaking
          // dirty canvas pixels into the cart.
          $design_thumb = '';
          if (!empty($cart_item['_mug_design']) && class_exists('Mug_Customizer_Design_Storage')) {
            $storage = new Mug_Customizer_Design_Storage();
            $design  = $storage->decode($cart_item['_mug_design']);
            if (!is_wp_error($design) && !empty($design['preview_url'])) {
              $design_thumb = $design['preview_url'];
            }
          }

          // Variant attributes display string
          $variant_str = '';
          if ($product->is_type('variation')) {
            $attrs = [];
            foreach ($product->get_variation_attributes() as $k => $v) { $attrs[] = ucfirst(str_replace('-', ' ', $v)); }
            $variant_str = implode(', ', $attrs);
          }

          $line_subtotal = $product->get_price() * $cart_item['quantity'];
          $regular_price = (float) $product->get_regular_price();
          $sale_price    = (float) $product->get_sale_price();
          $on_sale       = $product->is_on_sale();
          $line_regular  = $regular_price * $cart_item['quantity'];
          $saved         = max(0, $line_regular - $line_subtotal);

          // Compute estimated arrival (5 / 10 biz days)
          $fast_date = mc_cart_business_date(5);
          ?>

          <div class="mc-cart-item" data-cart-item-key="<?php echo esc_attr($cart_item_key); ?>">
            <div class="mc-item-image">
              <?php if ($design_thumb) : ?>
                <img src="<?php echo esc_url($design_thumb); ?>" alt="<?php echo esc_attr($product_name); ?>">
              <?php else : ?>
                <?php echo $thumbnail; // phpcs:ignore ?>
              <?php endif; ?>
            </div>

            <div class="mc-item-info">
              <span class="mc-just-added" data-just-added><?php esc_html_e('Just added', 'mug-customizer'); ?></span>
              <h3 class="mc-item-title"><?php echo wp_kses_post($product_name); ?></h3>
              <?php if ($variant_str) : ?>
                <div class="mc-item-variant"><?php echo esc_html($variant_str); ?></div>
              <?php endif; ?>
              <div class="mc-item-shipping">
                <strong><?php esc_html_e('Order today', 'mug-customizer'); ?></strong>
                <?php esc_html_e('to get it as soon as', 'mug-customizer'); ?>
                <strong><?php echo esc_html($fast_date); ?></strong>
                <?php esc_html_e('with expedited shipping', 'mug-customizer'); ?>
              </div>

              <div class="mc-item-actions">
                <a href="#" class="mc-item-save"><?php esc_html_e('Save for Later', 'mug-customizer'); ?></a>
                <span class="mc-item-sep">|</span>
                <a href="<?php echo esc_url($product_permalink); ?>" class="mc-item-edit"><?php esc_html_e('Edit Item', 'mug-customizer'); ?></a>
                <span class="mc-item-sep">|</span>
                <a href="<?php echo esc_url(wc_get_cart_remove_url($cart_item_key)); ?>" class="mc-item-remove"><?php esc_html_e('Remove', 'mug-customizer'); ?></a>
              </div>
            </div>

            <div class="mc-item-qty">
              <select name="cart[<?php echo esc_attr($cart_item_key); ?>][qty]" class="mc-qty-select" data-key="<?php echo esc_attr($cart_item_key); ?>">
                <?php for ($i = 1; $i <= 99; $i++) : ?>
                  <option value="<?php echo esc_attr($i); ?>" <?php selected($cart_item['quantity'], $i); ?>><?php echo (int) $i; ?></option>
                <?php endfor; ?>
              </select>
              <span class="mc-qty-label"><?php echo $cart_item['quantity'] === 1 ? esc_html__('mug', 'mug-customizer') : esc_html__('mugs', 'mug-customizer'); ?></span>
            </div>

            <div class="mc-item-price">
              <?php if ($on_sale && $regular_price > 0) : ?>
                <div class="mc-price-comp"><?php echo wc_price($line_regular); ?> <?php esc_html_e('Comp. value', 'mug-customizer'); ?></div>
              <?php endif; ?>
              <div class="mc-price-current"><?php echo wc_price($line_subtotal); ?></div>
              <?php if ($saved > 0) : ?>
                <div class="mc-price-saved">
                  <?php /* translators: %s = amount saved */ printf(esc_html__('You saved %s', 'mug-customizer'), wc_price($saved)); ?>
                </div>
              <?php endif; ?>
              <?php if (!empty($promo_code)) : ?>
                <div class="mc-price-promo"><?php echo esc_html($promo_code); ?></div>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>

        <!-- Promo + share row -->
        <div class="mc-cart-promo-row">
          <div class="mc-cart-coupon">
            <input type="text" name="coupon_code" id="coupon_code" class="mc-coupon-input" placeholder="<?php esc_attr_e('Promo code / Gift card / Voucher', 'mug-customizer'); ?>">
            <button type="submit" class="mc-coupon-apply" name="apply_coupon" value="<?php esc_attr_e('Apply', 'mug-customizer'); ?>"><?php esc_html_e('Apply', 'mug-customizer'); ?></button>
            <?php do_action('woocommerce_cart_coupon'); ?>
          </div>
          <?php
          $applied_coupons = WC()->cart->get_applied_coupons();
          if (!empty($applied_coupons)) : ?>
            <div class="mc-applied-coupons">
              <span class="mc-not-qualified"><?php esc_html_e('Not yet qualified', 'mug-customizer'); ?> <a href="#"><?php esc_html_e('why not?', 'mug-customizer'); ?></a></span>
              <?php foreach ($applied_coupons as $code) : ?>
                <div class="mc-applied-pill">
                  <span><?php echo esc_html(strtoupper($code)); ?></span>
                  <a href="<?php echo esc_url(wc_get_cart_remove_coupon_url($code)); ?>" class="mc-coupon-remove"><?php esc_html_e('remove', 'mug-customizer'); ?></a>
                </div>
              <?php endforeach; ?>
              <p class="mc-coupon-note"><?php esc_html_e('Promo codes cannot be combined with any other Zazzle promotional or volume discount offers.', 'mug-customizer'); ?> <a href="#"><?php esc_html_e('(see details)', 'mug-customizer'); ?></a></p>
            </div>
          <?php endif; ?>

          <button type="button" class="mc-share-cart"><?php esc_html_e('Share this Cart', 'mug-customizer'); ?></button>
        </div>

      </div><!-- /.mc-cart-items -->

      <!-- RIGHT: payment + subtotal rail -->
      <aside class="mc-cart-rail">

        <h3 class="mc-pay-header"><?php esc_html_e('Select a Payment Method', 'mug-customizer'); ?></h3>
        <div class="mc-pay-list">
          <label class="mc-pay-row">
            <input type="radio" name="mc_payment" value="card" checked>
            <span class="mc-pay-logos">
              <span class="mc-pay-logo visa">VISA</span>
              <span class="mc-pay-logo mc">MC</span>
              <span class="mc-pay-logo amex">AMEX</span>
            </span>
          </label>
          <label class="mc-pay-row">
            <input type="radio" name="mc_payment" value="paypal">
            <span class="mc-pay-logos"><span class="mc-pay-logo paypal">PayPal</span></span>
          </label>
          <label class="mc-pay-row">
            <input type="radio" name="mc_payment" value="gpay">
            <span class="mc-pay-logos"><span class="mc-pay-logo gpay">G Pay</span></span>
          </label>
          <label class="mc-pay-row">
            <input type="radio" name="mc_payment" value="klarna">
            <span class="mc-pay-logos">
              <span class="mc-pay-logo klarna">Klarna</span>
              <span class="mc-pay-tagline"><?php esc_html_e('Buy now, pay later', 'mug-customizer'); ?></span>
            </span>
          </label>
          <label class="mc-pay-row">
            <input type="radio" name="mc_payment" value="venmo">
            <span class="mc-pay-logos"><span class="mc-pay-logo venmo">venmo</span></span>
          </label>
        </div>

        <hr class="mc-rail-hr">

        <?php
        $regular_total  = 0;
        foreach (WC()->cart->get_cart() as $ci) {
          $p = $ci['data']; $reg = (float) $p->get_regular_price(); $regular_total += $reg * $ci['quantity'];
        }
        $current_total = WC()->cart->get_subtotal();
        $saved_total   = max(0, $regular_total - $current_total);
        ?>
        <div class="mc-rail-subtotal-row">
          <span class="mc-rail-label"><?php esc_html_e('Subtotal:', 'mug-customizer'); ?>*</span>
          <span class="mc-rail-prices">
            <?php if ($saved_total > 0) : ?>
              <span class="mc-rail-comp"><?php echo wc_price($regular_total); ?></span>
            <?php endif; ?>
            <span class="mc-rail-current"><?php echo wc_price($current_total); ?></span>
          </span>
        </div>
        <?php if ($saved_total > 0) : ?>
          <div class="mc-rail-saved"><?php /* translators: %s = saved amount */ printf(esc_html__('You saved %s', 'mug-customizer'), wc_price($saved_total)); ?></div>
        <?php endif; ?>

        <a href="<?php echo esc_url(wc_get_checkout_url()); ?>" class="mc-checkout-btn">
          <span class="mc-lock" aria-hidden="true">🔒</span> <?php esc_html_e('Proceed to Checkout', 'mug-customizer'); ?>
        </a>

        <p class="mc-rail-foot"><?php esc_html_e('*Shipping and Taxes calculated at checkout', 'mug-customizer'); ?></p>

      </aside>

    </div><!-- /.mc-cart-grid -->

    <?php do_action('woocommerce_after_cart_table'); ?>
  </form>

  <?php do_action('woocommerce_after_cart'); ?>
</div>
