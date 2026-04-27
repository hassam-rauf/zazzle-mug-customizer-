---
id: "0002"
title: Environment Setup — Product & Routing Verification
stage: green
date: 2026-04-26
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: "XAMPP is running, continue from where we left off"
labels: ["setup","product","routing","verification","woocommerce"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - specs/001-mug-customizer-plugin/tasks.md
  - mug-customizer/public/class-frontend.php
tests:
  - "GET /product/custom-mug/ → 200 + Personalize This Mug button present"
  - "GET /mug-designer/?product_id=14 → 200 + canvas, tool-rail, Fabric.js loaded"
  - "GET /mug-review/?product_id=14 → 200"
  - "GET /wp-json/mug-customizer/v1/variants/14 → 200 + mockupMap, printAreaConfig, addonPrices"
---

## Prompt

XAMPP is running, continue from where we left off

## Response snapshot

Resumed from prior session. Identified pending tasks: T018 (plugin activate verify), T023 (variable product setup), T029 (designer page routing).

**Actions taken:**
1. Confirmed plugin active in DB (`active_plugins` includes `mug-customizer/mug-customizer.php`) → **T018 ✅**
2. Wrote and ran `setup-product.php` to: rename product to "Custom Photo Mug", add Style/Size/Color attributes, delete 3 old variations, generate 60 new variations (4×3×5 at $19.99), write `_print_area_config`, `_variant_mockup_map`, `_addon_prices` post meta, flush rewrite rules → **T023 ✅**
3. Confirmed rewrite rules flushed + URI fallback in `class-frontend.php` handles `/mug-designer/` without needing a WP page → **T029 ✅**
4. Discovered WooCommerce "Coming Soon" mode was enabled — disabled it via DB (`woocommerce_coming_soon=no`, `woocommerce_store_pages_only=no`)
5. Verified all 4 key URLs return HTTP 200
6. Confirmed "Personalize This Mug →" button renders on PDP at line 408-409
7. Marked T018, T023, T029 complete in tasks.md; deleted setup-product.php

**REST API response verified:** `/wp-json/mug-customizer/v1/variants/14` returns full mockupMap (60 keys), printAreaConfig (4 styles), addonPrices.

## Outcome

- ✅ Impact: All 3 pending setup tasks (T018, T023, T029) resolved. Plugin live with product and routing working.
- 🧪 Tests: All 4 HTTP checks pass (200). Button and canvas elements verified in HTML.
- 📁 Files: tasks.md (3 tasks marked [X])
- 🔁 Next prompts: T065 mobile notice, T067 remove debug logs, T068 end-to-end shopper flow
- 🧠 Reflection: WC "Coming Soon" mode was an invisible blocker — product page returned 200 but showed placeholder content. Always check WC store mode when PDP seems blank.

## Evaluation notes (flywheel)

- Failure modes observed: WooCommerce Coming Soon mode silently replaced product template with placeholder; WSL curl uses Windows host IP (172.21.48.1), not localhost
- Graders run and results (PASS/FAIL): Manual HTTP status checks PASS; button presence check PASS; REST API structure PASS
- Prompt variant (if applicable): null
- Next experiment: Run quickstart.md checklist items manually in browser
