<?php
/**
 * Title: Hero Section
 * Slug: flavor-starter/hero-section
 * Categories: banner, featured
 * Description: Full-width hero section with heading, description, CTA button, and background image.
 * Keywords: hero, banner, call to action, cta
 */

// Use JPG if available, fallback to SVG placeholder for development.
$hero_jpg = get_theme_file_path( 'assets/images/hero-background.jpg' );
if ( file_exists( $hero_jpg ) ) {
	$hero_image_url = esc_url( get_theme_file_uri( 'assets/images/hero-background.jpg' ) );
} else {
	$hero_image_url = esc_url( get_theme_file_uri( 'assets/images/hero-background.svg' ) );
}
?>

<!-- wp:cover {"url":"<?php echo $hero_image_url; ?>","dimRatio":60,"overlayColor":"text","isUserOverlayColor":true,"minHeight":600,"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70","left":"var:preset|spacing|50","right":"var:preset|spacing|50"}}}} -->
<div class="wp-block-cover alignfull" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70);padding-left:var(--wp--preset--spacing--50);padding-right:var(--wp--preset--spacing--50);min-height:600px">
	<span aria-hidden="true" class="wp-block-cover__background has-text-background-color has-background-dim-60 has-background-dim"></span>
	<img class="wp-block-cover__image-background" alt="<?php echo esc_attr__( 'Hero background image showing modern workspace', 'flavor-starter' ); ?>" src="<?php echo $hero_image_url; ?>" data-object-fit="cover"/>
	<div class="wp-block-cover__inner-container">
		<!-- wp:group {"layout":{"type":"constrained","contentSize":"800px"}} -->
		<div class="wp-block-group">
			<!-- wp:heading {"textAlign":"center","level":1,"textColor":"background","fontSize":"xxx-large"} -->
			<h1 class="wp-block-heading has-text-align-center has-background-color has-text-color has-xxx-large-font-size"><?php echo esc_html__( 'Build Beautiful WordPress Sites', 'flavor-starter' ); ?></h1>
			<!-- /wp:heading -->

			<!-- wp:paragraph {"align":"center","textColor":"background","fontSize":"large"} -->
			<p class="has-text-align-center has-background-color has-text-color has-large-font-size"><?php echo esc_html__( 'A modern FSE block theme with a complete design system. Convert Figma designs to WordPress with design tokens, block patterns, and responsive layouts.', 'flavor-starter' ); ?></p>
			<!-- /wp:paragraph -->

			<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"},"style":{"spacing":{"margin":{"top":"var:preset|spacing|50"}}}} -->
			<div class="wp-block-buttons" style="margin-top:var(--wp--preset--spacing--50)">
				<!-- wp:button {"backgroundColor":"primary","textColor":"background","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|60","right":"var:preset|spacing|60"}}}} -->
				<div class="wp-block-button"><a class="wp-block-button__link has-background-color has-text-color has-primary-background-color has-background wp-element-button" style="padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--60)" href="<?php echo esc_url( '/get-started' ); ?>"><?php echo esc_html__( 'Get Started', 'flavor-starter' ); ?></a></div>
				<!-- /wp:button -->

				<!-- wp:button {"backgroundColor":"background","textColor":"text","className":"is-style-outline","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|60","right":"var:preset|spacing|60"}}}} -->
				<div class="wp-block-button is-style-outline"><a class="wp-block-button__link has-text-color has-background-background-color has-background wp-element-button" style="padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--60)" href="<?php echo esc_url( '/learn-more' ); ?>"><?php echo esc_html__( 'Learn More', 'flavor-starter' ); ?></a></div>
				<!-- /wp:button -->
			</div>
			<!-- /wp:buttons -->
		</div>
		<!-- /wp:group -->
	</div>
</div>
<!-- /wp:cover -->
