<?php
/**
 * Fires when Flavian Starter is deleted via the Plugins screen (not deactivated).
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

delete_option( 'flavian-starter_options' );

$post_ids = get_posts(
	[
		'post_type'   => 'flavian-starter_event',
		'numberposts' => -1,
		'fields'      => 'ids',
		'post_status' => 'any',
	]
);
foreach ( $post_ids as $post_id ) {
	wp_delete_post( (int) $post_id, true );
}
