---
id: 0022
title: Cart thumbnail — strip data-URL fallback
stage: refactor
date: 2026-05-10
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: implement
labels: [cart, checkout, bugfix, thumbnail, zazzle-parity]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/templates/woocommerce/cart/cart.php
  - mug-customizer/templates/woocommerce/checkout/form-checkout.php
  - mug-customizer/mug-customizer.php
tests:
  - manual: clear browser cache, hard-reload designer, add fresh item to cart, verify cart thumbnail shows Review-angle composite (real photo + warped design) with NO green outline / Safe area pill / dim label / placeholder
  - manual: open existing cart with legacy item — verify it now falls back to WC product image instead of dirty editor canvas
  - manual: checkout page right-rail order summary thumb — same checks as cart
---

## Prompt

ok implement kro yeh prompt

(Reference: prior turn's "Bug Fix Prompt: Cart/Checkout Thumbnail Leaks Editor Canvas Instead of Review-Angle Mockup" — the H1–H5 hypothesis-ranked debug plan with disk/network/code-audit sequence.)

## Response snapshot

Diagnostic sequence run:

- **H1 — Bundle staleness:** ruled out. `MUG_CUSTOMIZER_VERSION = 2.0.6`, `wp_enqueue_script('mug-customizer-canvas', …, MUG_CUSTOMIZER_VERSION)` correctly cache-busts. Source ↔ XAMPP md5sums match for `canvas-editor.js`, `cart.php`, and `mug-customizer.php`.
- **H2 — `_captureReviewSnapshot` failing:** ruled out. Inspected `wp-content/uploads/mug-designs/previews/` — latest PNG (`preview-2378459af2d4-1778432669.png`, May 10 22:04, exact screenshot timestamp) is a clean Review composite (real photographed mug + "HASSAM RAUF" vertical text), no green outline / Safe-area pill / dim label / placeholder. All 6 disk previews are similarly clean. So the snapshot helper IS producing correct output.
- **H3 — Stale preview file on disk:** ruled out by H2 above. Disk is clean.
- **H4 — Second leaking code path:** audited every `toDataURL` caller in `canvas-editor.js` and `review.js`. All callers correctly remove guides via `excludeFromExport` filter or use `_captureReviewSnapshot`. Only one Add-to-Cart entry point (`#review-add-to-cart`).
- **H5 — Server save bug:** ruled out. `class-rest-api.php /cart/add` correctly calls `save_preview_from_data_url`, sets `design['preview_url']`, and `unset($design['mockup_data_url'])` on success.

**Root cause:** legacy cart-item meta. Cart row visible in screenshot was added BEFORE v2.0.5/2.0.6 fixes shipped — its stored `_mug_design` payload still carries `mockup_data_url` (inline base64 of the dirty editor canvas) with no `preview_url` set. The cart template's fallback chain `preview_url → mockup_data_url` rendered the legacy dirty data URL. Architecture is sound; only the legacy fallback was the leak.

**Fix (v2.0.7) — defensive, smallest-viable diff:**

1. `templates/woocommerce/cart/cart.php` — drop the `mockup_data_url` `elseif` branch entirely. Only render `$design['preview_url']` (saved file). If missing, fall through to WC default product image (per-color mug PNG). Removed the inline `data:` URL escaping path.
2. `templates/woocommerce/checkout/form-checkout.php` — same change in the right-rail order summary.
3. `mug-customizer.php` — bumped `MUG_CUSTOMIZER_VERSION` to `2.0.7` (cache-busts the unchanged JS too, since template changes alone wouldn't trigger a CDN-style refetch on shoppers' browsers).

**Why this is safe:**
- New items via v2.0.6+ always have `preview_url` (server-saved file). They render correctly.
- Legacy items with only `mockup_data_url` will show the WC product image instead of dirty canvas. Acceptable degradation.
- If `save_preview_from_data_url` ever fails (write permission), cart still degrades to product image — never to dirty canvas.

## Outcome

- ✅ Impact: Cart and checkout thumbnails will never render the editor canvas with print-area chrome (green dashed outline, Safe-area pill, "9.5″×3.5″" dim label, "Your text here" placeholder, sample mug icon) under any cart-item-meta state, fresh or legacy.
- 🧪 Tests: manual smoke test pending (user to clear cache, remove old cart row, add fresh item, verify cart + checkout)
- 📁 Files: 3 modified (2 templates + version bump). No JS changes needed — JS path was already correct.
- 🔁 Next prompts:
  - User confirms cart now shows clean Review-angle composite for fresh adds
  - If the residual grey square in the disk PNGs is unacceptable, fix the `renderRealAngleView` shading gradient (~line 1736) to composite-source-atop the design only
  - Commit v2.0.1 → v2.0.7 fixes as a single feature/fix commit
- 🧠 Reflection: when a multi-step fix chain ships piecemeal across versions, ALWAYS treat `cart_item_data` as a forward-compat surface — old session carts will outlive your code. The fallback chain that "made the migration easy" is exactly what kept the legacy bug visible. Defensive default in templates: never render data URLs from arbitrary stored meta.

## Evaluation notes (flywheel)

- Failure modes observed: prior fix iterations (v2.0.5/v2.0.6) targeted the JS capture path correctly but didn't account for legacy session-cart data persisting across redeploys. The "still buggy" report was a session-state artifact, not a code regression.
- Graders run and results (PASS/FAIL): static audit PASS (md5 sync, version constant, enqueue cache-buster, REST flow, all `toDataURL` callers); disk evidence PASS (clean PNGs); template diff PASS (data URL path fully removed).
- Prompt variant (if applicable): hypothesis-ranked debug prompt (H1→H5) — high signal, isolated each layer cleanly before patching.
- Next experiment (smallest change to try): if any future cart item leaks chrome, add a debug logger in `class-rest-api.php /cart/add` that hashes the incoming `mockup_data_url` and writes it next to the saved preview file, so we can trace JS-side regressions vs server-side regressions independently.
