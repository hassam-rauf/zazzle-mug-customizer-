<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Rest_Api {

    const NAMESPACE = 'mug-customizer/v1';

    public function init(): void {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes(): void {
        // GET /variants/{product_id}
        register_rest_route(self::NAMESPACE, '/variants/(?P<product_id>\d+)', [
            'methods'             => WP_REST_Server::READABLE,
            'callback'            => [$this, 'get_variants'],
            'permission_callback' => '__return_true',
            'args'                => [
                'product_id' => ['validate_callback' => fn($v) => is_numeric($v)],
            ],
        ]);

        // POST /designs/save
        register_rest_route(self::NAMESPACE, '/designs/save', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'save_design'],
            'permission_callback' => [$this, 'check_nonce'],
        ]);

        // POST /designs/export
        register_rest_route(self::NAMESPACE, '/designs/export', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'export_design'],
            'permission_callback' => [$this, 'check_nonce'],
        ]);

        // POST /cart/add
        register_rest_route(self::NAMESPACE, '/cart/add', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'add_to_cart'],
            'permission_callback' => [$this, 'check_nonce'],
        ]);

        // POST /mockups/upload (admin only)
        register_rest_route(self::NAMESPACE, '/mockups/upload', [
            'methods'             => WP_REST_Server::CREATABLE,
            'callback'            => [$this, 'upload_mockup'],
            'permission_callback' => [$this, 'check_admin'],
        ]);
    }

    // ── Permission callbacks ───────────────────────────────────────────────────

    public function check_nonce(WP_REST_Request $request): bool {
        $nonce = $request->get_header('X-WP-Nonce');
        return (bool) wp_verify_nonce($nonce, 'wp_rest');
    }

    public function check_admin(WP_REST_Request $request): bool {
        return $this->check_nonce($request) && current_user_can('manage_woocommerce');
    }

    // ── Endpoint: GET /variants/{product_id} ──────────────────────────────────

    public function get_variants(WP_REST_Request $request): WP_REST_Response {
        $product_id = (int) $request->get_param('product_id');
        $product    = wc_get_product($product_id);

        if (! $product) {
            return new WP_REST_Response(['code' => 'not_found', 'message' => 'Product not found.'], 404);
        }

        $resolver = new Mug_Customizer_Variant_Resolver();

        return new WP_REST_Response([
            'product_id'      => $product_id,
            'mockup_map'      => $resolver->get_mockup_map($product_id),
            'print_area'      => $resolver->get_print_area_config($product_id),
            'addon_prices'    => $resolver->get_addon_prices($product_id),
        ], 200);
    }

    // ── Endpoint: POST /designs/save ──────────────────────────────────────────

    public function save_design(WP_REST_Request $request): WP_REST_Response {
        $body   = $request->get_json_params();
        $storage = new Mug_Customizer_Design_Storage();

        $validated = $storage->validate($body);
        if (is_wp_error($validated)) {
            return new WP_REST_Response(['code' => $validated->get_error_code(), 'message' => $validated->get_error_message()], 400);
        }

        $encoded   = $storage->encode($body);
        $design_id = 'sess_' . wp_generate_password(12, false);

        if (function_exists('WC') && WC()->session) {
            $product_id = (int) ($body['product_id'] ?? 0);
            WC()->session->set('mug_design_' . $product_id, $encoded);
        }

        return new WP_REST_Response([
            'success'   => true,
            'design_id' => $design_id,
            'saved_at'  => gmdate('c'),
        ], 200);
    }

    // ── Endpoint: POST /designs/export ────────────────────────────────────────

    public function export_design(WP_REST_Request $request): WP_REST_Response {
        $body           = $request->get_json_params();
        $order_id       = (int) ($body['order_id'] ?? 0);
        $order_item_id  = (int) ($body['order_item_id'] ?? 0);
        $canvas_data    = $body['canvas_data_url'] ?? '';
        $variant        = $body['variant'] ?? [];

        if (! $order_id || ! $canvas_data) {
            return new WP_REST_Response(['code' => 'bad_request', 'message' => 'Missing required fields.'], 400);
        }

        $generator = new Mug_Customizer_Print_Generator();
        $result    = $generator->generate($order_id, $order_item_id, $canvas_data, $variant);

        if (is_wp_error($result)) {
            return new WP_REST_Response(['code' => $result->get_error_code(), 'message' => $result->get_error_message()], 500);
        }

        return new WP_REST_Response(array_merge(['success' => true], $result), 200);
    }

    // ── Endpoint: POST /cart/add ──────────────────────────────────────────────

    public function add_to_cart(WP_REST_Request $request): WP_REST_Response {
        $body         = $request->get_json_params();
        $product_id   = (int) ($body['product_id'] ?? 0);
        $variation_id = (int) ($body['variation_id'] ?? 0);
        $quantity     = max(1, (int) ($body['quantity'] ?? 1));
        $design       = $body['design'] ?? [];

        // ── Bootstrap WC cart in REST context ─────────────────────────────────
        // WC() singleton exists, but ->cart and ->session are not initialised on
        // REST requests by default. wc_load_cart() handles all of session +
        // cart + customer setup correctly.
        if (! function_exists('WC') || ! function_exists('wc_get_product')) {
            return new WP_REST_Response(['code' => 'wc_missing', 'message' => 'WooCommerce is not active.'], 500);
        }
        if (function_exists('wc_load_cart')) {
            wc_load_cart();
        }
        if (is_null(WC()->cart)) {
            // Last-ditch fallback for older WC versions
            WC()->frontend_includes();
            if (method_exists(WC(), 'initialize_session')) WC()->initialize_session();
            if (method_exists(WC(), 'initialize_cart'))    WC()->initialize_cart();
        }
        if (is_null(WC()->cart)) {
            return new WP_REST_Response(['code' => 'cart_unavailable', 'message' => 'Cart could not be initialised.'], 500);
        }

        $storage = new Mug_Customizer_Design_Storage();
        $valid   = $storage->validate($design);
        if (is_wp_error($valid)) {
            return new WP_REST_Response(['code' => $valid->get_error_code(), 'message' => $valid->get_error_message()], 400);
        }

        if (! $storage->has_objects($design)) {
            return new WP_REST_Response(['code' => 'empty_design', 'message' => 'Please add at least one design element.'], 400);
        }

        $product = wc_get_product($product_id);
        if (! $product || ! $product->is_purchasable()) {
            return new WP_REST_Response(['code' => 'not_purchasable', 'message' => 'Product is not available.'], 409);
        }

        // Persist the rendered design preview (mug + user design composite)
        // as a PNG file in uploads/. If the file save succeeds we drop the
        // giant base64 from the payload (keeps cart-item meta lean). If it
        // fails (write permission etc.), we KEEP mockup_data_url so the cart
        // template can still render the design inline as `data:` URL.
        if (!empty($design['mockup_data_url'])) {
            $preview_url = $storage->save_preview_from_data_url($design['mockup_data_url']);
            if (!is_wp_error($preview_url)) {
                $design['preview_url'] = $preview_url;
                unset($design['mockup_data_url']);
            } else {
                error_log('[MugCustomizer] preview save failed: ' . $preview_url->get_error_message());
            }
        }

        $cart_item_data = [
            '_mug_design'  => $storage->encode($design),
            '_mug_variant' => wp_json_encode($design['variant'] ?? []),
            '_mug_addons'  => wp_json_encode($design['addons'] ?? []),
        ];

        // Variable products require the attribute map alongside variation_id.
        // Resolve it from the variation object so callers don't have to send it.
        $variation = [];
        if ($variation_id > 0) {
            $variation_obj = wc_get_product($variation_id);
            if ($variation_obj instanceof WC_Product_Variation) {
                $variation = $variation_obj->get_variation_attributes();
            }
        }
        // Fallback: if parent is variable but no variation_id was passed, use
        // the variant payload from the design body and try to find a match.
        if ($product instanceof WC_Product_Variable && empty($variation) && !empty($design['variant'])) {
            $candidates = $product->get_available_variations();
            $needle     = array_change_key_case((array) $design['variant'], CASE_LOWER);
            foreach ($candidates as $cand) {
                $attrs_lc = [];
                foreach ($cand['attributes'] as $k => $v) {
                    // attribute_pa_color → color
                    $key = strtolower(str_replace(['attribute_pa_', 'attribute_'], '', $k));
                    $attrs_lc[$key] = strtolower((string) $v);
                }
                $match = true;
                foreach ($needle as $nk => $nv) {
                    if (!isset($attrs_lc[$nk]) || $attrs_lc[$nk] !== strtolower((string) $nv)) {
                        $match = false; break;
                    }
                }
                if ($match) {
                    $variation_id = (int) $cand['variation_id'];
                    $vobj = wc_get_product($variation_id);
                    if ($vobj instanceof WC_Product_Variation) {
                        $variation = $vobj->get_variation_attributes();
                    }
                    break;
                }
            }
        }

        $cart_item_key = WC()->cart->add_to_cart($product_id, $quantity, $variation_id, $variation, $cart_item_data);

        if (! $cart_item_key) {
            return new WP_REST_Response(['code' => 'cart_error', 'message' => 'Could not add item to cart. (Check that variation attributes match an available variation.)'], 500);
        }

        return new WP_REST_Response([
            'success'       => true,
            'cart_item_key' => $cart_item_key,
            'cart_url'      => wc_get_cart_url(),
            'cart_count'    => WC()->cart->get_cart_contents_count(),
        ], 200);
    }

    // ── Endpoint: POST /mockups/upload ────────────────────────────────────────

    public function upload_mockup(WP_REST_Request $request): WP_REST_Response {
        $product_id  = (int) ($request->get_param('product_id') ?? 0);
        $variant_key = sanitize_text_field($request->get_param('variant_key') ?? '');
        $files       = $request->get_file_params();

        if (! $product_id || ! $variant_key || empty($files['file'])) {
            return new WP_REST_Response(['code' => 'bad_request', 'message' => 'Missing product_id, variant_key, or file.'], 400);
        }

        $file      = $files['file'];
        $mime_type = $file['type'] ?? '';

        if ($mime_type !== 'image/png') {
            return new WP_REST_Response(['code' => 'invalid_type', 'message' => 'Only PNG files are accepted.'], 400);
        }

        $max_bytes = 5 * 1024 * 1024;
        if ($file['size'] > $max_bytes) {
            return new WP_REST_Response(['code' => 'file_too_large', 'message' => 'File must be under 5MB.'], 413);
        }

        // Move file to mug-mockups dir
        $upload_dir  = wp_upload_dir();
        $mockup_dir  = $upload_dir['basedir'] . '/' . MUG_CUSTOMIZER_MOCKUP_DIR . '/';
        $mockup_url  = $upload_dir['baseurl'] . '/' . MUG_CUSTOMIZER_MOCKUP_DIR . '/';

        wp_mkdir_p($mockup_dir);

        $filename    = sanitize_file_name($variant_key . '.png');
        $destination = $mockup_dir . $filename;

        if (! move_uploaded_file($file['tmp_name'], $destination)) {
            return new WP_REST_Response(['code' => 'upload_failed', 'message' => 'Could not save file.'], 500);
        }

        // Update postmeta
        $resolver = new Mug_Customizer_Variant_Resolver();
        $map      = $resolver->get_mockup_map($product_id);
        $map[$variant_key] = $mockup_url . $filename;
        update_post_meta($product_id, '_variant_mockup_map', wp_json_encode($map));

        return new WP_REST_Response([
            'success'     => true,
            'url'         => $mockup_url . $filename,
            'variant_key' => $variant_key,
        ], 200);
    }
}
