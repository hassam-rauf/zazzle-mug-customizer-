<?php
/**
 * Plugin Name: Mug Customizer
 * Plugin URI:  https://example.com/mug-customizer
 * Description: Zazzle-like mug customizer for WooCommerce. Shoppers design custom mugs with text and images, then add to cart with 300 DPI print file generation.
 * Version:     1.8.0
 * Author:      Hassam Rauf
 * License:     GPL-2.0+
 * Text Domain: mug-customizer
 * Domain Path: /languages
 * Requires at least: 6.4
 * Requires PHP: 7.4
 * WC requires at least: 8.0
 */

defined('ABSPATH') || exit;

// ── Constants ────────────────────────────────────────────────────────────────
define('MUG_CUSTOMIZER_VERSION',        '2.1.4');
define('MUG_CUSTOMIZER_PLUGIN_FILE',    __FILE__);
define('MUG_CUSTOMIZER_PLUGIN_DIR',     plugin_dir_path(__FILE__));
define('MUG_CUSTOMIZER_PLUGIN_URL',     plugin_dir_url(__FILE__));
define('MUG_CUSTOMIZER_UPLOAD_DIR',     'mug-designs');
define('MUG_CUSTOMIZER_MOCKUP_DIR',     'mug-mockups');
define('MUG_CUSTOMIZER_MAX_UPLOAD_MB',  10);
define('MUG_CUSTOMIZER_PRINT_MULTIPLIER', 4);

// ── Autoloader ───────────────────────────────────────────────────────────────
spl_autoload_register(function (string $class): void {
    $prefix = 'Mug_Customizer_';
    if (strpos($class, $prefix) !== 0) {
        return;
    }

    $relative = strtolower(str_replace('_', '-', substr($class, strlen($prefix))));
    $dirs     = [
        MUG_CUSTOMIZER_PLUGIN_DIR . 'includes/',
        MUG_CUSTOMIZER_PLUGIN_DIR . 'admin/',
        MUG_CUSTOMIZER_PLUGIN_DIR . 'public/',
    ];

    foreach ($dirs as $dir) {
        $file = $dir . 'class-' . $relative . '.php';
        if (file_exists($file)) {
            require_once $file;
            return;
        }
    }
});

// ── Activation / Deactivation ─────────────────────────────────────────────────
register_activation_hook(__FILE__, 'mug_customizer_activate');
register_deactivation_hook(__FILE__, 'mug_customizer_deactivate');

function mug_customizer_activate(): void {
    // Create upload directories
    $upload_base = wp_upload_dir()['basedir'];

    $dirs = [
        $upload_base . '/' . MUG_CUSTOMIZER_UPLOAD_DIR,
        $upload_base . '/' . MUG_CUSTOMIZER_MOCKUP_DIR,
    ];

    foreach ($dirs as $dir) {
        if (! file_exists($dir)) {
            wp_mkdir_p($dir);
        }
    }

    // Protect mug-designs from direct access
    $htaccess = $upload_base . '/' . MUG_CUSTOMIZER_UPLOAD_DIR . '/.htaccess';
    if (! file_exists($htaccess)) {
        file_put_contents($htaccess, "Options -Indexes\nDeny from all\n");
    }

    flush_rewrite_rules();
}

function mug_customizer_deactivate(): void {
    flush_rewrite_rules();
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
add_action('plugins_loaded', 'mug_customizer_init');

function mug_customizer_init(): void {
    if (! class_exists('WooCommerce')) {
        add_action('admin_notices', function () {
            echo '<div class="notice notice-error"><p><strong>Mug Customizer</strong> requires WooCommerce to be installed and active.</p></div>';
        });
        return;
    }

    // Core
    (new Mug_Customizer_Rest_Api())->init();
    (new Mug_Customizer_Cart_Handler())->init();

    // Admin
    if (is_admin()) {
        (new Mug_Customizer_Admin_Menu())->init();
        (new Mug_Customizer_Mockup_Manager())->init();
        (new Mug_Customizer_Order_Meta_Display())->init();
    }

    // Frontend
    if (! is_admin()) {
        (new Mug_Customizer_Frontend())->init();
    }
}
