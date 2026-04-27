---
id: 002
title: Mug Customizer Plugin Architecture Plan
stage: plan
date: 2026-04-23
surface: agent
model: claude-sonnet-4-6
feature: mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /sp.plan
labels: ["plan","woocommerce","fabric.js","php","imagick","canvas","print-file","architecture"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-mug-customizer-plugin/plan.md
  - specs/001-mug-customizer-plugin/research.md
  - specs/001-mug-customizer-plugin/data-model.md
  - specs/001-mug-customizer-plugin/quickstart.md
  - specs/001-mug-customizer-plugin/contracts/rest-api.md
  - CLAUDE.md
tests:
  - null
---

## Prompt

ok ab start kro Bismillah k naam se

(Context: User confirmed full Zazzle-exact feature scope, decided to run /sp.plan to generate technical architecture for the WooCommerce mug customizer plugin.)

## Response snapshot

Generated complete 6-phase implementation plan with all Phase 0 and Phase 1 artifacts:

**Research (Phase 0) — research.md:**
- Canvas: Fabric.js 6.x (over Konva.js) — IText, clipPath, toDataURL 4× multiplier
- WC integration: Variable Product + 6 WC hooks (add_cart_item_data, checkout_create_order_line_item, admin_order_item_values, email_order_items_args, cart_calculate_fees)
- Print file: PHP Imagick, 4× multiplier → 975×1125px (11oz), 1050×1200px with bleed
- Mockup strategy: Static transparent PNGs, admin-uploaded, JS lookup map via wp_localize_script
- Frontend: Vanilla JS + Fabric.js, no build pipeline

**Data Model (Phase 1) — data-model.md:**
- 6 entities: Mug Product (postmeta), Design (Fabric JSON), Cart Item Meta, Order Item Meta, Mockup Image (WP attachment), Print File (filesystem)
- Validation rules: clipPath boundary, 10MB upload limit, ≥1 canvas object before cart

**REST API Contracts — contracts/rest-api.md:**
- 5 endpoints: GET /variants/{product_id}, POST /designs/save, POST /designs/export, POST /cart/add, POST /mockups/upload

**Plugin Structure:**
- `mug-customizer/` with includes/ (PHP core), admin/, public/templates/, public/assets/js/ (canvas-editor.js, pdp.js, review.js)
- 6 architectural decisions (AD-001 to AD-006)

**6-Week Implementation Phases:**
- Phase 1: Plugin bootstrap + PDP variant switching
- Phase 2: Fabric.js designer canvas + print boundary
- Phase 3: Image upload + options panel
- Phase 4: Review tab + Add to Cart
- Phase 5: Order meta + print file generation
- Phase 6: Polish + testing

## Outcome

- ✅ Impact: Complete technical architecture ready — all decisions made, no unknowns remaining
- 🧪 Tests: quickstart.md has 14-item manual test checklist
- 📁 Files: plan.md, research.md, data-model.md, quickstart.md, contracts/rest-api.md, CLAUDE.md updated
- 🔁 Next prompts: /sp.tasks — generate granular implementation tasks from plan
- 🧠 Reflection: All 6 architectural decisions documented in plan. Fabric.js + WC Variable Product + PHP Imagick is the correct minimal stack for shared WordPress hosting.

## Evaluation notes (flywheel)

- Failure modes observed: First research agent had no web access — resolved from internal knowledge
- Graders run and results (PASS/FAIL): Constitution check — all 6 gates PASS
- Prompt variant (if applicable): null
- Next experiment (smallest change to try): Run /sp.tasks to break plan into implementable tasks
