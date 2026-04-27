<?php
defined('ABSPATH') || exit;

class Mug_Customizer_Design_Storage {

    public function encode(array $design): string {
        return wp_json_encode($design, JSON_UNESCAPED_UNICODE);
    }

    public function decode(string $json) {
        $data = json_decode($json, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return new WP_Error('invalid_json', 'Design data is not valid JSON.');
        }

        $valid = $this->validate($data);
        if (is_wp_error($valid)) {
            return $valid;
        }

        return $data;
    }

    public function validate(array $design) {
        if (empty($design['canvas_json'])) {
            return new WP_Error('missing_canvas', 'canvas_json is required.');
        }

        if (empty($design['variant']['style']) || empty($design['variant']['size']) || empty($design['variant']['color'])) {
            return new WP_Error('missing_variant', 'variant must include style, size, and color.');
        }

        if (empty($design['version'])) {
            return new WP_Error('missing_version', 'version is required.');
        }

        return true;
    }

    public function has_objects(array $design): bool {
        $canvas = $design['canvas_json'] ?? [];
        if (is_string($canvas)) {
            $canvas = json_decode($canvas, true) ?? [];
        }
        $objects = $canvas['objects'] ?? [];
        return count($objects) > 0;
    }
}
