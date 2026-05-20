<?php
/**
 * Plugin Name: Flavian Headless Support
 * Description: CORS, preview URL rewriting, and REST API hardening for the headless WP setup. Only active when the flavian_headless_mode option is on.
 * Version:     0.1.0
 * Author:      Flavian
 * License:     GPL-2.0-or-later
 *
 * Configured by scripts/wordpress-install/setup-headless.sh.
 */

namespace Flavian\Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Cached check so the toggle doesn't hit the options table on every hook.
 */
function is_enabled(): bool {
	static $enabled = null;
	if ( $enabled === null ) {
		$enabled = (bool) get_option( 'flavian_headless_mode', false );
	}
	return $enabled;
}

function frontend_url(): string {
	$url = (string) get_option( 'flavian_headless_frontend_url', '' );
	return $url !== '' ? rtrim( $url, '/' ) : 'http://localhost:3000';
}

function preview_secret(): string {
	return (string) get_option( 'flavian_headless_preview_secret', '' );
}

/**
 * CORS for the frontend origin.
 *
 * Wide-open headers would defeat the purpose; we mirror the configured
 * frontend origin (or echo the Origin header if it matches one of a small
 * allowlist) and let WP's standard REST/GraphQL responses pass through.
 */
add_action( 'init', __NAMESPACE__ . '\\send_cors_headers' );
function send_cors_headers(): void {
	if ( ! is_enabled() ) {
		return;
	}

	$origin = isset( $_SERVER['HTTP_ORIGIN'] ) ? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) ) : '';
	if ( $origin === '' ) {
		return;
	}

	$allowed = array_filter( array_unique( array(
		frontend_url(),
		'http://localhost:3000',
	) ) );

	if ( ! in_array( $origin, $allowed, true ) ) {
		return;
	}

	header( 'Access-Control-Allow-Origin: ' . $origin );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
	header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
	header( 'Vary: Origin' );

	if ( ( $_SERVER['REQUEST_METHOD'] ?? '' ) === 'OPTIONS' ) {
		status_header( 204 );
		exit;
	}
}

/**
 * Rewrite the "Preview" link in the admin to point at the frontend's
 * /api/preview route. The route validates the secret + post id, sets a
 * Next.js draft mode cookie, then redirects to the post's frontend URL.
 */
add_filter( 'preview_post_link', __NAMESPACE__ . '\\rewrite_preview_link', 10, 2 );
function rewrite_preview_link( string $link, \WP_Post $post ): string {
	if ( ! is_enabled() ) {
		return $link;
	}
	$secret = preview_secret();
	if ( $secret === '' ) {
		return $link;
	}

	$query = http_build_query( array(
		'secret' => $secret,
		'id'     => $post->ID,
		'slug'   => $post->post_name,
		'type'   => $post->post_type,
	) );

	return frontend_url() . '/api/preview?' . $query;
}

/**
 * Replace the "View Post" permalink in the admin row actions so editors
 * land on the frontend rendering, not the WP single template.
 */
add_filter( 'post_link', __NAMESPACE__ . '\\rewrite_permalink', 10, 2 );
add_filter( 'page_link', __NAMESPACE__ . '\\rewrite_permalink', 10, 2 );
function rewrite_permalink( string $permalink, $post ): string {
	if ( ! is_enabled() || ! is_admin() ) {
		return $permalink;
	}
	$post = get_post( $post );
	if ( ! $post || $post->post_status !== 'publish' ) {
		return $permalink;
	}

	$path = wp_parse_url( $permalink, PHP_URL_PATH ) ?: '/';
	return frontend_url() . $path;
}

/**
 * REST API: trim a handful of endpoints that leak data unnecessarily for a
 * headless setup (user enumeration is the classic one). Apps that actually
 * need the users endpoint can reinstate it.
 */
add_filter( 'rest_endpoints', __NAMESPACE__ . '\\restrict_rest_endpoints' );
function restrict_rest_endpoints( array $endpoints ): array {
	if ( ! is_enabled() ) {
		return $endpoints;
	}
	unset(
		$endpoints['/wp/v2/users'],
		$endpoints['/wp/v2/users/(?P<id>[\d]+)']
	);
	return $endpoints;
}

/**
 * Expose the preview secret to GraphQL/REST consumers via a custom field
 * so a frontend can validate incoming preview requests against the same
 * secret WordPress just signed them with. Returned only to authenticated
 * editors+ — never publicly.
 */
add_action( 'rest_api_init', __NAMESPACE__ . '\\register_preview_field' );
function register_preview_field(): void {
	if ( ! is_enabled() ) {
		return;
	}
	register_rest_field( 'post', 'preview_secret_match', array(
		'get_callback' => static function ( $object, $field, $request ) {
			if ( ! current_user_can( 'edit_post', $object['id'] ) ) {
				return null;
			}
			$incoming = (string) $request->get_param( 'preview_secret' );
			return hash_equals( preview_secret(), $incoming );
		},
		'schema' => array(
			'description' => 'True when the incoming preview_secret query arg matches the stored secret.',
			'type'        => 'boolean',
			'context'     => array( 'edit' ),
		),
	) );
}

/**
 * Admin notice with the current frontend URL so editors know where Preview
 * is going to land them.
 */
add_action( 'admin_notices', __NAMESPACE__ . '\\admin_notice_headless_mode' );
function admin_notice_headless_mode(): void {
	if ( ! is_enabled() || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && $screen->id !== 'dashboard' ) {
		return;
	}
	printf(
		'<div class="notice notice-info"><p><strong>%s</strong> %s <code>%s</code></p></div>',
		esc_html__( 'Headless mode is active.', 'flavian' ),
		esc_html__( 'Previews and post links route to:', 'flavian' ),
		esc_html( frontend_url() )
	);
}
