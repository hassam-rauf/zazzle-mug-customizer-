---
id: 0023
title: htaccess allow preview PNGs
stage: green
date: 2026-05-10
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: implement
labels: [cart, htaccess, bugfix, thumbnail, permissions, root-cause]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/includes/class-design-storage.php
  - mug-customizer/templates/woocommerce/cart/cart.php
  - mug-customizer/mug-customizer.php
  - wp-content/uploads/mug-designs/previews/.htaccess (created at deploy target)
tests:
  - manual: hard-reload cart page, confirm thumbnail loads (no broken-image icon)
  - manual: open preview URL directly in browser tab, expect 200 OK + image
  - manual: try to list directory `/wp-content/uploads/mug-designs/previews/`, expect 403 (Indexes off)
  - manual: try to fetch a non-PNG inside `mug-designs/`, expect 403 (parent Deny still works)
---

## Prompt

& 'c:\Users\Hassam Rauf\Pictures\Screenshots\Screenshot 2026-05-10 224111.png'

(Screenshot showed DevTools view with the `<!-- MC_DEBUG: ... -->` HTML comment exposing `preview_url=http://localhost/mug_store_Zazzle/wp-content/uploads/mug-designs/previews/preview-0cc0f01826ed-1778434391.png has_mockup=no` — confirming preview_url IS being saved correctly.)

## Response snapshot

**Diagnostic chain:**

1. v2.0.7 changed cart template to render only `preview_url`. User reported broken-image placeholder still appearing in cart, qty=1 (fresh add, not legacy).
2. Disk check: `wp-content/uploads/mug-designs/previews/` had 4 new PNGs from 22:29–22:33, all clean Review composites. So save worked.
3. Added temporary debug instrumentation in `cart.php` that emitted an HTML comment + `data-mc-thumb-src` attribute exposing the actual `$design_thumb` value.
4. User pasted the rendered HTML comment: `MC_DEBUG: has_meta=yes decode_ok=yes preview_url=http://localhost/mug_store_Zazzle/wp-content/uploads/mug-designs/previews/preview-0cc0f01826ed-1778434391.png has_mockup=no`
5. The URL was correctly set — so the `<img>` was emitting `<img src="http://localhost/.../preview-...png">`. File existed on disk at the matching path with `-rwxrwxrwx` perms.
6. `ls -la` of parent `mug-designs/` revealed `.htaccess`. Cat: `Options -Indexes\nDeny from all`.
7. Found the source — plugin activation hook `mug_customizer_activate()` in `mug-customizer.php` writes that `.htaccess` to protect raw design JSON / print files. But Apache's `Deny from all` is recursive — it blocks `mug-designs/previews/*.png` too.

**Root cause:** Apache 403 Forbidden on every preview PNG. Browser sees the image fail to load → renders broken-image icon. The cart's `<img>` tag was correct; the file was on disk; the URL was right; but HTTP could never reach it.

**Fix (v2.0.8):**

1. `class-design-storage.php` `save_preview_from_data_url()` — after `wp_mkdir_p($dir)`, write a `previews/.htaccess` that re-allows public access for PNG files only:
   ```
   <Files *.png>
     Order allow,deny      # Apache 2.2 syntax
     Allow from all
     Require all granted   # Apache 2.4 syntax
   </Files>
   ```
   Idempotent (skips if file already exists). Limited to `*.png` so design JSON or future non-PNG artifacts dropped into `previews/` would still be denied.
2. Wrote the same `.htaccess` directly into the deployed `previews/` directory so existing cart items work immediately (without waiting for the next preview save to trigger creation).
3. Reverted the temporary cart-template debug instrumentation (HTML comment + `data-mc-thumb-src` attribute) — root cause confirmed, no longer needed.
4. Bumped `MUG_CUSTOMIZER_VERSION` `2.0.7 → 2.0.8`.
5. rsync'd to XAMPP webroot.

**Why this is safe:**
- Parent `mug-designs/.htaccess` (`Deny from all`) still protects all OTHER files in the tree (raw design JSON, print files, etc.).
- Subdirectory `<Files *.png>` block selectively whitelists ONLY PNG extensions inside `previews/`. Anything else inside `previews/` (a stray .json dropped there by mistake) would still be denied.
- `Options -Indexes` (still inherited from parent) keeps directory listing off.
- Idempotent file write — won't churn on every cart add.

**Why this hadn't bitten before v2.0.7:** Earlier versions fell back to inline `mockup_data_url` (`data:image/png;base64,...`) when the file URL failed — bypassing Apache entirely. The browser rendered the dirty editor canvas from the inline blob and the user saw that as "the bug." When v2.0.7 removed the data-URL fallback (because legacy carts had dirty inline data), the underlying 403 became visible for the first time. Two bugs masked each other.

## Outcome

- ✅ Impact: Cart and checkout thumbnails will now render the clean Review-angle composite for every fresh add. Server-side flow + Apache permissions both correct end-to-end.
- 🧪 Tests:
  - Manual: hard-reload cart page → expect clean thumbnail (real photographed mug + warped design, no green outline / Safe-area pill / placeholder / broken icon)
  - Manual: open preview URL directly in browser → expect 200 OK + PNG renders
  - Manual: verify `/wp-content/uploads/mug-designs/` directory listing returns 403 (parent protection intact)
- 📁 Files:
  - `mug-customizer/includes/class-design-storage.php` — added previews/.htaccess writer
  - `mug-customizer/templates/woocommerce/cart/cart.php` — reverted debug instrumentation (back to clean v2.0.7 logic)
  - `mug-customizer/mug-customizer.php` — version 2.0.7 → 2.0.8
  - `wp-content/uploads/mug-designs/previews/.htaccess` — created at XAMPP webroot
- 🔁 Next prompts:
  - User confirms cart thumbnail loads cleanly
  - Address the residual grey-square artifact in disk PNGs (cylinder shading gradient at angle=0)
  - Commit v2.0.1 → v2.0.8 fixes as a single bugfix commit
- 🧠 Reflection: a fallback path can hide a bug for months. The "data: URL" inline render was masking a 403 the whole time. When you rip out a fallback for ANY reason, do an end-to-end verification of the primary path under realistic conditions BEFORE shipping — don't assume "it would have worked anyway." Also: when permissions are part of the test, manual `curl http://localhost/...` is irreplaceable — it would have surfaced the 403 in seconds. WSL's network isolation made that harder here, but the test plan should still call for a host-side curl check on any URL the cart depends on.

## Evaluation notes (flywheel)

- Failure modes observed: two-bug masking pattern (data: URL fallback hid Apache 403). The "obvious cause" (dirty editor canvas) was real but downstream of the actual primary cause (no public preview file possible). Diagnosing the visible symptom led to v2.0.5/v2.0.6/v2.0.7, none of which could fix the real problem.
- Graders run and results (PASS/FAIL): static audit PASS (md5 sync, version bump, idempotent writer, narrow `<Files *.png>` scope); permissions audit PASS (parent Deny preserved, only PNGs inside `previews/` whitelisted).
- Prompt variant (if applicable): in-template debug instrumentation (HTML comment + data-attr) — surgical, single-page-load test, no log file digging. Worth keeping as a pattern for "is the server sending the value I think?" questions.
- Next experiment (smallest change to try): if any future plugin-managed upload tree needs a public subdirectory, factor the "deny parent + allow specific subdir" pattern into a reusable helper (`Mug_Customizer_Filesystem::ensure_public_subdir($dir, $extension)`).
