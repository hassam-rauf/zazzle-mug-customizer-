# Data Model: Mug Customizer Plugin

**Feature**: 001-mug-customizer-plugin  
**Date**: 2026-04-23

---

## Entities

### 1. Mug Product (WordPress Post / WooCommerce Variable Product)

Stored as: `wp_posts` (type: `product`) + `wp_postmeta`

| Field | Storage | Type | Notes |
|---|---|---|---|
| `post_id` | wp_posts.ID | int | WC product ID |
| `_variant_mockup_map` | wp_postmeta | JSON | Lookup: `"{style}-{size}-{color}-{angle}"` → URL |
| `_print_area_config` | wp_postmeta | JSON | Per-style print area: `{top, left, width, height}` in canvas % |
| `_addon_prices` | wp_postmeta | JSON | `{"lid": 2.50, "gift_box": 4.00}` |
| WC attributes | wp_postmeta | WC native | Style, Size, Color as product attributes |

**Variant mockup map example**:
```json
{
  "classic-11oz-black-front": "/wp-content/uploads/mug-mockups/classic-11oz-black-front.png",
  "classic-11oz-black-back":  "/wp-content/uploads/mug-mockups/classic-11oz-black-back.png",
  "classic-11oz-white-front": "/wp-content/uploads/mug-mockups/classic-11oz-white-front.png"
}
```

**Print area config example**:
```json
{
  "classic": { "top": 22, "left": 18, "width": 64, "height": 56 },
  "travel":  { "top": 18, "left": 20, "width": 60, "height": 62 }
}
```
*(values in % relative to canvas dimensions)*

---

### 2. Design (Canvas State)

Stored as: JSON — saved in cart item meta and order item meta

| Field | Type | Notes |
|---|---|---|
| `canvas_json` | JSON (Fabric.js) | Full `canvas.toJSON()` output — contains all objects |
| `variant` | object | `{style, size, color}` |
| `addons` | array | `["lid"]` or `[]` |
| `canvas_width` | int | Canvas width in px at design time |
| `canvas_height` | int | Canvas height in px at design time |
| `version` | string | Schema version `"1.0"` for future migrations |

**canvas_json structure** (Fabric.js standard):
```json
{
  "version": "6.0.0",
  "objects": [
    {
      "type": "IText",
      "text": "Hello World",
      "fontFamily": "Georgia",
      "fontSize": 24,
      "fill": "#222222",
      "left": 120,
      "top": 80,
      "fontWeight": "bold"
    },
    {
      "type": "Image",
      "src": "data:image/png;base64,...",
      "left": 60,
      "top": 40,
      "scaleX": 0.5,
      "scaleY": 0.5
    }
  ]
}
```

---

### 3. Cart Item Meta

Stored as: WooCommerce cart session → `woocommerce_add_cart_item_data` hook

| Meta Key | Type | Value |
|---|---|---|
| `_mug_design` | JSON string | Full Design object (see above) |
| `_mug_variant` | JSON string | `{"style":"classic","size":"11oz","color":"black"}` |
| `_mug_addons` | JSON string | `["lid"]` |

---

### 4. Order Item Meta

Stored as: `woocommerce_order_itemmeta` table  
Hook: `woocommerce_checkout_create_order_line_item`

| Meta Key | Type | Value |
|---|---|---|
| `_mug_design_json` | text | Compressed Design JSON |
| `_mug_variant` | text | Variant config JSON |
| `_mug_addons` | text | Add-ons array JSON |
| `_mug_print_file` | text | Relative path: `mug-designs/{order_id}/print.png` |
| `_mug_design_image` | text | Relative path: `mug-designs/{order_id}/preview.png` |

---

### 5. Mockup Image (Admin-Managed)

Stored as: WordPress attachment + custom meta

| Field | Storage | Notes |
|---|---|---|
| `attachment_id` | wp_posts.ID | WP media library attachment |
| `_mockup_variant_key` | wp_postmeta | `"classic-11oz-black-front"` |
| `_mockup_product_id` | wp_postmeta | Links to product |
| URL | wp_posts.guid | Served directly |

Admin creates mapping: Product → Variant Key → Attachment ID → URL

---

### 6. Print File

Stored as: File in `wp-content/uploads/mug-designs/{order_id}/`

| File | Dimensions | Format | Notes |
|---|---|---|---|
| `print.png` | 1050×1200px | PNG-24 | 300 DPI equivalent, print-ready flat artwork |
| `preview.png` | 600×600px | PNG | Composite: design on mockup, for admin display |

**Generation**: On `woocommerce_checkout_create_order_line_item` → async or immediate via REST API call.

---

## State Transitions

```
Design State:
  EMPTY → IN_PROGRESS (user adds first element)
  IN_PROGRESS → SAVED (auto-save to session)
  SAVED → IN_CART (add to cart)
  IN_CART → ORDERED (checkout complete)
  ORDERED → PRINT_GENERATED (print file created)

Order Item:
  PENDING → PROCESSING (payment confirmed)
  PROCESSING → PRINT_READY (print file generated)
  PRINT_READY → FULFILLED (shipped)
```

---

## Validation Rules

| Rule | Where Enforced |
|---|---|
| Canvas must have ≥1 object before add-to-cart | JS frontend (canvas.getObjects().length) |
| Uploaded images max 10MB | JS FileReader check + PHP MIME validation |
| Allowed upload types: JPG, PNG | PHP server-side validation |
| Design objects must stay within clipPath boundary | Fabric.js clipPath constraint |
| Variant must be fully selected (style+size+color) | JS before enabling "Next: Review" button |
| Print file generated before order marked complete | PHP hook on order status change |
