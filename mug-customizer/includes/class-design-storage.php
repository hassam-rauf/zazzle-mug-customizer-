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

    /**
     * Decode a data URL (e.g. "data:image/png;base64,...") and persist it as a
     * PNG file in `uploads/mug-designs/`. Returns the public URL on success
     * or WP_Error on failure.
     */
    public function save_preview_from_data_url(string $data_url) {
        if (strpos($data_url, 'data:image/') !== 0) {
            return new WP_Error('bad_data_url', 'Not a valid image data URL.');
        }

        $comma = strpos($data_url, ',');
        if ($comma === false) {
            return new WP_Error('malformed_data_url', 'Data URL is malformed.');
        }
        $base64 = substr($data_url, $comma + 1);
        $binary = base64_decode($base64, true);
        if ($binary === false) {
            return new WP_Error('decode_failed', 'Failed to decode image data.');
        }

        // Cap at ~6 MB to keep storage sane
        if (strlen($binary) > 6 * 1024 * 1024) {
            return new WP_Error('too_large', 'Preview image too large.');
        }

        $upload  = wp_upload_dir();
        $sub_dir = '/' . MUG_CUSTOMIZER_UPLOAD_DIR . '/previews';
        $dir     = $upload['basedir'] . $sub_dir;
        $url_dir = $upload['baseurl'] . $sub_dir;
        wp_mkdir_p($dir);

        // The parent `mug-designs/.htaccess` denies all HTTP access to protect
        // raw design JSON / print files. Cart thumbnails LIVE inside this tree
        // (`mug-designs/previews/*.png`) so we must re-allow PNG fetches at the
        // subdirectory level. Idempotent — only writes if missing.
        $allow_htaccess = $dir . '/.htaccess';
        if (! file_exists($allow_htaccess)) {
            file_put_contents(
                $allow_htaccess,
                "<Files *.png>\n"
                . "  Order allow,deny\n"
                . "  Allow from all\n"
                . "  Require all granted\n"
                . "</Files>\n"
            );
        }

        $hash     = substr(md5($binary), 0, 12);
        $filename = 'preview-' . $hash . '-' . time() . '.png';
        $path     = $dir . '/' . $filename;

        if (file_put_contents($path, $binary) === false) {
            return new WP_Error('write_failed', 'Could not write preview file.');
        }

        return $url_dir . '/' . $filename;
    }

    /**
     * Persist the high-resolution print-ready PNG (300 DPI, cropped to print
     * area) produced by the editor's `exportPrintFile()`. Returned by the
     * REST `/cart/add` endpoint at cart-add time so the press team can
     * download the production file directly from the order screen.
     *
     * Saved to `uploads/mug-designs/print-files/<hash>-<ts>.png`. Print files
     * can exceed the 6 MB preview cap — we allow up to 15 MB.
     */
    public function save_print_file_from_data_url(string $data_url) {
        if (strpos($data_url, 'data:image/') !== 0) {
            return new WP_Error('bad_data_url', 'Not a valid image data URL.');
        }

        $comma = strpos($data_url, ',');
        if ($comma === false) {
            return new WP_Error('malformed_data_url', 'Data URL is malformed.');
        }
        $base64 = substr($data_url, $comma + 1);
        $binary = base64_decode($base64, true);
        if ($binary === false) {
            return new WP_Error('decode_failed', 'Failed to decode print file data.');
        }

        if (strlen($binary) > 15 * 1024 * 1024) {
            return new WP_Error('too_large', 'Print file too large.');
        }

        $upload  = wp_upload_dir();
        $sub_dir = '/' . MUG_CUSTOMIZER_UPLOAD_DIR . '/print-files';
        $dir     = $upload['basedir'] . $sub_dir;
        $url_dir = $upload['baseurl'] . $sub_dir;
        wp_mkdir_p($dir);

        // Same .htaccess pattern as previews — parent denies, we re-allow PNG.
        // Hashes in filenames make URLs effectively unguessable; for tighter
        // production security a capability-checked download endpoint should
        // serve these files instead of direct Apache delivery (TODO).
        $allow_htaccess = $dir . '/.htaccess';
        if (! file_exists($allow_htaccess)) {
            file_put_contents(
                $allow_htaccess,
                "<Files *.png>\n"
                . "  Order allow,deny\n"
                . "  Allow from all\n"
                . "  Require all granted\n"
                . "</Files>\n"
            );
        }

        $hash     = substr(md5($binary), 0, 12);
        $filename = 'print-' . $hash . '-' . time() . '.png';
        $path     = $dir . '/' . $filename;

        if (file_put_contents($path, $binary) === false) {
            return new WP_Error('write_failed', 'Could not write print file.');
        }

        return $url_dir . '/' . $filename;
    }
}
