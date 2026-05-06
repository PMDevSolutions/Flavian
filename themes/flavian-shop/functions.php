<?php
/**
 * Flavian Shop theme bootstrap.
 *
 * @package Flavian_Shop
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! defined( 'FLAVIAN_SHOP_VERSION' ) ) {
	define( 'FLAVIAN_SHOP_VERSION', '0.1.0' );
}

/**
 * Theme setup.
 *
 * Declares WooCommerce support so WooCommerce uses the FSE templates we ship
 * in /templates instead of falling back to its bundled classic templates.
 */
function flavian_shop_setup() {
	load_theme_textdomain( 'flavian-shop', get_template_directory() . '/languages' );

	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_theme_support( 'responsive-embeds' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );

	// WooCommerce — opt in to FSE block-based templates and gallery features.
	add_theme_support( 'woocommerce', array(
		'thumbnail_image_width' => 600,
		'single_image_width'    => 1200,
		'product_grid'          => array(
			'default_rows'    => 3,
			'min_rows'        => 1,
			'default_columns' => 3,
			'min_columns'     => 1,
			'max_columns'     => 6,
		),
	) );
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );
}
add_action( 'after_setup_theme', 'flavian_shop_setup' );

/**
 * Register block patterns shipped with the theme.
 *
 * @return void
 */
function flavian_shop_register_patterns() {
	if ( ! function_exists( 'register_block_pattern_category' ) ) {
		return;
	}
	register_block_pattern_category(
		'flavian-shop',
		array( 'label' => __( 'Flavian Shop', 'flavian-shop' ) )
	);
}
add_action( 'init', 'flavian_shop_register_patterns' );

/**
 * Enqueue front-end assets.
 *
 * @return void
 */
function flavian_shop_enqueue_assets() {
	wp_enqueue_style(
		'flavian-shop',
		get_stylesheet_uri(),
		array(),
		FLAVIAN_SHOP_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'flavian_shop_enqueue_assets' );

/**
 * Soft-warn the admin when WooCommerce is not active.
 *
 * The theme renders fine without WooCommerce — the WC-specific templates and
 * patterns simply don't appear. The notice helps new contributors realise the
 * theme expects WooCommerce to be installed.
 */
function flavian_shop_notice_no_woocommerce() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( class_exists( 'WooCommerce' ) ) {
		return;
	}
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && in_array( $screen->id, array( 'dashboard', 'themes' ), true ) ) {
		printf(
			'<div class="notice notice-warning"><p>%s</p></div>',
			esc_html__(
				'Flavian Shop expects WooCommerce. Install and activate WooCommerce to enable shop, single-product, cart, and checkout templates.',
				'flavian-shop'
			)
		);
	}
}
add_action( 'admin_notices', 'flavian_shop_notice_no_woocommerce' );
