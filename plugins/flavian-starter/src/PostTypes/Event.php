<?php
/**
 * Example custom post type.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\PostTypes;

defined( 'ABSPATH' ) || exit;

final class Event {

	public const POST_TYPE = 'flavian-starter_event';

	/**
	 * Hook the registration onto `init`.
	 */
	public function register(): void {
		add_action( 'init', [ $this, 'register_post_type' ] );
	}

	/**
	 * Register the post type. Public, REST-enabled, with archive at /events/.
	 */
	public function register_post_type(): void {
		register_post_type(
			self::POST_TYPE,
			[
				'labels'       => [
					'name'               => __( 'Events', 'flavian-starter' ),
					'singular_name'      => __( 'Event', 'flavian-starter' ),
					'add_new_item'       => __( 'Add New Event', 'flavian-starter' ),
					'edit_item'          => __( 'Edit Event', 'flavian-starter' ),
					'new_item'           => __( 'New Event', 'flavian-starter' ),
					'view_item'          => __( 'View Event', 'flavian-starter' ),
					'search_items'       => __( 'Search Events', 'flavian-starter' ),
					'not_found'          => __( 'No events found.', 'flavian-starter' ),
					'not_found_in_trash' => __( 'No events found in Trash.', 'flavian-starter' ),
				],
				'public'       => true,
				'show_in_rest' => true,
				'has_archive'  => true,
				'menu_icon'    => 'dashicons-calendar-alt',
				'supports'     => [ 'title', 'editor', 'thumbnail', 'excerpt' ],
				'rewrite'      => [ 'slug' => 'events' ],
			]
		);
	}
}
