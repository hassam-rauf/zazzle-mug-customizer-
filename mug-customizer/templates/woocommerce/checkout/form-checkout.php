<?php
/**
 * Checkout Form (Zazzle parity, v2.1.3)
 *
 * Overrides woocommerce/checkout/form-checkout.php. Numbered step layout
 * (Shipping → Payment → Review) with all WC actions intact so payment
 * gateways and plugins hook normally.
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

// Estimated delivery date — 7 business days. Falls back to a calendar offset
// if the cart-handler helper isn't loaded yet.
$ship_eta = function_exists('mc_cart_business_date')
    ? mc_cart_business_date(7)
    : date_i18n(get_option('date_format', 'M j'), strtotime('+10 days'));
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

  <!-- Trust badges row — 3-icon reassurance strip -->
  <div class="mc-trust-row">
    <div class="mc-trust-item">
      <span class="mc-trust-i" aria-hidden="true">🔒</span>
      <span><?php esc_html_e('Secure SSL checkout', 'mug-customizer'); ?></span>
    </div>
    <div class="mc-trust-item">
      <span class="mc-trust-i" aria-hidden="true">🚚</span>
      <span><?php esc_html_e('Fast shipping', 'mug-customizer'); ?></span>
    </div>
    <div class="mc-trust-item">
      <span class="mc-trust-i" aria-hidden="true">↩</span>
      <span><?php esc_html_e('30-day returns', 'mug-customizer'); ?></span>
    </div>
  </div>

  <form name="checkout" id="checkout" method="post" class="checkout woocommerce-checkout" action="<?php echo esc_url(wc_get_checkout_url()); ?>" enctype="multipart/form-data">

    <div class="mc-checkout-grid">

      <!-- LEFT: numbered steps -->
      <div class="mc-checkout-main">

        <?php if (sizeof($checkout->get_checkout_fields())) : ?>
          <?php do_action('woocommerce_checkout_before_customer_details'); ?>

          <!-- Step 1: Shipping address -->
          <section class="mc-checkout-section" id="mc-step-shipping">
            <h2 class="mc-section-title">
              <span class="mc-step-num">1</span>
              <span class="mc-step-icon" aria-hidden="true">📦</span>
              <?php esc_html_e('Shipping address', 'mug-customizer'); ?>
            </h2>
            <div id="customer_details">
              <div class="mc-checkout-billing">
                <?php do_action('woocommerce_checkout_billing'); ?>
              </div>
              <div class="mc-checkout-shipping">
                <?php do_action('woocommerce_checkout_shipping'); ?>
              </div>
            </div>
          </section>

          <?php do_action('woocommerce_checkout_after_customer_details'); ?>
        <?php endif; ?>

        <!-- Step 2: Payment method -->
        <section class="mc-checkout-section" id="mc-step-payment">
          <h2 class="mc-section-title">
            <span class="mc-step-num">2</span>
            <span class="mc-step-icon" aria-hidden="true">💳</span>
            <?php esc_html_e('Payment method', 'mug-customizer'); ?>
          </h2>

          <!-- Inline trust strip — reassurance right at payment decision point -->
          <div class="mc-pay-trust">
            <span class="mc-brand visa">VISA</span>
            <span class="mc-brand mc">MC</span>
            <span class="mc-brand amex">AMEX</span>
            <span class="mc-brand paypal">PayPal</span>
            <span class="mc-pay-trust-text">
              <span aria-hidden="true">🔒</span>
              <?php esc_html_e('Encrypted &amp; secure', 'mug-customizer'); ?>
            </span>
          </div>

          <?php do_action('woocommerce_checkout_before_order_review'); ?>

          <!-- Render ONLY the payment block + place order button, NOT the
               full review-order table (which would duplicate the right-rail
               summary). woocommerce_checkout_payment() outputs <div id="payment">
               with gateways + terms + place_order + nonce — exactly what we need. -->
          <div id="order_review" class="woocommerce-checkout-review-order">
            <?php woocommerce_checkout_payment(); ?>
          </div>

          <?php do_action('woocommerce_checkout_after_order_review'); ?>
        </section>

        <!-- Step 3: Review extras (coupon + notes) -->
        <section class="mc-checkout-section" id="mc-step-extras">
          <h2 class="mc-section-title">
            <span class="mc-step-num">3</span>
            <span class="mc-step-icon" aria-hidden="true">✨</span>
            <?php esc_html_e('Add a touch (optional)', 'mug-customizer'); ?>
          </h2>

          <!-- Coupon code — collapsible to keep the section clean -->
          <details class="mc-checkout-collapsible">
            <summary>
              <span aria-hidden="true">🏷️</span>
              <?php esc_html_e('Have a promo code?', 'mug-customizer'); ?>
            </summary>
            <div class="mc-checkout-coupon-row">
              <input type="text" name="coupon_code" id="checkout_coupon_code" class="mc-checkout-coupon-input" placeholder="<?php esc_attr_e('Enter code', 'mug-customizer'); ?>" autocomplete="off">
              <button type="submit" name="apply_coupon" value="<?php esc_attr_e('Apply', 'mug-customizer'); ?>" class="mc-checkout-coupon-apply"><?php esc_html_e('Apply', 'mug-customizer'); ?></button>
            </div>
            <?php
            $applied = WC()->cart->get_applied_coupons();
            if (!empty($applied)) : ?>
              <div class="mc-checkout-applied">
                <?php foreach ($applied as $code) : ?>
                  <span class="mc-checkout-applied-pill">
                    <?php echo esc_html(strtoupper($code)); ?>
                    <a href="<?php echo esc_url(wc_get_cart_remove_coupon_url($code)); ?>" aria-label="<?php esc_attr_e('Remove coupon', 'mug-customizer'); ?>">×</a>
                  </span>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </details>

          <!-- Order notes — gift message / delivery instructions -->
          <details class="mc-checkout-collapsible">
            <summary>
              <span aria-hidden="true">🎁</span>
              <?php esc_html_e('Add a gift note or delivery instructions', 'mug-customizer'); ?>
            </summary>
            <textarea name="order_comments" id="order_comments" rows="3" class="mc-checkout-notes" placeholder="<?php esc_attr_e('e.g., Happy Birthday Mom! / Leave at front door', 'mug-customizer'); ?>"><?php echo esc_textarea($checkout->get_value('order_comments')); ?></textarea>
          </details>
        </section>

      </div><!-- /.mc-checkout-main -->

      <!-- RIGHT: sticky order summary -->
      <aside class="mc-checkout-rail">
        <div class="mc-rail-head-row">
          <h3 class="mc-rail-heading"><?php esc_html_e('Order summary', 'mug-customizer'); ?></h3>
          <a href="<?php echo esc_url(wc_get_cart_url()); ?>" class="mc-rail-edit">
            <?php esc_html_e('← Edit cart', 'mug-customizer'); ?>
          </a>
        </div>

        <div class="mc-rail-items">
          <?php foreach (WC()->cart->get_cart() as $cart_item_key => $cart_item) :
            $product   = apply_filters('woocommerce_cart_item_product', $cart_item['data'], $cart_item, $cart_item_key);
            if (!$product || !$product->exists() || $cart_item['quantity'] <= 0) continue;
            $name      = apply_filters('woocommerce_cart_item_name', $product->get_name(), $cart_item, $cart_item_key);
            $thumbnail = apply_filters('woocommerce_cart_item_thumbnail', $product->get_image('woocommerce_thumbnail'), $cart_item, $cart_item_key);
            // v2.0.7: file-based preview only; never inline data URL.
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

        <!-- Estimated delivery — reinforces the cart-page promise -->
        <div class="mc-rail-eta">
          <span class="mc-eta-icon" aria-hidden="true">🚚</span>
          <span class="mc-eta-text">
            <?php esc_html_e('Estimated delivery by', 'mug-customizer'); ?>
            <strong><?php echo esc_html($ship_eta); ?></strong>
          </span>
        </div>

      </aside>

    </div><!-- /.mc-checkout-grid -->

  </form>

  <?php do_action('woocommerce_after_checkout_form', $checkout); ?>
</div>
