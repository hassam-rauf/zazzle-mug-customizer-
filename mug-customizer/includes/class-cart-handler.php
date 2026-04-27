<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Cart_Handler {

    public function init(): void {
        // Cart
        add_filter('woocommerce_add_cart_item_data',            [$this, 'add_cart_item_data'], 10, 3);
        add_filter('woocommerce_get_item_data',                  [$this, 'display_cart_item_data'], 10, 2);

        // Order
        add_action('woocommerce_checkout_create_order_line_item', [$this, 'save_order_item_meta'], 10, 4);
        add_action('woocommerce_order_status_processing',          [$this, 'generate_print_on_processing'], 10, 1);

        // Admin display
        add_action('woocommerce_admin_order_item_headers',        [$this, 'add_order_item_header']);
        add_action('woocommerce_admin_order_item_values',          [$this, 'display_order_item_values'], 10, 3);

        // Email
        add_filter('woocommerce_email_order_items_args',           [$this, 'add_design_to_email'], 10, 2);

        // Add-on pricing
        add_action('woocommerce_cart_calculate_fees',              [$this, 'add_addon_fees']);
    }

    // ── Cart hooks ────────────────────────────────────────────────────────────

    public function add_cart_item_data(array $cart_item_data, int $product_id, int $variation_id): array {
        // Data is injected by REST /cart/add — already present in $cart_item_data
        return $cart_item_data;
    }

    public function display_cart_item_data(array $item_data, array $cart_item): array {
        if (empty($cart_item['_mug_design'])) {
            return $item_data;
        }

        $storage = new Mug_Customizer_Design_Storage();
        $design  = $storage->decode($cart_item['_mug_design']);

        if (is_wp_error($design)) {
            return $item_data;
        }

        // Build display summary
        $texts   = [];
        $has_img = false;

        $canvas_json = is_string($design['canvas_json']) ? json_decode($design['canvas_json'], true) : $design['canvas_json'];
        foreach ($canvas_json['objects'] ?? [] as $obj) {
            if (($obj['type'] ?? '') === 'IText' || ($obj['type'] ?? '') === 'Textbox') {
                $texts[] = '"' . esc_html(substr($obj['text'] ?? '', 0, 30)) . '"';
            }
            if (($obj['type'] ?? '') === 'Image') {
                $has_img = true;
            }
        }

        $summary = implode(', ', $texts);
        if ($has_img) {
            $summary .= ($summary ? ' + ' : '') . 'Custom image';
        }

        if ($summary) {
            $item_data[] = ['name' => 'Custom Design', 'value' => $summary];
        }

        $variant = json_decode($cart_item['_mug_variant'] ?? '{}', true);
        if ($variant) {
            $item_data[] = [
                'name'  => 'Options',
                'value' => sprintf('%s · %s · %s', $variant['style'] ?? '', $variant['size'] ?? '', $variant['color'] ?? ''),
            ];
        }

        return $item_data;
    }

    // ── Order hooks ───────────────────────────────────────────────────────────

    public function save_order_item_meta(WC_Order_Item_Product $item, string $cart_item_key, array $cart_item, WC_Order $order): void {
        if (empty($cart_item['_mug_design'])) {
            return;
        }

        $item->update_meta_data('_mug_design_json',  $cart_item['_mug_design']);
        $item->update_meta_data('_mug_variant',       $cart_item['_mug_variant'] ?? '{}');
        $item->update_meta_data('_mug_addons',        $cart_item['_mug_addons'] ?? '[]');
    }

    public function generate_print_on_processing(int $order_id): void {
        $order = wc_get_order($order_id);
        if (! $order) {
            return;
        }

        $generator = new Mug_Customizer_Print_Generator();

        foreach ($order->get_items() as $item_id => $item) {
            $design_json = $item->get_meta('_mug_design_json');
            if (! $design_json) {
                continue;
            }

            $storage = new Mug_Customizer_Design_Storage();
            $design  = $storage->decode($design_json);
            if (is_wp_error($design)) {
                continue;
            }

            // Export canvas from stored JSON — use canvas_json objects as-is
            // In production, canvas_data_url would be re-rendered; here we use stored data
            $canvas_data = $design['canvas_data_url'] ?? '';
            if (! $canvas_data) {
                continue;
            }

            $result = $generator->generate($order_id, $item_id, $canvas_data, $design['variant'] ?? []);

            if (is_wp_error($result)) {
                error_log('[MugCustomizer] Print generation failed for order ' . $order_id . ': ' . $result->get_error_message());
                // Notify admin
                wp_mail(
                    get_option('admin_email'),
                    '[Mug Customizer] Print file generation failed — Order #' . $order_id,
                    'Print file could not be generated for order #' . $order_id . '. Error: ' . $result->get_error_message() . "\n\nPlease generate manually."
                );
            }
        }
    }

    // ── Admin order display ───────────────────────────────────────────────────

    public function add_order_item_header(WC_Order $order): void {
        echo '<th class="mug-design-col">Custom Design</th>';
    }

    public function display_order_item_values(?WC_Product $product, WC_Order_Item $item, WC_Order $order): void {
        $design_json = $item->get_meta('_mug_design_json');
        if (! $design_json) {
            echo '<td>—</td>';
            return;
        }

        $storage  = new Mug_Customizer_Design_Storage();
        $design   = $storage->decode($design_json);
        $variant  = json_decode($item->get_meta('_mug_variant') ?? '{}', true);
        $addons   = json_decode($item->get_meta('_mug_addons') ?? '[]', true);
        $print_path = $item->get_meta('_mug_print_file');

        echo '<td class="mug-design-meta">';

        if (! is_wp_error($design)) {
            $canvas = is_string($design['canvas_json']) ? json_decode($design['canvas_json'], true) : $design['canvas_json'];
            foreach ($canvas['objects'] ?? [] as $obj) {
                if (in_array($obj['type'] ?? '', ['IText', 'Textbox'], true)) {
                    echo '<div><strong>Text:</strong> ' . esc_html($obj['text'] ?? '') . '</div>';
                }
                if (($obj['type'] ?? '') === 'Image') {
                    echo '<div><strong>Image:</strong> Customer uploaded</div>';
                }
            }
        }

        if ($variant) {
            echo '<div><strong>Style:</strong> ' . esc_html($variant['style'] ?? '') . ' · ' . esc_html($variant['size'] ?? '') . ' · ' . esc_html($variant['color'] ?? '') . '</div>';
        }

        if ($addons) {
            echo '<div><strong>Add-ons:</strong> ' . esc_html(implode(', ', $addons)) . '</div>';
        }

        if ($print_path && file_exists($print_path)) {
            $upload_dir = wp_upload_dir();
            $url        = str_replace($upload_dir['basedir'], $upload_dir['baseurl'], $print_path);
            echo '<div><a href="' . esc_url($url) . '" target="_blank">⬇ Download Print File</a></div>';
        }

        echo '</td>';
    }

    // ── Email ──────────────────────────────────────────────────────────────────

    public function add_design_to_email(array $args, WC_Email $email): array {
        // Email display handled via woocommerce_order_item_meta — meta keys
        // prefixed with _ are hidden by default; show non-private version in email
        return $args;
    }

    // ── Add-on fees ───────────────────────────────────────────────────────────

    public function add_addon_fees(WC_Cart $cart): void {
        foreach ($cart->get_cart() as $cart_item) {
            $addons = json_decode($cart_item['_mug_addons'] ?? '[]', true);
            if (empty($addons)) {
                continue;
            }

            $resolver = new Mug_Customizer_Variant_Resolver();
            $prices   = $resolver->get_addon_prices((int) $cart_item['product_id']);

            foreach ($addons as $addon) {
                $price = $prices[$addon] ?? 0;
                if ($price > 0) {
                    $cart->add_fee(ucfirst(str_replace('_', ' ', $addon)), $price, true);
                }
            }
        }
    }
}
