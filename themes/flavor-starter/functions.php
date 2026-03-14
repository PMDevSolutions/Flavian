<?php
/**
 * Flavor Starter Theme functions and definitions.
 *
 * @package flavor-starter
 * @since 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

/**
 * Define theme version constant.
 */
define( 'FLAVOR_STARTER_VERSION', '1.0.0' );

/**
 * Sets up theme defaults and registers support for various WordPress features.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_setup() {
	/*
	 * Make theme available for translation.
	 * Translations can be filed in the /languages/ directory.
	 */
	load_theme_textdomain( 'flavor-starter', get_template_directory() . '/languages' );

	/*
	 * Add default posts and comments RSS feed links to head.
	 */
	add_theme_support( 'automatic-feed-links' );

	/*
	 * Let WordPress manage the document title.
	 */
	add_theme_support( 'title-tag' );

	/*
	 * Enable support for Post Thumbnails on posts and pages.
	 */
	add_theme_support( 'post-thumbnails' );

	/*
	 * Switch default core markup for search form, comment form, and comments
	 * to output valid HTML5.
	 */
	add_theme_support(
		'html5',
		array(
			'search-form',
			'comment-form',
			'comment-list',
			'gallery',
			'caption',
			'style',
			'script',
		)
	);

	/*
	 * Add support for core custom logo.
	 */
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 100,
			'width'       => 400,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	/*
	 * Add support for editor styles.
	 */
	add_theme_support( 'editor-styles' );

	/*
	 * Add support for responsive embedded content.
	 */
	add_theme_support( 'responsive-embeds' );

	/*
	 * Add support for block styles.
	 */
	add_theme_support( 'wp-block-styles' );

	/*
	 * Add support for appearance tools (border, spacing, etc.).
	 */
	add_theme_support( 'appearance-tools' );
}
add_action( 'after_setup_theme', 'flavor_starter_setup' );

/**
 * Enqueue theme styles.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_enqueue_styles() {
	wp_enqueue_style(
		'flavor-starter-style',
		get_stylesheet_uri(),
		array(),
		FLAVOR_STARTER_VERSION
	);
}
add_action( 'wp_enqueue_scripts', 'flavor_starter_enqueue_styles' );

/**
 * Register block patterns.
 *
 * Note: Block patterns are auto-registered from the /patterns directory
 * in WordPress 6.0+. This function provides backwards compatibility
 * and ensures pattern categories are available.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_register_block_patterns() {
	/*
	 * Register custom pattern categories.
	 */
	register_block_pattern_category(
		'flavor-starter',
		array(
			'label'       => esc_html__( 'Flavor Starter', 'flavor-starter' ),
			'description' => esc_html__( 'Patterns included with the Flavor Starter theme.', 'flavor-starter' ),
		)
	);

	register_block_pattern_category(
		'banner',
		array(
			'label'       => esc_html__( 'Banner', 'flavor-starter' ),
			'description' => esc_html__( 'Full-width banner and hero patterns.', 'flavor-starter' ),
		)
	);

	register_block_pattern_category(
		'featured',
		array(
			'label'       => esc_html__( 'Featured', 'flavor-starter' ),
			'description' => esc_html__( 'Featured content patterns.', 'flavor-starter' ),
		)
	);
}
add_action( 'init', 'flavor_starter_register_block_patterns' );

/**
 * Register block styles.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_register_block_styles() {
	/*
	 * Register custom button style.
	 */
	register_block_style(
		'core/button',
		array(
			'name'  => 'flavor-starter-rounded',
			'label' => esc_html__( 'Rounded', 'flavor-starter' ),
		)
	);

	/*
	 * Register custom group style.
	 */
	register_block_style(
		'core/group',
		array(
			'name'  => 'flavor-starter-shadow',
			'label' => esc_html__( 'Shadow', 'flavor-starter' ),
		)
	);
}
add_action( 'init', 'flavor_starter_register_block_styles' );

/**
 * Add custom inline styles for block styles.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_add_inline_styles() {
	$custom_css = '
		.is-style-flavor-starter-rounded .wp-block-button__link {
			border-radius: 9999px;
		}
		.is-style-flavor-starter-shadow {
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		}
	';

	wp_add_inline_style( 'flavor-starter-style', $custom_css );
}
add_action( 'wp_enqueue_scripts', 'flavor_starter_add_inline_styles' );

/**
 * Add editor inline styles.
 *
 * @since 1.0.0
 * @return void
 */
function flavor_starter_add_editor_styles() {
	$custom_css = '
		.is-style-flavor-starter-rounded .wp-block-button__link {
			border-radius: 9999px;
		}
		.is-style-flavor-starter-shadow {
			box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
		}
	';

	wp_add_inline_style( 'wp-block-library', $custom_css );
}
add_action( 'enqueue_block_editor_assets', 'flavor_starter_add_editor_styles' );
