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

final class EventCategory {

	public const TAXONOMY = 'flavian-starter_event_category';

	/**
	 * Hook the registration onto `init`.
	 */
	public function register(): void {
		add_action( 'init', [ $this, 'register_taxonomy' ] );
	}

	/**
	 * Register the taxonomy against the Event post type.
	 */
	public function register_taxonomy(): void {
		$object_type = class_exists( Event::class ) ? Event::POST_TYPE : 'flavian-starter_event';

		register_taxonomy(
			self::TAXONOMY,
			[ $object_type ],
			[
				'labels'            => [
					'name'          => __( 'Event Categories', 'flavian-starter' ),
					'singular_name' => __( 'Event Category', 'flavian-starter' ),
				],
				'hierarchical'      => true,
				'show_in_rest'      => true,
				'show_admin_column' => true,
				'rewrite'           => [ 'slug' => 'event-category' ],
			]
		);
	}
}
