<?php
/**
 * Title: Two Column Features with Images
 * Slug: flavian/features-two-column
 * Categories: flavian-features, columns
 * Keywords: features, two column, images, benefits, showcase
 * Description: A two-column layout with images and descriptions for highlighting key features.
 * Viewport Width: 1200
 *
 * @since 1.0.0
 * @package Flavian
 */

?>
<!-- wp:group {"backgroundColor":"white","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-white-background-color has-background" style="padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)"><!-- wp:heading {"textAlign":"center","fontSize":"2x-large"} -->
<h2 class="wp-block-heading has-text-align-center has-2-x-large-font-size">Why Choose Us</h2>
<!-- /wp:heading -->

<!-- wp:columns {"align":"wide","style":{"spacing":{"blockGap":{"left":"var:preset|spacing|50"}}}} -->
<div class="wp-block-columns alignwide"><!-- wp:column -->
<div class="wp-block-column"><!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/feature-1.jpg' ) ); ?>" alt="Creative workspace showcasing innovative design tools and processes"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":3,"fontSize":"large"} -->
<h3 class="wp-block-heading has-large-font-size">Innovative Design</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Stand out with a modern aesthetic that captures attention and communicates your brand story through thoughtful, purposeful design choices.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column -->

<!-- wp:column -->
<div class="wp-block-column"><!-- wp:image {"sizeSlug":"large","linkDestination":"none"} -->
<figure class="wp-block-image size-large"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/feature-2.jpg' ) ); ?>" alt="Dedicated support team ready to help with technical questions"/></figure>
<!-- /wp:image -->

<!-- wp:heading {"level":3,"fontSize":"large"} -->
<h3 class="wp-block-heading has-large-font-size">Expert Support</h3>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Get the help you need when you need it. Our knowledgeable support team is here to guide you every step of the way.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
