<?php
/**
 * {{THEME_NAME}} theme functions.
 *
 * @package {{THEME_SLUG}}
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

add_action( 'after_setup_theme', static function () {
    add_theme_support( 'wp-block-styles' );
    add_theme_support( 'editor-styles' );
    add_theme_support( 'responsive-embeds' );
} );
