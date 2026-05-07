<?php
/**
 * Title: Featured products grid
 * Slug: flavian-shop/featured-products
 * Categories: flavian-shop, woocommerce
 * Description: Three-column grid showing featured WooCommerce products with image, title, price, and add-to-cart button.
 * Keywords: products, featured, grid, woocommerce
 * Block Types: woocommerce/product-collection
 * Viewport Width: 1400
 *
 * @package Flavian_Shop
 */

?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|50","right":"var:preset|spacing|40","bottom":"var:preset|spacing|50","left":"var:preset|spacing|40"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="padding-top:var(--wp--preset--spacing--50);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--50);padding-left:var(--wp--preset--spacing--40)">
	<!-- wp:group {"layout":{"type":"flex","justifyContent":"space-between","flexWrap":"nowrap"}} -->
	<div class="wp-block-group">
	<!-- wp:heading {"level":2,"fontSize":"x-large"} -->
	<h2 class="wp-block-heading has-x-large-font-size"><?php echo esc_html__( 'Featured', 'flavian-shop' ); ?></h2>
	<!-- /wp:heading -->

	<!-- wp:paragraph -->
	<p><a href="/shop"><?php echo esc_html__( 'View all →', 'flavian-shop' ); ?></a></p>
	<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->

	<!-- wp:woocommerce/product-collection {"queryId":10,"query":{"perPage":6,"pages":1,"offset":0,"postType":"product","order":"desc","orderBy":"date","search":"","exclude":[],"sticky":"","inherit":false,"taxQuery":{},"isProductCollectionBlock":true,"woocommerceOnSale":false,"woocommerceStockStatus":["instock","outofstock","onbackorder"],"woocommerceAttributes":[],"woocommerceHandPickedProducts":[],"featured":true},"tagName":"div","displayLayout":{"type":"flex","columns":3,"shrinkColumns":true},"queryContextIncludes":["collection"],"forcePageReload":false} -->
	<div class="wp-block-woocommerce-product-collection">
	<!-- wp:woocommerce/product-template -->
		<!-- wp:woocommerce/product-image {"showSaleBadge":true,"saleBadgeAlign":"right","isDescendentOfQueryLoop":true} /-->
		<!-- wp:post-title {"isLink":true,"level":3,"fontSize":"medium","__woocommerceNamespace":"woocommerce/product-collection/product-title"} /-->
		<!-- wp:woocommerce/product-price {"isDescendentOfQueryLoop":true} /-->
		<!-- wp:woocommerce/product-button {"isDescendentOfQueryLoop":true} /-->
	<!-- /wp:woocommerce/product-template -->

	<!-- wp:woocommerce/product-collection-no-results -->
		<!-- wp:paragraph -->
		<p><?php echo esc_html__( 'No featured products yet — mark a product as featured in the WooCommerce admin.', 'flavian-shop' ); ?></p>
		<!-- /wp:paragraph -->
	<!-- /wp:woocommerce/product-collection-no-results -->
	</div>
	<!-- /wp:woocommerce/product-collection -->
</div>
<!-- /wp:group -->
