# Feature Specification: Zazzle-Like Mug Customizer WooCommerce Plugin

**Feature Branch**: `001-mug-customizer-plugin`  
**Created**: 2026-04-23  
**Status**: Draft  
**Input**: User description: "Zazzle-like mug customizer WooCommerce plugin for WordPress with 5-page flow, designer canvas, PNG mockup images, and cart integration"

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Browse & Select a Mug Product (Priority: P1)

A shopper lands on the WordPress site, browses the mug category, clicks a product, and reaches the Product Detail Page (PDP) where they see mug variants (style, size, color) with live mockup image updates and can click "Start Designing".

**Why this priority**: Entry point of the entire flow. Delivers a shoppable catalog even before the designer is complete.

**Independent Test**: A shopper can land on the PDP, switch style/size/color options, and see the correct mockup image update. Delivers browse-and-choose value independently.

**Acceptance Scenarios**:

1. **Given** a shopper is on the Mugs category page, **When** they click a product card, **Then** they land on the PDP showing the mug image, name, price, and available variant selectors.
2. **Given** the shopper is on the PDP, **When** they select a different Color or Style, **Then** the hero mockup image updates to the matching photo without a full page reload.
3. **Given** the shopper clicks "Start Designing", **Then** they are taken to the designer view for that mug variant.

---

### User Story 2 — Design a Custom Mug (Priority: P1)

A shopper opens the designer, adds text and/or uploads an image onto the mug canvas, sees the design applied live on a realistic mug preview, and can adjust position, size, font, and color. The canvas enforces the visible print-area boundary.

**Why this priority**: Core value proposition. Without design capability the plugin has no differentiator.

**Independent Test**: A shopper can add text, choose font and color, reposition within the print boundary, and see it reflected live. Delivers a functional designer independently.

**Acceptance Scenarios**:

1. **Given** the shopper is in the designer, **When** they type text and pick a font/color, **Then** the text appears on the mug canvas within the print boundary in real time.
2. **Given** the shopper uploads an image (JPG/PNG, ≤10 MB), **Then** the image appears on the canvas and can be resized and repositioned within the print area.
3. **Given** the shopper drags a design element outside the print boundary, **Then** the element is constrained so it cannot extend beyond the printable region.
4. **Given** the shopper clicks "Next: Review", **Then** they see the Review tab with the design intact.

---

### User Story 3 — Review Design & Add to Cart (Priority: P1)

After designing, the shopper reviews a photorealistic mockup of their mug, confirms product options and quantity, sees the final price, and adds the customized mug to the WooCommerce cart.

**Why this priority**: Completes the purchase funnel. Without add-to-cart there is no revenue.

**Independent Test**: A shopper with a completed design can reach the Review tab, confirm options and price, and successfully add the item to the WooCommerce cart with customization data attached.

**Acceptance Scenarios**:

1. **Given** the shopper is on the Review tab, **Then** they see at least one photorealistic mug mockup reflecting their design (front view).
2. **Given** the shopper clicks "Add to Cart", **Then** the item appears in the WooCommerce cart with the custom design data (text, image references, selected options) attached to the line item.
3. **Given** the cart contains a customized mug and the order is placed, **Then** the admin order view displays the customization details (design text, uploaded image filename, selected options).

---

### User Story 4 — Configure Product Options Inside Designer (Priority: P2)

While in the designer, the shopper can change mug style, size, color, and optional add-ons (lid, gift box) from a side panel. Changing options updates the preview image and adjusts the displayed price in real time.

**Why this priority**: Supports upsell and variant flexibility. Can be layered on after the core P1 designer is working.

**Independent Test**: A shopper can switch mug color inside the designer and see the preview change, and select an add-on and see the price update — independently testable without needing the full PDP flow.

**Acceptance Scenarios**:

1. **Given** the shopper is in the designer, **When** they change the mug color option, **Then** the mug preview updates to the correct color mockup.
2. **Given** the shopper selects an add-on (e.g., gift wrapping), **Then** the displayed price updates to include the add-on cost.

---

### User Story 5 — Admin: Manage Mockup Images (Priority: P2)

A WordPress administrator uploads mug mockup PNG images via the admin panel and maps each to a specific product variant combination (style × size × color × angle). These images are then served on the PDP and in the designer/review views.

**Why this priority**: Required for the admin to maintain the product catalog without developer help. Enables future product expansion.

**Independent Test**: An admin can upload a PNG, assign it to "Classic × 11oz × White × Front", and see it immediately appear as the preview for that combination on the front end.

**Acceptance Scenarios**:

1. **Given** an admin uploads a PNG and assigns it to a variant combination, **When** a shopper selects that combination, **Then** the correct mockup image is displayed.
2. **Given** no mockup image is assigned for a variant combination, **Then** a default placeholder image is shown instead of a broken image.

---

### Edge Cases

- What happens when a shopper uploads an image file larger than 10 MB?
- What happens when a shopper tries to add to cart without placing any design elements?
- How does the system handle a variant combination that has no mockup image assigned?
- What if the shopper's browser does not support canvas-based editing?
- What happens to a design if the shopper navigates away mid-design and returns via browser back?
- How are customization details displayed in the WooCommerce order confirmation email?
- What if a shopper uploads a PNG with a transparent background — is the transparency preserved on the print file?
- What happens if the print-file generation fails after the order is placed?

---

## Requirements *(mandatory)*

### Functional Requirements

**Browse & PDP**
- **FR-001**: System MUST display a Mugs category page listing all mug products with name, price, and thumbnail image.
- **FR-002**: System MUST display a Product Detail Page (PDP) with: hero mockup image, product name, price, variant selectors (Style, Size, Color), and a "Start Designing" CTA.
- **FR-003**: System MUST update the PDP hero mockup image dynamically when the shopper changes a variant selection, without a full page reload.

**Designer Canvas**
- **FR-004**: System MUST display an interactive design canvas showing the selected mug mockup with a clearly marked print-area boundary (green dashed rectangle indicating the printable surface).
- **FR-005**: System MUST allow shoppers to add, edit, and delete text elements on the canvas with controls for: font family, font size, text color, bold, italic, and text alignment.
- **FR-006**: System MUST allow shoppers to upload their own image (JPG, PNG; max 10 MB) and place it on the canvas.
- **FR-007**: System MUST constrain all design elements within the defined print area; elements cannot be placed or scaled to extend outside this boundary.
- **FR-008**: System MUST display the canvas with a "wrap" preview — the print-area rectangle extends to the right of the mug to indicate the full wrap-around surface, with vertical seam-line guides.
- **FR-009**: System MUST provide undo/redo for canvas actions (minimum 10 history steps).
- **FR-010**: System MUST allow shoppers to zoom in/out on the canvas preview.
- **FR-011**: System MUST provide a left-side tool rail with at minimum: Add Text, Upload Image, and Undo/Redo controls.

**Product Configuration in Designer**
- **FR-012**: System MUST provide an options panel in the designer where the shopper can select: Mug Style, Size, Color, and optional Add-ons.
- **FR-013**: System MUST update the mug mockup preview when variant options change inside the designer.
- **FR-014**: System MUST display the current price updated in real time as options and add-ons change.

**Review & Cart**
- **FR-015**: System MUST provide a "Review" tab/view (accessible via top navigation) showing a photorealistic mockup of the finalized mug with the shopper's design applied.
- **FR-016**: System MUST display at minimum the front-view mockup in the Review tab; back/side angles are optional for v1.
- **FR-017**: System MUST allow the shopper to set quantity and add the customized mug to the WooCommerce cart from the Review view.
- **FR-018**: System MUST store custom design data (text content, fonts, colors, uploaded image references, canvas layout JSON) as WooCommerce order item meta.
- **FR-019**: System MUST display customization details in the WooCommerce admin order view.
- **FR-020**: System MUST include customization details in the WooCommerce order confirmation email sent to the customer and admin.

**Mockup Image Management (Admin)**
- **FR-021**: System MUST provide a WordPress admin interface to upload PNG mockup images and map each to a variant combination (style × size × color × angle).
- **FR-022**: System MUST display a default fallback mockup image when no image is assigned to a particular variant combination.

**Print File Generation**
- **FR-023**: System MUST generate a print-ready flat artwork file at minimum 300 DPI equivalent from the customer's canvas design upon order placement.
- **FR-024**: The generated print file MUST be stored securely on the server and accessible only to site administrators.

### Key Entities

- **Mug Product**: A WooCommerce variable product representing a mug. Attributes: Style (e.g., Classic, Travel), Size (e.g., 11oz, 15oz), Color (e.g., White, Black), Add-ons (e.g., Lid, Gift Box).
- **Mockup Image**: A PNG photograph of a specific mug variant at a specific angle (~2000×2000px). Mapped to a variant combination (style × size × color × angle) in the admin.
- **Design**: The shopper's canvas state — text elements (content, font, size, color, position, rotation), image elements (file reference, position, scale, rotation), and the selected variant. Persisted as JSON.
- **Print File**: A high-resolution raster file generated from the Design, representing flat artwork sized for the mug's print area at 300 DPI.
- **Order Item Meta**: WooCommerce metadata attached to a cart/order line item, storing the Design JSON, selected variant, and Print File path.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A shopper can complete the full flow — landing → browse → PDP → design (simple text) → review → add to cart — in under 5 minutes.
- **SC-002**: The designer canvas is interactive within 3 seconds of the page loading on a standard broadband connection.
- **SC-003**: Mockup image updates when switching variants appear within 1 second.
- **SC-004**: 90% of shoppers who reach the designer can successfully add a customized mug to cart without requiring support assistance.
- **SC-005**: All customization data (text, image reference, options) is preserved accurately through cart → checkout → order with zero data loss.
- **SC-006**: Generated print files meet a minimum of 300 DPI at the mug's print dimensions, verified by visual admin review.
- **SC-007**: An admin can upload a new mockup image and assign it to a variant in under 2 minutes without developer assistance.
- **SC-008**: The plugin activates on a standard WordPress 6.4+ and WooCommerce 8.0+ installation without plugin conflicts.

---

## Assumptions

- Client will supply final product photography as PNG files; placeholder images (`images/*.jpg`) are used during development.
- Mockup image naming convention: `{style}-{size}-{color}-{angle}.png` (e.g., `classic-11oz-white-front.png`).
- Initial launch targets mugs only; other drinkware types are out of scope for v1.
- The WordPress site already has WooCommerce installed and configured with basic payment and shipping.
- No special shopper account requirement is imposed; guest checkout is supported.
- The plugin is a standalone WordPress plugin; all data is stored on the client's own server (no SaaS dependency).
- Print file generation is server-side only; third-party print API (e.g., Printful, Printify) integration is out of scope for v1.
- Add-ons (lid, gift box) are modeled as WooCommerce product attributes, not as separate products.
- Clipart/design library is out of scope for v1; shoppers can only add text and their own uploaded images.
