<?php
defined('ABSPATH') || exit;
/** @var WC_Product $product */
$designer_url = home_url('/mug-designer/?product_id=' . $product->get_id());
?>
<div class="mug-customizer-pdp-cta">
    <a href="<?php echo esc_url($designer_url); ?>" class="button mug-cta-primary">
        <?php esc_html_e('Personalize This Mug →', 'mug-customizer'); ?>
    </a>
    <button type="button" class="button mug-cta-secondary">
        <?php esc_html_e('Choose a Template Instead', 'mug-customizer'); ?>
    </button>
</div>
