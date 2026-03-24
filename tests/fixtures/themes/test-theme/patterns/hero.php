<?php
/**
 * Title: Hero Section
 * Slug: test-theme/hero
 * Categories: featured
 */
?>
<!-- wp:group {"align":"full","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull">
	<!-- wp:heading {"level":1} -->
	<h1 class="wp-block-heading">Hero Title</h1>
	<!-- /wp:heading -->

	<!-- wp:image {"sizeSlug":"full"} -->
	<figure class="wp-block-image size-full">
		<img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/hero.jpg' ) ); ?>" alt="Hero image" />
	</figure>
	<!-- /wp:image -->
</div>
<!-- /wp:group -->
