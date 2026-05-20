<?php
/**
 * Tests for the Event custom post type registration.
 *
 * @package Flavian\Plugins\FlavianStarter\Tests
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\Tests\PostTypes;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use Flavian\Plugins\FlavianStarter\PostTypes\Event;
use Flavian\Plugins\FlavianStarter\Tests\TestCase;

/**
 * @covers \Flavian\Plugins\FlavianStarter\PostTypes\Event
 */
final class EventTest extends TestCase {

	public function test_post_type_constant_uses_plugin_slug(): void {
		$this->assertSame( 'flavian-starter_event', Event::POST_TYPE );
	}

	public function test_register_hooks_post_type_onto_init(): void {
		Actions\expectAdded( 'init' )
			->once()
			->with( \Mockery::type( 'array' ) );

		( new Event() )->register();
	}

	public function test_register_post_type_passes_expected_args(): void {
		$captured = [];

		Functions\when( 'register_post_type' )->alias(
			static function ( $slug, $args ) use ( &$captured ): void {
				$captured = [ 'slug' => $slug, 'args' => $args ];
			}
		);

		( new Event() )->register_post_type();

		$this->assertSame( 'flavian-starter_event', $captured['slug'] );
		$this->assertTrue( $captured['args']['public'] );
		$this->assertTrue( $captured['args']['show_in_rest'] );
		$this->assertContains( 'title', $captured['args']['supports'] );
		$this->assertContains( 'editor', $captured['args']['supports'] );
		$this->assertSame( 'events', $captured['args']['rewrite']['slug'] );
	}
}
