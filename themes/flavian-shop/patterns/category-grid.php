<?php
/**
 * Title: Category grid
 * Slug: flavian-shop/category-grid
 * Categories: flavian-shop, woocommerce
 * Description: Three-column grid linking to product categories. Replace placeholder images and category links after inserting.
 * Keywords: categories, navigation, grid
 * Viewport Width: 1400
 *
 * @package Flavian_Shop
 */

?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|50","right":"var:preset|spacing|40","bottom":"var:preset|spacing|50","left":"var:preset|spacing|40"}}},"backgroundColor":"surface","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-surface-background-color has-background" style="padding-top:var(--wp--preset--spacing--50);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--50);padding-left:var(--wp--preset--spacing--40)">
	<!-- wp:heading {"textAlign":"center","level":2,"fontSize":"x-large"} -->
	<h2 class="wp-block-heading has-text-align-center has-x-large-font-size"><?php echo esc_html__( 'Shop by category', 'flavian-shop' ); ?></h2>
	<!-- /wp:heading -->

	<!-- wp:columns -->
	<div class="wp-block-columns">
	<!-- wp:column -->
	<div class="wp-block-column">
		<!-- wp:cover {"dimRatio":30,"minHeight":280,"contentPosition":"bottom left","style":{"border":{"radius":"0.75rem"}}} -->
		<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="border-radius:0.75rem;min-height:280px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim-30 has-background-dim"></span><div class="wp-block-cover__inner-container">
		<!-- wp:heading {"textColor":"background","level":3} -->
		<h3 class="wp-block-heading has-background-color has-text-color"><a href="/product-category/new"><?php echo esc_html__( 'New arrivals', 'flavian-shop' ); ?></a></h3>
		<!-- /wp:heading -->
		</div></div>
		<!-- /wp:cover -->
	</div>
	<!-- /wp:column -->

	<!-- wp:column -->
	<div class="wp-block-column">
		<!-- wp:cover {"dimRatio":30,"minHeight":280,"contentPosition":"bottom left","style":{"border":{"radius":"0.75rem"}}} -->
		<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="border-radius:0.75rem;min-height:280px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim-30 has-background-dim"></span><div class="wp-block-cover__inner-container">
		<!-- wp:heading {"textColor":"background","level":3} -->
		<h3 class="wp-block-heading has-background-color has-text-color"><a href="/product-category/best-sellers"><?php echo esc_html__( 'Best sellers', 'flavian-shop' ); ?></a></h3>
		<!-- /wp:heading -->
		</div></div>
		<!-- /wp:cover -->
	</div>
	<!-- /wp:column -->

	<!-- wp:column -->
	<div class="wp-block-column">
		<!-- wp:cover {"dimRatio":30,"minHeight":280,"contentPosition":"bottom left","style":{"border":{"radius":"0.75rem"}}} -->
		<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="border-radius:0.75rem;min-height:280px"><span aria-hidden="true" class="wp-block-cover__background has-background-dim-30 has-background-dim"></span><div class="wp-block-cover__inner-container">
		<!-- wp:heading {"textColor":"background","level":3} -->
		<h3 class="wp-block-heading has-background-color has-text-color"><a href="/product-category/sale"><?php echo esc_html__( 'On sale', 'flavian-shop' ); ?></a></h3>
		<!-- /wp:heading -->
		</div></div>
		<!-- /wp:cover -->
	</div>
	<!-- /wp:column -->
	</div>
	<!-- /wp:columns -->
</div>
<!-- /wp:group -->
