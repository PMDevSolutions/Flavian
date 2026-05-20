<?php
/**
 * Plugin activation handler.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter;

defined( 'ABSPATH' ) || exit;

final class Activator {

	/**
	 * Runs once when the plugin is activated. Registers types eagerly so
	 * rewrite rules can be flushed against the final permalink structure.
	 */
	public static function activate(): void {
		if ( class_exists( PostTypes\Event::class ) ) {
			( new PostTypes\Event() )->register();
		}
		if ( class_exists( Taxonomies\EventCategory::class ) ) {
			( new Taxonomies\EventCategory() )->register();
		}
		flush_rewrite_rules();
	}
}
