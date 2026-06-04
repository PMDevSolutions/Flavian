<?php
/**
 * Title: Landing Hero
 * Slug: canva-fixture/hero
 * Categories: featured, banner
 * Description: Hero cover with background image, used by the landing front page.
 *
 * @package CanvaFixture
 */

?>
<!-- wp:cover {"url":"<?php echo esc_url( get_theme_file_uri( 'assets/images/hero.jpg' ) ); ?>","dimRatio":50,"overlayColor":"primary","minHeight":420,"contentPosition":"center center","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70","left":"var:preset|spacing|50","right":"var:preset|spacing|50"}}}} -->
<div class="wp-block-cover alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-right:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--70);padding-left:var(--wp--preset--spacing--50);min-height:420px">
	<span aria-hidden="true" class="wp-block-cover__background has-primary-background-color has-background-dim-50 has-background-dim"></span>
	<img class="wp-block-cover__image-background" alt="<?php esc_attr_e( 'Acme team at work', 'canva-fixture' ); ?>" src="<?php echo esc_url( get_theme_file_uri( 'assets/images/hero.jpg' ) ); ?>" data-object-fit="cover"/>
	<div class="wp-block-cover__inner-container">
		<!-- wp:heading {"textAlign":"center","level":1,"textColor":"background","fontSize":"xx-large"} -->
		<h1 class="wp-block-heading has-text-align-center has-background-color has-text-color has-xx-large-font-size">Welcome to Acme</h1>
		<!-- /wp:heading -->

		<!-- wp:paragraph {"align":"center","textColor":"background","fontSize":"medium"} -->
		<p class="has-text-align-center has-background-color has-text-color has-medium-font-size">We build delightful things for delightful people.</p>
		<!-- /wp:paragraph -->

		<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} -->
		<div class="wp-block-buttons">
			<!-- wp:button -->
			<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="#contact">Get started</a></div>
			<!-- /wp:button -->
		</div>
		<!-- /wp:buttons -->
	</div>
</div>
<!-- /wp:cover -->
