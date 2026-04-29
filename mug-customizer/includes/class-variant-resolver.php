<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Variant_Resolver {

    /**
     * Default print-area config keyed by style-size.
     *
     * Coordinates are in NATIVE PNG PIXELS (not percentages), referenced to
     * `pngWidth` × `pngHeight`. Front-side cylindrical wrap is described by
     * `wrapDeg` (visible arc of the cylinder seen in the front photo).
     *
     * Real-world print dimensions live on the JS side (`PRINT_DIMS_IN`) and
     * are independent of pixel calibration; together they drive the DPI check
     * and the production print file size.
     */
    private const DEFAULT_PRINT_AREAS = [
        // Tuned to the bundled placeholder-mug-white.svg (2000x2000 reference)
        'classic-11oz'  => ['x' => 530, 'y' => 760, 'width' => 830, 'height' => 700, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'classic-15oz'  => ['x' => 510, 'y' => 730, 'width' => 870, 'height' => 780, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'travel-11oz'   => ['x' => 560, 'y' => 700, 'width' => 760, 'height' => 800, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 130],
        'travel-15oz'   => ['x' => 540, 'y' => 670, 'width' => 800, 'height' => 860, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 130],
        'espresso-11oz' => ['x' => 560, 'y' => 820, 'width' => 760, 'height' => 600, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'espresso-15oz' => ['x' => 540, 'y' => 790, 'width' => 800, 'height' => 660, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'two-tone-11oz' => ['x' => 530, 'y' => 760, 'width' => 830, 'height' => 700, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'two-tone-15oz' => ['x' => 510, 'y' => 730, 'width' => 870, 'height' => 780, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],

        // Style-only fallbacks (used when size is missing)
        'classic'  => ['x' => 530, 'y' => 760, 'width' => 830, 'height' => 700, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'travel'   => ['x' => 560, 'y' => 700, 'width' => 760, 'height' => 800, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 130],
        'espresso' => ['x' => 560, 'y' => 820, 'width' => 760, 'height' => 600, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
        'two-tone' => ['x' => 530, 'y' => 760, 'width' => 830, 'height' => 700, 'pngWidth' => 2000, 'pngHeight' => 2000, 'wrapDeg' => 140],
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
        // Transparent vector placeholder until the client supplies real PNGs.
        return MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug-white.svg';
    }

    public function get_print_area_config(int $product_id): array {
        $raw = get_post_meta($product_id, '_print_area_config', true);
        if ($raw) {
            $stored = (array) json_decode($raw, true);
            // Merge stored values over defaults so missing keys (e.g. new
            // styles) still resolve, and legacy entries can coexist.
            return array_replace(self::DEFAULT_PRINT_AREAS, $stored);
        }
        return self::DEFAULT_PRINT_AREAS;
    }

    public function get_print_area(int $product_id, string $style, string $size = ''): array {
        $config = $this->get_print_area_config($product_id);
        $style  = strtolower($style);
        $size   = strtolower($size);
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
