<?php
/**
 * Mugly — Home Page Template
 * Served via template_redirect on is_home() / is_front_page().
 * Full standalone page; bypasses WP block theme to avoid double header.
 */
defined('ABSPATH') || exit;

$shop_url   = get_permalink(wc_get_page_id('shop'));
$mugs_url   = get_term_link('mugs', 'product_cat');
$mugs_url   = is_wp_error($mugs_url) ? $shop_url : $mugs_url;
$cart_count = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
$is_logged  = is_user_logged_in();
$account_url   = $is_logged ? wc_get_account_endpoint_url('dashboard') : wc_get_page_permalink('myaccount');
$account_label = $is_logged ? (get_user_meta(get_current_user_id(), 'first_name', true) ?: 'My Account') : 'Sign In';

$featured_products = wc_get_products([
    'limit'   => 8,
    'status'  => 'publish',
    'orderby' => 'popularity',
    'order'   => 'DESC',
]);
$new_arrivals = wc_get_products([
    'limit'   => 4,
    'status'  => 'publish',
    'orderby' => 'date',
    'order'   => 'DESC',
]);

$cat_img = MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/categories/';
$categories = [
    ['label' => 'Mugs',        'url' => $mugs_url, 'color' => '#f97316', 'img' => $cat_img . 'mugs.jpg'],
    ['label' => 'Photo Books', 'url' => $shop_url, 'color' => '#3b82f6', 'img' => $cat_img . 'photo-books.jpg'],
    ['label' => 'Apparel',     'url' => $shop_url, 'color' => '#8b5cf6', 'img' => $cat_img . 'apparel.jpg'],
    ['label' => 'Phone Cases', 'url' => $shop_url, 'color' => '#06b6d4', 'img' => $cat_img . 'phone-cases.jpg'],
    ['label' => 'Invitations', 'url' => $shop_url, 'color' => '#ec4899', 'img' => $cat_img . 'invitations.jpg'],
    ['label' => 'Wall Art',    'url' => $shop_url, 'color' => '#ef4444', 'img' => $cat_img . 'wall-art.jpg'],
    ['label' => 'Gifts',       'url' => $shop_url, 'color' => '#10b981', 'img' => $cat_img . 'gifts.jpg'],
    ['label' => 'Office',      'url' => $shop_url, 'color' => '#1d4ed8', 'img' => $cat_img . 'office.jpg'],
];
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php bloginfo('name'); ?> — Custom Printed Mugs &amp; Personalized Gifts</title>
  <?php wp_head(); ?>
</head>
<body class="mug-home-body">

<!-- ── Promo Banner ─────────────────────────────────────────────────────── -->
<div class="home-promo-banner">
  <span class="home-promo-tag">LIMITED OFFER</span>
  <span>Free Shipping on Orders Over $35 &nbsp;·&nbsp; Up to 50% Off Sale Items</span>
  <a href="<?php echo esc_url($shop_url); ?>" class="home-promo-cta">Shop Now &rarr;</a>
</div>

<!-- ── Header ───────────────────────────────────────────────────────────── -->
<header class="home-header">
  <div class="home-header-inner">

    <a href="<?php echo esc_url(home_url('/')); ?>" class="home-logo">
      <?php bloginfo('name'); ?>
    </a>

    <form class="home-search-form" method="get" action="<?php echo esc_url(home_url('/')); ?>">
      <input type="text" name="s" class="home-search-input"
             placeholder="Search mugs, designs, occasions…"
             value="<?php echo esc_attr(get_search_query()); ?>">
      <input type="hidden" name="post_type" value="product">
      <button type="submit" class="home-search-btn" aria-label="Search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      </button>
    </form>

    <div class="home-header-actions">
      <a href="<?php echo esc_url($account_url); ?>" class="home-action-link">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span><?php echo esc_html($account_label); ?></span>
      </a>
      <a href="<?php echo esc_url(wc_get_cart_url()); ?>" class="home-action-link home-cart-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <?php if ($cart_count > 0): ?>
          <span class="home-cart-badge"><?php echo esc_html($cart_count); ?></span>
        <?php endif; ?>
        <span>Cart</span>
      </a>
    </div>

  </div>
</header>

<!-- ── Main Navigation ───────────────────────────────────────────────────── -->
<nav class="home-main-nav">
  <div class="home-nav-inner">
    <a href="<?php echo esc_url(home_url('/')); ?>"          class="home-nav-link home-nav-active">Home</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">All Products</a>
    <a href="<?php echo esc_url($mugs_url); ?>"              class="home-nav-link">Mugs</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Photo Books</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Apparel</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Invitations</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Wall Art</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Gifts</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link home-nav-sale">Sale&nbsp;🔥</a>
  </div>
</nav>

<!-- ── Hero ─────────────────────────────────────────────────────────────── -->
<section class="home-hero">
  <div class="home-hero-inner">

    <div class="home-hero-text">
      <p class="home-hero-eyebrow">PERSONALIZED GIFTS &amp; CUSTOM PRINTS</p>
      <h1 class="home-hero-headline">Design Something<br>Unforgettable</h1>
      <p class="home-hero-sub">Upload your photos, add custom text, pick your style — we print and ship fast.</p>
      <div class="home-hero-ctas">
        <a href="<?php echo esc_url($mugs_url); ?>" class="home-btn-primary">Start Designing &rarr;</a>
        <a href="<?php echo esc_url($shop_url); ?>"  class="home-btn-secondary">Browse Designs</a>
      </div>
      <div class="home-hero-trust">
        <span>⭐ 4.9/5 from 10,000+ reviews</span>
        <span>&nbsp;·&nbsp;</span>
        <span>🚚 Free shipping $35+</span>
        <span>&nbsp;·&nbsp;</span>
        <span>❤️ Love It Guarantee</span>
      </div>
    </div>

    <div class="home-hero-visual">
        <div class="home-hero-cards">
        <div class="home-mug-card home-mug-card-1">
          <div class="home-mug-face">
            <img src="https://images.unsplash.com/photo-1528294941335-0d388bc8ac99?w=600&q=80&fit=crop&auto=format" alt="Custom Photo" loading="lazy">
          </div>
          <div class="home-mug-caption">Custom Photo</div>
        </div>
        <div class="home-mug-card home-mug-card-2">
          <div class="home-mug-face">
            <img src="https://images.unsplash.com/photo-1522410818928-5522dacd5066?w=600&q=80&fit=crop&auto=format" alt="Artist Design" loading="lazy">
          </div>
          <div class="home-mug-caption">Artist Design</div>
        </div>
        <div class="home-mug-card home-mug-card-3">
          <div class="home-mug-face">
            <img src="https://images.unsplash.com/photo-1513201099705-a9746e1e201f?w=600&q=80&fit=crop&auto=format" alt="Personalized Gift" loading="lazy">
          </div>
          <div class="home-mug-caption">Personalized Gift</div>
        </div>
        <div class="home-mug-card home-mug-card-4">
          <div class="home-mug-face">
            <img src="https://images.unsplash.com/photo-1679119790850-161688b0417e?w=600&q=80&fit=crop&auto=format" alt="Add Your Text" loading="lazy">
          </div>
          <div class="home-mug-caption">Add Your Text</div>
        </div>
      </div>
    </div>

  </div>
</section>

<!-- ── Shop by Category ──────────────────────────────────────────────────── -->
<section class="home-section home-section-cats">
  <div class="home-section-inner">
    <div class="home-section-hdr">
      <div>
        <p class="home-cat-eyebrow">Browse</p>
        <h2 class="home-section-title">Shop by Category</h2>
      </div>
      <a href="<?php echo esc_url($shop_url); ?>" class="home-see-all">See All &rarr;</a>
    </div>
    <div class="home-cat-grid">
      <?php foreach ($categories as $cat): ?>
        <a href="<?php echo esc_url($cat['url']); ?>" class="home-cat-card" style="--cat-clr:<?php echo esc_attr($cat['color']); ?>">
          <div class="home-cat-thumb">
            <img src="<?php echo esc_url($cat['img']); ?>" alt="<?php echo esc_attr($cat['label']); ?>" loading="lazy">
          </div>
          <span class="home-cat-name"><?php echo esc_html($cat['label']); ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ── Popular Designs ───────────────────────────────────────────────────── -->
<section class="home-section home-section-gray">
  <div class="home-section-inner">
    <div class="home-section-hdr">
      <h2 class="home-section-title">Popular Mug Designs</h2>
      <a href="<?php echo esc_url($shop_url); ?>" class="home-see-all">View All &rarr;</a>
    </div>
    <div class="home-prod-grid">
      <?php foreach ($featured_products as $prod):
        $img_id  = $prod->get_image_id();
        $img_url = $img_id
          ? wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')
          : MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png';
        $rating    = (float) $prod->get_average_rating();
        $rat_count = (int)   $prod->get_rating_count();
      ?>
        <a href="<?php echo esc_url($prod->get_permalink()); ?>" class="home-prod-card">
          <div class="home-prod-img">
            <img src="<?php echo esc_url($img_url); ?>" alt="<?php echo esc_attr($prod->get_name()); ?>" loading="lazy">
            <div class="home-prod-overlay"><span>Customize &rarr;</span></div>
          </div>
          <div class="home-prod-body">
            <?php if ($rat_count > 0): ?>
              <div class="home-prod-stars">
                <?php for ($i = 1; $i <= 5; $i++):
                  $cls = ($i <= $rating) ? 'star-on' : (($i - 0.5 <= $rating) ? 'star-half' : 'star-off');
                ?><span class="hstar <?php echo esc_attr($cls); ?>">★</span><?php endfor; ?>
                <span class="home-rat-cnt">(<?php echo esc_html($rat_count); ?>)</span>
              </div>
            <?php endif; ?>
            <h4 class="home-prod-name"><?php echo esc_html($prod->get_name()); ?></h4>
            <div class="home-prod-price"><?php echo wp_kses_post($prod->get_price_html()); ?></div>
          </div>
        </a>
      <?php endforeach; ?>

      <?php if (empty($featured_products)): ?>
        <a href="<?php echo esc_url($mugs_url); ?>" class="home-prod-card home-prod-cyo">
          <div class="home-prod-img home-prod-cyo-img">
            <span class="home-cyo-plus">＋</span>
            <span class="home-cyo-label">Start Blank</span>
          </div>
          <div class="home-prod-body">
            <h4 class="home-prod-name" style="color:var(--home-accent);">Create Your Own</h4>
            <div class="home-prod-price">From $14.95</div>
          </div>
        </a>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- ── Personalized Gifts Promo ──────────────────────────────────────────── -->
<section class="home-gifting-section">
  <div class="home-gifting-inner">
    <div class="home-gifting-text">
      <p class="home-gifting-eyebrow">PERSONALIZED GIFTS</p>
      <h2 class="home-gifting-title">The Perfect Gift for Every Occasion</h2>
      <p class="home-gifting-body">Birthdays, anniversaries, holidays — a custom mug with a personal photo or message turns any occasion into a lasting memory.</p>
      <div class="home-gifting-occasions">
        <span class="home-occasion-tag">🎂 Birthdays</span>
        <span class="home-occasion-tag">💍 Anniversaries</span>
        <span class="home-occasion-tag">🎄 Holidays</span>
        <span class="home-occasion-tag">👶 New Baby</span>
        <span class="home-occasion-tag">🎓 Graduation</span>
      </div>
      <a href="<?php echo esc_url($mugs_url); ?>" class="home-btn-primary">Customize Now</a>
    </div>
    <div class="home-gifting-visual">
      <div class="home-gift-stack">
        <div class="home-gift-mug home-gift-mug-a">
          <div class="home-gift-mug-body">
            <img src="https://images.unsplash.com/photo-1625649611137-df49dc542f6a?w=400&q=80&fit=crop&auto=format" alt="Birthday" loading="lazy">
          </div>
          <div class="home-gift-mug-lbl">Birthday</div>
        </div>
        <div class="home-gift-mug home-gift-mug-b">
          <div class="home-gift-mug-body">
            <img src="https://images.unsplash.com/photo-1653581489939-a5884bd10795?w=400&q=80&fit=crop&auto=format" alt="Anniversary" loading="lazy">
          </div>
          <div class="home-gift-mug-lbl">Anniversary</div>
        </div>
        <div class="home-gift-mug home-gift-mug-c">
          <div class="home-gift-mug-body">
            <img src="https://images.unsplash.com/photo-1764175760784-d481a3862a52?w=400&q=80&fit=crop&auto=format" alt="Holiday" loading="lazy">
          </div>
          <div class="home-gift-mug-lbl">Holiday</div>
        </div>
      </div>
    </div>
  </div>
</section>

<!-- ── New Arrivals ──────────────────────────────────────────────────────── -->
<?php if (!empty($new_arrivals)): ?>
<section class="home-section">
  <div class="home-section-inner">
    <div class="home-section-hdr">
      <h2 class="home-section-title">New Arrivals</h2>
      <a href="<?php echo esc_url($shop_url . '?orderby=date'); ?>" class="home-see-all">View All &rarr;</a>
    </div>
    <div class="home-prod-grid home-prod-grid-4">
      <?php foreach ($new_arrivals as $prod):
        $img_id  = $prod->get_image_id();
        $img_url = $img_id
          ? wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')
          : MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png';
      ?>
        <a href="<?php echo esc_url($prod->get_permalink()); ?>" class="home-prod-card">
          <div class="home-prod-img">
            <img src="<?php echo esc_url($img_url); ?>" alt="<?php echo esc_attr($prod->get_name()); ?>" loading="lazy">
            <span class="home-new-badge">NEW</span>
            <div class="home-prod-overlay"><span>Customize &rarr;</span></div>
          </div>
          <div class="home-prod-body">
            <h4 class="home-prod-name"><?php echo esc_html($prod->get_name()); ?></h4>
            <div class="home-prod-price"><?php echo wp_kses_post($prod->get_price_html()); ?></div>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- ── Mugly Premium ─────────────────────────────────────────────────────── -->
<section class="home-premium-section">
  <div class="home-premium-inner">
    <div class="home-premium-badge-pill">MUGLY PREMIUM</div>
    <h2 class="home-premium-title">More Perks. More Savings. Every Order.</h2>
    <p class="home-premium-sub">Join Mugly Premium for unlimited free shipping, exclusive discounts, and early access to new designs.</p>
    <div class="home-perks-row">
      <div class="home-perk"><span class="home-perk-ico">🚀</span><span class="home-perk-lbl">Free Shipping Always</span></div>
      <div class="home-perk"><span class="home-perk-ico">💰</span><span class="home-perk-lbl">20% Off Everything</span></div>
      <div class="home-perk"><span class="home-perk-ico">⚡</span><span class="home-perk-lbl">Priority Production</span></div>
      <div class="home-perk"><span class="home-perk-ico">🎁</span><span class="home-perk-lbl">Exclusive Designs</span></div>
    </div>
    <a href="<?php echo esc_url($account_url); ?>" class="home-btn-premium">Join Premium — $9.99/mo</a>
    <p class="home-premium-fine">Cancel anytime. No commitment.</p>
  </div>
</section>

<!-- ── Ideas & Inspiration ──────────────────────────────────────────────── -->
<section class="home-section">
  <div class="home-section-inner">
    <div class="home-section-hdr">
      <h2 class="home-section-title">Ideas &amp; Inspiration</h2>
    </div>
    <div class="home-inspo-grid">
      <?php
      $inspo = [
        ['title' => 'Birthday Mug Ideas', 'sub' => 'Make their day unforgettable',        'bg' => '#fef3c7', 'img' => 'https://images.unsplash.com/photo-1638417568260-32cd7abd212c?w=600&q=80&fit=crop&auto=format'],
        ['title' => 'Office &amp; Desk',  'sub' => 'Bring personality to your workspace', 'bg' => '#ede9fe', 'img' => 'https://images.unsplash.com/photo-1746021535489-00edc5efb203?w=600&q=80&fit=crop&auto=format'],
        ['title' => 'Pet Photo Mugs',     'sub' => 'Celebrate your furry best friend',    'bg' => '#dcfce7', 'img' => 'https://images.unsplash.com/photo-1450778869180-41d0601e046e?w=600&q=80&fit=crop&auto=format'],
        ['title' => 'Wedding Favors',     'sub' => 'Gifts your guests will cherish',      'bg' => '#fce7f3', 'img' => 'https://images.unsplash.com/photo-1515934751635-c81c6bc9a2d8?w=600&q=80&fit=crop&auto=format'],
      ];
      foreach ($inspo as $card): ?>
        <a href="<?php echo esc_url($mugs_url); ?>" class="home-inspo-card">
          <div class="home-inspo-img">
            <img src="<?php echo esc_url($card['img']); ?>" alt="<?php echo esc_attr(wp_strip_all_tags($card['title'])); ?>">
          </div>
          <div class="home-inspo-body" style="background:<?php echo esc_attr($card['bg']); ?>">
            <h4 class="home-inspo-title"><?php echo wp_kses_post($card['title']); ?></h4>
            <p class="home-inspo-sub"><?php echo esc_html($card['sub']); ?></p>
            <span class="home-inspo-link">Explore &rarr;</span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ── Trust Badges ─────────────────────────────────────────────────────── -->
<section class="home-trust-section">
  <div class="home-trust-inner">
    <div class="home-trust-card">
      <div class="home-trust-ico">❤️</div>
      <h4 class="home-trust-title">Love It Guarantee</h4>
      <p class="home-trust-body">Not satisfied? We'll replace it or give you a full refund — no questions asked.</p>
    </div>
    <div class="home-trust-card">
      <div class="home-trust-ico">🚚</div>
      <h4 class="home-trust-title">Free Shipping</h4>
      <p class="home-trust-body">Free standard shipping on all orders over $35. Expedited options always available.</p>
    </div>
    <div class="home-trust-card">
      <div class="home-trust-ico">🔒</div>
      <h4 class="home-trust-title">Secure Shopping</h4>
      <p class="home-trust-body">Your payment and personal data are protected with industry-grade encryption.</p>
    </div>
    <div class="home-trust-card">
      <div class="home-trust-ico">⭐</div>
      <h4 class="home-trust-title">Premium Quality</h4>
      <p class="home-trust-body">300 DPI printing on ceramic mugs — vibrant, dishwasher-safe, built to last.</p>
    </div>
  </div>
</section>

<!-- ── Newsletter ───────────────────────────────────────────────────────── -->
<section class="home-newsletter-section">
  <div class="home-newsletter-inner">
    <div class="home-newsletter-text">
      <h2 class="home-newsletter-title">Get Inspired in Your Inbox</h2>
      <p class="home-newsletter-sub">Join 50,000+ customers. New designs, exclusive deals, and gift ideas — delivered weekly.</p>
    </div>
    <form class="home-newsletter-form" onsubmit="return false;">
      <input type="email" class="home-newsletter-input" placeholder="Your email address">
      <button type="submit" class="home-newsletter-btn">Subscribe</button>
    </form>
    <p class="home-newsletter-fine">No spam. Unsubscribe anytime.</p>
  </div>
</section>

<!-- ── Footer ───────────────────────────────────────────────────────────── -->
<footer class="home-footer">
  <div class="home-footer-top">
    <div class="home-footer-brand">
      <a href="<?php echo esc_url(home_url('/')); ?>" class="home-footer-logo"><?php bloginfo('name'); ?></a>
      <p class="home-footer-tagline">Custom mugs &amp; personalized gifts crafted with love.</p>
      <div class="home-footer-social">
        <a href="#" class="home-social-ico soc-ig" aria-label="Instagram">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
        </a>
        <a href="#" class="home-social-ico soc-fb" aria-label="Facebook">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
        <a href="#" class="home-social-ico soc-pin" aria-label="Pinterest">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z"/></svg>
        </a>
        <a href="#" class="home-social-ico soc-tw" aria-label="Twitter/X">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.847L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>
        </a>
      </div>
    </div>

    <div class="home-footer-col">
      <h4 class="home-footer-col-hd">Shop</h4>
      <ul class="home-footer-links">
        <li><a href="<?php echo esc_url($shop_url); ?>">All Products</a></li>
        <li><a href="<?php echo esc_url($mugs_url); ?>">Mugs</a></li>
        <li><a href="<?php echo esc_url($shop_url . '?orderby=date'); ?>">New Arrivals</a></li>
        <li><a href="<?php echo esc_url($shop_url . '?orderby=popularity'); ?>">Best Sellers</a></li>
        <li><a href="<?php echo esc_url($shop_url); ?>">Sale Items</a></li>
        <li><a href="<?php echo esc_url($shop_url); ?>">Gift Ideas</a></li>
      </ul>
    </div>

    <div class="home-footer-col">
      <h4 class="home-footer-col-hd">Help</h4>
      <ul class="home-footer-links">
        <li><a href="#">How It Works</a></li>
        <li><a href="#">Shipping Info</a></li>
        <li><a href="#">Returns &amp; Refunds</a></li>
        <li><a href="#">Track My Order</a></li>
        <li><a href="#">FAQs</a></li>
        <li><a href="#">Contact Us</a></li>
      </ul>
    </div>

    <div class="home-footer-col">
      <h4 class="home-footer-col-hd">Company</h4>
      <ul class="home-footer-links">
        <li><a href="#">About Us</a></li>
        <li><a href="#">Careers</a></li>
        <li><a href="#">Press</a></li>
        <li><a href="#">Blog</a></li>
        <li><a href="#">Affiliates</a></li>
      </ul>
    </div>
  </div><!-- /.home-footer-top -->

  <div class="home-footer-bottom">
    <p class="home-footer-copy">&copy; <?php echo esc_html(date('Y')); ?> <?php bloginfo('name'); ?>. All rights reserved.</p>
    <div class="home-footer-legal">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
      <a href="#">Cookie Preferences</a>
    </div>
    <div class="home-payment-row">
      <span class="home-pay-badge">VISA</span>
      <span class="home-pay-badge">MC</span>
      <span class="home-pay-badge">AMEX</span>
      <span class="home-pay-badge">PayPal</span>
      <span class="home-pay-badge">Apple Pay</span>
    </div>
  </div>
</footer>

<?php wp_footer(); ?>
</body>
</html>
