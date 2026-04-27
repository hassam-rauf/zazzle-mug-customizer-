# Implementation Plan: Mug Customizer WooCommerce Plugin

**Branch**: `001-mug-customizer-plugin` | **Date**: 2026-04-23 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/001-mug-customizer-plugin/spec.md`

---

## Summary

Build a Zazzle-exact mug customizer as a standalone WordPress plugin integrating with WooCommerce. Shoppers browse mugs → select variants on PDP → design on a Fabric.js canvas (text + image upload, print-area constrained) → review photorealistic mockup → add to cart with design JSON attached → order placed triggers 300 DPI print file generation via PHP Imagick.

**UI Reference**: `mockups/ui-flow.html` — 5-page Zazzle-exact flow already designed. Plugin must match this exactly.

---

## Technical Context

**Language/Version**: PHP 7.4+ (plugin) + Vanilla JavaScript (ES2020)  
**Primary Dependencies**: Fabric.js 6.x, WooCommerce 8.0+, WordPress 6.4+, PHP Imagick  
**Storage**: WordPress `wp_postmeta` (variant map), `woocommerce_order_itemmeta` (design data), file system (print files + mockup PNGs)  
**Testing**: PHPUnit (PHP), Manual browser testing (JS canvas)  
**Target Platform**: WordPress (Linux/Apache or Nginx shared hosting compatible)  
**Project Type**: WordPress Plugin (PHP backend + JS frontend — no separate build step in V1)  
**Performance Goals**: Canvas interactive in <3s; mockup image swap <1s; print file generated <30s  
**Constraints**: Must run on shared hosting (no Node.js, no Docker); Imagick required (common on cPanel hosts); no external API dependencies in V1  
**Scale/Scope**: Single WordPress site; ~100 orders/day typical load

---

## Constitution Check

| Gate | Status | Notes |
|---|---|---|
| No hardcoded secrets | ✅ PASS | Config via `define()` constants in plugin header |
| Smallest viable diff | ✅ PASS | Variable products used (no custom post type) |
| No invented APIs | ✅ PASS | All WC hooks verified in research |
| Input validated at boundary | ✅ PASS | File type + nonce on all REST endpoints |
| No unused abstractions | ✅ PASS | No repository pattern — direct WP/WC functions |
| External dependencies minimal | ✅ PASS | Fabric.js only external JS dep |

*Re-checked post-design: All gates pass.*

---

## Project Structure

### Documentation (this feature)

```
specs/001-mug-customizer-plugin/
├── spec.md           ✅ Complete
├── plan.md           ✅ This file
├── research.md       ✅ Complete (Phase 0)
├── data-model.md     ✅ Complete (Phase 1)
├── quickstart.md     ✅ Complete (Phase 1)
├── contracts/
│   └── rest-api.md   ✅ Complete (Phase 1)
└── tasks.md          ⏳ Next — run /sp.tasks
```

### Source Code (WordPress Plugin)

```
wp-content/plugins/mug-customizer/
├── mug-customizer.php                    # Plugin header, constants, loader
│
├── includes/                             # Core PHP — no UI
│   ├── class-rest-api.php                # 5 REST endpoints (see contracts/rest-api.md)
│   ├── class-cart-handler.php            # 6 WooCommerce hooks for cart/order meta
│   ├── class-print-generator.php         # PHP Imagick — 300 DPI print file
│   ├── class-variant-resolver.php        # Mockup map lookup (_variant_mockup_map)
│   └── class-design-storage.php          # Design JSON encode/decode/validate
│
├── admin/                                # WordPress admin UI
│   ├── class-admin-menu.php              # Admin menu registration
│   ├── class-mockup-manager.php          # PNG upload + variant mapping UI
│   ├── class-order-meta-display.php      # Design details in order view
│   └── assets/
│       ├── css/admin.css
│       └── js/admin-mockup-upload.js
│
├── public/                               # Frontend (customer-facing)
│   ├── class-frontend.php                # wp_enqueue_scripts, template overrides
│   ├── templates/
│   │   ├── pdp-designer-button.php       # "Personalize This Mug" CTA on PDP
│   │   ├── designer.php                  # Full-page designer (Design tab)
│   │   └── review.php                    # Review tab
│   └── assets/
│       ├── css/
│       │   ├── designer.css              # Designer layout (matches ui-flow.html page 4)
│       │   └── pdp.css                   # PDP overrides (matches ui-flow.html page 3)
│       └── js/
│           ├── canvas-editor.js          # Fabric.js canvas — core designer logic
│           ├── pdp.js                    # Variant switching, image swap on PDP
│           └── review.js                 # Review tab, add-to-cart submission
│
└── languages/                            # i18n (empty for V1, structure ready)
```

**WordPress uploads** (outside plugin, auto-created):
```
wp-content/uploads/
├── mug-mockups/         # Admin-uploaded PNG mockups per variant
│   ├── classic-11oz-black-front.png
│   └── ...
└── mug-designs/         # Generated per order (private)
    └── {order_id}/
        ├── print.png    # 1050×1200px — 300 DPI print file
        └── preview.png  # 600×600px — admin display
```

---

## Architecture Decisions

### AD-001: Fabric.js for Canvas
**Decision**: Fabric.js 6.x (not Konva.js, not native canvas)  
**Why**: Best text editing (IText), native clipPath for print boundary, `toDataURL({multiplier:4})` for 300 DPI export, JSON serialization for design persistence.

### AD-002: Variable Product (Not Custom Product Type)
**Decision**: Use standard WooCommerce Variable Product  
**Why**: Style/Size/Color map directly to WC attributes/variations. No custom UI needed. Admin already knows how to manage it. Custom product type is overkill for V1.

### AD-003: Static PNG Mockups (Not Dynamic API)
**Decision**: Static transparent-background PNGs, admin-uploaded  
**Why**: No external dependency, no cost, works on shared hosting. Dynamic Mockups API ($29/mo) deferred to V2 if client wants photorealistic composite previews.

### AD-004: Design Overlay Approach (Not 3D Wrap)
**Decision**: PNG mockup (opaque) + CSS-positioned Fabric.js canvas overlay  
**Why**: Exact Zazzle approach. Canvas sits behind the mug PNG; mug PNG has transparent body area so canvas shows through. No 3D needed — multiple angle PNGs provide same UX.

**Layer order (z-index)**:
```
z=1  Canvas (Fabric.js) — user draws here
z=2  Mug PNG (transparent body) — overlaid on canvas, creates "design on mug" illusion
z=3  Print boundary div (dashed green) — pointer-events:none, visual guide only
```

### AD-005: Vanilla JS (No React for V1)
**Decision**: Vanilla JS + Fabric.js, no build pipeline  
**Why**: WordPress plugin ecosystem; simpler enqueue; no webpack conflicts with Gutenberg. React deferred to V2 if needed.

### AD-006: PHP Imagick for Print Files
**Decision**: PHP Imagick (not GD)  
**Why**: 16-bit color, ICC profile support, lossless PNG compositing — required for print quality. GD is 8-bit only.

---

## Implementation Phases

### Phase 1 — Foundation (Week 1–2)
*Goal: Working WooCommerce product with variant switching on PDP*

- [ ] Plugin bootstrap file (`mug-customizer.php`) — constants, autoloader, activation hook
- [ ] WooCommerce Variable Product setup: Style, Size, Color attributes
- [ ] `class-variant-resolver.php` — `_variant_mockup_map` postmeta read/write
- [ ] Admin: Mockup image upload UI (`class-mockup-manager.php`) — PNG per variant key
- [ ] PDP: `pdp.js` — variant pill click → AJAX fetch → hero image swap (no page reload)
- [ ] PDP: `pdp.css` — 3-column grid (74px thumbs | 1.2fr preview | 1fr info), matches `mockups/ui-flow.html` page 3
- [ ] REST: `GET /variants/{product_id}` endpoint

**Milestone**: Shopper can switch mug color on PDP and see correct PNG update.

---

### Phase 2 — Designer Canvas (Week 3–4)
*Goal: Functional Fabric.js designer with print area constraint*

- [ ] Designer page route (`/mug-designer?product={id}&variation={id}`)
- [ ] `designer.php` template — top bar (Design/Review tabs, Save&Exit, Next:Review), left tool rail (80px dark), center canvas stage, right mini-preview card
- [ ] `canvas-editor.js` — Fabric.js canvas init, print area clipPath from `_print_area_config`
- [ ] Add Text: `fabric.IText` add on button click, font/size/color/bold/italic controls in context bar
- [ ] Print boundary: green dashed rect + 3 seam lines (from `mockups/ui-flow.html` page 4 exactly)
- [ ] Canvas wrap preview: boundary extends right of mug (170% width) showing unrolled wrap surface
- [ ] Design tab ↔ Review tab navigation (same URL pattern, tab toggle)
- [ ] Auto-save design JSON to session every 30s (`POST /designs/save`)
- [ ] Undo/Redo: 10-step history stack on canvas

**Milestone**: Shopper can add text, see it on mug within print boundary, switch tabs.

---

### Phase 3 — Image Upload + Options (Week 5)
*Goal: Image upload works; variant options changeable inside designer*

- [ ] Upload panel: file input → FileReader → `fabric.Image.fromURL()` → canvas (max 10MB, JPG/PNG)
- [ ] Server-side upload validation (MIME check, size limit) via `POST /uploads/image`
- [ ] Options panel (right side): Style, Size, Color, Add-ons dropdowns inside designer
- [ ] Variant change in designer → fetch new mockup image → update canvas background PNG
- [ ] Add-on selection → price recalculates via `addon_prices` from variant API
- [ ] Price display updates in real time (right panel)

**Milestone**: Shopper can upload their photo and change mug options inside the designer.

---

### Phase 4 — Review Tab + Add to Cart (Week 6)
*Goal: Full flow working end-to-end into WooCommerce cart*

- [ ] `review.php` template — 3-column (100px thumbs | 1.4fr main | 1fr options/price/cart), matches `mockups/ui-flow.html` page 5
- [ ] Review: render design on mug mockup (composite canvas export over PNG for display)
- [ ] Vertical thumb strip: 6 angle thumbnails (left active, others available)
- [ ] `review.js` — serialize canvas → base64 → `POST /cart/add`
- [ ] `class-cart-handler.php` — `woocommerce_add_cart_item_data` + `woocommerce_get_item_data`
- [ ] Cart page: show design summary (text content, image filename, options)
- [ ] Quantity selector + Add to Cart button → WooCommerce cart

**Milestone**: Full flow Landing → Design → Review → Cart working end-to-end.

---

### Phase 5 — Order + Print File (Week 7)
*Goal: Order placed → design data saved → print file generated*

- [ ] `class-cart-handler.php` — `woocommerce_checkout_create_order_line_item` hook
- [ ] `class-print-generator.php` — Imagick: decode base64 → resize to 1050×1200px → save PNG
- [ ] Print file triggered on `woocommerce_order_status_processing` hook
- [ ] `class-order-meta-display.php` — design details in WC admin order view
- [ ] Email: design summary in order confirmation (text + options, no image attachment for V1)
- [ ] Admin: link to print file in order view

**Milestone**: Order placed → print.png generated in uploads → visible in admin.

---

### Phase 6 — Polish + Testing (Week 8)
*Goal: Production-ready, no obvious gaps vs Zazzle flow*

- [ ] Error handling: empty design → "Add at least one element" toast before cart
- [ ] Error handling: upload fail → user message
- [ ] Error handling: print generation fail → admin alert email, order still completes
- [ ] Mobile responsive check (designer collapses gracefully — not full mobile design)
- [ ] Cross-browser test: Chrome, Firefox, Safari, Edge
- [ ] Performance: canvas load <3s, mockup swap <1s (verified)
- [ ] Security audit: nonce on all writes, MIME validation, file path traversal check
- [ ] Manual test all 14 items in `quickstart.md` checklist
- [ ] Code cleanup — no dead code, no console.logs

**Milestone**: Plugin passes full quickstart.md checklist. Ready for client demo.

---

## Risk Analysis

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Client hosting has no Imagick | Medium | High | Check early; fallback to GD for preview (lower quality), warn admin |
| Client PNG mockups delayed | High | Medium | Use placeholder JPGs; plugin works without transparent PNGs |
| Fabric.js version conflicts with other plugins | Low | Medium | Load Fabric.js in noConflict mode; scope to designer page only |
| Canvas export too large for server POST | Low | Medium | Compress at 0.92 quality; chunk if needed; server max_post_size check |
| WooCommerce version incompatibility | Low | High | Test on WC 8.0 and 8.9; use `woocommerce_` hooks only (stable API) |

---

## Out of Scope (V1)

- Clipart library
- Templates library
- Auto Printful/Printify fulfillment
- 3D rotating preview (multiple angle PNGs provide equivalent UX)
- Mobile-first designer (desktop-optimized only)
- User account design saving (session only in V1)
- Coupon/discount codes in designer (WooCommerce native handles this at cart)
