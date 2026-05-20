<?php
/**
 * Tests the bootstrap singleton.
 *
 * @package Flavian\Plugins\FlavianStarter\Tests
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\Tests;

use Flavian\Plugins\FlavianStarter\Plugin;

/**
 * @covers \Flavian\Plugins\FlavianStarter\Plugin
 */
final class PluginTest extends TestCase {

	public function test_instance_returns_singleton(): void {
		$a = Plugin::instance();
		$b = Plugin::instance();
		$this->assertSame( $a, $b );
	}
}
