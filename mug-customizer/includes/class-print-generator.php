<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Print_Generator {

    // Print dimensions at 300 DPI per size (with bleed)
    private const PRINT_SIZES = [
        '11oz' => ['width' => 1050, 'height' => 1200],
        '15oz' => ['width' => 1240, 'height' => 1350],
        '20oz' => ['width' => 1300, 'height' => 1450],
    ];

    public function generate(int $order_id, int $order_item_id, string $base64_png, array $variant) {
        if (! extension_loaded('imagick')) {
            return new WP_Error('imagick_missing', 'PHP Imagick extension is required for print file generation.');
        }

        // Decode base64 image data
        $base64_clean = preg_replace('#^data:image/\w+;base64,#i', '', $base64_png);
        $image_data   = base64_decode($base64_clean);

        if (! $image_data) {
            return new WP_Error('invalid_image', 'Could not decode canvas image data.');
        }

        // Determine target dimensions
        $size   = strtolower($variant['size'] ?? '11oz');
        $dims   = self::PRINT_SIZES[$size] ?? self::PRINT_SIZES['11oz'];

        // Create output directory
        $upload_dir = wp_upload_dir();
        $order_dir  = $upload_dir['basedir'] . '/' . MUG_CUSTOMIZER_UPLOAD_DIR . '/' . $order_id . '/';
        $order_url  = $upload_dir['baseurl'] . '/' . MUG_CUSTOMIZER_UPLOAD_DIR . '/' . $order_id . '/';

        if (! wp_mkdir_p($order_dir)) {
            return new WP_Error('dir_failed', 'Could not create print file directory.');
        }

        try {
            $im = new Imagick();
            $im->readImageBlob($image_data);
            $im->setImageFormat('png');
            $im->setImageResolution(300, 300);
            $im->resizeImage($dims['width'], $dims['height'], Imagick::FILTER_LANCZOS, 1);
            $im->setImageCompressionQuality(95);

            $print_path = $order_dir . 'print.png';
            $im->writeImage($print_path);
            $im->clear();
            $im->destroy();

            // Generate smaller preview (600×600)
            $preview = new Imagick($print_path);
            $preview->thumbnailImage(600, 600, true);
            $preview->writeImage($order_dir . 'preview.png');
            $preview->clear();
            $preview->destroy();

        } catch (ImagickException $e) {
            error_log('[MugCustomizer] Imagick error for order ' . $order_id . ': ' . $e->getMessage());
            return new WP_Error('imagick_failed', 'Print file generation failed: ' . $e->getMessage());
        }

        // Save print file path to order item meta
        if ($order_item_id) {
            wc_update_order_item_meta($order_item_id, '_mug_print_file', $order_dir . 'print.png');
            wc_update_order_item_meta($order_item_id, '_mug_preview_file', $order_dir . 'preview.png');
        }

        return [
            'print_file_url'  => $order_url . 'print.png',
            'preview_url'     => $order_url . 'preview.png',
            'dimensions'      => array_merge($dims, ['dpi' => 300]),
        ];
    }
}
