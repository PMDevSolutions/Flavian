<?php
/**
 * Plugin Name: Flavian Multisite Helpers
 * Description: Network admin niceties for the multisite setup — cached site list, a network dashboard widget, and an admin notice surfacing the network from a single site.
 * Version:     0.1.0
 * Author:      Flavian
 * License:     GPL-2.0-or-later
 *
 * Hooks are only registered when the install is actually multisite, so the
 * file is a no-op on single-site deployments.
 *
 * @package Flavian\Multisite
 */

namespace Flavian\Multisite;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

if ( ! is_multisite() ) {
	return;
}

const SITES_CACHE_KEY = 'flavian_multisite_sites';
const SITES_CACHE_TTL = 5 * MINUTE_IN_SECONDS;

/**
 * Fetch the network's sites with a short-lived transient cache.
 *
 * `get_sites()` is fine for one-off lookups but hammers the DB when called
 * from a hook that runs on every admin page. Five minutes is enough to
 * deduplicate dashboard widgets and admin notices without staling badly.
 *
 * @return array<int, \WP_Site>
 */
function get_network_sites_cached(): array {
	$cached = get_site_transient( SITES_CACHE_KEY );
	if ( is_array( $cached ) ) {
		return $cached;
	}

	$sites = get_sites(
		array(
			'number'  => 100,
			'orderby' => 'path',
		)
	);

	set_site_transient( SITES_CACHE_KEY, $sites, SITES_CACHE_TTL );
	return $sites;
}

/**
 * Invalidate the cached site list whenever a site is created or deleted.
 *
 * @return void
 */
function flush_sites_cache(): void {
	delete_site_transient( SITES_CACHE_KEY );
}
add_action( 'wp_initialize_site', __NAMESPACE__ . '\\flush_sites_cache' );
add_action( 'wp_delete_site', __NAMESPACE__ . '\\flush_sites_cache' );
add_action( 'wp_update_site', __NAMESPACE__ . '\\flush_sites_cache' );

/**
 * Register the "Network Sites" dashboard widget on the network admin.
 *
 * @return void
 */
function register_network_dashboard_widget(): void {
	wp_add_dashboard_widget(
		'flavian_network_sites',
		__( 'Network sites', 'flavian' ),
		__NAMESPACE__ . '\\render_network_dashboard_widget'
	);
}
add_action( 'wp_network_dashboard_setup', __NAMESPACE__ . '\\register_network_dashboard_widget' );

/**
 * Render the body of the network sites dashboard widget.
 *
 * @return void
 */
function render_network_dashboard_widget(): void {
	$sites = get_network_sites_cached();
	if ( empty( $sites ) ) {
		echo '<p>' . esc_html__( 'No sites in this network yet.', 'flavian' ) . '</p>';
		return;
	}

	echo '<ul class="flavian-network-sites">';
	foreach ( $sites as $site ) {
		$blog_id = (int) $site->blog_id;
		$details = get_blog_details( $blog_id );
		if ( ! $details ) {
			continue;
		}
		printf(
			'<li><a href="%1$s">%2$s</a> &mdash; <code>%3$s</code></li>',
			esc_url( get_admin_url( $blog_id ) ),
			esc_html( $details->blogname ),
			esc_html( $details->siteurl )
		);
	}
	echo '</ul>';
}

/**
 * Show a one-line notice on per-site admin screens linking back to the network.
 *
 * Helps editors who are managing multiple sub-sites realise they have
 * network-admin privileges available.
 *
 * @return void
 */
function admin_notice_network_link(): void {
	if ( ! is_super_admin() ) {
		return;
	}
	if ( is_network_admin() ) {
		return;
	}
	$screen = function_exists( 'get_current_screen' ) ? get_current_screen() : null;
	if ( ! $screen || 'dashboard' !== $screen->id ) {
		return;
	}
	$count = count( get_network_sites_cached() );
	printf(
		'<div class="notice notice-info"><p>%1$s <a href="%2$s">%3$s</a></p></div>',
		esc_html(
			sprintf(
				/* translators: %d: site count */
				_n( 'This is one of %d networked site.', 'This is one of %d networked sites.', $count, 'flavian' ),
				$count
			)
		),
		esc_url( network_admin_url() ),
		esc_html__( 'Open Network Admin', 'flavian' )
	);
}
add_action( 'admin_notices', __NAMESPACE__ . '\\admin_notice_network_link' );

/**
 * Expose a `flavian_network_sites` shortcode that lists sister sites.
 *
 * Useful in the network's main site footer or any place a theme wants a
 * cross-site nav without hand-rolling the query.
 *
 * @param array $atts Shortcode attributes.
 * @return string
 */
function shortcode_network_sites( $atts ): string {
	$atts = shortcode_atts(
		array(
			'exclude_current' => 'true',
		),
		$atts,
		'flavian_network_sites'
	);

	$current_blog_id = get_current_blog_id();
	$exclude_current = 'true' === strtolower( (string) $atts['exclude_current'] );
	$sites           = get_network_sites_cached();
	$html            = '<ul class="flavian-network-sites">';
	$rendered_any    = false;

	foreach ( $sites as $site ) {
		$blog_id = (int) $site->blog_id;
		if ( $exclude_current && $blog_id === $current_blog_id ) {
			continue;
		}
		$details = get_blog_details( $blog_id );
		if ( ! $details ) {
			continue;
		}
		$rendered_any = true;
		$html        .= sprintf(
			'<li><a href="%1$s">%2$s</a></li>',
			esc_url( $details->siteurl ),
			esc_html( $details->blogname )
		);
	}
	$html .= '</ul>';

	return $rendered_any ? $html : '';
}
add_shortcode( 'flavian_network_sites', __NAMESPACE__ . '\\shortcode_network_sites' );
