<?php
/**
 * Title: USP strip
 * Slug: flavian-shop/usp-strip
 * Categories: flavian-shop, featured
 * Description: Four-column unique-selling-points strip — free shipping, easy returns, secure checkout, support.
 * Keywords: usp, trust, badges, shipping
 * Viewport Width: 1200
 */
?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","right":"var:preset|spacing|40","bottom":"var:preset|spacing|40","left":"var:preset|spacing|40"}},"border":{"top":{"color":"var:preset|color|border","width":"1px"},"bottom":{"color":"var:preset|color|border","width":"1px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull" style="border-top-color:var(--wp--preset--color--border);border-top-width:1px;border-bottom-color:var(--wp--preset--color--border);border-bottom-width:1px;padding-top:var(--wp--preset--spacing--40);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--40);padding-left:var(--wp--preset--spacing--40)">
  <!-- wp:columns {"isStackedOnMobile":true} -->
  <div class="wp-block-columns">
    <!-- wp:column -->
    <div class="wp-block-column">
      <!-- wp:heading {"textAlign":"center","level":3,"fontSize":"medium"} -->
      <h3 class="wp-block-heading has-text-align-center has-medium-font-size"><?php echo esc_html__( 'Free shipping', 'flavian-shop' ); ?></h3>
      <!-- /wp:heading -->
      <!-- wp:paragraph {"align":"center","textColor":"muted","fontSize":"small"} -->
      <p class="has-text-align-center has-muted-color has-text-color has-small-font-size"><?php echo esc_html__( 'On orders over $75', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:column -->

    <!-- wp:column -->
    <div class="wp-block-column">
      <!-- wp:heading {"textAlign":"center","level":3,"fontSize":"medium"} -->
      <h3 class="wp-block-heading has-text-align-center has-medium-font-size"><?php echo esc_html__( 'Easy returns', 'flavian-shop' ); ?></h3>
      <!-- /wp:heading -->
      <!-- wp:paragraph {"align":"center","textColor":"muted","fontSize":"small"} -->
      <p class="has-text-align-center has-muted-color has-text-color has-small-font-size"><?php echo esc_html__( '30 days, no questions', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:column -->

    <!-- wp:column -->
    <div class="wp-block-column">
      <!-- wp:heading {"textAlign":"center","level":3,"fontSize":"medium"} -->
      <h3 class="wp-block-heading has-text-align-center has-medium-font-size"><?php echo esc_html__( 'Secure checkout', 'flavian-shop' ); ?></h3>
      <!-- /wp:heading -->
      <!-- wp:paragraph {"align":"center","textColor":"muted","fontSize":"small"} -->
      <p class="has-text-align-center has-muted-color has-text-color has-small-font-size"><?php echo esc_html__( 'SSL-encrypted payments', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:column -->

    <!-- wp:column -->
    <div class="wp-block-column">
      <!-- wp:heading {"textAlign":"center","level":3,"fontSize":"medium"} -->
      <h3 class="wp-block-heading has-text-align-center has-medium-font-size"><?php echo esc_html__( 'Real support', 'flavian-shop' ); ?></h3>
      <!-- /wp:heading -->
      <!-- wp:paragraph {"align":"center","textColor":"muted","fontSize":"small"} -->
      <p class="has-text-align-center has-muted-color has-text-color has-small-font-size"><?php echo esc_html__( 'Talk to a human, fast', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->
    </div>
    <!-- /wp:column -->
  </div>
  <!-- /wp:columns -->
</div>
<!-- /wp:group -->
