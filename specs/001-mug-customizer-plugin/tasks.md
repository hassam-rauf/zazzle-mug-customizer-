# Tasks: Mug Customizer WooCommerce Plugin

**Input**: Design documents from `/specs/001-mug-customizer-plugin/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅ quickstart.md ✅  
**Tests**: Manual browser tests only (no automated test tasks — not requested in spec)  
**UI Reference**: `mockups/ui-flow.html` — all frontend must match this exactly

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no shared dependencies)
- **[Story]**: User story label (US1–US5)
- All paths relative to `wp-content/plugins/mug-customizer/`

---

## Phase 1: Setup (Plugin Bootstrap)

**Purpose**: WordPress plugin foundation — file structure, constants, loader, activation

- [X] T001 Create plugin root file `mug-customizer.php` with plugin header, constants (VERSION, PLUGIN_DIR, UPLOAD_DIR, MOCKUP_DIR, MAX_UPLOAD_MB, PRINT_MULTIPLIER), and class autoloader
- [X] T002 Create directory structure: `includes/`, `admin/`, `admin/assets/css/`, `admin/assets/js/`, `public/`, `public/templates/`, `public/assets/css/`, `public/assets/js/`, `languages/`
- [X] T003 [P] Create `includes/class-rest-api.php` — register REST namespace `mug-customizer/v1`, stub all 5 endpoints (GET /variants/{id}, POST /designs/save, POST /designs/export, POST /cart/add, POST /mockups/upload) returning `WP_REST_Response` with 200 + `{stub: true}`
- [X] T004 [P] Create `includes/class-cart-handler.php` — stub class with the 6 WC hook registrations (no logic yet): `woocommerce_add_cart_item_data`, `woocommerce_get_item_data`, `woocommerce_checkout_create_order_line_item`, `woocommerce_admin_order_item_values`, `woocommerce_email_order_items_args`, `woocommerce_cart_calculate_fees`
- [X] T005 [P] Create `includes/class-variant-resolver.php` — stub class with method `get_mockup_url($product_id, $variant_key)` and `get_print_area($product_id, $style)`
- [X] T006 [P] Create `includes/class-print-generator.php` — stub class with method `generate($order_id, $order_item_id, $base64_png, $variant)` returning `['success' => false, 'stub' => true]`
- [X] T007 [P] Create `includes/class-design-storage.php` — stub class with methods `encode($design_array)`, `decode($json_string)`, `validate($design_array)` returning `true`
- [X] T008 [P] Create `admin/class-admin-menu.php` — register admin menu page "Mug Customizer" under WooCommerce menu
- [X] T009 [P] Create `admin/class-mockup-manager.php` — stub class for PNG upload + variant mapping admin UI
- [X] T010 [P] Create `admin/class-order-meta-display.php` — stub hooks for `woocommerce_admin_order_item_headers` and `woocommerce_admin_order_item_values`
- [X] T011 [P] Create `public/class-frontend.php` — register `wp_enqueue_scripts` hook, stub `wp_localize_script` with `window.mugCustomizer = {apiRoot, nonce, mockupMap: {}, printAreaConfig: {}}`
- [X] T012 Create `public/assets/js/canvas-editor.js` — empty file with `/* Fabric.js canvas editor — mug-customizer */` header comment
- [X] T013 [P] Create `public/assets/js/pdp.js` — empty file stub
- [X] T014 [P] Create `public/assets/js/review.js` — empty file stub
- [X] T015 [P] Create `public/assets/css/designer.css` — empty file stub
- [X] T016 [P] Create `public/assets/css/pdp.css` — empty file stub
- [X] T017 Wire all classes into `mug-customizer.php` loader: instantiate and call `init()` on each class on `plugins_loaded` hook
- [X] T018 Verify plugin activates in WordPress admin with no fatal errors (Plugins → Activate → no red error)

**Checkpoint**: Plugin activates, REST namespace registered, all stub classes load without errors.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure shared by all user stories — variant resolver, design storage, WP uploads dirs

**⚠️ CRITICAL**: US1–US5 implementation cannot begin until this phase is complete

- [X] T019 Implement `includes/class-variant-resolver.php` fully:
  - `get_mockup_url($product_id, $variant_key)` — reads `_variant_mockup_map` postmeta (JSON), returns URL or fallback placeholder URL
  - `get_print_area($product_id, $style)` — reads `_print_area_config` postmeta (JSON), returns `{top, left, width, height}` in %
  - `get_addon_prices($product_id)` — reads `_addon_prices` postmeta (JSON)
  - `build_variant_key($style, $size, $color, $angle)` — returns `"{style}-{size}-{color}-{angle}"` string
- [X] T020 Implement `includes/class-design-storage.php` fully:
  - `encode($design)` — `json_encode` with validation, returns compressed JSON string
  - `decode($json)` — `json_decode`, validate required keys (`canvas_json`, `variant`, `version`), return array or `WP_Error`
  - `validate($design)` — check: canvas_json not empty, variant has style+size+color, version present
  - `has_objects($design)` — return true if `canvas_json.objects` array has ≥1 item
- [X] T021 [P] Create upload directories on plugin activation in `mug-customizer.php`:
  - `wp_upload_dir()['basedir'] . '/mug-designs/'` — for print files
  - `wp_upload_dir()['basedir'] . '/mug-mockups/'` — for admin PNG mockups
  - Add `.htaccess` in `mug-designs/` to deny direct access (`Deny from all`)
- [X] T022 [P] Implement `public/class-frontend.php` — `wp_localize_script()`:
  - Output `window.mugCustomizer.apiRoot` = `rest_url('mug-customizer/v1/')`
  - Output `window.mugCustomizer.nonce` = `wp_create_nonce('wp_rest')`
  - Output `window.mugCustomizer.mockupMap` = variant resolver output for current product
  - Output `window.mugCustomizer.printAreaConfig` = print area config for current product
  - Output `window.mugCustomizer.maxUploadMB` = `MUG_CUSTOMIZER_MAX_UPLOAD_MB`
  - Enqueue Fabric.js 6.x from CDN: `https://cdnjs.cloudflare.com/ajax/libs/fabric.js/6.3.0/fabric.min.js`

**Checkpoint**: Foundation complete. `window.mugCustomizer` available on frontend. Variant resolver returns correct URLs from postmeta. Design storage validates JSON correctly.

---

## Phase 3: User Story 1 — Browse & Select a Mug Product (Priority: P1)

**Goal**: PDP loads with mug image + variant selectors. Variant pill click updates hero image without page reload. "Personalize This Mug" CTA leads to designer.

**Independent Test**: Load PDP → click Color swatch → hero image updates → click "Personalize This Mug" → designer page loads. No designer functionality needed to pass.

### Implementation — US1

- [X] T023 [US1] Create WooCommerce Variable Product in WP admin: name "Custom Photo Mug", attributes Style (Classic, Travel, Espresso, Two-Tone), Size (11oz, 15oz, 20oz), Color (Black, White, Red, Blue, Green). Generate all variations. Note product ID.
- [X] T024 [US1] Implement `admin/class-mockup-manager.php` fully:
  - Add meta box "Mug Mockup Images" to product edit page
  - For each variant key, show: text input for variant key + WP media upload button
  - Save postmeta `_variant_mockup_map` as JSON on `save_post` hook
  - Save postmeta `_print_area_config` as JSON (default values per style: classic top:22 left:18 w:64 h:56)
  - Save postmeta `_addon_prices` as JSON
- [X] T025 [US1] Implement REST endpoint `GET /variants/{product_id}` in `includes/class-rest-api.php`:
  - Call `Variant_Resolver::get_mockup_url()`, `get_print_area()`, `get_addon_prices()`
  - Return JSON per `contracts/rest-api.md` spec
  - Return `404` if product not found, `400` if not a variable product
- [X] T026 [US1] Create PDP template override `public/templates/pdp-designer-button.php`:
  - Hook into `woocommerce_after_add_to_cart_button` 
  - Render "Personalize This Mug →" button (orange, full-width, matches `mockups/ui-flow.html` page 3 `.cta-primary`)
  - Button links to `/mug-designer/?product_id={id}&variation_id={variation_id}`
  - Enqueue `public/assets/css/pdp.css` on product pages
- [X] T027 [US1] Write `public/assets/css/pdp.css`:
  - 3-column grid `.pdp { display:grid; grid-template-columns:74px 1.2fr 1fr; gap:20px; padding:30px; }` — matches `mockups/ui-flow.html` line 77
  - Thumb strip: `.thumb-strip { display:flex; flex-direction:column; gap:8px; }` — matches line 78–81
  - Hero preview area: `.pdp-preview { background:#f8f9fb; border-radius:12px; height:540px; }` — matches line 82
  - Pill group, swatch, price-big, option-block styles — copy from `mockups/ui-flow.html` lines 94–100
- [X] T028 [US1] Write `public/assets/js/pdp.js`:
  - On DOM ready: fetch `GET /wp-json/mug-customizer/v1/variants/{product_id}` → store `mockupMap`, `printAreaConfig`, `addonPrices`
  - On variant pill click: update `.pdp-preview .hero-mug` `src` from `mockupMap[buildKey(style,size,color,'front')]`
  - On swatch click: same logic for color change
  - Track selected state: `let selected = { style:'classic', size:'11oz', color:'black' }`
  - Update price display when add-on checkbox toggled: base price + `addonPrices[addon]`
  - "Personalize This Mug" button: append `&style=classic&size=11oz&color=black` to href from current selection

**Checkpoint — US1 DONE**: PDP shows mug image. Variant clicks update image. CTA goes to designer URL. ✓

---

## Phase 4: User Story 2 — Design a Custom Mug (Priority: P1)

**Goal**: Fabric.js designer canvas loads. User adds text, uploads image, sees design within green dashed print area, can undo/redo. "Next: Review" preserves design.

**Independent Test**: Open `/mug-designer/?product_id={id}` → add text → see it on canvas within green dashed boundary → upload image → resize within boundary → undo → text removed → "Next: Review" → Review tab loads with design intact.

### Implementation — US2 (Canvas Core)

- [X] T029 [US2] Create designer page in WordPress: Settings → Reading OR register custom rewrite rule for `/mug-designer/` → map to `public/templates/designer.php`; OR use `add_shortcode('mug_designer', ...)` on a blank page. Register page on plugin activation.
- [X] T030 [US2] Create `public/templates/designer.php` — full-page template (no sidebar, no WP header/footer — use `get_header('designer')` or blank template):
  - Top bar: "✕ Save and Exit" link, product name, "● Saved" status, **Design** tab (active, underlined) + **Review** tab link, ↶ ↷ undo/redo buttons, "👁 Preview", "Next: Review →" button — matches `mockups/ui-flow.html` lines 461–475 exactly
  - Left tool rail: 80px dark panel with Add Text (active), Uploads, Images icons — matches lines 478–491
  - Center stage: `<canvas id="mug-canvas"></canvas>` inside `#canvas-stage` div, background `#eff1f5`
  - Right mini-preview card: 160px panel showing mug thumbnail + "Text & Images" label — matches lines 513–516
  - Bottom zoom controls: −, zoom%, +, ⚙, ?, ⤴ buttons — matches lines 518–525
  - Enqueue Fabric.js + `canvas-editor.js` + `designer.css`
- [X] T031 [US2] Write `public/assets/css/designer.css`:
  - Full-page layout (no scroll): `body { overflow:hidden; }`, `#designer-wrap { display:flex; flex-direction:column; height:100vh; }`
  - Top bar: `#designer-topbar { display:flex; align-items:center; padding:12px 20px; border-bottom:1px solid #e5e7eb; background:#fff; gap:20px; }`
  - Left rail: `#tool-rail { width:80px; background:#fff; border-right:1px solid #e5e7eb; padding:12px 10px; display:flex; flex-direction:column; gap:8px; }`
  - Canvas stage: `#canvas-stage { flex:1; background:#eff1f5; position:relative; display:flex; align-items:center; justify-content:center; }`
  - Matches `mockups/ui-flow.html` page 4 layout precisely
- [X] T032 [US2] Implement `public/assets/js/canvas-editor.js` — Part 1: Canvas Init:
  - Parse URL params: `product_id`, `variation_id`, `style`, `size`, `color`
  - Init `fabric.Canvas('mug-canvas', { width: 244, height: 281, selection: true })`
  - Load mug PNG from `window.mugCustomizer.mockupMap[key+'-front']` as background image (non-selectable, non-evented, z=bottom)
  - Define print area rect from `window.mugCustomizer.printAreaConfig[style]` (convert % to px)
  - Draw green dashed print boundary: `new fabric.Rect({ stroke:'#4caf50', strokeDashArray:[4,3], fill:'rgba(76,175,80,0.03)', strokeWidth:1.8, selectable:false, evented:false })`
  - Draw 3 vertical seam lines at 25%, 50%, 75% of print area width (green dashed, opacity 0.65)
  - Set canvas `clipPath` to print area rect so objects cannot extend outside
  - Wrap boundary extends 170% width right of mug (matches `mockups/ui-flow.html` line 505)
- [X] T033 [US2] Implement `canvas-editor.js` — Part 2: Add Text:
  - "Add Text" rail button click → `canvas.add(new fabric.IText('Your text here', { fontFamily:'Georgia', fontSize:24, fill:'#222', left: printArea.left+20, top: printArea.top+20 }))`
  - Text panel card (left:132px, top:30px, matches `mockups/ui-flow.html` lines 493–500): shows on "Add Text" click, hides on ✕
  - Context bar appears when text selected: font family `<select>` (Google Fonts: Roboto, Georgia, Oswald, Dancing Script, Montserrat), font size input, color picker, Bold/Italic toggles, alignment buttons
  - Bind context bar controls to `canvas.getActiveObject()` property updates + `canvas.requestRenderAll()`
  - On text deselect: hide context bar
- [X] T034 [US2] Implement `canvas-editor.js` — Part 3: Undo/Redo:
  - Maintain `historyStack = []` and `historyIndex = -1`
  - On every canvas `object:modified`, `object:added`, `object:removed`: push `canvas.toJSON()` to stack (cap at 10)
  - Undo button (↶): `historyIndex--` → `canvas.loadFromJSON(historyStack[historyIndex])`
  - Redo button (↷): `historyIndex++` → `canvas.loadFromJSON(historyStack[historyIndex])`
  - Disable undo button when `historyIndex <= 0`, disable redo when at stack top
- [X] T035 [US2] Implement `canvas-editor.js` — Part 4: Zoom Controls:
  - `−` button: `canvas.setZoom(canvas.getZoom() - 0.1)` (min 0.5)
  - `+` button: `canvas.setZoom(canvas.getZoom() + 0.1)` (max 3.0)
  - Zoom % display: update label on zoom change
  - ⤴ (fit): `canvas.setZoom(1)`, `canvas.viewportTransform = [1,0,0,1,0,0]`
- [X] T036 [US2] Implement `canvas-editor.js` — Part 5: Design Persistence (session save):
  - `serializeDesign()` → `{ canvas_json: canvas.toJSON(), variant: selectedVariant, addons: selectedAddons, canvas_width: 244, canvas_height: 281, version: '1.0' }`
  - Auto-save every 30s: `setInterval(() => POST /designs/save with serializeDesign(), 30000)`
  - On "Next: Review →" click: `sessionStorage.setItem('mugDesign', JSON.stringify(serializeDesign()))` → navigate to review URL
  - Implement `POST /designs/save` endpoint in `class-rest-api.php`: validate nonce, validate design JSON, save to WP session (`WC()->session->set('mug_design', $design)`)
- [X] T037 [US2] Implement REST `POST /designs/save` in `includes/class-rest-api.php`:
  - Validate nonce (`X-WP-Nonce` header)
  - Call `Design_Storage::validate()` — return `400` if invalid
  - Call `Design_Storage::encode()` — save to WC session: `WC()->session->set('mug_design_' . $product_id, $encoded)`
  - Return `{ success: true, design_id: "sess_...", saved_at: ISO timestamp }`

**Checkpoint — US2 DONE**: Designer loads with mug image. Text adds and stays within print boundary. Undo/redo works. Zoom works. "Next: Review" carries design to next page. ✓

---

## Phase 5: User Story 3 — Review Design & Add to Cart (Priority: P1)

**Goal**: Review tab shows mug mockup with design, shopper confirms options + quantity, clicks "Add to Cart" → WooCommerce cart has item with design meta attached.

**Independent Test**: Navigate to review URL with `sessionStorage` design → mug mockup displays → options summary correct → click "Add to Cart" → WooCommerce cart shows customized mug with design details.

### Implementation — US3

- [X] T038 [US3] Create `public/templates/review.php` — full-page template:
  - Same top bar as designer (Save&Exit, Design tab link, **Review** tab active) — matches `mockups/ui-flow.html` lines 533–541
  - 3-column grid `100px 1.4fr 1fr` — matches line 543
  - Left: vertical thumbnail strip (84px×84px each, 6 angles, first active with blue border) — matches lines 544–565
  - Center: large mug preview `<img id="review-main-img">` — matches lines 567–569
  - Right panel: selected options list (Style, Size, Color, Add-on), shipping estimate, subtotal with sale price, qty picker, "Add to Cart" button (yellow, pill shape), "100% Satisfaction Guaranteed" — matches lines 571–609
  - Enqueue `review.js` + `designer.css`
- [X] T039 [US3] Write `public/assets/js/review.js`:
  - On load: read design from `sessionStorage.getItem('mugDesign')` → parse JSON
  - Set `#review-main-img` src from `window.mugCustomizer.mockupMap[variant+'-front']`
  - Render options list: iterate `design.variant` + `design.addons`
  - Compute subtotal: base variation price + addon prices from `window.mugCustomizer.addonPrices`
  - Thumb strip click: update `#review-main-img` src to clicked angle mockup
  - Qty picker: `+`/`−` buttons update `<input>` value (min 1, max 99)
  - "Add to Cart" click: validate design has ≥1 object → `POST /wp-json/mug-customizer/v1/cart/add` with design + variant + qty → on success redirect to WC cart URL
- [X] T040 [US3] Implement REST `POST /cart/add` in `includes/class-rest-api.php`:
  - Validate nonce
  - Validate design via `Design_Storage::validate()` + `has_objects()` — return `400` if empty design
  - Call `WC()->cart->add_to_cart($product_id, $quantity, $variation_id, $variation_attributes, ['_mug_design' => $encoded_design, '_mug_variant' => $variant_json, '_mug_addons' => $addons_json])`
  - Return `{ success: true, cart_item_key, cart_url, cart_count }`
  - Return `409` if product out of stock
- [X] T041 [US3] Implement `includes/class-cart-handler.php` — cart meta hooks:
  - `woocommerce_add_cart_item_data`: attach `_mug_design`, `_mug_variant`, `_mug_addons` to cart item array
  - `woocommerce_get_item_data`: return display array `[['name'=>'Custom Design','value'=>'Text: "..." | Image: uploaded']]` for cart page display
  - `woocommerce_checkout_create_order_line_item`: call `$item->update_meta_data('_mug_design_json', $design)`, `_mug_variant`, `_mug_addons` — persists to `woocommerce_order_itemmeta`
- [ ] T042 [US3] Verify cart: add customized mug → WC cart page shows item with "Custom Design: Text: '...'" summary. Proceed to checkout → order created with meta in DB (`SELECT * FROM wp_woocommerce_order_itemmeta WHERE meta_key='_mug_design_json'`).

**Checkpoint — US3 DONE**: Full flow Landing→Design→Review→Cart works. Design data in WC order meta. ✓

---

## Phase 6: User Story 4 — Configure Options Inside Designer (Priority: P2)

**Goal**: Options panel in designer (Style, Size, Color, Add-ons). Changing options updates canvas mug PNG + price.

**Independent Test**: Open designer → change Color to "White" → mug PNG updates to white variant → select "Lid" add-on → price updates. All without page reload.

### Implementation — US4

- [X] T043 [P] [US4] Add options panel to `public/templates/designer.php` right column (340px):
  - Style `<select>`, Size `<select>`, Color swatches, Add-ons checkboxes (Lid, Gift Box with prices)
  - Price display: `<span id="current-price">$18.95</span>` updates dynamically
  - Matches Zazzle right panel pattern — variant selectors stacked vertically
- [X] T044 [US4] Implement variant change handler in `canvas-editor.js`:
  - On Style/Size/Color change: update `selectedVariant` object → call `updateMugPreview()`
  - `updateMugPreview()`: lookup new mockup URL from `window.mugCustomizer.mockupMap[newKey+'-front']` → update canvas background image via `fabric.Image.fromURL()` → `canvas.setBackgroundImage()` → `canvas.requestRenderAll()`
  - Recalculate print area clipPath for new style if `printAreaConfig[newStyle]` differs
- [X] T045 [US4] Implement add-on price handler in `canvas-editor.js`:
  - On add-on checkbox change: add/remove from `selectedAddons[]`
  - Recalculate display price: `basePrice + selectedAddons.reduce((sum,a) => sum + addonPrices[a], 0)`
  - Update `#current-price` text

**Checkpoint — US4 DONE**: Options panel changes update canvas mug + price in real time. ✓

---

## Phase 7: User Story 5 — Image Upload (Priority: P1)

**Goal**: Shopper clicks Uploads in tool rail → file picker → JPG/PNG ≤10MB → image appears on canvas within print area, resizable/movable.

**Independent Test**: Click Uploads → pick a JPG → image appears on canvas inside print boundary → drag to reposition → resize handles work → stays within clipPath.

### Implementation — US5

- [X] T046 [US5] Add file input to `public/templates/designer.php`: `<input type="file" id="mug-upload-input" accept="image/jpeg,image/png" style="display:none">` + trigger on "Uploads" rail button click
- [X] T047 [US5] Implement upload handler in `canvas-editor.js`:
  - "Uploads" button click → `document.getElementById('mug-upload-input').click()`
  - On file change: validate MIME (`image/jpeg` or `image/png`) + size (≤ `window.mugCustomizer.maxUploadMB * 1024 * 1024`)
  - If invalid: show toast error ("File too large" / "Only JPG/PNG accepted")
  - Use `FileReader.readAsDataURL()` → on load: `fabric.Image.fromURL(dataUrl, img => { img.scaleToWidth(printArea.width * 0.5); img.set({ left: printArea.left, top: printArea.top }); canvas.add(img); canvas.setActiveObject(img); canvas.requestRenderAll(); })`
  - Image auto-constrained by canvas `clipPath`
- [X] T048 [US5] Add server-side image upload endpoint `POST /uploads/image` in `includes/class-rest-api.php` (for future server-hosted images — V1 uses base64 dataURL directly on canvas, so this is prep only):
  - Validate nonce, MIME type, file size
  - Use `wp_handle_upload()` → save to `mug-designs/uploads/`
  - Return `{ url, attachment_id }`
  - Return `400` for invalid type, `413` for oversized file

**Checkpoint — US5 DONE**: Image upload works. File picker opens. Image appears on canvas within print area. Resize/move works. ✓

---

## Phase 8: Order Meta + Print File Generation

**Goal**: Order placed → design JSON saved to order → print file (300 DPI PNG) generated → stored in uploads → visible in admin.

**Independent Test**: Place test order with customized mug → check WP admin order → design details visible → `wp-content/uploads/mug-designs/{order_id}/print.png` exists and is 1050×1200px.

### Implementation

- [X] T049 Implement `includes/class-print-generator.php` fully:
  - `generate($order_id, $order_item_id, $base64_png, $variant)`:
    - Decode base64 → `$image_data = base64_decode(str_replace('data:image/png;base64,', '', $base64_png))`
    - Init Imagick: `$im = new Imagick(); $im->readImageBlob($image_data)`
    - Resize to print dimensions: 11oz → 1050×1200, 15oz → 1240×1350 (from `research.md`)
    - Set resolution: `$im->setImageResolution(300, 300)`
    - Save: `$dir = wp_upload_dir()['basedir'] . '/mug-designs/' . $order_id . '/'; wp_mkdir_p($dir); $im->writeImage($dir . 'print.png')`
    - Return `['success'=>true, 'path'=> $dir.'print.png', 'url'=> wp_upload_dir()['baseurl'].'/mug-designs/'.$order_id.'/print.png']`
  - On Imagick failure: return `WP_Error('imagick_failed', 'Print generation failed')`
- [X] T050 Implement REST `POST /designs/export` in `includes/class-rest-api.php`:
  - Validate nonce + order ownership
  - Call `Print_Generator::generate()` — return `500` on WP_Error
  - Update order item meta `_mug_print_file` with print file path
  - Return response per `contracts/rest-api.md`
- [X] T051 Hook print generation to order: in `includes/class-cart-handler.php` add hook `woocommerce_order_status_processing` → for each order item with `_mug_design_json` meta → call `Print_Generator::generate()` using `_mug_design_json` data
- [X] T052 Implement `admin/class-order-meta-display.php` fully:
  - `woocommerce_admin_order_item_headers`: add "Custom Design" column header
  - `woocommerce_admin_order_item_values`: render design summary:
    - Text objects: list text content, font, color
    - Image objects: "Customer image uploaded"
    - Variant: Style / Size / Color / Add-ons
    - Print file: clickable link `<a href="{print_url}" target="_blank">Download Print File</a>` (only if exists)
- [X] T053 Implement email design summary: in `includes/class-cart-handler.php` hook `woocommerce_email_order_items_args` → append design summary text to order email items section (text-only: "Custom Design: [text content] | Options: [variant]")

**Checkpoint**: Order placed → print.png generated → admin sees design details + download link. ✓

---

## Phase 9: Admin Mockup Image Manager (User Story 5 Admin)

**Goal**: Admin uploads PNG mockups per variant via WP admin panel without developer help.

**Independent Test**: Admin → WooCommerce → Mug Customizer → upload `classic-11oz-black-front.png` → assign to variant key → save → frontend shows this image for that variant.

### Implementation

- [X] T054 Implement `admin/class-mockup-manager.php` fully:
  - Standalone admin page under WooCommerce menu: "Mug Mockups"
  - Product selector: dropdown of all Variable Products
  - For selected product: show grid of variant keys (`{style}-{size}-{color}-{angle}`)
  - Each row: variant key label + current image preview (if set) + WP Media Library button ("Upload PNG")
  - On media select: store `attachment_id` in `_variant_mockup_map` postmeta
  - "Save Mappings" button → AJAX POST → update postmeta
  - Show fallback indicator if no image assigned ("Using placeholder")
- [X] T055 Implement REST `POST /mockups/upload` in `includes/class-rest-api.php`:
  - Check `current_user_can('manage_woocommerce')` — return `403` if not admin
  - Validate file is PNG, ≤5MB
  - Use `wp_handle_upload()` → save to `mug-mockups/`
  - Update `_variant_mockup_map` postmeta for the product
  - Return `{ success, attachment_id, url, variant_key }`
- [X] T056 Implement fallback mockup in `includes/class-variant-resolver.php`:
  - If `_variant_mockup_map` has no entry for requested key: return `plugin_dir_url(__FILE__) . 'assets/images/placeholder-mug.png'`
  - Create `public/assets/images/placeholder-mug.png` (copy of `images/black white cup.jpg` as placeholder)

**Checkpoint — Admin DONE**: Admin can upload PNGs and assign to variants in under 2 minutes. ✓

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Error handling, security, performance, final QA

- [X] T057 [P] Error handling — empty design: in `review.js`, if `sessionStorage` design has 0 canvas objects → show modal "Please add at least one design element" → redirect back to designer
- [X] T058 [P] Error handling — upload failure: catch FileReader errors → show toast "Upload failed. Please try again."
- [X] T059 [P] Error handling — print generation failure: in `class-print-generator.php`, on Imagick exception → send admin email via `wp_mail()` → log with `error_log()` → order still completes (print flagged as pending)
- [X] T060 [P] Security — file path traversal: in `class-print-generator.php`, validate `$order_id` is numeric, use `sanitize_file_name()` on all paths
- [X] T061 [P] Security — upload MIME: double-check with `wp_check_filetype_and_ext()` not just client-reported type; reject non-image files even with correct extension
- [X] T062 [P] Performance — Fabric.js load: load Fabric.js only on designer/review pages (check `is_page('mug-designer')` or URL pattern before enqueue)
- [X] T063 [P] Performance — mockup images: add `loading="lazy"` to thumb strip images; ensure PNG mockups are ≤500KB (document in quickstart.md)
- [ ] T064 Cross-browser test in Chrome, Firefox, Safari, Edge — canvas renders correctly, file upload works, all buttons functional
- [X] T065 Mobile check — designer shows "Best viewed on desktop" notice on screens <768px width (designer not mobile-optimized in V1)
- [ ] T066 Run full `quickstart.md` 14-item manual test checklist — mark each pass/fail, fix any failures
- [X] T067 Remove all `console.log` debug statements from JS files, remove stub comments from PHP classes
- [ ] T068 Final: activate plugin on staging WordPress site, run full shopper flow end-to-end, verify print.png generated and matches design

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup)
    ↓
Phase 2 (Foundational) ← BLOCKS ALL STORIES
    ↓
Phase 3 (US1 - PDP)          ─┐
Phase 4 (US2 - Designer)      ├── Can start in parallel after Phase 2
Phase 7 (US5 - Image Upload)  ─┘ (US2 must finish before US5 — same file)
    ↓
Phase 5 (US3 - Review+Cart)  ← Needs US2 (design serialization)
    ↓
Phase 6 (US4 - Options Panel) ← Extends US2
    ↓
Phase 8 (Print File)         ← Needs US3 (order meta)
Phase 9 (Admin Mockups)      ← Can parallel with Phase 8
    ↓
Phase 10 (Polish)
```

### User Story Dependencies

| Story | Depends On | Can Parallelize With |
|---|---|---|
| US1 — PDP | Phase 2 | US2 setup |
| US2 — Designer | Phase 2 | US1 |
| US3 — Review+Cart | US2 complete | — |
| US4 — Options Panel | US2 complete | US3 |
| US5 — Image Upload | US2 complete | US4 |

### Critical Path (1 Developer, Sequential)

```
Phase 1 → Phase 2 → US1 (PDP) → US2 (Designer) → US5 (Upload) → US3 (Cart) → US4 (Options) → Print File → Admin → Polish
```
Estimated: 8 weeks at 1 developer.

---

## Parallel Execution Examples

### Phase 3 — US1 Parallel Tasks

```
Parallel group A (different files, no deps):
  T024: admin/class-mockup-manager.php
  T026: public/templates/pdp-designer-button.php
  T027: public/assets/css/pdp.css

Sequential after A:
  T025: REST GET /variants endpoint (needs T019 resolver)
  T028: public/assets/js/pdp.js (needs T025 for API)
```

### Phase 4 — US2 Parallel Tasks

```
Parallel group A:
  T030: public/templates/designer.php (HTML structure)
  T031: public/assets/css/designer.css

Sequential (build canvas in order):
  T032: canvas init + background + print boundary
  T033: add text (needs T032 canvas)
  T034: undo/redo (needs T032 canvas)
  T035: zoom (needs T032 canvas)
  T036+T037: auto-save (needs T033+ features)
```

---

## Implementation Strategy

### MVP (User Stories 1+2+3 Only — 4 Weeks)

1. Phase 1: Setup — 2 days
2. Phase 2: Foundational — 2 days
3. Phase 3 (US1 — PDP) — 3 days
4. Phase 4 (US2 — Designer text only) — 5 days
5. Phase 5 (US3 — Review+Cart) — 3 days
6. **STOP AND DEMO**: Shopper can design (text only) → review → add to cart

### Full V1 (All Stories — 8 Weeks)

After MVP validated:
- Add image upload (US5 — 2 days)
- Add options panel (US4 — 2 days)
- Add print file generation (3 days)
- Add admin mockup manager (3 days)
- Polish + testing (1 week)

---

## Task Summary

| Phase | Tasks | Story |
|---|---|---|
| Phase 1: Setup | T001–T018 (18 tasks) | — |
| Phase 2: Foundational | T019–T022 (4 tasks) | — |
| Phase 3: Browse+PDP | T023–T028 (6 tasks) | US1 |
| Phase 4: Designer Canvas | T029–T037 (9 tasks) | US2 |
| Phase 5: Review+Cart | T038–T042 (5 tasks) | US3 |
| Phase 6: Options Panel | T043–T045 (3 tasks) | US4 |
| Phase 7: Image Upload | T046–T048 (3 tasks) | US5 |
| Phase 8: Print File | T049–T053 (5 tasks) | — |
| Phase 9: Admin Mockups | T054–T056 (3 tasks) | — |
| Phase 10: Polish | T057–T068 (12 tasks) | — |
| **TOTAL** | **68 tasks** | |

**Parallel opportunities**: 31 tasks marked [P]  
**MVP scope**: T001–T042 (42 tasks, ~4 weeks)
