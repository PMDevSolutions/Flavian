<?php
/**
 * PHPUnit bootstrap.
 *
 * Brain Monkey stands in for the WordPress runtime — no MySQL or
 * wp-tests-lib install required. Tests against real WordPress should live in
 * a separate tests/integration/ directory with its own bootstrap.
 *
 * @package Flavian\Plugins\FlavianStarter\Tests
 */

declare( strict_types=1 );

defined( 'ABSPATH' ) || define( 'ABSPATH', '/tmp/wordpress/' );

if ( ! defined( 'FLAVIAN_STARTER_VERSION' ) ) {
	define( 'FLAVIAN_STARTER_VERSION', '0.0.0-test' );
	define( 'FLAVIAN_STARTER_FILE',    dirname( __DIR__ ) . '/flavian-starter.php' );
	define( 'FLAVIAN_STARTER_PATH',    dirname( __DIR__ ) . '/' );
	define( 'FLAVIAN_STARTER_URL',     'http://example.test/wp-content/plugins/flavian-starter/' );
}

$autoload = __DIR__ . '/../vendor/autoload.php';
if ( ! file_exists( $autoload ) ) {
	fwrite( STDERR, "\nRun `composer install` inside this plugin before running tests.\n" );
	exit( 1 );
}
require_once $autoload;
