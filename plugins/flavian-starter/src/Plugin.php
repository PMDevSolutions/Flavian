<?php
/**
 * Bootstrap class for Flavian Starter.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter;

defined( 'ABSPATH' ) || exit;

/**
 * Singleton bootstrap. Conditionally wires each feature based on which classes
 * the autoloader can resolve — so removing a feature directory does not break
 * the rest of the plugin.
 */
final class Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var self|null
	 */
	private static ?self $instance = null;

	/**
	 * Accessor for the singleton instance.
	 *
	 * @return self
	 */
	public static function instance(): self {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Private constructor — use {@see self::instance()}.
	 */
	private function __construct() {}

	/**
	 * Wire feature classes into WordPress.
	 *
	 * @return void
	 */
	public function boot(): void {
		if ( class_exists( PostTypes\Event::class ) ) {
			( new PostTypes\Event() )->register();
		}
		if ( class_exists( Taxonomies\EventCategory::class ) ) {
			( new Taxonomies\EventCategory() )->register();
		}
		if ( class_exists( Admin\Settings::class ) ) {
			( new Admin\Settings() )->register();
		}
		if ( class_exists( Blocks\FeaturedEvent::class ) ) {
			( new Blocks\FeaturedEvent() )->register();
		}

		add_action( 'init', array( $this, 'load_textdomain' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
	}

	/**
	 * Load the plugin's text domain.
	 *
	 * @return void
	 */
	public function load_textdomain(): void {
		load_plugin_textdomain(
			'flavian-starter',
			false,
			dirname( plugin_basename( FLAVIAN_STARTER_FILE ) ) . '/languages'
		);
	}

	/**
	 * Enqueue admin-only assets.
	 *
	 * @param string $hook Current admin page hook suffix.
	 * @return void
	 */
	public function enqueue_admin_assets( string $hook ): void {
		if ( 'settings_page_flavian-starter' !== $hook ) {
			return;
		}
		wp_enqueue_style(
			'flavian-starter-admin',
			FLAVIAN_STARTER_URL . 'assets/css/admin.css',
			array(),
			FLAVIAN_STARTER_VERSION
		);
		wp_enqueue_script(
			'flavian-starter-admin',
			FLAVIAN_STARTER_URL . 'assets/js/admin.js',
			array(),
			FLAVIAN_STARTER_VERSION,
			true
		);
	}
}
