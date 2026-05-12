<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Mockup_Manager {

    public function init(): void {
        add_action('add_meta_boxes',  [$this, 'add_product_meta_box']);
        add_action('save_post',       [$this, 'save_product_meta'], 10, 2);
    }

    // ── Product meta box ──────────────────────────────────────────────────────

    public function add_product_meta_box(): void {
        add_meta_box(
            'mug_mockup_images',
            __('Mug Mockup Images & Configuration', 'mug-customizer'),
            [$this, 'render_meta_box'],
            'product',
            'normal',
            'default'
        );
    }

    public function render_meta_box(WP_Post $post): void {
        wp_nonce_field('mug_customizer_meta', 'mug_customizer_nonce');

        $resolver     = new Mug_Customizer_Variant_Resolver();
        $mockup_map   = $resolver->get_mockup_map($post->ID);
        $print_config = $resolver->get_print_area_config($post->ID);
        $addon_prices = $resolver->get_addon_prices($post->ID);

        $styles = ['classic', 'travel', 'espresso', 'two-tone'];
        $sizes  = ['11oz', '15oz', '20oz'];
        $colors = ['black', 'white', 'red', 'blue', 'green'];
        // 7 angles — must match the PDP image gallery + editor + preview modal.
        // Variant key pattern: {style}-{size}-{color}-{angle} (all lowercase, hyphen-separated).
        $angles = ['front', 'front-left', 'front-right', 'left', 'right', 'handle', 'lifestyle'];

        echo '<div class="mug-customizer-metabox">';

        // Mockup image grid
        echo '<h3>' . esc_html__('Mockup Images (PNG per variant)', 'mug-customizer') . '</h3>';
        echo '<p class="description">' . esc_html__('Upload a transparent-background PNG for each variant. Filename convention: {style}-{size}-{color}-{angle}.png', 'mug-customizer') . '</p>';
        echo '<table class="widefat mug-mockup-table"><thead><tr><th>Variant Key</th><th>Current Image</th><th>Upload</th></tr></thead><tbody>';

        foreach ($styles as $style) {
            foreach ($colors as $color) {
                foreach ($angles as $angle) {
                    $key     = "{$style}-11oz-{$color}-{$angle}";
                    $current = $mockup_map[$key] ?? '';
                    echo '<tr class="mug-mockup-item">';
                    echo '<td><code>' . esc_html($key) . '</code></td>';
                    echo '<td>';
                    if ($current) {
                        echo '<img class="mockup-preview" src="' . esc_url($current) . '" style="height:60px;width:auto;">';
                        echo '<span class="mug-mockup-placeholder" style="display:none;color:#999;">No image</span>';
                    } else {
                        echo '<img class="mockup-preview" src="" style="height:60px;width:auto;display:none;">';
                        echo '<span class="mug-mockup-placeholder" style="color:#999;">No image</span>';
                    }
                    echo '</td>';
                    echo '<td>';
                    echo '<input type="hidden" name="mug_mockup_url[' . esc_attr($key) . ']" value="' . esc_url($current) . '" class="mockup-url-input">';
                    echo '<button type="button" class="button btn-upload-mockup" data-variant-key="' . esc_attr($key) . '">' . esc_html__('Select PNG', 'mug-customizer') . '</button>';
                    echo '</td>';
                    echo '</tr>';
                }
            }
        }

        echo '</tbody></table>';

        // Visual Print Area Editor
        echo '<h3 style="margin-top:20px;">' . esc_html__('Print Area — Visual Editor', 'mug-customizer') . '</h3>';
        echo '<p class="description">' . esc_html__('Upload a front PNG for each style, then drag the orange box to set the exact print area. Resize using the corner handle.', 'mug-customizer') . '</p>';

        foreach ($styles as $style) {
            $area      = $print_config[$style] ?? ['top' => 22, 'left' => 18, 'width' => 64, 'height' => 56];
            $front_key = "{$style}-11oz-black-front";
            $png_url   = $mockup_map[$front_key] ?? '';

            echo '<div class="mug-pae-editor" data-style="' . esc_attr($style) . '">';
            echo '<h4>' . esc_html(ucfirst(str_replace('-', ' ', $style))) . '</h4>';
            echo '<div class="mug-pae-wrap">';

            // Visual canvas
            $bg_style = $png_url ? 'background-image:url(' . esc_url($png_url) . ');' : '';
            echo '<div class="mug-pae-canvas" style="' . esc_attr($bg_style) . '">';
            echo '<div class="mug-pae-box" style="'
                . 'top:'    . esc_attr($area['top'])    . '%%;'
                . 'left:'   . esc_attr($area['left'])   . '%%;'
                . 'width:'  . esc_attr($area['width'])  . '%%;'
                . 'height:' . esc_attr($area['height']) . '%%;">';
            echo '<span class="mug-pae-label">' . esc_html__('Print Area', 'mug-customizer') . '</span>';
            echo '<div class="mug-pae-handle"></div>';
            echo '</div>';
            echo '</div>';

            // Coordinate inputs
            echo '<div class="mug-pae-coords">';
            foreach (['top', 'left', 'width', 'height'] as $prop) {
                echo '<label class="mug-pae-coord-row">';
                echo '<span>' . esc_html(ucfirst($prop)) . '</span>';
                echo '<input type="number" '
                    . 'class="mug-pae-input mug-pae-' . esc_attr($prop) . '" '
                    . 'name="print_area[' . esc_attr($style) . '][' . esc_attr($prop) . ']" '
                    . 'value="' . esc_attr($area[$prop]) . '" '
                    . 'min="0" max="100">';
                echo '<span>%</span>';
                echo '</label>';
            }
            echo '<p class="mug-pae-hint">↔ Drag to move &nbsp; ◢ Corner to resize</p>';
            echo '</div>';

            echo '</div>'; // .mug-pae-wrap
            echo '</div>'; // .mug-pae-editor
        }

        // Add-on prices
        echo '<h3 style="margin-top:20px;">' . esc_html__('Add-on Prices (USD)', 'mug-customizer') . '</h3>';
        echo '<table class="widefat"><thead><tr><th>Add-on</th><th>Price ($)</th></tr></thead><tbody>';
        foreach (['lid' => 'Lid', 'gift_box' => 'Gift Box'] as $key => $label) {
            $price = $addon_prices[$key] ?? 0;
            echo '<tr><td>' . esc_html($label) . '</td><td><input type="number" name="addon_prices[' . esc_attr($key) . ']" value="' . esc_attr($price) . '" min="0" step="0.01" style="width:80px;"></td></tr>';
        }
        echo '</tbody></table>';
        echo '</div>';
    }

    public function save_product_meta(int $post_id, WP_Post $post): void {
        if (
            ! isset($_POST['mug_customizer_nonce']) ||
            ! wp_verify_nonce($_POST['mug_customizer_nonce'], 'mug_customizer_meta') ||
            $post->post_type !== 'product' ||
            defined('DOING_AUTOSAVE') && DOING_AUTOSAVE
        ) {
            return;
        }

        if (isset($_POST['mug_mockup_url'])) {
            $map = array_map('esc_url_raw', (array) $_POST['mug_mockup_url']);
            update_post_meta($post_id, '_variant_mockup_map', wp_json_encode($map));
        }

        if (isset($_POST['print_area'])) {
            $areas = [];
            foreach ((array) $_POST['print_area'] as $style => $vals) {
                $areas[sanitize_key($style)] = [
                    'top'    => (int) ($vals['top']    ?? 22),
                    'left'   => (int) ($vals['left']   ?? 18),
                    'width'  => (int) ($vals['width']  ?? 64),
                    'height' => (int) ($vals['height'] ?? 56),
                ];
            }
            update_post_meta($post_id, '_print_area_config', wp_json_encode($areas));
        }

        if (isset($_POST['addon_prices'])) {
            $prices = [];
            foreach ((array) $_POST['addon_prices'] as $key => $val) {
                $prices[sanitize_key($key)] = round((float) $val, 2);
            }
            update_post_meta($post_id, '_addon_prices', wp_json_encode($prices));
        }
    }

    // ── Standalone admin page ─────────────────────────────────────────────────

    public function render_admin_page(): void {
        echo '<div class="wrap">';
        echo '<h1>' . esc_html__('Mug Mockup Images', 'mug-customizer') . '</h1>';
        echo '<p>' . esc_html__('To manage mockup images for a product, edit the product and look for the "Mug Mockup Images & Configuration" meta box.', 'mug-customizer') . '</p>';

        // List all variable products with mockup maps
        $products = wc_get_products(['type' => 'variable', 'limit' => 50]);
        if (empty($products)) {
            echo '<p>' . esc_html__('No variable products found. Create a Variable Product first.', 'mug-customizer') . '</p>';
        } else {
            echo '<table class="widefat"><thead><tr><th>Product</th><th>Mockups Assigned</th><th>Action</th></tr></thead><tbody>';
            foreach ($products as $product) {
                $resolver = new Mug_Customizer_Variant_Resolver();
                $map      = $resolver->get_mockup_map($product->get_id());
                echo '<tr>';
                echo '<td>' . esc_html($product->get_name()) . '</td>';
                echo '<td>' . count($map) . ' images</td>';
                echo '<td><a href="' . esc_url(get_edit_post_link($product->get_id())) . '" class="button">Edit Product</a></td>';
                echo '</tr>';
            }
            echo '</tbody></table>';
        }
        echo '</div>';
    }
}
