---
id: "0005"
title: Category Page Zazzle Parity — Full Custom Template
stage: green
date: 2026-04-26
surface: agent
model: claude-sonnet-4-6
feature: 001-mug-customizer-plugin
branch: 001-mug-customizer-plugin
user: hassam-rauf
command: /sp.implement
labels: ["category","template-override","woocommerce","zazzle-parity","css","php","mug-store"]
links:
  spec: specs/001-mug-customizer-plugin/spec.md
  ticket: null
  adr: null
  pr: null
files:
  - mug-customizer/public/templates/cat-template.php (created)
  - mug-customizer/public/assets/css/cat.css (created)
  - mug-customizer/public/class-frontend.php (category template_redirect + cat.css enqueue)
tests:
  - cat.css loaded via wp_head enqueue ✅
  - No WP block theme header/footer wrapper (only 1 CSS reference in style tag, no nav elements) ✅
  - Promo banner renders ✅
  - Custom header (logo + search + account/cart) renders ✅
  - Main nav with Mugs active ✅
  - Page hero "Personalized Custom Mugs" + stats row renders ✅
  - Breadcrumb renders ✅
  - Filter sidebar "Refine Results" renders with Style/Size/Color/Price groups ✅
  - 3-column product grid renders ✅
  - Product card shows image, price ($19.99), color swatches (Black/White/Red/Blue/Green), "Explore designs →" button ✅
  - Create Your Own card renders with designer link ✅
  - "Personalize Existing Designs" section (10 tiles) renders ✅
  - "More Than Just a Mug" section (6 drinkware cards) renders ✅
  - "Ideas & Inspiration" section (4 cards) renders ✅
  - Educational FAQ section (3 blocks) renders ✅
  - Newsletter signup section renders ✅
  - Footer (brand + 3 columns + social icons + bottom bar) renders ✅
---

## Prompt

User: "https://www.zazzle.com/custom/mugs this is zazzzle mug store and http://localhost/mug_store_Zazzle/mugs/ this is our mug store act like an expert research gaps and flaws in our woo commerce plug in frist check functionality of zazzle then find out gaps. We need same layout structure, functionality of this page like zazzle ok"

## Response snapshot

### Gap Analysis (18 gaps identified)

**Root cause**: The `/mugs/` page was a WP page with `[mug_category]` shortcode rendered inside Twenty Twenty-Five block theme — causing double header. Cards had no CTAs, no color swatches, no ratings. Many below-grid sections (Personalize Existing Designs, More Drinkware, Ideas & Inspiration, FAQ, Newsletter) entirely absent.

### Gaps Closed

- **G01** — Double header eliminated via `template_redirect` + full standalone template ✅
- **G02** — Page hero added: "Personalized Custom Mugs" + eyebrow + sub + dual CTAs + 4-stat panel ✅
- **G03** — Active filter chips bar (appears when filters applied, each dismissable) ✅
- **G04** — "Explore designs →" orange CTA button on every product card ✅
- **G05** — Color variant swatches on product cards (from WC variation attributes) ✅
- **G06** — Star rating row on product cards ✅
- **G07** — Sale percentage badge (–N%) on product card image ✅
- **G08** — Hover overlay "Quick View" on card image ✅
- **G09** — 3-column product grid (previously 2-col on narrow sidebar layout) ✅
- **G10** — "Personalize Existing Designs" section with 10 design-category tiles ✅
- **G11** — "More Than Just a Mug" section with 6 drinkware gradient cards (Travel Tumblers NEW!, Water Bottles, Wine Glasses, Pint Glasses, Shot Glasses, Beer Steins) ✅
- **G12** — "Ideas & Inspiration" section (4 pastel article cards) ✅
- **G13** — Educational FAQ block ("How do I create a mug? What styles? What occasions?") ✅
- **G14** — Newsletter signup section ✅
- **G15** — Full proper footer (matches home page: multi-column, social icons, payment row, copyright) ✅
- **G16** — Collapsible filter accordion with open/closed toggle + aria-expanded ✅
- **G17** — "Shop All Mugs →" link in designs section header ✅
- **G18** — Added "Most Popular" sort option ✅

### Implementation

**`cat-template.php`** (~300 lines):
- Full standalone `<!DOCTYPE html>` with `wp_head()` / `wp_footer()`
- Reuses `.home-*` classes from `home.css` for promo banner, header, nav, newsletter, footer (zero duplication)
- Handles both `is_product_category()` (WC archive) and `is_page('mugs')` (WP page)
- `get_queried_object()` instanceof check: `WP_Term` → use term name; else fallback "Mugs"
- Variation attributes normalized with `strtolower()` before `$v_attrs['color']` lookup (same fix as pdp-template.php)
- JS: filter accordion toggle (aria-expanded + .open class), color swatch toggle (hidden inputs)

**`cat.css`** (~280 lines):
- `.mug-cat-body` body reset (same as `.mug-home-body`)
- CSS vars: `--cat-brand`, `--cat-accent`, `--cat-max: 1320px`
- Hero: `flex` layout, dark gradient, eyebrow + headline + CTA + ghost btn + stats panel
- Main layout: `grid-template-columns: 230px 1fr`; sidebar sticky `top:72px`
- Filter accordion: `max-height:0 → 300px` with CSS transition
- Product grid: `repeat(3,1fr)` → 2-col at 1100px → 2-col at 768px → 1-col at 500px
- Product card: image with scale hover, `.cat-sale-pill` badge, `.cat-card-swatches`, `.cat-explore-btn` (orange)
- Design tiles: `repeat(5,1fr)` grid with colored backgrounds
- More drinkware: `repeat(6,1fr)` gradient cards
- Inspo: `repeat(4,1fr)` pastel cards
- FAQ: `repeat(3,1fr)` white bordered blocks

**`class-frontend.php`** changes:
- `enqueue_assets()`: `if (is_product_category() || is_page('mugs'))` → enqueue `cat.css`
- `maybe_load_designer_template()`: added before `is_product()` check → `include cat-template.php; exit`

## Outcome

- ✅ Impact: Mug category page now matches Zazzle's layout — page hero, 3-col grid, enhanced product cards with swatches/ratings/explore CTA, 5 new below-grid sections, proper footer
- 🧪 Tests: 17/17 element presence checks passed
- 📁 Files: 2 created (cat-template.php, cat.css), 1 modified (class-frontend.php)
- 🔁 Next prompts: Add more products/variants to DB, category page pagination, mobile QA, staging sync
- 🧠 Reflection: Template_redirect pattern now established for all 4 page types (home, category, product, designer/review). No code duplication — cat template reuses all home.css classes for shared UI

## Evaluation notes (flywheel)

- Failure modes observed: none — pattern established from home/PDP sessions carried over cleanly
- Graders run and results (PASS/FAIL): curl element presence — 17/17 PASS
- Prompt variant (if applicable): gap analysis + implement in single session
- Next experiment: add real category photos per design tile by assigning WP media to product category terms
