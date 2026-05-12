<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Cart_Handler {

    public function init(): void {
        // Cart
        add_filter('woocommerce_add_cart_item_data',            [$this, 'add_cart_item_data'], 10, 3);
        add_filter('woocommerce_get_item_data',                  [$this, 'display_cart_item_data'], 10, 2);

        // Order
        add_action('woocommerce_checkout_create_order_line_item', [$this, 'save_order_item_meta'], 10, 4);

        // Admin display (order detail page — line items table)
        add_action('woocommerce_admin_order_item_headers',        [$this, 'add_order_item_header']);
        add_action('woocommerce_admin_order_item_values',          [$this, 'display_order_item_values'], 10, 3);

        // Admin display (orders LIST — quick visual scan)
        // Legacy CPT-based orders + HPOS (HPOS uses different hooks).
        add_filter('manage_edit-shop_order_columns',                              [$this, 'add_order_list_column'], 20);
        add_action('manage_shop_order_posts_custom_column',                       [$this, 'render_order_list_column'], 10, 2);
        add_filter('manage_woocommerce_page_wc-orders_columns',                   [$this, 'add_order_list_column'], 20);
        add_action('manage_woocommerce_page_wc-orders_custom_column',             [$this, 'render_order_list_column_hpos'], 10, 2);

        // Customer & admin emails — replace WC product image with our preview
        // and append a Print File download link (admin emails only).
        add_filter('woocommerce_order_item_thumbnail',                           [$this, 'replace_email_thumbnail'], 10, 2);
        add_action('woocommerce_email_after_order_table',                         [$this, 'email_print_file_link'], 10, 4);

        // Add-on pricing
        add_action('woocommerce_cart_calculate_fees',              [$this, 'add_addon_fees']);

        // Override default WC cart template with our Zazzle-styled version
        add_filter('woocommerce_locate_template',                   [$this, 'override_cart_template'], 10, 3);

        // Enqueue cart-page styles only on cart screen
        add_action('wp_enqueue_scripts',                            [$this, 'enqueue_cart_assets']);
    }

    public function override_cart_template(string $template, string $template_name, string $template_path): string {
        $overrides = [
            'cart/cart.php'              => MUG_CUSTOMIZER_PLUGIN_DIR . 'templates/woocommerce/cart/cart.php',
            'checkout/form-checkout.php' => MUG_CUSTOMIZER_PLUGIN_DIR . 'templates/woocommerce/checkout/form-checkout.php',
        ];
        if (isset($overrides[$template_name]) && file_exists($overrides[$template_name])) {
            return $overrides[$template_name];
        }
        return $template;
    }

    public function enqueue_cart_assets(): void {
        if (!function_exists('is_cart') && !function_exists('is_checkout')) return;
        $on_cart_or_checkout = (function_exists('is_cart') && is_cart())
            || (function_exists('is_checkout') && is_checkout());
        if (!$on_cart_or_checkout) return;
        wp_enqueue_style(
            'mug-customizer-cart',
            MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/cart.css',
            ['woocommerce-general'],
            MUG_CUSTOMIZER_VERSION
        );
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

    // Print file generation moved to cart-add time (REST /cart/add saves
    // print_file.data_url → uploads/mug-designs/print-files/ → preserves URL
    // through to order item meta as _mug_design_json[print_file_url]). The
    // legacy `generate_print_on_processing` Imagick path is no longer wired —
    // the editor's exportPrintFile() already produces a 300 DPI cropped PNG
    // at the press-required dimensions, so server-side re-rendering would
    // just round-trip the same image.

    // ── Admin order detail (item rows) ────────────────────────────────────────

    public function add_order_item_header(WC_Order $order): void {
        echo '<th class="mug-design-col" style="min-width:220px;">Custom Design</th>';
    }

    public function display_order_item_values($product, $item, $order_or_item_id = null): void {
        // WC's `woocommerce_admin_order_item_values` action passes
        // (WC_Product|null, WC_Order_Item, int order_item_id) — the 3rd arg is
        // an integer, NOT a WC_Order. Older / 3rd-party callers vary, so the
        // signature is untyped here to stay compatible.
        if (! $item instanceof WC_Order_Item) return;
        $design_json = $item->get_meta('_mug_design_json');
        if (! $design_json) {
            echo '<td>—</td>';
            return;
        }

        $storage  = new Mug_Customizer_Design_Storage();
        $design   = $storage->decode($design_json);
        $variant  = is_array($design) ? ($design['variant'] ?? []) : (json_decode($item->get_meta('_mug_variant') ?? '{}', true) ?: []);
        $addons   = is_array($design) ? ($design['addons']  ?? []) : (json_decode($item->get_meta('_mug_addons')  ?? '[]', true) ?: []);

        echo '<td class="mug-design-meta" style="vertical-align:top;">';

        // Visual preview FIRST so admin can verify before reading details
        if (is_array($design) && !empty($design['preview_url'])) {
            echo '<a href="' . esc_url($design['preview_url']) . '" target="_blank" rel="noopener" style="display:inline-block;margin-bottom:8px;">';
            echo '<img src="' . esc_url($design['preview_url']) . '" alt="Design preview" style="width:140px;height:140px;object-fit:cover;border:1px solid #dcdcde;border-radius:6px;background:#f6f7f7;">';
            echo '</a>';
        }

        if (is_array($design)) {
            $canvas = is_string($design['canvas_json'] ?? '') ? json_decode($design['canvas_json'], true) : ($design['canvas_json'] ?? []);
            foreach ($canvas['objects'] ?? [] as $obj) {
                if (in_array($obj['type'] ?? '', ['IText', 'Textbox', 'i-text', 'textbox'], true)) {
                    echo '<div><strong>Text:</strong> ' . esc_html($obj['text'] ?? '') . '</div>';
                }
                if (in_array(strtolower($obj['type'] ?? ''), ['image'], true)) {
                    echo '<div><strong>Image:</strong> Customer uploaded</div>';
                }
            }
        }

        if (!empty($variant)) {
            echo '<div><strong>Style:</strong> ' . esc_html(($variant['style'] ?? '') . ' · ' . ($variant['size'] ?? '') . ' · ' . ($variant['color'] ?? '')) . '</div>';
        }

        if (!empty($addons)) {
            echo '<div><strong>Add-ons:</strong> ' . esc_html(implode(', ', (array) $addons)) . '</div>';
        }

        // 300 DPI production print file — saved at cart-add time
        if (is_array($design) && !empty($design['print_file_url'])) {
            $dims = $design['print_file_dims'] ?? null;
            $dim_label = $dims
                ? sprintf(' (%s″ × %s″ @ %d DPI)', $dims['w_in'], $dims['h_in'], $dims['dpi'])
                : '';
            echo '<div style="margin-top:8px;">';
            echo '<a href="' . esc_url($design['print_file_url']) . '" download class="button button-primary" target="_blank" rel="noopener">';
            echo '⬇ Download Print File' . esc_html($dim_label);
            echo '</a>';
            echo '</div>';
        } else {
            echo '<div style="margin-top:8px;color:#b32d2e;"><em>Print file unavailable — design may pre-date v2.1.0.</em></div>';
        }

        echo '</td>';
    }

    // ── Admin orders LIST (column with thumbnail) ─────────────────────────────

    public function add_order_list_column(array $columns): array {
        // Insert "Design" column right after order-status, before order-date
        $new = [];
        foreach ($columns as $key => $label) {
            $new[$key] = $label;
            if ($key === 'order_status') {
                $new['mug_design'] = __('Design', 'mug-customizer');
            }
        }
        // Fallback: if order_status not present, append before the end
        if (! isset($new['mug_design'])) {
            $new['mug_design'] = __('Design', 'mug-customizer');
        }
        return $new;
    }

    public function render_order_list_column(string $column, int $post_id): void {
        if ($column !== 'mug_design') return;
        $order = wc_get_order($post_id);
        if (! $order) { echo '—'; return; }
        echo $this->order_first_design_thumb_html($order);
    }

    public function render_order_list_column_hpos(string $column, $order): void {
        if ($column !== 'mug_design') return;
        if (! $order instanceof WC_Order) return;
        echo $this->order_first_design_thumb_html($order);
    }

    private function order_first_design_thumb_html(WC_Order $order): string {
        $count = 0;
        $first_url = '';
        foreach ($order->get_items() as $item) {
            $design_json = $item->get_meta('_mug_design_json');
            if (! $design_json) continue;
            $count++;
            if ($first_url) continue;
            $storage = new Mug_Customizer_Design_Storage();
            $design  = $storage->decode($design_json);
            if (is_array($design) && !empty($design['preview_url'])) {
                $first_url = $design['preview_url'];
            }
        }
        if (! $first_url) return '—';
        $extra_label = ($count > 1) ? ' <span style="color:#646970;">+' . ($count - 1) . '</span>' : '';
        return '<img src="' . esc_url($first_url) . '" alt="" style="width:48px;height:48px;object-fit:cover;border-radius:4px;vertical-align:middle;border:1px solid #dcdcde;">' . $extra_label;
    }

    // ── Email integration ─────────────────────────────────────────────────────
    //
    // WC's default order-items table renders the product's featured image as
    // each item's thumbnail. For mug orders this would be the placeholder.
    // We swap it for the design preview so customer + admin emails show the
    // actual customised mug. Works in BOTH HTML email and the order-received
    // page (same filter is used).
    public function replace_email_thumbnail(string $thumbnail, $item): string {
        if (! is_object($item) || ! method_exists($item, 'get_meta')) return $thumbnail;
        $design_json = $item->get_meta('_mug_design_json');
        if (! $design_json) return $thumbnail;
        $storage = new Mug_Customizer_Design_Storage();
        $design  = $storage->decode($design_json);
        if (! is_array($design) || empty($design['preview_url'])) return $thumbnail;
        return '<img src="' . esc_url($design['preview_url']) . '" alt="" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #e5e7eb;">';
    }

    // Admin email (new-order notification): append a print-file download link
    // section after the items table so the production team can grab files
    // straight from the email. Customer emails do NOT get this link.
    public function email_print_file_link($order, $sent_to_admin, $plain_text, $email): void {
        if (! $sent_to_admin || $plain_text) return;
        if (! $order instanceof WC_Order)    return;

        $rows = [];
        foreach ($order->get_items() as $item) {
            $design_json = $item->get_meta('_mug_design_json');
            if (! $design_json) continue;
            $storage = new Mug_Customizer_Design_Storage();
            $design  = $storage->decode($design_json);
            if (! is_array($design) || empty($design['print_file_url'])) continue;

            $variant = $design['variant'] ?? [];
            $dims    = $design['print_file_dims'] ?? null;
            $rows[]  = sprintf(
                '<tr><td style="padding:6px;border-bottom:1px solid #e5e7eb;">%s — <em>%s · %s · %s</em></td><td style="padding:6px;border-bottom:1px solid #e5e7eb;text-align:right;"><a href="%s" download>⬇ Print file%s</a></td></tr>',
                esc_html($item->get_name()),
                esc_html($variant['style'] ?? ''),
                esc_html($variant['size']  ?? ''),
                esc_html($variant['color'] ?? ''),
                esc_url($design['print_file_url']),
                $dims ? sprintf(' (%s″×%s″, %d DPI)', $dims['w_in'], $dims['h_in'], $dims['dpi']) : ''
            );
        }
        if (! $rows) return;

        echo '<h2 style="margin-top:24px;">Production Print Files</h2>';
        echo '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;font-size:14px;">';
        echo implode('', $rows);
        echo '</table>';
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
