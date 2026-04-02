<?php
/**
 * Flavian theme functions and definitions.
 *
 * @package Flavian
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register custom block pattern categories.
 *
 * @return void
 */
function flavian_register_pattern_categories(): void {
	$categories = array(
		array(
			'slug'  => 'flavian-hero',
			'label' => __( 'Hero Sections', 'flavian' ),
		),
		array(
			'slug'  => 'flavian-features',
			'label' => __( 'Feature Sections', 'flavian' ),
		),
		array(
			'slug'  => 'flavian-testimonials',
			'label' => __( 'Testimonials', 'flavian' ),
		),
		array(
			'slug'  => 'flavian-cta',
			'label' => __( 'Calls to Action', 'flavian' ),
		),
		array(
			'slug'  => 'flavian-pricing',
			'label' => __( 'Pricing', 'flavian' ),
		),
		array(
			'slug'  => 'flavian-general',
			'label' => __( 'General', 'flavian' ),
		),
	);

	foreach ( $categories as $category ) {
		register_block_pattern_category( $category['slug'], array( 'label' => $category['label'] ) );
	}
}
add_action( 'init', 'flavian_register_pattern_categories' );

/**
 * Enqueue Google Fonts (Inter and Playfair Display).
 * Loads Inter and Playfair Display fonts from Google Fonts CDN.
 *
 * @since 1.0.0
 * @return void
 */
function flavian_enqueue_fonts(): void {
	wp_enqueue_style(
		'flavian-google-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap',
		array(),
		'1.0.0'
	);
}
add_action( 'wp_enqueue_scripts', 'flavian_enqueue_fonts' );
