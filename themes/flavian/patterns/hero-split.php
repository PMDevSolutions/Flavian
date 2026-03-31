<?php
/**
 * Title: Hero with Image Split
 * Slug: flavian/hero-split
 * Categories: flavian-hero, featured
 * Keywords: hero, split, image, two column, banner
 * Description: A two-column hero section with content on the left and an image on the right.
 * Viewport Width: 1200
 */
?>
<!-- wp:group {"backgroundColor":"light","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-light-background-color has-background" style="padding-top:var(--wp--preset--spacing--80);padding-bottom:var(--wp--preset--spacing--80)"><!-- wp:columns {"align":"wide"} -->
<div class="wp-block-columns alignwide"><!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- wp:heading {"textAlign":"left","level":1,"fontSize":"3x-large","fontFamily":"heading"} -->
<h1 class="wp-block-heading has-text-align-left has-heading-font-family has-3-x-large-font-size">Build Something Extraordinary</h1>
<!-- /wp:heading -->

<!-- wp:paragraph {"textColor":"dark","fontSize":"medium"} -->
<p class="has-dark-color has-text-color has-medium-font-size">Create stunning websites with the Flavian theme. Powered by Full Site Editing, it gives you complete control over every aspect of your site's design.</p>
<!-- /wp:paragraph -->

<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"backgroundColor":"primary","textColor":"white"} -->
<div class="wp-block-button"><a class="wp-block-button__link has-white-color has-primary-background-color has-text-color has-background wp-element-button">Get Started</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons --></div>
<!-- /wp:column -->

<!-- wp:column {"verticalAlignment":"center"} -->
<div class="wp-block-column is-vertically-aligned-center"><!-- wp:image {"sizeSlug":"full","linkDestination":"none"} -->
<figure class="wp-block-image size-full"><img src="<?php echo esc_url( get_theme_file_uri( 'assets/images/hero-placeholder.jpg' ) ); ?>" alt="Team collaborating in modern workspace"/></figure>
<!-- /wp:image --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
