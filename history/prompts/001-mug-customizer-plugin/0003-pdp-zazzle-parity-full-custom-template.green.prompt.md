---
name: PDP Zazzle Parity — Full Custom Template
description: Deep gap analysis of Zazzle PDP vs WC plugin page, then full implementation of custom pdp-template.php with 3-col layout, pills, swatches, trust badges, sticky CTA, specs, and zoom modal
type: green
stage: green
date: 2026-04-26
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /sp.implement
labels: ["pdp","template-override","woocommerce","zazzle-parity","css","js","php"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/templates/pdp-template.php (created)
  - mug-customizer/public/assets/css/pdp.css (full rewrite)
  - mug-customizer/public/assets/js/pdp.js (full rewrite)
  - mug-customizer/public/class-frontend.php (template_redirect + hook cleanup)
tests:
  - 36/37 automated element presence checks passed (G06 false-negative: other selects on page, WC style select confirmed absent)
  - Breadcrumb: Home › Mugs › Custom Photo Mug ✅
  - Style pills render with correct data-values ✅
  - Color swatches with hex backgrounds ✅
  - Customize It CTA links to designer with style/size/color params ✅
  - No WC select dropdowns, no WC Add-to-Cart button ✅
  - Sticky bar, zoom modal, trust badges, specs section all present ✅
---

## Prompt

User: "https://www.zazzle.com/pd/spp/pt-zazzle_mug?... compare it with our http://localhost/... then find out gaps client want same page layout structure and functionality like zazzle, research like an expert. ok"

## Response

### Gap Analysis (38 gaps identified across 5 categories)

**Root cause**: WC block theme (Twenty Twenty-Five) owns the product page via FSE templates. Our `pdp.css` and `pdp.js` were loaded but targeted elements (`.pill`, `.swatch`, `.pdp-preview`) that WC never rendered — all custom UI code was dead.

### Implementation

**1. `pdp-template.php`** (new full-page template, ~400 lines)
- Custom header: logo + search bar + nav (Sign In, Cart with badge)
- Promo banner (dark blue, site-wide deal message)
- Breadcrumb: Home › [Category] › [Product] (dynamic from WP terms)
- 3-column grid: 80px thumb strip | 1.3fr hero preview | 1fr info panel
- Thumb strip: 4 angle thumbnails (front/back/side/lifestyle) from mockup map
- Hero preview: 540px, gray bg, centered mug image + "Your Design / Appears Here" ghost overlay + zoom button
- Info panel: title + "Sold by" block, star rating (dynamic from WC), price (sale/regular with strikethrough + save badge), per mug note, free shipping note
- Style pills (from `get_variation_attributes()`)
- Size pills
- Color swatches with inline hex backgrounds from `$color_hex` map
- Delivery estimate (expedited +5 days, standard +10 days)
- "Customize It →" primary orange CTA (links to designer with style/size/color params)
- "Choose a Template Instead" secondary CTA
- Inline trust text (3 items near CTA)
- Features list (300 DPI, microwave/dishwasher safe, FDA certified, ceramic)
- Trust badges section ("The Mugly Promise" — 3 cards: Love It Guarantee, Free Shipping, Secure Shopping)
- About/Specs section (2-col: text + specs table with dimensions, materials, care)
- Customer Reviews section (WC `comments_template()` with `$product` global set)
- Sticky CTA bar (appears on scroll via IntersectionObserver)
- Zoom modal (click preview or zoom button)
- `mugPdpConfig` JS inline config object

**2. `pdp.css`** (complete rewrite, ~400 lines)
- All new sections styled: header, promo banner, breadcrumb, 3-col grid
- Sticky thumbs + preview with zoom-in hover effect
- Info panel scrollable (sticky top, max-height calc)
- Pills, swatches, delivery row, CTA block
- Trust badges 3-col grid, about 2-col grid, specs table
- Sticky bar slide-up animation, zoom modal overlay
- Responsive breakpoints at 960px and 600px

**3. `pdp.js`** (full rewrite)
- Reads from `window.mugPdpConfig` (new) + `window.mugCustomizer` (fallback)
- `initPills()`: click → deselect siblings → update selected → `onVariantChange()`
- `initSwatches()`: click → update `selected.color` → `onVariantChange()`
- `onVariantChange()`: updates all 4 thumb images, hero image, both personalize button URLs, selected label spans
- `initThumbs()`: click → set active → swap hero image
- `initZoom()`: click preview or zoom button → modal with hero src
- `initStickyBar()`: IntersectionObserver on CTA block → slide sticky bar in/out

**4. `class-frontend.php`**
- Added `is_product()` branch to `maybe_load_designer_template()` → includes `pdp-template.php` + exit
- Removed `woocommerce_after_add_to_cart_button` hook (no longer needed)
- Removed `render_personalize_button()` method (superseded by template)

**5. DB fix** (via temp PHP script, removed after use)
- Created "Mugs" product_cat term (ID 16)
- Assigned product 14 to Mugs category
- Breadcrumb now shows: Home › Mugs › Custom Photo Mug

**Key discovery**: XAMPP `C:\xampp\htdocs\` is a SEPARATE COPY from project files at `D:\Projects\`. All file changes must be synced to both. Added explicit cp commands after every edit.

### Gaps Resolved

All 38 gaps from the analysis addressed:
- G01–G05: Layout, thumb strip, hero preview, breadcrumb, ghost overlay ✅
- G06–G10: Style pills, size pills, color swatches, variant→image sync ✅
- G11–G18: Title, rating, price, shipping note, delivery, Customize CTA, sticky bar ✅
- G19–G23: Trust badges section (3 cards), inline trust text ✅
- G24–G29: About section, specs table, dimensions, care, reviews ✅
- G30–G38: Custom header, search, cart, JS config, swatch colors, zoom, no WC selects ✅
