<?php
/**
 * Title: Product grid (4 columns)
 * Slug: flavian-shop/product-grid
 * Categories: flavian-shop, woocommerce
 * Description: Compact 4-column product grid. Drop into shop, category, or landing pages.
 * Keywords: products, grid, shop, woocommerce
 * Block Types: woocommerce/product-collection
 * Viewport Width: 1400
 */
?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","right":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)">
  <!-- wp:woocommerce/product-collection {"queryId":11,"query":{"perPage":8,"pages":1,"offset":0,"postType":"product","order":"desc","orderBy":"date","search":"","exclude":[],"sticky":"","inherit":false,"taxQuery":{},"isProductCollectionBlock":true,"woocommerceOnSale":false,"woocommerceStockStatus":["instock","outofstock","onbackorder"],"woocommerceAttributes":[],"woocommerceHandPickedProducts":[]},"tagName":"div","displayLayout":{"type":"flex","columns":4,"shrinkColumns":true},"queryContextIncludes":["collection"],"forcePageReload":false} -->
  <div class="wp-block-woocommerce-product-collection">
    <!-- wp:woocommerce/product-template -->
      <!-- wp:woocommerce/product-image {"showSaleBadge":true,"saleBadgeAlign":"right","isDescendentOfQueryLoop":true} /-->
      <!-- wp:post-title {"isLink":true,"level":3,"fontSize":"medium","__woocommerceNamespace":"woocommerce/product-collection/product-title"} /-->
      <!-- wp:woocommerce/product-price {"isDescendentOfQueryLoop":true} /-->
      <!-- wp:woocommerce/product-button {"isDescendentOfQueryLoop":true} /-->
    <!-- /wp:woocommerce/product-template -->

    <!-- wp:woocommerce/product-collection-no-results -->
      <!-- wp:paragraph -->
      <p><?php echo esc_html__( 'No products found.', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->
    <!-- /wp:woocommerce/product-collection-no-results -->
  </div>
  <!-- /wp:woocommerce/product-collection -->
</div>
<!-- /wp:group -->
