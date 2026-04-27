# Research: Mug Customizer Plugin — Phase 0 Findings

**Feature**: 001-mug-customizer-plugin  
**Date**: 2026-04-23  
**Status**: Complete — all unknowns resolved

---

## R-001: Canvas Library — Fabric.js vs Konva.js

**Decision**: Fabric.js 6.x

**Rationale**:
- Superior built-in text editing (IText, Textbox with cursor, selection, multiline)
- Native `clipPath` support — design elements constrained to print area rectangle out of the box
- `canvas.toDataURL({ multiplier: 4 })` exports at 4× screen resolution (300 DPI equivalent at standard screen density)
- Built-in `canvas.getObjects()` JSON serialization for design state persistence
- `fabric.Canvas` has built-in history via custom state stack (undo/redo)
- Larger ecosystem, better maintained (v6 released 2024), extensive documentation

**Alternatives considered**:
- Konva.js: Better raw performance for animation/games, but text editing weaker; no built-in clipPath constraint
- Native HTML5 Canvas: Too low-level, massive boilerplate for text/image transforms

**Key capabilities used**:
1. `fabric.IText` — interactive inline text editing
2. `clipPath` on canvas — enforces print area boundary
3. `canvas.toDataURL({ multiplier: 4, format: 'png' })` — 300 DPI export

---

## R-002: WooCommerce Integration Architecture

**Decision**: Variable Product + Custom Order Item Meta + 6 WooCommerce hooks

**Rationale**: Standard WooCommerce variable product handles Style/Size/Color variants natively. Custom meta stored in `woocommerce_order_itemmeta` table via WC hooks — no custom DB tables needed.

**Key hooks**:
| Hook | Purpose |
|---|---|
| `woocommerce_add_cart_item_data` | Inject design JSON into cart item |
| `woocommerce_get_item_data` | Display design summary in cart |
| `woocommerce_checkout_create_order_line_item` | Persist design to order meta |
| `woocommerce_admin_order_item_values` | Show design in admin order view |
| `woocommerce_email_order_items_args` | Include design in order emails |
| `woocommerce_cart_calculate_fees` | Add-on pricing (lid, gift box) |

**Product type**: WooCommerce Variable Product (Style, Size, Color as attributes). Mockup image mapping stored in product `postmeta` as JSON lookup: `_variant_mockup_map`.

**Alternatives considered**:
- Custom WC product type: More control but unnecessary complexity for v1
- Custom DB tables: Overkill — WC order item meta handles the data volume fine

---

## R-003: Print File Generation (300 DPI)

**Decision**: Fabric.js 4× multiplier export → PHP Imagick server-side processing

**Rationale**:
- `canvas.toDataURL({ multiplier: 4 })` scales canvas 4× before rasterizing → 300 DPI equivalent
- PHP **Imagick** (not GD) for server-side: supports 16-bit color, ICC profiles, lossless PNG compositing
- Design sent as base64 PNG via REST API → PHP decodes → Imagick saves to `wp-content/uploads/mug-designs/{order_id}/print.png`

**11oz Mug print dimensions at 300 DPI**:
- Print area: 3.25" × 3.75" (wrap surface)
- At 300 DPI: **975px × 1125px**
- With bleed: **1050px × 1200px** (recommended for print)

**15oz Mug**:
- Print area: 3.87" × 4.25"
- At 300 DPI: **1161px × 1275px** (with bleed: ~1240px × 1350px)

**Canvas export size** (at 4× multiplier, assuming 250px canvas height):
- Canvas set to ~244px × 281px → 4× = 975px × 1125px (exact 300 DPI target)

**Alternatives considered**:
- GD library: 8-bit color depth only, poor for print — rejected
- Puppeteer/headless Chrome: Server overhead, not suitable for shared WordPress hosting — rejected
- Third-party print API: Out of scope for v1

---

## R-004: PNG Mockup Strategy

**Decision**: Static transparent-background PNGs per variant, served from `wp-content/uploads/mug-mockups/`

**Naming convention**: `{style}-{size}-{color}-{angle}.png`
- Example: `classic-11oz-black-front.png`, `travel-15oz-white-side.png`

**During development**: Placeholder JPGs from `/images/` used. Swap with transparent PNGs when client provides.

**Variant lookup**: JavaScript object built from PHP `wp_localize_script()` output:
```js
window.mugCustomizer.mockupMap = {
  "classic-11oz-black-front": "/wp-content/uploads/mug-mockups/classic-11oz-black-front.png",
  ...
}
```

**Alternatives considered**:
- Dynamic Mockups API ($29/mo): Best quality but adds external dependency and cost — defer to V2
- PIXI.js displacement map (3D wrap): Overkill, complex, fragile — rejected

---

## R-005: Frontend Architecture

**Decision**: Vanilla JavaScript + Fabric.js (no React/Vue for v1)

**Rationale**:
- WordPress plugin ecosystem is PHP-first; vanilla JS + Fabric.js is simpler to enqueue and maintain
- No build pipeline needed (Fabric.js loaded via CDN or bundled)
- Reduces complexity — React would need webpack/build setup and WP block editor conflicts
- Fabric.js is already a rich component library for the canvas

**If React needed in V2**: Add only for the designer component, loaded in isolation via `wp_enqueue_script`.

---

## Resolution Summary

| Unknown | Status | Decision |
|---|---|---|
| Canvas library | ✅ Resolved | Fabric.js 6.x |
| WC integration hooks | ✅ Resolved | 6 standard WC hooks |
| Product data storage | ✅ Resolved | Variable product + postmeta |
| Print file generation | ✅ Resolved | 4× multiplier + PHP Imagick |
| 11oz print dimensions | ✅ Resolved | 975×1125px (bleed: 1050×1200px) |
| PNG mockup delivery | ✅ Resolved | Static PNGs + JS lookup map |
| Frontend framework | ✅ Resolved | Vanilla JS + Fabric.js |
