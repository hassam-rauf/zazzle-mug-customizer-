<?php
/**
 * Checkout Form (Zazzle parity)
 *
 * Overrides woocommerce/checkout/form-checkout.php — keeps all standard WC
 * hooks/actions intact (so payment gateways, plugins, etc. hook normally)
 * while wrapping them in a Zazzle-styled 2-column layout.
 *
 * @package Mug_Customizer
 */
defined('ABSPATH') || exit;

do_action('woocommerce_before_checkout_form', $checkout);

if (!$checkout->is_registration_enabled() && $checkout->is_registration_required() && !is_user_logged_in()) {
    echo esc_html(apply_filters('woocommerce_checkout_must_be_logged_in_message', __('You must be logged in to checkout.', 'woocommerce')));
    return;
}

$current_user = wp_get_current_user();
$first_name   = $current_user->ID ? ($current_user->first_name ?: $current_user->display_name) : '';
?>

<div id="mc-checkout-wrap">

  <div class="mc-checkout-header">
    <h1 class="mc-checkout-title"><?php esc_html_e('Checkout', 'mug-customizer'); ?></h1>
    <?php if ($first_name) : ?>
      <div class="mc-checkout-user">
        <?php /* translators: %s = first name */ printf(esc_html__('Not %s? ', 'mug-customizer'), esc_html($first_name)); ?>
        <a href="<?php echo esc_url(wp_logout_url(home_url())); ?>"><?php esc_html_e('(Sign out)', 'mug-customizer'); ?></a>
      </div>
    <?php endif; ?>
  </div>

  <div class="mc-cart-trust">
    <span class="mc-trust-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7-4.5-9.5-9C.5 8 3.5 4 7 4c2 0 3.5 1 5 3 1.5-2 3-3 5-3 3.5 0 6.5 4 4.5 8C19 16.5 12 21 12 21z"/></svg>
    </span>
    <strong><?php esc_html_e('Secure checkout — your data is safe with us', 'mug-customizer'); ?></strong>
  </div>

  <form name="checkout" method="post" class="checkout woocommerce-checkout" action="<?php echo esc_url(wc_get_checkout_url()); ?>" enctype="multipart/form-data">

    <div class="mc-checkout-grid">

      <!-- LEFT: customer + shipping + payment -->
      <div class="mc-checkout-main">

        <?php if (sizeof($checkout->get_checkout_fields())) : ?>
          <?php do_action('woocommerce_checkout_before_customer_details'); ?>

          <section class="mc-checkout-section" id="mc-customer-details">
            <h2 class="mc-section-title"><?php esc_html_e('Contact information', 'mug-customizer'); ?></h2>
            <div class="col2-set" id="customer_details">
              <div class="col-1">
                <?php do_action('woocommerce_checkout_billing'); ?>
              </div>
              <div class="col-2">
                <?php do_action('woocommerce_checkout_shipping'); ?>
              </div>
            </div>
          </section>

          <?php do_action('woocommerce_checkout_after_customer_details'); ?>
        <?php endif; ?>

        <section class="mc-checkout-section" id="mc-payment-section">
          <h2 class="mc-section-title"><?php esc_html_e('Payment options', 'mug-customizer'); ?></h2>
          <?php do_action('woocommerce_checkout_before_order_review_heading'); ?>
          <?php do_action('woocommerce_checkout_before_order_review'); ?>
          <div id="order_review" class="woocommerce-checkout-review-order">
            <?php do_action('woocommerce_checkout_order_review'); ?>
          </div>
          <?php do_action('woocommerce_checkout_after_order_review'); ?>
        </section>

      </div><!-- /.mc-checkout-main -->

      <!-- RIGHT: order summary (sticky) -->
      <aside class="mc-checkout-rail">
        <h3 class="mc-rail-heading"><?php esc_html_e('Order summary', 'mug-customizer'); ?></h3>

        <div class="mc-rail-items">
          <?php foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) :
            $product   = apply_filters('woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key);
            if (!$product || !$product->exists() || $cart_item['quantity'] <= 0) continue;
            $name      = apply_filters('woocommerce_cart_item_name', $product->get_name(), $cart_item, $cart_item_key);
            $thumbnail = apply_filters('woocommerce_cart_item_thumbnail', $product->get_image('woocommerce_thumbnail'), $cart_item, $cart_item_key);
            // v2.0.7: only use saved-file preview, never the inline data URL
            // (legacy cart items carry pre-fix dirty editor-canvas data URLs).
            $design_thumb = '';
            if (!empty($cart_item['_mug_design']) && class_exists('Mug_Customizer_Design_Storage')) {
              $storage = new Mug_Customizer_Design_Storage();
              $design  = $storage->decode($cart_item['_mug_design']);
              if (!is_wp_error($design) && !empty($design['preview_url'])) {
                $design_thumb = $design['preview_url'];
              }
            }
            $line_subtotal = $product->get_price() * $cart_item['quantity'];
            ?>
            <div class="mc-rail-item">
              <div class="mc-rail-thumb">
                <?php if ($design_thumb) : ?>
                  <img src="<?php echo esc_url($design_thumb); ?>" alt="<?php echo esc_attr($name); ?>">
                <?php else : ?>
                  <?php echo $thumbnail; // phpcs:ignore ?>
                <?php endif; ?>
                <span class="mc-rail-qty"><?php echo (int) $cart_item['quantity']; ?></span>
              </div>
              <div class="mc-rail-info">
                <div class="mc-rail-name"><?php echo wp_kses_post($name); ?></div>
                <?php if ($product->is_type('variation')) :
                  $attrs = [];
                  foreach ($product->get_variation_attributes() as $k => $v) { $attrs[] = ucfirst(str_replace('-', ' ', $v)); }
                  ?>
                  <div class="mc-rail-variant"><?php echo esc_html(implode(' / ', $attrs)); ?></div>
                <?php endif; ?>
                <div class="mc-rail-line-price"><?php echo wc_price($line_subtotal); ?></div>
              </div>
            </div>
          <?php endforeach; ?>
        </div>

        <hr class="mc-rail-hr">

        <div class="mc-rail-totals">
          <div class="mc-rail-row">
            <span><?php esc_html_e('Subtotal', 'mug-customizer'); ?></span>
            <span><?php wc_cart_totals_subtotal_html(); ?></span>
          </div>
          <?php foreach (WC()->cart->get_coupons() as $code => $coupon) : ?>
            <div class="mc-rail-row">
              <span class="mc-rail-coupon-label"><?php wc_cart_totals_coupon_label($coupon); ?></span>
              <span><?php wc_cart_totals_coupon_html($coupon); ?></span>
            </div>
          <?php endforeach; ?>
          <?php if (WC()->cart->needs_shipping() && WC()->cart->show_shipping()) : ?>
            <?php foreach (WC()->cart->get_shipping_packages() as $i => $package) : ?>
              <div class="mc-rail-row">
                <span><?php esc_html_e('Shipping', 'mug-customizer'); ?></span>
                <span><?php wc_cart_totals_shipping_html(); ?></span>
              </div>
            <?php break; endforeach; ?>
          <?php endif; ?>
          <?php foreach (WC()->cart->get_fees() as $fee) : ?>
            <div class="mc-rail-row">
              <span><?php echo esc_html($fee->name); ?></span>
              <span><?php wc_cart_totals_fee_html($fee); ?></span>
            </div>
          <?php endforeach; ?>
          <?php if (wc_tax_enabled() && !WC()->cart->display_prices_including_tax()) :
            if ('itemized' === get_option('woocommerce_tax_total_display')) {
              foreach (WC()->cart->get_tax_totals() as $code => $tax) : ?>
                <div class="mc-rail-row"><span><?php echo esc_html($tax->label); ?></span><span><?php echo wp_kses_post($tax->formatted_amount); ?></span></div>
              <?php endforeach;
            } else { ?>
              <div class="mc-rail-row"><span><?php echo esc_html(WC()->countries->tax_or_vat()); ?></span><span><?php wc_cart_totals_taxes_total_html(); ?></span></div>
            <?php }
          endif; ?>
        </div>

        <hr class="mc-rail-hr">

        <div class="mc-rail-total-row">
          <span class="mc-rail-total-label"><?php esc_html_e('Total', 'mug-customizer'); ?></span>
          <span class="mc-rail-total-amount"><?php wc_cart_totals_order_total_html(); ?></span>
        </div>

      </aside>

    </div><!-- /.mc-checkout-grid -->

  </form>

  <?php do_action('woocommerce_after_checkout_form', $checkout); ?>
</div>
