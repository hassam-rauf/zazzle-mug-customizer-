# REST API Contracts: Mug Customizer Plugin

**Base URL**: `/wp-json/mug-customizer/v1`  
**Auth**: WordPress nonce for all write endpoints (`X-WP-Nonce` header)  
**Date**: 2026-04-23

---

## Endpoints

### 1. GET /variants/{product_id}

Get mockup image map and print area config for a product.

**Request**:
```
GET /wp-json/mug-customizer/v1/variants/123
```

**Response 200**:
```json
{
  "product_id": 123,
  "mockup_map": {
    "classic-11oz-black-front": "https://site.com/wp-content/uploads/mug-mockups/classic-11oz-black-front.png",
    "classic-11oz-white-front": "https://site.com/wp-content/uploads/mug-mockups/classic-11oz-white-front.png"
  },
  "print_area": {
    "classic": { "top": 22, "left": 18, "width": 64, "height": 56 },
    "travel":  { "top": 18, "left": 20, "width": 60, "height": 62 }
  },
  "addon_prices": {
    "lid": 2.50,
    "gift_box": 4.00
  }
}
```

**Errors**:
- `404` — product not found
- `400` — invalid product_id

---

### 2. POST /designs/save

Save design draft to user session (auto-save).

**Request**:
```json
{
  "product_id": 123,
  "canvas_json": { "version": "6.0.0", "objects": [...] },
  "variant": { "style": "classic", "size": "11oz", "color": "black" },
  "addons": ["lid"],
  "canvas_width": 244,
  "canvas_height": 281
}
```

**Response 200**:
```json
{
  "success": true,
  "design_id": "sess_abc123",
  "saved_at": "2026-04-23T10:30:00Z"
}
```

**Errors**:
- `400` — missing required fields
- `413` — canvas_json too large (>2MB)

---

### 3. POST /designs/export

Export design as high-resolution print file. Called on order placement.

**Request**:
```json
{
  "order_id": 456,
  "order_item_id": 789,
  "canvas_data_url": "data:image/png;base64,iVBORw0KGgo...",
  "variant": { "style": "classic", "size": "11oz", "color": "black" },
  "nonce": "abc123xyz"
}
```

**Response 200**:
```json
{
  "success": true,
  "print_file_url": "https://site.com/wp-content/uploads/mug-designs/456/print.png",
  "preview_url": "https://site.com/wp-content/uploads/mug-designs/456/preview.png",
  "dimensions": { "width": 1050, "height": 1200, "dpi": 300 }
}
```

**Errors**:
- `400` — invalid base64 or missing fields
- `403` — invalid nonce
- `500` — Imagick processing failed
- `507` — disk space insufficient

---

### 4. POST /cart/add

Add customized mug to WooCommerce cart.

**Request**:
```json
{
  "product_id": 123,
  "variation_id": 456,
  "quantity": 1,
  "design": {
    "canvas_json": { "version": "6.0.0", "objects": [...] },
    "variant": { "style": "classic", "size": "11oz", "color": "black" },
    "addons": [],
    "canvas_width": 244,
    "canvas_height": 281,
    "version": "1.0"
  }
}
```

**Response 200**:
```json
{
  "success": true,
  "cart_item_key": "a1b2c3d4e5f6",
  "cart_url": "https://site.com/cart",
  "cart_count": 1
}
```

**Errors**:
- `400` — product not purchasable or missing design
- `403` — invalid nonce
- `409` — out of stock

---

### 5. POST /mockups/upload *(Admin only)*

Upload a PNG mockup and assign to a variant combination.

**Request**: `multipart/form-data`
```
file: [PNG file, max 5MB]
product_id: 123
variant_key: "classic-11oz-black-front"
```

**Response 200**:
```json
{
  "success": true,
  "attachment_id": 789,
  "url": "https://site.com/wp-content/uploads/mug-mockups/classic-11oz-black-front.png",
  "variant_key": "classic-11oz-black-front"
}
```

**Errors**:
- `400` — not a PNG, or missing variant_key
- `403` — not admin / insufficient permissions
- `413` — file >5MB

---

## Error Response Format (All Endpoints)

```json
{
  "code": "invalid_nonce",
  "message": "Security token expired. Please refresh the page.",
  "data": { "status": 403 }
}
```

---

## Frontend JS Usage Pattern

```js
// Localized by PHP via wp_localize_script()
const { apiRoot, nonce } = window.mugCustomizer;

// Example: load variants
const res = await fetch(`${apiRoot}mug-customizer/v1/variants/123`);
const data = await res.json();

// Example: add to cart
await fetch(`${apiRoot}mug-customizer/v1/cart/add`, {
  method: 'POST',
  headers: { 'X-WP-Nonce': nonce, 'Content-Type': 'application/json' },
  body: JSON.stringify({ product_id: 123, variation_id: 456, quantity: 1, design: {...} })
});
```
