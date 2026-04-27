<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Admin_Menu {

    public function init(): void {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_enqueue_scripts', [$this, 'enqueue_assets']);
    }

    public function register_menu(): void {
        add_submenu_page(
            'woocommerce',
            __('Mug Mockups', 'mug-customizer'),
            __('Mug Mockups', 'mug-customizer'),
            'manage_woocommerce',
            'mug-customizer-mockups',
            [$this, 'render_page']
        );
    }

    public function render_page(): void {
        $manager = new Mug_Customizer_Mockup_Manager();
        $manager->render_admin_page();
    }

    public function enqueue_assets(string $hook): void {
        $allowed_hooks = [
            'woocommerce_page_mug-customizer-mockups',
            'post.php',
            'post-new.php',
        ];

        if (! in_array($hook, $allowed_hooks, true)) {
            return;
        }

        // On product edit screen, only enqueue if it's a variable product
        if (in_array($hook, ['post.php', 'post-new.php'], true)) {
            $post_id = (int) ($_GET['post'] ?? 0);
            if ($post_id && get_post_type($post_id) !== 'product') {
                return;
            }
        }

        wp_enqueue_media();
        wp_enqueue_script(
            'mug-customizer-admin',
            MUG_CUSTOMIZER_PLUGIN_URL . 'admin/assets/js/admin-mockup-upload.js',
            ['jquery'],
            MUG_CUSTOMIZER_VERSION,
            true
        );
        wp_enqueue_style(
            'mug-customizer-admin',
            MUG_CUSTOMIZER_PLUGIN_URL . 'admin/assets/css/admin.css',
            [],
            MUG_CUSTOMIZER_VERSION
        );
    }
}
