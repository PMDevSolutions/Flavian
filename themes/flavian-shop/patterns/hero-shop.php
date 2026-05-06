<?php
/**
 * Title: Shop hero
 * Slug: flavian-shop/hero-shop
 * Categories: flavian-shop, featured
 * Description: A two-column shop hero with headline, supporting copy, primary CTA, and a side image. Edit copy and image after inserting.
 * Keywords: hero, shop, landing, banner
 * Block Types: core/cover
 * Viewport Width: 1400
 */
?>
<!-- wp:group {"align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","right":"var:preset|spacing|40","bottom":"var:preset|spacing|60","left":"var:preset|spacing|40"}}},"backgroundColor":"surface","layout":{"type":"constrained"}} -->
<div class="wp-block-group alignfull has-surface-background-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-right:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--60);padding-left:var(--wp--preset--spacing--40)">
  <!-- wp:columns {"verticalAlignment":"center"} -->
  <div class="wp-block-columns are-vertically-aligned-center">
    <!-- wp:column {"verticalAlignment":"center"} -->
    <div class="wp-block-column is-vertically-aligned-center">
      <!-- wp:paragraph {"fontSize":"small","textColor":"primary","style":{"typography":{"textTransform":"uppercase","letterSpacing":"0.08em","fontWeight":"600"}}} -->
      <p class="has-primary-color has-text-color has-small-font-size" style="font-weight:600;letter-spacing:0.08em;text-transform:uppercase"><?php echo esc_html__( 'New collection', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->

      <!-- wp:heading {"level":1,"fontSize":"display"} -->
      <h1 class="wp-block-heading has-display-font-size"><?php echo esc_html__( 'Goods made to last.', 'flavian-shop' ); ?></h1>
      <!-- /wp:heading -->

      <!-- wp:paragraph {"textColor":"muted","fontSize":"medium"} -->
      <p class="has-muted-color has-text-color has-medium-font-size"><?php echo esc_html__( 'Carefully sourced, honestly priced. Browse our latest pieces and find your next favourite.', 'flavian-shop' ); ?></p>
      <!-- /wp:paragraph -->

      <!-- wp:buttons -->
      <div class="wp-block-buttons">
        <!-- wp:button -->
        <div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/shop"><?php echo esc_html__( 'Shop now', 'flavian-shop' ); ?></a></div>
        <!-- /wp:button -->

        <!-- wp:button {"className":"is-style-outline"} -->
        <div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="/shop?orderby=date"><?php echo esc_html__( 'See what\'s new', 'flavian-shop' ); ?></a></div>
        <!-- /wp:button -->
      </div>
      <!-- /wp:buttons -->
    </div>
    <!-- /wp:column -->

    <!-- wp:column -->
    <div class="wp-block-column">
      <!-- wp:image {"sizeSlug":"large","style":{"border":{"radius":"0.75rem"}}} -->
      <figure class="wp-block-image size-large has-custom-border"><img alt="" style="border-radius:0.75rem"/></figure>
      <!-- /wp:image -->
    </div>
    <!-- /wp:column -->
  </div>
  <!-- /wp:columns -->
</div>
<!-- /wp:group -->
