<?php
/**
 * Title: About Section
 * Slug: flavor-starter/about-section
 * Categories: text, featured
 * Description: Two-column about section with image and text content.
 * Keywords: about, intro, two columns, image
 */

// Use JPG if available, fallback to SVG placeholder for development.
$about_jpg = get_theme_file_path( 'assets/images/about-image.jpg' );
if ( file_exists( $about_jpg ) ) {
	$about_image_url = esc_url( get_theme_file_uri( 'assets/images/about-image.jpg' ) );
} else {
	$about_image_url = esc_url( get_theme_file_uri( 'assets/images/about-image.svg' ) );
}
?>

<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|70","bottom":"var:preset|spacing|70"}}},"backgroundColor":"background","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-background-background-color has-background" style="padding-top:var(--wp--preset--spacing--70);padding-bottom:var(--wp--preset--spacing--70)">
	<!-- wp:columns {"align":"wide","style":{"spacing":{"blockGap":{"top":"var:preset|spacing|60","left":"var:preset|spacing|60"}}}} -->
	<div class="wp-block-columns alignwide">
		<!-- wp:column {"width":"50%"} -->
		<div class="wp-block-column" style="flex-basis:50%">
			<!-- wp:image {"sizeSlug":"large","linkDestination":"none","style":{"border":{"radius":"8px"}}} -->
			<figure class="wp-block-image size-large has-custom-border"><img src="<?php echo $about_image_url; ?>" alt="<?php echo esc_attr__( 'Team collaboration in modern office', 'flavor-starter' ); ?>" style="border-radius:8px"/></figure>
			<!-- /wp:image -->
		</div>
		<!-- /wp:column -->

		<!-- wp:column {"width":"50%","verticalAlignment":"center"} -->
		<div class="wp-block-column is-vertically-aligned-center" style="flex-basis:50%">
			<!-- wp:group {"style":{"spacing":{"blockGap":"var:preset|spacing|40"}},"layout":{"type":"constrained"}} -->
			<div class="wp-block-group">
				<!-- wp:paragraph {"textColor":"primary","fontSize":"small"} -->
				<p class="has-primary-color has-text-color has-small-font-size" style="font-weight:600"><?php echo esc_html__( 'ABOUT US', 'flavor-starter' ); ?></p>
				<!-- /wp:paragraph -->

				<!-- wp:heading {"level":2,"textColor":"text","fontSize":"xx-large"} -->
				<h2 class="wp-block-heading has-text-color has-xx-large-font-size"><?php echo esc_html__( 'We Build Digital Experiences', 'flavor-starter' ); ?></h2>
				<!-- /wp:heading -->

				<!-- wp:paragraph {"textColor":"muted","fontSize":"medium"} -->
				<p class="has-muted-color has-text-color has-medium-font-size"><?php echo esc_html__( 'Our team specializes in converting Figma designs into pixel-perfect WordPress themes. Using FSE block architecture and design tokens, we create themes that are easy to customize and maintain.', 'flavor-starter' ); ?></p>
				<!-- /wp:paragraph -->

				<!-- wp:paragraph {"textColor":"muted","fontSize":"medium"} -->
				<p class="has-muted-color has-text-color has-medium-font-size"><?php echo esc_html__( 'Every theme we build follows WordPress coding standards, uses proper escaping functions, and implements accessibility best practices.', 'flavor-starter' ); ?></p>
				<!-- /wp:paragraph -->

				<!-- wp:buttons {"style":{"spacing":{"margin":{"top":"var:preset|spacing|40"}}}} -->
				<div class="wp-block-buttons" style="margin-top:var(--wp--preset--spacing--40)">
					<!-- wp:button {"backgroundColor":"primary","textColor":"background"} -->
					<div class="wp-block-button"><a class="wp-block-button__link has-background-color has-text-color has-primary-background-color has-background wp-element-button" href="<?php echo esc_url( '/about' ); ?>"><?php echo esc_html__( 'Learn More About Us', 'flavor-starter' ); ?></a></div>
					<!-- /wp:button -->
				</div>
				<!-- /wp:buttons -->
			</div>
			<!-- /wp:group -->
		</div>
		<!-- /wp:column -->
	</div>
	<!-- /wp:columns -->
</div>
<!-- /wp:group -->
