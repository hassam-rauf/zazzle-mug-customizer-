<?php
defined('ABSPATH') || exit;

// Get filter params
$filter_style  = array_filter((array) ($_GET['mug_style']  ?? []));
$filter_size   = array_filter((array) ($_GET['mug_size']   ?? []));
$filter_color  = array_filter((array) ($_GET['mug_color']  ?? []));
$filter_price  = sanitize_text_field($_GET['mug_price']  ?? '');
$sort          = sanitize_text_field($_GET['mug_sort']   ?? 'date');
$paged         = max(1, (int) ($_GET['mug_page'] ?? 1));

// Build WC query args
$query_args = [
    'limit'   => 8,
    'page'    => $paged,
    'status'  => 'publish',
    'return'  => 'objects',
];

switch ($sort) {
    case 'price_asc':  $query_args['orderby'] = 'price'; $query_args['order'] = 'ASC';  break;
    case 'price_desc': $query_args['orderby'] = 'price'; $query_args['order'] = 'DESC'; break;
    default:           $query_args['orderby'] = 'date';  $query_args['order'] = 'DESC'; break;
}

$products   = wc_get_products($query_args);
$shop_url   = get_permalink(wc_get_page_id('shop'));
$current_url = strtok($_SERVER['REQUEST_URI'], '?');

$styles  = ['Classic Mug', 'Travel Mug', 'Espresso Mug', 'Two-Tone Mug'];
$sizes   = ['11 oz', '15 oz', '20 oz'];
$colors  = [
    'white'  => '#ffffff',
    'black'  => '#111111',
    'red'    => '#dc2626',
    'blue'   => '#2563eb',
    'green'  => '#16a34a',
    'yellow' => '#f59e0b',
];
?>

<script>
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('.wp-block-post-title, .entry-title, h1.page-title').forEach(function(el) {
    el.style.display = 'none';
  });
});
</script>
<div class="mug-category-page">

  <!-- ── Top Bar ─────────────────────────────────────────────────────────── -->
  <div class="mug-topbar">
    <div class="mug-logo"><?php bloginfo('name'); ?></div>
    <form class="mug-search" method="get" action="<?php echo esc_url(home_url('/')); ?>">
      <input type="text" name="s" placeholder="<?php esc_attr_e('Search mugs…', 'mug-customizer'); ?>">
      <input type="hidden" name="post_type" value="product">
      <button type="submit"><?php esc_html_e('Search', 'mug-customizer'); ?></button>
    </form>
    <div class="mug-top-actions">
      <?php if (is_user_logged_in()): ?>
        <a href="<?php echo esc_url(wc_get_account_endpoint_url('dashboard')); ?>"><?php esc_html_e('My Account', 'mug-customizer'); ?></a>
      <?php else: ?>
        <a href="<?php echo esc_url(wc_get_page_permalink('myaccount')); ?>"><?php esc_html_e('Sign in', 'mug-customizer'); ?></a>
      <?php endif; ?>
      <a href="<?php echo esc_url(wc_get_cart_url()); ?>">
        <?php esc_html_e('Cart', 'mug-customizer'); ?>
        (<?php echo WC()->cart ? WC()->cart->get_cart_contents_count() : 0; ?>)
      </a>
    </div>
  </div>

  <!-- ── Breadcrumb ──────────────────────────────────────────────────────── -->
  <div class="mug-breadcrumb">
    <a href="<?php echo esc_url(home_url('/')); ?>"><?php esc_html_e('Home', 'mug-customizer'); ?></a> ›
    <a href="<?php echo esc_url($shop_url); ?>"><?php esc_html_e('Drinkware', 'mug-customizer'); ?></a> ›
    <b><?php esc_html_e('Mugs', 'mug-customizer'); ?></b>
  </div>

  <!-- ── Layout: Filters | Products ─────────────────────────────────────── -->
  <div class="mug-cat-layout">

    <!-- Filters Sidebar -->
    <aside class="mug-filters">
      <form method="get" action="<?php echo esc_url($current_url); ?>" id="mug-filter-form">
        <h3><?php esc_html_e('Filters', 'mug-customizer'); ?></h3>

        <!-- Style -->
        <div class="mug-filter-group">
          <h4><?php esc_html_e('Style', 'mug-customizer'); ?></h4>
          <?php foreach ($styles as $style):
            $val = sanitize_title($style);
          ?>
            <label>
              <input type="checkbox" name="mug_style[]" value="<?php echo esc_attr($val); ?>"
                <?php checked(in_array($val, $filter_style)); ?>>
              <?php echo esc_html($style); ?>
            </label>
          <?php endforeach; ?>
        </div>

        <!-- Size -->
        <div class="mug-filter-group">
          <h4><?php esc_html_e('Size', 'mug-customizer'); ?></h4>
          <?php foreach ($sizes as $size):
            $val = sanitize_title($size);
          ?>
            <label>
              <input type="checkbox" name="mug_size[]" value="<?php echo esc_attr($val); ?>"
                <?php checked(in_array($val, $filter_size)); ?>>
              <?php echo esc_html($size); ?>
            </label>
          <?php endforeach; ?>
        </div>

        <!-- Color -->
        <div class="mug-filter-group">
          <h4><?php esc_html_e('Color', 'mug-customizer'); ?></h4>
          <div class="mug-filter-swatches">
            <?php foreach ($colors as $color_name => $hex): ?>
              <div class="mug-filter-swatch <?php echo in_array($color_name, $filter_color) ? 'selected' : ''; ?>"
                   style="background:<?php echo esc_attr($hex); ?>;"
                   data-color="<?php echo esc_attr($color_name); ?>"
                   title="<?php echo esc_attr(ucfirst($color_name)); ?>">
              </div>
            <?php endforeach; ?>
            <?php foreach ($filter_color as $c): ?>
              <input type="hidden" name="mug_color[]" value="<?php echo esc_attr($c); ?>">
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Price -->
        <div class="mug-filter-group">
          <h4><?php esc_html_e('Price', 'mug-customizer'); ?></h4>
          <?php
          $price_opts = [
            'under15' => __('Under $15', 'mug-customizer'),
            '15to25'  => __('$15 – $25', 'mug-customizer'),
            'over25'  => __('$25+', 'mug-customizer'),
          ];
          foreach ($price_opts as $pval => $plabel): ?>
            <label>
              <input type="radio" name="mug_price" value="<?php echo esc_attr($pval); ?>"
                <?php checked($filter_price, $pval); ?>>
              <?php echo esc_html($plabel); ?>
            </label>
          <?php endforeach; ?>
        </div>

        <button type="submit" class="mug-filter-apply"><?php esc_html_e('Apply Filters', 'mug-customizer'); ?></button>
        <a href="<?php echo esc_url($current_url); ?>" class="mug-filter-clear"><?php esc_html_e('Clear All', 'mug-customizer'); ?></a>
      </form>
    </aside>

    <!-- Products Area -->
    <div class="mug-products-area">

      <!-- Results bar -->
      <div class="mug-results-bar">
        <div class="mug-results-count">
          <?php $count = count($products); printf(esc_html(_n('%d mug', '%d mugs', $count, 'mug-customizer')), $count); ?>
        </div>
        <form method="get" action="<?php echo esc_url($current_url); ?>" class="mug-sort-form">
          <?php foreach ($_GET as $k => $v): if ($k === 'mug_sort') continue; ?>
            <?php if (is_array($v)): foreach ($v as $vi): ?>
              <input type="hidden" name="<?php echo esc_attr($k); ?>[]" value="<?php echo esc_attr($vi); ?>">
            <?php endforeach; else: ?>
              <input type="hidden" name="<?php echo esc_attr($k); ?>" value="<?php echo esc_attr($v); ?>">
            <?php endif; ?>
          <?php endforeach; ?>
          <select name="mug_sort" onchange="this.form.submit()">
            <option value="date"       <?php selected($sort, 'date'); ?>><?php esc_html_e('Sort: Newest', 'mug-customizer'); ?></option>
            <option value="price_asc"  <?php selected($sort, 'price_asc'); ?>><?php esc_html_e('Price: Low to High', 'mug-customizer'); ?></option>
            <option value="price_desc" <?php selected($sort, 'price_desc'); ?>><?php esc_html_e('Price: High to Low', 'mug-customizer'); ?></option>
          </select>
        </form>
      </div>

      <!-- Product Grid -->
      <div class="mug-prod-grid">
        <?php foreach ($products as $product): ?>
          <a href="<?php echo esc_url($product->get_permalink()); ?>" class="mug-prod-card">
            <div class="mug-prod-img">
              <?php if ($product->get_image_id()): ?>
                <img src="<?php echo esc_url(wp_get_attachment_image_url($product->get_image_id(), 'woocommerce_thumbnail')); ?>"
                     alt="<?php echo esc_attr($product->get_name()); ?>">
              <?php else: ?>
                <img src="<?php echo esc_url(MUG_CUSTOMIZER_PLUGIN_URL . 'public/assets/images/placeholder-mug.png'); ?>"
                     alt="<?php echo esc_attr($product->get_name()); ?>">
              <?php endif; ?>
            </div>
            <div class="mug-prod-info">
              <h5><?php echo esc_html($product->get_name()); ?></h5>
              <div class="mug-prod-price"><?php echo wp_kses_post($product->get_price_html()); ?></div>
            </div>
          </a>
        <?php endforeach; ?>

        <!-- Create Your Own card -->
        <?php
        $first_product = wc_get_products(['limit' => 1, 'status' => 'publish']);
        $cyo_id = !empty($first_product) ? $first_product[0]->get_id() : 0;
        $cyo_url = $cyo_id ? home_url('/mug-designer/?product_id=' . $cyo_id) : '#';
        ?>
        <a href="<?php echo esc_url($cyo_url); ?>" class="mug-prod-card mug-cyo-card">
          <div class="mug-prod-img mug-cyo-img">
            <div class="mug-cyo-plus">＋</div>
            <div class="mug-cyo-label"><?php esc_html_e('Start Blank', 'mug-customizer'); ?></div>
          </div>
          <div class="mug-prod-info">
            <h5 class="mug-cyo-title"><?php esc_html_e('Create Your Own', 'mug-customizer'); ?></h5>
            <div class="mug-prod-price"><?php esc_html_e('From $14.95', 'mug-customizer'); ?></div>
          </div>
        </a>
      </div>

    </div><!-- /.mug-products-area -->
  </div><!-- /.mug-cat-layout -->
</div><!-- /.mug-category-page -->

<script>
// Color swatch toggle for filters
document.querySelectorAll('.mug-filter-swatch').forEach(function(sw) {
  sw.addEventListener('click', function() {
    var color = this.dataset.color;
    var existing = document.querySelector('input[name="mug_color[]"][value="' + color + '"]');
    if (existing) {
      existing.remove();
      this.classList.remove('selected');
    } else {
      var inp = document.createElement('input');
      inp.type = 'hidden';
      inp.name = 'mug_color[]';
      inp.value = color;
      document.getElementById('mug-filter-form').appendChild(inp);
      this.classList.add('selected');
    }
  });
});
</script>
