<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Variant_Resolver {

    // Default print area config keyed by style-size (values in % of canvas dimensions)
    // 15oz mugs are taller/wider, so the print area occupies a larger portion of the canvas
    private const DEFAULT_PRINT_AREAS = [
        'classic-11oz'  => ['top' => 22, 'left' => 18, 'width' => 64, 'height' => 56],
        'classic-15oz'  => ['top' => 20, 'left' => 17, 'width' => 66, 'height' => 60],
        'travel-11oz'   => ['top' => 18, 'left' => 20, 'width' => 60, 'height' => 62],
        'travel-15oz'   => ['top' => 16, 'left' => 19, 'width' => 62, 'height' => 66],
        'espresso-11oz' => ['top' => 24, 'left' => 18, 'width' => 62, 'height' => 52],
        'espresso-15oz' => ['top' => 22, 'left' => 17, 'width' => 64, 'height' => 56],
        'two-tone-11oz' => ['top' => 22, 'left' => 18, 'width' => 64, 'height' => 56],
        'two-tone-15oz' => ['top' => 20, 'left' => 17, 'width' => 66, 'height' => 60],
        // Style-only fallbacks (used when size not specified)
        'classic'  => ['top' => 22, 'left' => 18, 'width' => 64, 'height' => 56],
        'travel'   => ['top' => 18, 'left' => 20, 'width' => 60, 'height' => 62],
        'espresso' => ['top' => 24, 'left' => 18, 'width' => 62, 'height' => 52],
        'two-tone' => ['top' => 22, 'left' => 18, 'width' => 64, 'height' => 56],
    ];

    public function get_mockup_map(int $product_id): array {
        $raw = get_post_meta($product_id, '_variant_mockup_map', true);
        return $raw ? (array) json_decode($raw, true) : [];
    }

    public function get_mockup_url(int $product_id, string $variant_key): string {
        $map = $this->get_mockup_map($product_id);
        if (isset($map[$variant_key])) {
            return $map[$variant_key];
        }
        // Fallback placeholder
        return MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png';
    }

    public function get_print_area_config(int $product_id): array {
        $raw = get_post_meta($product_id, '_print_area_config', true);
        if ($raw) {
            return (array) json_decode($raw, true);
        }
        return self::DEFAULT_PRINT_AREAS;
    }

    public function get_print_area(int $product_id, string $style, string $size = ''): array {
        $config = $this->get_print_area_config($product_id);
        $style  = strtolower($style);
        $size   = strtolower($size);
        // Try style-size compound key first, then style-only, then default
        $key = $size ? "{$style}-{$size}" : $style;
        return $config[$key] ?? $config[$style] ?? self::DEFAULT_PRINT_AREAS['classic'];
    }

    public function get_addon_prices(int $product_id): array {
        $raw = get_post_meta($product_id, '_addon_prices', true);
        if ($raw) {
            return (array) json_decode($raw, true);
        }
        return ['lid' => 2.50, 'gift_box' => 4.00];
    }

    public function build_variant_key(string $style, string $size, string $color, string $angle = 'front'): string {
        return strtolower(implode('-', [
            sanitize_title($style),
            sanitize_title($size),
            sanitize_title($color),
            sanitize_title($angle),
        ]));
    }
}
