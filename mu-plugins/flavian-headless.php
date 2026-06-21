<?php
/**
 * Plugin Name: Flavian Headless Support
 * Description: CORS, preview URL rewriting, and REST API hardening for the headless WP setup. Only active when the flavian_headless_mode option is on.
 * Version:     0.1.0
 * Author:      Flavian
 * License:     GPL-2.0-or-later
 *
 * Configured by scripts/wordpress-install/setup-headless.sh.
 *
 * @package Flavian\Headless
 */

namespace Flavian\Headless;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Per-blog site-transient cache for cross-site (network) config reads.
const CONFIG_CACHE_PREFIX = 'flavian_headless_cfg_';
const CONFIG_CACHE_TTL    = 5 * MINUTE_IN_SECONDS;

/**
 * Read the headless settings for the current blog, cached per blog for the request.
 *
 * In multisite get_option() is already per-blog, but a request-static that is not
 * keyed by blog id leaks one site's config into another after switch_to_blog().
 * Keying the request cache by blog id keeps each tenant isolated.
 *
 * @return array Current blog config: enabled (bool), frontend_url (string), preview_secret (string).
 */
function current_settings(): array {
	static $cache = array();

	$blog_id = get_current_blog_id();
	if ( ! isset( $cache[ $blog_id ] ) ) {
		$cache[ $blog_id ] = array(
			'enabled'        => (bool) get_option( 'flavian_headless_mode', false ),
			'frontend_url'   => normalize_frontend_url( (string) get_option( 'flavian_headless_frontend_url', '' ) ),
			'preview_secret' => (string) get_option( 'flavian_headless_preview_secret', '' ),
		);
	}

	return $cache[ $blog_id ];
}

/**
 * Normalize a stored frontend URL: strip a trailing slash, fall back to local dev.
 *
 * @param string $url Raw stored URL.
 * @return string
 */
function normalize_frontend_url( string $url ): string {
	return '' !== $url ? rtrim( $url, '/' ) : 'http://localhost:3000';
}

/**
 * Whether headless mode is enabled for the current blog.
 *
 * @return bool
 */
function is_enabled(): bool {
	return current_settings()['enabled'];
}

/**
 * Configured frontend origin without a trailing slash, for the current blog.
 *
 * @return string
 */
function frontend_url(): string {
	return current_settings()['frontend_url'];
}

/**
 * Stored preview secret used to authenticate Preview-button clicks, for the current blog.
 *
 * @return string
 */
function preview_secret(): string {
	return current_settings()['preview_secret'];
}

/**
 * Read another blog's public headless config without leaking the current blog's.
 *
 * Network-level views (e.g. the network dashboard widget) need a sub-site's
 * config. This switches into the target blog to read its per-site options, always
 * restores, and caches the non-sensitive result in a per-blog site transient so a
 * network screen listing many sites does not switch on every render. The preview
 * secret is intentionally excluded — it never needs to leave its own site.
 *
 * @param int $blog_id Target blog id.
 * @return array Public config: enabled (bool), frontend_url (string).
 */
function settings_for_blog( int $blog_id ): array {
	if ( ! is_multisite() || get_current_blog_id() === $blog_id ) {
		$current = current_settings();
		return array(
			'enabled'      => $current['enabled'],
			'frontend_url' => $current['frontend_url'],
		);
	}

	$cache_key = CONFIG_CACHE_PREFIX . $blog_id;
	$cached    = get_site_transient( $cache_key );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	switch_to_blog( $blog_id );
	$settings = array(
		'enabled'      => (bool) get_option( 'flavian_headless_mode', false ),
		'frontend_url' => normalize_frontend_url( (string) get_option( 'flavian_headless_frontend_url', '' ) ),
	);
	restore_current_blog();

	set_site_transient( $cache_key, $settings, CONFIG_CACHE_TTL );
	return $settings;
}

/**
 * Drop the cross-site config cache for a blog when its headless options change.
 *
 * The update_option_* hooks fire on the blog whose option changed, so the current
 * blog id identifies the transient to invalidate.
 *
 * @return void
 */
function flush_config_cache(): void {
	delete_site_transient( CONFIG_CACHE_PREFIX . get_current_blog_id() );
}
add_action( 'update_option_flavian_headless_mode', __NAMESPACE__ . '\\flush_config_cache' );
add_action( 'update_option_flavian_headless_frontend_url', __NAMESPACE__ . '\\flush_config_cache' );
add_action( 'update_option_flavian_headless_preview_secret', __NAMESPACE__ . '\\flush_config_cache' );

/**
 * Origins allowed to make credentialed cross-origin requests.
 *
 * The configured frontend plus localhost:3000 for local dev. Apps that need
 * more origins can extend this on the `flavian_headless_allowed_origins` filter.
 *
 * @return string[]
 */
function allowed_origins(): array {
	$origins = array_filter(
		array_unique(
			array(
				frontend_url(),
				'http://localhost:3000',
			)
		)
	);

	/**
	 * Filter the CORS origin allowlist for headless mode.
	 *
	 * @param string[] $origins Allowed origins (no trailing slash).
	 */
	return (array) apply_filters( 'flavian_headless_allowed_origins', $origins );
}

/**
 * The request Origin, sanitized, or '' when absent.
 *
 * @return string
 */
function request_origin(): string {
	return isset( $_SERVER['HTTP_ORIGIN'] )
		? esc_url_raw( wp_unslash( $_SERVER['HTTP_ORIGIN'] ) )
		: '';
}

/**
 * Emit CORS headers for the configured frontend origin.
 *
 * Wide-open headers would defeat the purpose; we mirror the configured
 * frontend origin (or echo the Origin header when it matches the allowlist)
 * and let WP's standard REST/GraphQL responses pass through.
 *
 * @return void
 */
function send_cors_headers(): void {
	if ( ! is_enabled() ) {
		return;
	}

	$origin = request_origin();
	if ( '' === $origin || ! in_array( $origin, allowed_origins(), true ) ) {
		return;
	}

	header( 'Access-Control-Allow-Origin: ' . $origin );
	header( 'Access-Control-Allow-Credentials: true' );
	header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
	header( 'Access-Control-Allow-Methods: GET, POST, OPTIONS' );
	header( 'Vary: Origin' );

	$method = isset( $_SERVER['REQUEST_METHOD'] )
		? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_METHOD'] ) )
		: '';
	if ( 'OPTIONS' === $method ) {
		status_header( 204 );
		exit;
	}
}
add_action( 'init', __NAMESPACE__ . '\\send_cors_headers' );

/**
 * Lock the REST API's CORS headers to the allowlist.
 *
 * WordPress core's default `rest_send_cors_headers()` reflects *any* Origin
 * back with `Access-Control-Allow-Credentials: true`. For a headless install
 * that hands the REST API to a known frontend, that's exactly the wide-open
 * behavior we want to avoid — so we swap core's handler for an allowlisted one.
 * Disallowed origins get no ACAO/ACAC and therefore no credentialed access.
 *
 * @return void
 */
function restrict_rest_cors(): void {
	if ( ! is_enabled() ) {
		return;
	}
	remove_filter( 'rest_pre_serve_request', 'rest_send_cors_headers' );
	add_filter( 'rest_pre_serve_request', __NAMESPACE__ . '\\send_rest_cors_headers' );
}
add_action( 'rest_api_init', __NAMESPACE__ . '\\restrict_rest_cors', 15 );

/**
 * Allowlisted replacement for core's rest_send_cors_headers().
 *
 * @param bool $served Whether the request has already been served.
 * @return bool Unmodified $served (this is a pass-through filter).
 */
function send_rest_cors_headers( $served ) {
	$origin = request_origin();
	if ( '' !== $origin && in_array( $origin, allowed_origins(), true ) ) {
		header( 'Access-Control-Allow-Origin: ' . $origin );
		header( 'Access-Control-Allow-Methods: OPTIONS, GET, POST, PUT, PATCH, DELETE' );
		header( 'Access-Control-Allow-Credentials: true' );
		header( 'Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce' );
		header( 'Vary: Origin', false );
	}
	return $served;
}

/**
 * Rewrite the admin "Preview" link to the frontend's /api/preview route.
 *
 * The route validates the secret + post id, sets a Next.js draft-mode
 * cookie, then redirects to the post's frontend URL.
 *
 * @param string   $link Current preview URL.
 * @param \WP_Post $post Post being previewed.
 * @return string
 */
function rewrite_preview_link( string $link, \WP_Post $post ): string {
	if ( ! is_enabled() ) {
		return $link;
	}
	$secret = preview_secret();
	if ( '' === $secret ) {
		return $link;
	}

	$query = http_build_query(
		array(
			'secret' => $secret,
			'id'     => $post->ID,
			'slug'   => $post->post_name,
			'type'   => $post->post_type,
		)
	);

	return frontend_url() . '/api/preview?' . $query;
}
add_filter( 'preview_post_link', __NAMESPACE__ . '\\rewrite_preview_link', 10, 2 );

/**
 * Rewrite "View Post" permalinks shown in the admin to the frontend origin.
 *
 * @param string            $permalink Current permalink.
 * @param \WP_Post|int|null $post      Post object or ID passed by the filter.
 * @return string
 */
function rewrite_permalink( string $permalink, $post ): string {
	if ( ! is_enabled() || ! is_admin() ) {
		return $permalink;
	}
	$post_obj = get_post( $post );
	if ( ! $post_obj || 'publish' !== $post_obj->post_status ) {
		return $permalink;
	}

	$path = wp_parse_url( $permalink, PHP_URL_PATH );
	if ( empty( $path ) ) {
		$path = '/';
	}
	return frontend_url() . $path;
}
add_filter( 'post_link', __NAMESPACE__ . '\\rewrite_permalink', 10, 2 );
add_filter( 'page_link', __NAMESPACE__ . '\\rewrite_permalink', 10, 2 );

/**
 * Remove REST endpoints that leak data unnecessarily for a headless setup.
 *
 * Apps that actually need the users endpoint can reinstate it on the
 * `rest_endpoints` filter with a later priority.
 *
 * @param array $endpoints REST endpoints map.
 * @return array
 */
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
add_filter( 'rest_endpoints', __NAMESPACE__ . '\\restrict_rest_endpoints' );

/**
 * Register a REST field that confirms the incoming preview_secret matches.
 *
 * Returned only to authenticated editors+; anonymous callers get null.
 *
 * @return void
 */
function register_preview_field(): void {
	if ( ! is_enabled() ) {
		return;
	}
	register_rest_field(
		'post',
		'preview_secret_match',
		array(
			'get_callback' => static function ( $post_arr, $field, $request ) {
				unset( $field );
				if ( ! current_user_can( 'edit_post', $post_arr['id'] ) ) {
					return null;
				}
				$incoming = (string) $request->get_param( 'preview_secret' );
				return hash_equals( preview_secret(), $incoming );
			},
			'schema'       => array(
				'description' => 'True when the incoming preview_secret query arg matches the stored secret.',
				'type'        => 'boolean',
				'context'     => array( 'edit' ),
			),
		)
	);
}
add_action( 'rest_api_init', __NAMESPACE__ . '\\register_preview_field' );

/**
 * Surface an admin notice on the dashboard showing the current frontend URL.
 *
 * @return void
 */
function admin_notice_headless_mode(): void {
	if ( ! is_enabled() || ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( $screen && 'dashboard' !== $screen->id ) {
		return;
	}
	printf(
		'<div class="notice notice-info"><p><strong>%s</strong> %s <code>%s</code></p></div>',
		esc_html__( 'Headless mode is active.', 'flavian' ),
		esc_html__( 'Previews and post links route to:', 'flavian' ),
		esc_html( frontend_url() )
	);
}
add_action( 'admin_notices', __NAMESPACE__ . '\\admin_notice_headless_mode' );
