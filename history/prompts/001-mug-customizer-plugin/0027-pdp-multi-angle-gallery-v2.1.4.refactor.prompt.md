---
id: 0027
title: PDP multi-angle gallery v2.1.4
stage: refactor
date: 2026-05-12
surface: agent
model: claude-opus-4-7
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: implement
labels: [pdp, gallery, images, ux, zazzle-parity]
links:
  spec: null
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/templates/pdp-template.php
  - mug-customizer/public/assets/js/pdp.js
  - mug-customizer/public/assets/css/pdp.css
  - mug-customizer/mug-customizer.php
tests:
  - manual: open any product PDP — thumb strip shows 7 real mug photos (front, front-left, front-right, left, right, handle, lifestyle) NOT empty grey placeholder boxes
  - manual: click each thumb — main hero image swaps instantly
  - manual: under Style heading — 4 photo swatches with upgrade-price chips (Classic / Travel +$1.75 / Espresso +$2.50 / Two-Tone +$4.35)
  - manual: clicking a style swatch updates the "selected style" label
  - manual: red promo line "Save 15% with code MAY15" appears between price and shipping note
  - manual: "Customize It →" CTA URL includes selected variant in query string
---

## Prompt

implement this prompt

(Reference: prior turn's UI/UX prompt — "Zazzle-parity PDP with multi-angle gallery". Driven by user-shared screenshots showing Zazzle's PDP (multi-thumb gallery + visual style swatches with upgrade prices + promo line) vs the local PDP (empty placeholder boxes labeled "Side" / "Lifestyle" + plain text radio buttons).)

## Response snapshot

### Discovery
- PDP template (`pdp-template.php`) was already comprehensive — header, breadcrumb, 3-col grid, ratings, price block, option pills, delivery estimate, CTA, trust badges, About section, Reviews. Only 2 critical pieces were broken/missing:
  - **Image gallery was empty** — it used a `mockup_map` keyed by variant, but admin hadn't uploaded variant-specific mockups, so every thumb fell back to a single `placeholder-mug.png`.
  - **Style selector was text-only** — 4 plain `.pill` buttons instead of visual swatches with photos + upgrade-price chips like Zazzle.
- Plugin's `public/assets/images/` directory already had 8 real mug angle photos (`mug-center.jpg`, `mug-front-left.jpg`, `mug-front-right.jpg`, `mug-left.jpg`, `mug-right.jpg`, `mug-handle.jpg`, `mug-donut.jpg`, `mug-classic-white.png`) from prior work — just unused on the PDP.
- The 7 angle photos (excluding the transparent-cutout `classic-white.png` which is for the designer) map cleanly to a 7-thumb vertical strip.

### Changes shipped (v2.1.4)

**1. PDP template — angle photo registry + fallback chain**
- Defined `$default_angle_imgs` mapping 7 angle keys → existing photo URLs.
- Introduced a fallback: variant-specific mockup wins, else use the matching angle photo, else placeholder.
- Replaced the hard-coded `['front', 'back', 'side', 'lifestyle']` array with the 7-angle list ordered for visual flow.
- Added `$angle_labels` for proper alt-text and `title` attributes (accessibility + hover tooltips).
- First thumb is `loading="eager"`, rest `loading="lazy"`.

**2. Visual style swatch selector** (`.pdp-style-swatches`)
- 78px-wide cards, each containing: 62×62 photo thumb + style name + upgrade-price chip (`+$1.75`, etc.).
- Static `$style_upgrade` map (`classic=0`, `travel=1.75`, `espresso=2.50`, `two-tone=4.35`) since WC variations don't trivially expose per-style price deltas — production version should pull from each variation's actual price minus the base SKU's.
- Each swatch maps to a distinct photo angle so styles are visually distinguishable even though we only have Classic mug photos shipped.
- Uses both `.pdp-style-swatch` and `.pill` classes so the existing `pdp.js` click handler (which listens on `.pill[data-option]`) catches it without modification.

**3. Promo code red line**
- Sits between `per mug` subscript and the shipping note.
- Pulls the code from `get_option('mc_promo_code', 'MAY15')` so admin can change it later via WP options or a filter (`mug_pdp_promo_code`).

**4. JS fallback chain** (`pdp.js`)
- `getMockupUrl(angle)` now: `mockupMap[key] || defaultAngles[angle] || placeholder`.
- `defaultAngles` comes through `window.mugPdpConfig.defaultAngles` (server-injected from PHP).
- `updateAllThumbs()` reads `data-angle` instead of a hard-coded 4-item array, so 7 thumbs work correctly.

**5. CSS additions** (`pdp.css`)
- `.pdp-promo-line` — red 13px, bold for the strong tag.
- `.pdp-style-swatches` + `.pdp-style-swatch` + child elements (`.pdp-ss-thumb`, `.pdp-ss-name`, `.pdp-ss-upgrade`) — card grid with photo + name + upgrade chip.
- Selected state: brand-blue 2px border on the card, inset blue ring on the thumb.

### Version + deploy
- `MUG_CUSTOMIZER_VERSION` 2.1.3 → 2.1.4
- rsync'd to XAMPP webroot.

## Outcome

- ✅ Impact: PDP went from "empty placeholder boxes that look broken" to a Zazzle-style multi-angle gallery with 7 real photos + visual style swatches with upgrade prices. The single biggest visual upgrade since the cart/checkout overhaul.
- 🧪 Tests: 6 manual checks — first thumb shows actual mug photo, clicking thumbs swaps hero, style swatches show photos + upgrade chips, etc.
- 📁 Files: 4 modified (template + JS + CSS + version).
- 🔁 Next prompts:
  - User screenshot of new PDP to confirm
  - Once green: commit + push v2.1.4
  - Deferred: pull upgrade prices from real WC variation pricing, add "Transfer design to a product" carousel, Ask Zee assistant placeholder
- 🧠 Reflection: when a feature looks "broken" but the template is already comprehensive, suspect a data-wiring issue — not a missing feature. Here the entire gallery infrastructure was built; the problem was `mockup_map` was empty (no admin uploads yet) and there was no fallback to the photos that already shipped in the plugin. Three-tier fallback chains (variant-specific → generic → placeholder) are an underused pattern for handing graceful-degradation between admin-curated content and shipped defaults.

## Evaluation notes (flywheel)

- Failure modes observed: missing-data masquerading as missing-feature. The user perceived "PDP isn't built" but actually it was 90% built, just rendering placeholders because no data flowed through.
- Graders run and results (PASS/FAIL): static review PASS — fallback chain ordered correctly (variant → angle → placeholder), JS reads `data-angle` dynamically so 7 thumbs work, CSS classes don't collide with existing `.pill` styles.
- Prompt variant (if applicable): screenshot-driven gap analysis → prioritized prompt → implementation. High signal — 4 surgical changes vs a from-scratch rewrite.
- Next experiment (smallest change to try): wire the style swatch upgrade prices to real WC variation deltas via `wc_get_product_variations()` instead of static array, so the chips stay accurate when admin changes pricing.
