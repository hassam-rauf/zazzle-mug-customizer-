<?php
/**
 * Mugly — Category Page Template
 * Served via template_redirect on is_product_category() or the /mugs/ WP page.
 * Full standalone page; bypasses WP block theme to eliminate double header.
 */
defined('ABSPATH') || exit;

// URLs
$shop_url    = get_permalink(wc_get_page_id('shop'));
$mugs_url    = get_term_link('mugs', 'product_cat');
$mugs_url    = is_wp_error($mugs_url) ? $shop_url : $mugs_url;
$current_url = strtok($_SERVER['REQUEST_URI'] ?? '/mugs/', '?');
$cart_count  = WC()->cart ? WC()->cart->get_cart_contents_count() : 0;
$is_logged   = is_user_logged_in();
$account_url   = $is_logged ? wc_get_account_endpoint_url('dashboard') : wc_get_page_permalink('myaccount');
$account_label = $is_logged ? (get_user_meta(get_current_user_id(), 'first_name', true) ?: 'My Account') : 'Sign In';

// Page title — handle both WC category archive and WP page
$queried = get_queried_object();
$term_name = ($queried instanceof WP_Term) ? $queried->name : 'Mugs';

// Filter params
$filter_style = array_filter(array_map('sanitize_text_field', (array) ($_GET['mug_style'] ?? [])));
$filter_size  = array_filter(array_map('sanitize_text_field', (array) ($_GET['mug_size']  ?? [])));
$filter_color = array_filter(array_map('sanitize_text_field', (array) ($_GET['mug_color'] ?? [])));
$filter_price = sanitize_text_field($_GET['mug_price'] ?? '');
$sort         = sanitize_text_field($_GET['mug_sort'] ?? 'date');
$has_filters  = !empty($filter_style) || !empty($filter_size) || !empty($filter_color) || $filter_price;
$paged        = max(1, intval($_GET['cat_page'] ?? 1));
$per_page     = 12;

// Product query (paginated)
$query_args = ['limit' => $per_page, 'page' => $paged, 'paginate' => true, 'status' => 'publish', 'return' => 'objects'];
switch ($sort) {
    case 'price_asc':  $query_args['orderby'] = 'price';      $query_args['order'] = 'ASC';  break;
    case 'price_desc': $query_args['orderby'] = 'price';      $query_args['order'] = 'DESC'; break;
    case 'popularity': $query_args['orderby'] = 'popularity'; $query_args['order'] = 'DESC'; break;
    default:           $query_args['orderby'] = 'date';       $query_args['order'] = 'DESC'; break;
}
$result    = wc_get_products($query_args);
$products  = $result->products;
$total     = (int) $result->total;
$max_pages = (int) $result->max_num_pages;
$from      = ($paged - 1) * $per_page + 1;
$to        = min($paged * $per_page, $total);

// Filter options
$styles     = ['Classic Mug' => 'classic-mug', 'Two-Tone Mug' => 'two-tone-mug', 'Travel Mug' => 'travel-mug', 'Espresso Mug' => 'espresso-mug'];
$sizes      = ['11 oz' => '11-oz', '15 oz' => '15-oz', '20 oz' => '20-oz'];
$price_opts = ['under15' => 'Under $15', '15to25' => '$15 – $25', 'over25' => '$25+'];
$filter_colors = [
    'white'  => '#f5f5f5',
    'black'  => '#111111',
    'red'    => '#dc2626',
    'blue'   => '#2563eb',
    'green'  => '#16a34a',
    'yellow' => '#f59e0b',
    'pink'   => '#ec4899',
    'navy'   => '#1e3a8a',
];

// Card-level color hex map
$color_hex = [
    'white'  => '#f5f5f5', 'black'  => '#111111', 'red'    => '#dc2626',
    'blue'   => '#2563eb', 'green'  => '#16a34a', 'yellow' => '#f59e0b',
    'pink'   => '#ec4899', 'navy'   => '#1e3a8a', 'maroon' => '#7f1d1d',
    'orange' => '#f97316', 'purple' => '#7c3aed', 'teal'   => '#0d9488',
];

// First product for CYO
$first_prod = wc_get_products(['limit' => 1, 'status' => 'publish']);
$cyo_id     = !empty($first_prod) ? $first_prod[0]->get_id() : 0;
$cyo_url    = $cyo_id ? home_url('/mug-designer/?product_id=' . $cyo_id) : '#';
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title><?php echo esc_html($term_name); ?> &mdash; <?php bloginfo('name'); ?></title>
  <?php wp_head(); ?>
</head>
<body class="mug-cat-body">

<!-- ── Promo Banner ──────────────────────────────────────────────────────── -->
<div class="home-promo-banner">
  <span class="home-promo-tag">LIMITED OFFER</span>
  <span>Free Shipping on Orders Over $35 &nbsp;&middot;&nbsp; Up to 50% Off Sale Items</span>
  <a href="<?php echo esc_url($shop_url); ?>" class="home-promo-cta">Shop Now &rarr;</a>
</div>

<!-- ── Header ────────────────────────────────────────────────────────────── -->
<header class="home-header">
  <div class="home-header-inner">
    <a href="<?php echo esc_url(home_url('/')); ?>" class="home-logo"><?php bloginfo('name'); ?></a>
    <form class="home-search-form" method="get" action="<?php echo esc_url(home_url('/')); ?>">
      <input type="text" name="s" class="home-search-input"
             placeholder="Search mugs, designs, occasions&hellip;"
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
    <a href="<?php echo esc_url(home_url('/')); ?>"          class="home-nav-link">Home</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">All Products</a>
    <a href="<?php echo esc_url($mugs_url); ?>"              class="home-nav-link home-nav-active">Mugs</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Photo Books</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Apparel</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Invitations</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Wall Art</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link">Gifts</a>
    <a href="<?php echo esc_url($shop_url); ?>"              class="home-nav-link home-nav-sale">Sale&nbsp;🔥</a>
  </div>
</nav>

<!-- ── Page Hero ─────────────────────────────────────────────────────────── -->
<section class="cat-hero">
  <div class="cat-hero-inner">
    <div class="cat-hero-text">
      <p class="cat-hero-eyebrow">100% Custom &nbsp;&middot;&nbsp; 300 DPI Print &nbsp;&middot;&nbsp; Ships in 2&ndash;5 Days</p>
      <h1 class="cat-hero-headline">Personalized Custom <?php echo esc_html($term_name); ?></h1>
      <p class="cat-hero-sub">Upload your own photo or image, add a personal message, and create a one-of-a-kind mug delivered right to your door.</p>
      <div class="cat-hero-ctas">
        <a href="<?php echo esc_url($cyo_url); ?>" class="home-btn-primary">Create Your Own &rarr;</a>
        <a href="#cat-products"                    class="cat-btn-ghost">Browse Designs</a>
      </div>
    </div>
    <div class="cat-hero-stats">
      <div class="cat-stat"><span class="cat-stat-n">50K+</span><span class="cat-stat-l">Designs Made</span></div>
      <div class="cat-stat"><span class="cat-stat-n">4.9&#9733;</span><span class="cat-stat-l">Avg Rating</span></div>
      <div class="cat-stat"><span class="cat-stat-n">2&ndash;5</span><span class="cat-stat-l">Day Delivery</span></div>
      <div class="cat-stat"><span class="cat-stat-n">100%</span><span class="cat-stat-l">Guarantee</span></div>
    </div>
  </div>
</section>

<!-- ── Breadcrumb ────────────────────────────────────────────────────────── -->
<div class="cat-breadcrumb">
  <div class="cat-bc-inner">
    <a href="<?php echo esc_url(home_url('/')); ?>">Home</a>
    <span class="cat-bc-sep">&rsaquo;</span>
    <a href="<?php echo esc_url($shop_url); ?>">Drinkware</a>
    <span class="cat-bc-sep">&rsaquo;</span>
    <span><?php echo esc_html($term_name); ?></span>
  </div>
</div>

<!-- ── Active Filter Chips ───────────────────────────────────────────────── -->
<?php if ($has_filters): ?>
<div class="cat-active-bar">
  <div class="cat-active-bar-inner">
    <span class="cat-af-lbl">Active Filters:</span>
    <?php foreach ($filter_style as $fs): ?>
      <a href="<?php echo esc_url($current_url); ?>" class="cat-af-chip"><?php echo esc_html(str_replace('-', ' ', ucwords($fs, '-'))); ?> &times;</a>
    <?php endforeach; ?>
    <?php foreach ($filter_size as $fz): ?>
      <a href="<?php echo esc_url($current_url); ?>" class="cat-af-chip"><?php echo esc_html(str_replace('-', ' ', ucwords($fz, '-'))); ?> &times;</a>
    <?php endforeach; ?>
    <?php foreach ($filter_color as $fc): ?>
      <a href="<?php echo esc_url($current_url); ?>" class="cat-af-chip"><?php echo esc_html(ucfirst($fc)); ?> &times;</a>
    <?php endforeach; ?>
    <?php if ($filter_price && isset($price_opts[$filter_price])): ?>
      <a href="<?php echo esc_url($current_url); ?>" class="cat-af-chip"><?php echo esc_html($price_opts[$filter_price]); ?> &times;</a>
    <?php endif; ?>
    <a href="<?php echo esc_url($current_url); ?>" class="cat-af-clear">Clear All</a>
  </div>
</div>
<?php endif; ?>

<!-- ── Main: Sidebar + Products ──────────────────────────────────────────── -->
<div class="cat-main" id="cat-products">
  <div class="cat-main-inner">

    <!-- ── Filter Sidebar ──────────────────────────────────────────────── -->
    <aside class="cat-sidebar">
      <div class="cat-sidebar-hd">
        <h3 class="cat-sidebar-title">Refine Results</h3>
        <a href="<?php echo esc_url($current_url); ?>" class="cat-clear-all">Clear All</a>
      </div>

      <form method="get" action="<?php echo esc_url($current_url); ?>" id="cat-filter-form">

        <!-- Style -->
        <div class="cat-filter-grp">
          <button type="button" class="cat-filter-toggle" aria-expanded="true">
            <span>Style</span>
            <svg class="cat-tog-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <div class="cat-filter-body open">
            <?php foreach ($styles as $label => $val): ?>
              <label class="cat-ck-label">
                <input type="checkbox" name="mug_style[]" value="<?php echo esc_attr($val); ?>" <?php checked(in_array($val, $filter_style)); ?>>
                <span><?php echo esc_html($label); ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Size -->
        <div class="cat-filter-grp">
          <button type="button" class="cat-filter-toggle" aria-expanded="true">
            <span>Size</span>
            <svg class="cat-tog-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <div class="cat-filter-body open">
            <?php foreach ($sizes as $label => $val): ?>
              <label class="cat-ck-label">
                <input type="checkbox" name="mug_size[]" value="<?php echo esc_attr($val); ?>" <?php checked(in_array($val, $filter_size)); ?>>
                <span><?php echo esc_html($label); ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Color -->
        <div class="cat-filter-grp">
          <button type="button" class="cat-filter-toggle" aria-expanded="true">
            <span>Color</span>
            <svg class="cat-tog-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <div class="cat-filter-body open">
            <div class="cat-swatch-row">
              <?php foreach ($filter_colors as $cname => $hex): ?>
                <div class="cat-fswatch <?php echo in_array($cname, $filter_color) ? 'cat-fswatch-on' : ''; ?>"
                     style="background:<?php echo esc_attr($hex); ?><?php echo ($cname === 'white') ? ';border-color:#ccc' : ''; ?>"
                     data-color="<?php echo esc_attr($cname); ?>"
                     title="<?php echo esc_attr(ucfirst($cname)); ?>">
                  <?php if (in_array($cname, $filter_color)): ?><span class="cat-fswatch-chk">&#10003;</span><?php endif; ?>
                </div>
              <?php endforeach; ?>
            </div>
            <?php foreach ($filter_color as $c): ?>
              <input type="hidden" name="mug_color[]" value="<?php echo esc_attr($c); ?>">
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Price -->
        <div class="cat-filter-grp">
          <button type="button" class="cat-filter-toggle" aria-expanded="true">
            <span>Price</span>
            <svg class="cat-tog-ico" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 15l-6-6-6 6"/></svg>
          </button>
          <div class="cat-filter-body open">
            <?php foreach ($price_opts as $pval => $plabel): ?>
              <label class="cat-ck-label">
                <input type="radio" name="mug_price" value="<?php echo esc_attr($pval); ?>" <?php checked($filter_price, $pval); ?>>
                <span><?php echo esc_html($plabel); ?></span>
              </label>
            <?php endforeach; ?>
          </div>
        </div>

        <button type="submit" class="cat-apply-btn">Apply Filters</button>
      </form>
    </aside><!-- /.cat-sidebar -->

    <!-- ── Products Area ─────────────────────────────────────────────────── -->
    <div class="cat-products-area">

      <!-- Results Bar -->
      <div class="cat-results-bar">
        <div class="cat-count">
          <?php if ($total > 0): ?>
            Showing <strong><?php echo esc_html($from); ?>–<?php echo esc_html($to); ?></strong> of <strong><?php echo esc_html($total); ?></strong> <?php echo esc_html($total === 1 ? 'design' : 'designs'); ?>
          <?php else: ?>
            <strong>0</strong> designs found
          <?php endif; ?>
        </div>
        <form method="get" action="<?php echo esc_url($current_url); ?>" class="cat-sort-form">
          <?php foreach ($_GET as $k => $v): if ($k === 'mug_sort') continue;
            if (is_array($v)): foreach ($v as $vi): ?>
              <input type="hidden" name="<?php echo esc_attr($k); ?>[]" value="<?php echo esc_attr($vi); ?>">
            <?php endforeach; else: ?>
              <input type="hidden" name="<?php echo esc_attr($k); ?>" value="<?php echo esc_attr($v); ?>">
            <?php endif; ?>
          <?php endforeach; ?>
          <select name="mug_sort" onchange="this.form.submit()" class="cat-sort-sel">
            <option value="date"       <?php selected($sort, 'date'); ?>>Sort: Newest</option>
            <option value="popularity" <?php selected($sort, 'popularity'); ?>>Most Popular</option>
            <option value="price_asc"  <?php selected($sort, 'price_asc'); ?>>Price: Low to High</option>
            <option value="price_desc" <?php selected($sort, 'price_desc'); ?>>Price: High to Low</option>
          </select>
        </form>
      </div><!-- /.cat-results-bar -->

      <!-- 3-Column Product Grid -->
      <div class="cat-prod-grid">

        <?php foreach ($products as $prod):
          $img_id  = $prod->get_image_id();
          $img_url = $img_id
            ? wp_get_attachment_image_url($img_id, 'woocommerce_thumbnail')
            : MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png';
          $rating  = (float) $prod->get_average_rating();
          $rat_cnt = (int)   $prod->get_rating_count();
          $is_sale = $prod->is_on_sale();
          $reg_p   = (float) $prod->get_regular_price();
          $sale_pct = ($is_sale && $reg_p > 0)
            ? round((1 - (float) $prod->get_price() / $reg_p) * 100) : 0;

          // Variant color swatches for this card
          $card_colors = [];
          if ($prod->is_type('variable')) {
              $v_attrs = [];
              foreach ($prod->get_variation_attributes() as $k => $v) {
                  $v_attrs[strtolower($k)] = array_values((array) $v);
              }
              $card_colors = array_slice($v_attrs['color'] ?? [], 0, 8);
              $total_colors = count($v_attrs['color'] ?? []);
          } else {
              $total_colors = 0;
          }
        ?>
          <div class="cat-card">
            <!-- Image -->
            <a href="<?php echo esc_url($prod->get_permalink()); ?>" class="cat-card-img-wrap">
              <img src="<?php echo esc_url($img_url); ?>" alt="<?php echo esc_attr($prod->get_name()); ?>" loading="lazy" class="cat-card-img">
              <div class="cat-card-overlay"><span>Quick View</span></div>
              <?php if ($is_sale && $sale_pct > 0): ?>
                <span class="cat-sale-pill">&minus;<?php echo esc_html($sale_pct); ?>%</span>
              <?php endif; ?>
            </a>

            <!-- Body -->
            <div class="cat-card-body">
              <?php if ($rat_cnt > 0): ?>
                <div class="cat-stars-row">
                  <?php for ($i = 1; $i <= 5; $i++):
                    $sc = ($i <= $rating) ? 'son' : (($i - 0.5 <= $rating) ? 'shalf' : 'soff');
                  ?><span class="cst <?php echo esc_attr($sc); ?>">&#9733;</span><?php endfor; ?>
                  <span class="cat-rat-n">(<?php echo esc_html($rat_cnt); ?>)</span>
                </div>
              <?php endif; ?>

              <h4 class="cat-card-name">
                <a href="<?php echo esc_url($prod->get_permalink()); ?>"><?php echo esc_html($prod->get_name()); ?></a>
              </h4>

              <div class="cat-card-price"><?php echo wp_kses_post($prod->get_price_html()); ?></div>

              <!-- Color variant swatches -->
              <?php if (!empty($card_colors)): ?>
                <div class="cat-card-swatches">
                  <?php foreach ($card_colors as $c):
                    $cl = strtolower(trim($c));
                    $hx = $color_hex[$cl] ?? '#e5e7eb';
                  ?>
                    <span class="cat-card-sw" style="background:<?php echo esc_attr($hx); ?><?php echo ($cl === 'white') ? ';border-color:#ccc' : ''; ?>" title="<?php echo esc_attr(ucfirst($c)); ?>"></span>
                  <?php endforeach; ?>
                  <?php if ($total_colors > 8): ?>
                    <span class="cat-card-sw-more">+<?php echo esc_html($total_colors - 8); ?></span>
                  <?php endif; ?>
                </div>
              <?php endif; ?>

              <a href="<?php echo esc_url($prod->get_permalink()); ?>" class="cat-explore-btn">
                Explore designs &rarr;
              </a>
            </div>
          </div><!-- /.cat-card -->

        <?php endforeach; ?>

        <!-- Create Your Own card -->
        <div class="cat-card cat-card-cyo">
          <a href="<?php echo esc_url($cyo_url); ?>" class="cat-card-img-wrap cat-cyo-img-wrap">
            <div class="cat-cyo-placeholder">
              <span class="cat-cyo-plus">&#xFF0B;</span>
              <span class="cat-cyo-sub">Start Blank</span>
            </div>
          </a>
          <div class="cat-card-body">
            <h4 class="cat-card-name"><a href="<?php echo esc_url($cyo_url); ?>" style="color:var(--cat-accent);">Create Your Own</a></h4>
            <div class="cat-card-price cat-cyo-price">From $14.95</div>
            <p class="cat-cyo-desc">Upload a photo, add text, choose your style.</p>
            <a href="<?php echo esc_url($cyo_url); ?>" class="cat-explore-btn cat-explore-cyo">Start Designing &rarr;</a>
          </div>
        </div>

      </div><!-- /.cat-prod-grid -->

      <?php if ($max_pages > 1):
        // Build a URL preserving all current filters but overriding cat_page
        $page_params = array_diff_key($_GET, ['cat_page' => '']);
      ?>
      <nav class="cat-pagination" aria-label="Products pagination">
        <?php if ($paged > 1):
          $prev_url = esc_url(add_query_arg(array_merge($page_params, ['cat_page' => $paged - 1]), $current_url));
        ?>
          <a href="<?php echo $prev_url; ?>" class="cat-page-btn cat-page-prev">&#8592; Prev</a>
        <?php endif; ?>

        <?php
        // Show at most 7 page links: always first, last, and up to 5 around current
        $window = 2;
        $shown  = [];
        for ($p = 1; $p <= $max_pages; $p++) {
            if ($p === 1 || $p === $max_pages || abs($p - $paged) <= $window) {
                $shown[] = $p;
            }
        }
        $prev_shown = null;
        foreach ($shown as $p):
            if ($prev_shown !== null && $p - $prev_shown > 1): ?>
              <span class="cat-page-ellipsis">…</span>
            <?php endif;
            $p_url   = esc_url(add_query_arg(array_merge($page_params, ['cat_page' => $p]), $current_url));
            $is_curr = ($p === $paged);
        ?>
            <a href="<?php echo $p_url; ?>"
               class="cat-page-btn<?php echo $is_curr ? ' cat-page-active' : ''; ?>"
               <?php if ($is_curr) echo 'aria-current="page"'; ?>>
              <?php echo esc_html($p); ?>
            </a>
        <?php $prev_shown = $p; endforeach; ?>

        <?php if ($paged < $max_pages):
          $next_url = esc_url(add_query_arg(array_merge($page_params, ['cat_page' => $paged + 1]), $current_url));
        ?>
          <a href="<?php echo $next_url; ?>" class="cat-page-btn cat-page-next">Next &#8594;</a>
        <?php endif; ?>
      </nav>
      <?php endif; ?>

    </div><!-- /.cat-products-area -->
  </div><!-- /.cat-main-inner -->
</div><!-- /.cat-main -->

<!-- ── Personalize Existing Designs ──────────────────────────────────────── -->
<section class="cat-designs-section">
  <div class="cat-designs-inner">
    <div class="cat-section-hdr">
      <h2 class="cat-section-title">Personalize Existing Designs</h2>
      <a href="<?php echo esc_url($mugs_url); ?>" class="cat-section-link">Shop All <?php echo esc_html($term_name); ?> &rarr;</a>
    </div>
    <div class="cat-design-tiles">
      <?php
      $design_cats = [
        ['label' => 'Photo Mugs',              'ico' => '📷', 'bg' => '#dbeafe'],
        ['label' => 'Funny &amp; Witty',       'ico' => '😄', 'bg' => '#fef9c3'],
        ['label' => 'Names &amp; Monograms',   'ico' => '✍️',  'bg' => '#ede9fe'],
        ['label' => 'Wedding &amp; Couples',   'ico' => '💍', 'bg' => '#fce7f3'],
        ['label' => 'Travel Mugs',             'ico' => '✈️',  'bg' => '#dcfce7'],
        ['label' => 'Boss &amp; Coworkers',    'ico' => '💼', 'bg' => '#f0fdf4'],
        ['label' => 'Teacher',                 'ico' => '🍎', 'bg' => '#fef3c7'],
        ['label' => 'Espresso',                'ico' => '☕', 'bg' => '#fff7ed'],
        ['label' => 'Beer Mugs &amp; Steins',  'ico' => '🍺', 'bg' => '#fefce8'],
        ['label' => 'Seasonal &amp; Holiday',  'ico' => '🎄', 'bg' => '#f0fdf4'],
      ];
      foreach ($design_cats as $dc): ?>
        <a href="<?php echo esc_url($mugs_url); ?>" class="cat-design-tile" style="background:<?php echo esc_attr($dc['bg']); ?>">
          <span class="cat-tile-ico"><?php echo $dc['ico']; ?></span>
          <span class="cat-tile-lbl"><?php echo wp_kses_post($dc['label']); ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ── More Than Just a Mug ──────────────────────────────────────────────── -->
<section class="cat-more-section">
  <div class="cat-more-inner">
    <div class="cat-section-hdr">
      <h2 class="cat-section-title">More Than Just a Mug</h2>
      <a href="<?php echo esc_url($shop_url); ?>" class="cat-section-link">Shop More Drinkware &rarr;</a>
    </div>
    <div class="cat-more-grid">
      <?php
      $drinkware = [
        ['label' => 'Travel Tumblers', 'ico' => '🥤', 'new' => true,  'grad' => 'linear-gradient(135deg,#0ea5e9,#38bdf8)'],
        ['label' => 'Water Bottles',   'ico' => '💧', 'new' => false, 'grad' => 'linear-gradient(135deg,#06b6d4,#22d3ee)'],
        ['label' => 'Wine Glasses',    'ico' => '🍷', 'new' => false, 'grad' => 'linear-gradient(135deg,#7c3aed,#a78bfa)'],
        ['label' => 'Pint Glasses',    'ico' => '🍺', 'new' => false, 'grad' => 'linear-gradient(135deg,#f59e0b,#fcd34d)'],
        ['label' => 'Shot Glasses',    'ico' => '🥃', 'new' => false, 'grad' => 'linear-gradient(135deg,#10b981,#34d399)'],
        ['label' => 'Beer Steins',     'ico' => '🍻', 'new' => false, 'grad' => 'linear-gradient(135deg,#dc2626,#f87171)'],
      ];
      foreach ($drinkware as $dw): ?>
        <a href="<?php echo esc_url($shop_url); ?>" class="cat-more-card" style="background:<?php echo esc_attr($dw['grad']); ?>">
          <?php if ($dw['new']): ?><span class="cat-more-new-badge">NEW</span><?php endif; ?>
          <span class="cat-more-ico"><?php echo $dw['ico']; ?></span>
          <span class="cat-more-lbl"><?php echo esc_html($dw['label']); ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ── Ideas & Inspiration ───────────────────────────────────────────────── -->
<section class="cat-inspo-section">
  <div class="cat-inspo-inner">
    <h2 class="cat-section-title" style="margin-bottom:24px;">Ideas &amp; Inspiration</h2>
    <div class="cat-inspo-grid">
      <?php
      $inspo = [
        ['title' => 'Best Mugs for Coffee Lovers',   'sub' => '8 styles compared by capacity &amp; material', 'ico' => '☕', 'bg' => '#fff7ed'],
        ['title' => 'Photo Mug Gift Guide 2025',     'sub' => 'Perfect for birthdays, Mother\'s Day &amp; more', 'ico' => '🎁', 'bg' => '#fef3c7'],
        ['title' => 'Types of Custom Drinkware',     'sub' => 'Classic, travel, espresso — which is right?',   'ico' => '📋', 'bg' => '#ede9fe'],
        ['title' => 'DIY: Succulent Mug Planter',   'sub' => 'Upcycle your mug into a cute planter',          'ico' => '🌿', 'bg' => '#dcfce7'],
      ];
      foreach ($inspo as $card): ?>
        <div class="cat-inspo-card" style="background:<?php echo esc_attr($card['bg']); ?>">
          <div class="cat-inspo-ico"><?php echo $card['ico']; ?></div>
          <h4 class="cat-inspo-card-title"><?php echo esc_html($card['title']); ?></h4>
          <p class="cat-inspo-card-sub"><?php echo wp_kses_post($card['sub']); ?></p>
          <a href="#" class="cat-inspo-link">Read More &rarr;</a>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ── Educational FAQ ───────────────────────────────────────────────────── -->
<section class="cat-faq-section">
  <div class="cat-faq-inner">
    <h2 class="cat-faq-title">Custom <?php echo esc_html($term_name); ?> &mdash; Your Questions Answered</h2>
    <div class="cat-faq-grid">
      <div class="cat-faq-block">
        <h3 class="cat-faq-q">How do I create a custom mug?</h3>
        <ol class="cat-faq-ol">
          <li>Choose your mug style &mdash; Classic, Two-Tone, Travel, or Espresso</li>
          <li>Upload your photo or pick a pre-made design template</li>
          <li>Add custom text, adjust layout, pick your color</li>
          <li>Place your order &mdash; we print and ship in 2&ndash;5 days</li>
        </ol>
      </div>
      <div class="cat-faq-block">
        <h3 class="cat-faq-q">What mug styles do we offer?</h3>
        <ul class="cat-faq-ul">
          <li><strong>Classic Mug</strong> &mdash; 11oz or 15oz, dishwasher safe</li>
          <li><strong>Two-Tone Mug</strong> &mdash; Colored handle &amp; interior</li>
          <li><strong>Travel Mug</strong> &mdash; Insulated, spill-resistant lid</li>
          <li><strong>Espresso Mug</strong> &mdash; Compact 3oz, perfect gift</li>
        </ul>
      </div>
      <div class="cat-faq-block">
        <h3 class="cat-faq-q">What occasions are custom mugs perfect for?</h3>
        <ul class="cat-faq-ul">
          <li>Birthdays &amp; anniversaries</li>
          <li>Weddings &amp; bridal showers</li>
          <li>Corporate gifts &amp; office milestones</li>
          <li>Mother&rsquo;s Day, Father&rsquo;s Day &amp; holidays</li>
          <li>Graduation &amp; retirement gifts</li>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- ── Newsletter ────────────────────────────────────────────────────────── -->
<section class="home-newsletter-section">
  <div class="home-newsletter-inner">
    <div class="home-newsletter-text">
      <h2 class="home-newsletter-title">Get Exclusive Offers</h2>
      <p class="home-newsletter-sub">New mug designs, flash sales, and inspiration &mdash; straight to your inbox.</p>
    </div>
    <form class="home-newsletter-form" onsubmit="return false;">
      <input type="email" class="home-newsletter-input" placeholder="Your email address">
      <button type="submit" class="home-newsletter-btn">Sign Up Now</button>
    </form>
    <p class="home-newsletter-fine">No spam. Unsubscribe anytime.</p>
  </div>
</section>

<!-- ── Footer ────────────────────────────────────────────────────────────── -->
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
        <li><a href="<?php echo esc_url($shop_url); ?>">Gift Ideas</a></li>
      </ul>
    </div>
    <div class="home-footer-col">
      <h4 class="home-footer-col-hd">Help</h4>
      <ul class="home-footer-links">
        <li><a href="#">How It Works</a></li>
        <li><a href="#">Shipping Info</a></li>
        <li><a href="#">Returns &amp; Refunds</a></li>
        <li><a href="#">FAQs</a></li>
        <li><a href="#">Contact Us</a></li>
      </ul>
    </div>
    <div class="home-footer-col">
      <h4 class="home-footer-col-hd">Company</h4>
      <ul class="home-footer-links">
        <li><a href="#">About Us</a></li>
        <li><a href="#">Blog</a></li>
        <li><a href="#">Careers</a></li>
        <li><a href="#">Affiliates</a></li>
      </ul>
    </div>
  </div><!-- /.home-footer-top -->
  <div class="home-footer-bottom">
    <p class="home-footer-copy">&copy; <?php echo esc_html(date('Y')); ?> <?php bloginfo('name'); ?>. All rights reserved.</p>
    <div class="home-footer-legal">
      <a href="#">Privacy Policy</a>
      <a href="#">Terms of Service</a>
    </div>
    <div class="home-payment-row">
      <span class="home-pay-badge">VISA</span>
      <span class="home-pay-badge">MC</span>
      <span class="home-pay-badge">AMEX</span>
      <span class="home-pay-badge">PayPal</span>
    </div>
  </div>
</footer>

<script>
(function () {
  /* Filter accordion */
  document.querySelectorAll('.cat-filter-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var expanded = this.getAttribute('aria-expanded') === 'true';
      this.setAttribute('aria-expanded', String(!expanded));
      var body = this.nextElementSibling;
      body.classList.toggle('open');
      this.querySelector('.cat-tog-ico').style.transform = expanded ? 'rotate(180deg)' : '';
    });
  });

  /* Color swatch toggle */
  document.querySelectorAll('.cat-fswatch').forEach(function (sw) {
    sw.addEventListener('click', function () {
      var color   = this.dataset.color;
      var form    = document.getElementById('cat-filter-form');
      var existing = form.querySelector('input[name="mug_color[]"][value="' + color + '"]');
      if (existing) {
        existing.remove();
        this.classList.remove('cat-fswatch-on');
        var chk = this.querySelector('.cat-fswatch-chk');
        if (chk) chk.remove();
      } else {
        var inp = document.createElement('input');
        inp.type = 'hidden'; inp.name = 'mug_color[]'; inp.value = color;
        form.appendChild(inp);
        this.classList.add('cat-fswatch-on');
        var chk = document.createElement('span');
        chk.className = 'cat-fswatch-chk'; chk.textContent = '✓';
        this.appendChild(chk);
      }
    });
  });
})();
</script>
<?php wp_footer(); ?>
</body>
</html>
