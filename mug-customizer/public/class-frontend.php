<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Frontend {

    public function init(): void {
        add_action('wp_enqueue_scripts',       [$this, 'enqueue_assets']);
        add_action('init',                      [$this, 'register_designer_page']);
        add_action('template_redirect',         [$this, 'maybe_load_designer_template']);
        add_shortcode('mug_landing',   [$this, 'render_landing_shortcode']);
        add_shortcode('mug_category',  [$this, 'render_category_shortcode']);
    }

    // ── Asset loading ─────────────────────────────────────────────────────────

    public function enqueue_assets(): void {
        global $post;

        $is_product  = is_product();
        $is_designer = $this->is_designer_page();
        $is_review   = $this->is_review_page();

        // Always load landing/category CSS (shortcodes can appear on any page)
        wp_enqueue_style('mug-customizer-landing', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/landing.css', [], MUG_CUSTOMIZER_VERSION);

        if (is_home() || is_front_page()) {
            wp_enqueue_style('mug-customizer-home', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/home.css', [], MUG_CUSTOMIZER_VERSION);
        }

        if (is_product_category() || is_page('mugs')) {
            wp_enqueue_style('mug-customizer-home', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/home.css', [], MUG_CUSTOMIZER_VERSION);
            wp_enqueue_style('mug-customizer-cat', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/cat.css', ['mug-customizer-home'], MUG_CUSTOMIZER_VERSION);
        }

        if ($is_product) {
            wp_enqueue_style('mug-customizer-pdp', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/pdp.css', [], MUG_CUSTOMIZER_VERSION);
            wp_enqueue_script('mug-customizer-pdp', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/js/pdp.js', [], MUG_CUSTOMIZER_VERSION, true);
            $this->localize_script('mug-customizer-pdp', $post ? $post->ID : 0);
        }

        if ($is_designer) {
            // Fabric.js from CDN
            wp_enqueue_script('fabricjs', 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.0/fabric.min.js', [], '5.3.0', true);
            wp_enqueue_style('mug-customizer-designer', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/designer.css', [], MUG_CUSTOMIZER_VERSION);
            wp_enqueue_script('mug-customizer-canvas', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/js/canvas-editor.js', ['fabricjs'], MUG_CUSTOMIZER_VERSION, true);

            $product_id = (int) ($_GET['product_id'] ?? 0);
            $this->localize_script('mug-customizer-canvas', $product_id);
        }

        if ($is_review) {
            wp_enqueue_style('mug-customizer-designer', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/css/designer.css', [], MUG_CUSTOMIZER_VERSION);
            wp_enqueue_script('mug-customizer-review', MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/js/review.js', [], MUG_CUSTOMIZER_VERSION, true);

            $product_id = (int) ($_GET['product_id'] ?? 0);
            $this->localize_script('mug-customizer-review', $product_id);
        }
    }

    private function localize_script(string $handle, int $product_id): void {
        $resolver   = new Mug_Customizer_Variant_Resolver();
        $mockup_map = $product_id ? $resolver->get_mockup_map($product_id) : [];
        $print_area = $product_id ? $resolver->get_print_area_config($product_id) : [];
        $addon_prices = $product_id ? $resolver->get_addon_prices($product_id) : [];

        wp_localize_script($handle, 'mugCustomizer', [
            'apiRoot'         => esc_url_raw(rest_url('mug-customizer/v1/')),
            'nonce'           => wp_create_nonce('wp_rest'),
            'mockupMap'       => $mockup_map,
            'printAreaConfig' => $print_area,
            'addonPrices'     => $addon_prices,
            'maxUploadMB'     => MUG_CUSTOMIZER_MAX_UPLOAD_MB,
            'cartUrl'         => wc_get_cart_url(),
            'pluginUrl'       => MUG_CUSTOMIZER_PLUGIN_URL,
        ]);
    }

    // ── Designer page ─────────────────────────────────────────────────────────

    public function register_designer_page(): void {
        add_rewrite_rule('^mug-designer/?$', 'index.php?mug_designer_page=1', 'top');
        add_rewrite_rule('^mug-review/?$',   'index.php?mug_review_page=1',   'top');
        add_rewrite_tag('%mug_designer_page%', '1');
        add_rewrite_tag('%mug_review_page%',   '1');
    }

    public function maybe_load_designer_template(): void {
        $uri = $_SERVER['REQUEST_URI'] ?? '';

        if (get_query_var('mug_designer_page') || strpos($uri, 'mug-designer') !== false) {
            include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/designer.php';
            exit;
        }
        if (get_query_var('mug_review_page') || strpos($uri, 'mug-review') !== false) {
            include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/review.php';
            exit;
        }
        if (is_home() || is_front_page()) {
            include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/home-template.php';
            exit;
        }
        if (is_product_category() || is_page('mugs')) {
            include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/cat-template.php';
            exit;
        }
        if (is_product()) {
            include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/pdp-template.php';
            exit;
        }
    }

    // ── Shortcodes ────────────────────────────────────────────────────────────

    public function render_landing_shortcode(): string {
        ob_start();
        include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/landing.php';
        return ob_get_clean();
    }

    public function render_category_shortcode(): string {
        ob_start();
        include MUG_CUSTOMIZER_PLUGIN_DIR . 'public/templates/category.php';
        return ob_get_clean();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function is_designer_page(): bool {
        return (bool) get_query_var('mug_designer_page') || (isset($_GET['product_id']) && strpos($_SERVER['REQUEST_URI'] ?? '', 'mug-designer') !== false);
    }

    private function is_review_page(): bool {
        return (bool) get_query_var('mug_review_page') || strpos($_SERVER['REQUEST_URI'] ?? '', 'mug-review') !== false;
    }
}
