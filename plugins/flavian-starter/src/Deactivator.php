<?php
/**
 * Plugin deactivation handler.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter;

defined( 'ABSPATH' ) || exit;

final class Deactivator {

	/**
	 * Runs once when the plugin is deactivated. Flushes rewrite rules so the
	 * custom post type's permalink rules disappear cleanly.
	 */
	public static function deactivate(): void {
		flush_rewrite_rules();
	}
}
