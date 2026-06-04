<?php
/**
 * Canva Fixture Landing theme functions.
 *
 * Golden output for the canva-e2e integration test. Block patterns in the
 * patterns/ directory are auto-registered by WordPress for block themes; this
 * file only wires up theme supports and the stylesheet.
 *
 * @package CanvaFixture
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

if ( ! function_exists( 'canva_fixture_setup' ) ) {
	/**
	 * Register theme supports.
	 *
	 * @return void
	 */
	function canva_fixture_setup() {
		add_theme_support( 'wp-block-styles' );
		add_theme_support( 'responsive-embeds' );
		add_theme_support( 'editor-styles' );
		add_theme_support( 'html5', array( 'style', 'script' ) );
	}
}
add_action( 'after_setup_theme', 'canva_fixture_setup' );

if ( ! function_exists( 'canva_fixture_enqueue_assets' ) ) {
	/**
	 * Enqueue the theme stylesheet.
	 *
	 * @return void
	 */
	function canva_fixture_enqueue_assets() {
		wp_enqueue_style(
			'canva-fixture-style',
			get_stylesheet_uri(),
			array(),
			wp_get_theme()->get( 'Version' )
		);
	}
}
add_action( 'wp_enqueue_scripts', 'canva_fixture_enqueue_assets' );
