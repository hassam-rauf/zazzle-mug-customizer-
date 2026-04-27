# Quickstart: Mug Customizer Plugin Development

**Date**: 2026-04-23  
**Branch**: `001-mug-customizer-plugin`

---

## Prerequisites

- WordPress 6.4+ with WooCommerce 8.0+ installed
- PHP 7.4+ with **Imagick extension** enabled (`php -m | grep imagick`)
- Local dev: LocalWP, XAMPP, or Docker
- Node.js (optional — only if adding build step for JS in V2)

---

## Plugin Setup

```bash
# 1. Clone / copy plugin to WordPress plugins folder
cp -r mug-customizer/ /wp-content/plugins/mug-customizer/

# 2. Activate in WordPress admin
# Dashboard → Plugins → Activate "Mug Customizer"

# 3. Verify Imagick
php -r "echo extension_loaded('imagick') ? 'OK' : 'MISSING';"
```

---

## WooCommerce Product Setup

1. Create a **Variable Product** named "Custom Photo Mug"
2. Add attributes: **Style** (Classic, Travel, Espresso, Two-Tone), **Size** (11oz, 15oz, 20oz), **Color** (Black, White, Red, Blue, Green)
3. Generate variations
4. In product edit page → "Mug Mockups" meta box → upload PNGs per variant

---

## Mockup Image Naming

Drop PNG files in `wp-content/uploads/mug-mockups/` following this convention:

```
{style}-{size}-{color}-{angle}.png

Examples:
  classic-11oz-black-front.png    ← primary (used in PDP + designer)
  classic-11oz-black-back.png
  classic-11oz-white-front.png
  travel-15oz-white-front.png
```

During development: placeholder JPGs from `/images/` auto-used as fallback.

---

## Canvas Print Area Reference

| Style | Canvas Size (px) | Print Area (% of canvas) | Export Size (300 DPI) |
|---|---|---|---|
| Classic 11oz | 244×281 | top:22% left:18% w:64% h:56% | 975×1125px |
| Classic 15oz | 260×310 | top:20% left:18% w:64% h:58% | 1161×1275px |
| Travel | 220×320 | top:18% left:20% w:60% h:62% | 975×1200px |

---

## Key Files Reference

```
mug-customizer/
├── mug-customizer.php              # Plugin bootstrap — edit plugin name/version here
├── includes/
│   ├── class-rest-api.php          # All REST endpoints
│   ├── class-cart-handler.php      # WooCommerce cart/order hooks
│   ├── class-print-generator.php   # Imagick print file creation
│   └── class-variant-resolver.php  # Mockup map lookup
├── public/
│   ├── templates/designer.php      # Designer page template
│   ├── templates/review.php        # Review tab template
│   └── assets/js/canvas-editor.js  # Fabric.js canvas — main designer logic
└── admin/
    └── class-mockup-manager.php    # Admin PNG upload UI
```

---

## Environment Variables / Config

Defined in `mug-customizer.php`:

```php
define('MUG_CUSTOMIZER_VERSION', '1.0.0');
define('MUG_CUSTOMIZER_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('MUG_CUSTOMIZER_UPLOAD_DIR', 'mug-designs');   // inside wp-content/uploads/
define('MUG_CUSTOMIZER_MOCKUP_DIR', 'mug-mockups');   // inside wp-content/uploads/
define('MUG_CUSTOMIZER_MAX_UPLOAD_MB', 10);            // customer image upload limit
define('MUG_CUSTOMIZER_PRINT_MULTIPLIER', 4);          // canvas export multiplier → 300 DPI
```

---

## Testing Checklist (Manual)

- [ ] PDP loads with mug image and variant pills
- [ ] Variant pill click → hero image updates
- [ ] "Personalize This Mug" → designer page loads
- [ ] Add Text → text box appears on canvas within print boundary
- [ ] Upload Image → image appears on canvas, resizable
- [ ] Drag outside print area → element constrained
- [ ] Undo/Redo works (10 steps)
- [ ] "Next: Review" → design preserved on Review tab
- [ ] "Add to Cart" → item in cart with design meta
- [ ] Change Style or Color in designer → mug PNG updates without page reload
- [ ] Admin: WooCommerce → Mug Mockups → upload PNG → assign to variant → frontend shows it
- [ ] Admin order view → design details visible
- [ ] Order email → design summary included
- [ ] Print file generated in `wp-content/uploads/mug-designs/{order_id}/print.png`
