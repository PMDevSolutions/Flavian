<?php
/**
 * Plugin Name:       Flavian Starter
 * Plugin URI:        https://github.com/PMDevSolutions/Flavian
 * Description:       Starter plugin for Flavian-based projects. Demonstrates CPT, taxonomy, settings, and a server-rendered block.
 * Version:           0.1.0
 * Requires at least: 6.5
 * Requires PHP:      8.0
 * Author:            PMDevSolutions
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       flavian-starter
 * Domain Path:       /languages
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter;

defined( 'ABSPATH' ) || exit;

define( 'FLAVIAN_STARTER_VERSION', '0.1.0' );
define( 'FLAVIAN_STARTER_FILE', __FILE__ );
define( 'FLAVIAN_STARTER_PATH', plugin_dir_path( __FILE__ ) );
define( 'FLAVIAN_STARTER_URL', plugin_dir_url( __FILE__ ) );

$flavian_autoload = FLAVIAN_STARTER_PATH . 'vendor/autoload.php';
if ( ! file_exists( $flavian_autoload ) ) {
	add_action(
		'admin_notices',
		static function (): void {
			echo '<div class="notice notice-error"><p>';
			esc_html_e(
				'Flavian Starter: vendor/autoload.php not found. Run "composer install" inside the plugin directory.',
				'flavian-starter'
			);
			echo '</p></div>';
		}
	);
	return;
}
require_once $flavian_autoload;

register_activation_hook( __FILE__, array( Activator::class, 'activate' ) );
register_deactivation_hook( __FILE__, array( Deactivator::class, 'deactivate' ) );

add_action(
	'plugins_loaded',
	static function (): void {
		Plugin::instance()->boot();
	}
);
