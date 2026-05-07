<?php
/**
 * Title: Newsletter signup
 * Slug: flavian-shop/newsletter
 * Categories: flavian-shop, featured
 * Description: Centered newsletter signup with heading, supporting text, and a placeholder form. Replace with your provider's embed (Mailchimp, Klaviyo, etc.) after inserting.
 * Keywords: newsletter, email, signup, marketing
 * Viewport Width: 1200
 *
 * @package Flavian_Shop
 */

?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","right":"var:preset|spacing|40","bottom":"var:preset|spacing|60","left":"var:preset|spacing|40"}}},"backgroundColor":"foreground","textColor":"background","layout":{"type":"constrained","contentSize":"640px"}} -->
<div class="wp-block-group alignfull has-background-color has-foreground-background-color has-text-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--60);padding-left:var(--wp--preset--spacing--40)">
	<!-- wp:heading {"textAlign":"center","level":2,"fontSize":"x-large"} -->
	<h2 class="wp-block-heading has-text-align-center has-x-large-font-size"><?php echo esc_html__( 'Get 10% off your first order', 'flavian-shop' ); ?></h2>
	<!-- /wp:heading -->

	<!-- wp:paragraph {"align":"center","fontSize":"medium"} -->
	<p class="has-text-align-center has-medium-font-size"><?php echo esc_html__( 'Subscribe for new arrivals, restocks, and the occasional thoughtful note. No spam.', 'flavian-shop' ); ?></p>
	<!-- /wp:paragraph -->

	<!-- wp:html -->
	<form action="#" method="post" class="flavian-shop-newsletter">
	<label class="screen-reader-text" for="flavian-newsletter-email"><?php echo esc_html__( 'Your email', 'flavian-shop' ); ?></label>
	<input id="flavian-newsletter-email" type="email" name="email" required placeholder="<?php echo esc_attr__( 'you@example.com', 'flavian-shop' ); ?>">
	<button type="submit"><?php echo esc_html__( 'Subscribe', 'flavian-shop' ); ?></button>
	</form>
	<!-- /wp:html -->
</div>
<!-- /wp:group -->
