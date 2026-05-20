<?php
/**
 * Example custom taxonomy.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\Taxonomies;

use Flavian\Plugins\FlavianStarter\PostTypes\Event;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the Event Category taxonomy against the Event post type.
 */
final class EventCategory {

	public const TAXONOMY = 'flavian-starter_event_category';

	/**
	 * Hook the registration onto `init`.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_taxonomy' ) );
	}

	/**
	 * Register the taxonomy.
	 *
	 * @return void
	 */
	public function register_taxonomy(): void {
		$object_type = class_exists( Event::class ) ? Event::POST_TYPE : 'flavian-starter_event';

		register_taxonomy(
			self::TAXONOMY,
			array( $object_type ),
			array(
				'labels'            => array(
					'name'          => __( 'Event Categories', 'flavian-starter' ),
					'singular_name' => __( 'Event Category', 'flavian-starter' ),
				),
				'hierarchical'      => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'rewrite'           => array( 'slug' => 'event-category' ),
			)
		);
	}
}
