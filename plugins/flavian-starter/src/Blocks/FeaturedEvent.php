<?php
/**
 * Featured Event dynamic block.
 *
 * Server-rendered — no build step required. The editor-side script in
 * assets/blocks/featured-event/index.js uses the WP runtime globals
 * (wp.blocks, wp.element, wp.blockEditor, wp.i18n) directly instead of an
 * ESM/JSX bundle, so the plugin works the moment it's activated.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\Blocks;

use Flavian\Plugins\FlavianStarter\PostTypes\Event;

defined( 'ABSPATH' ) || exit;

/**
 * Registers and server-renders the Featured Event block.
 */
final class FeaturedEvent {

	/**
	 * Hook block registration to `init` (required by register_block_type).
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'init', array( $this, 'register_block' ) );
	}

	/**
	 * Register the block by pointing register_block_type at the block.json.
	 *
	 * @return void
	 */
	public function register_block(): void {
		register_block_type(
			FLAVIAN_STARTER_PATH . 'assets/blocks/featured-event',
			array(
				'render_callback' => array( $this, 'render' ),
			)
		);
	}

	/**
	 * Server-side render: pulls the most recent published event.
	 *
	 * @param array<string, mixed> $attributes Block attributes (unused).
	 * @param string               $content    Inner content (unused).
	 * @return string
	 */
	public function render( array $attributes, string $content ): string {
		unset( $attributes, $content );

		$post_type = class_exists( Event::class ) ? Event::POST_TYPE : 'flavian-starter_event';

		$events = get_posts(
			array(
				'post_type'      => $post_type,
				'posts_per_page' => 1,
				'post_status'    => 'publish',
				'no_found_rows'  => true,
			)
		);

		if ( empty( $events ) ) {
			return '';
		}

		$event   = $events[0];
		$excerpt = '' !== $event->post_excerpt
			? $event->post_excerpt
			: wp_trim_words( $event->post_content, 30 );

		ob_start();
		?>
		<div <?php echo wp_kses_data( get_block_wrapper_attributes() ); ?>>
			<h3 class="flavian-starter-featured-event__title">
				<?php echo esc_html( $event->post_title ); ?>
			</h3>
			<div class="flavian-starter-featured-event__excerpt">
				<?php echo wp_kses_post( wpautop( $excerpt ) ); ?>
			</div>
			<a class="flavian-starter-featured-event__link" href="<?php echo esc_url( (string) get_permalink( $event ) ); ?>">
				<?php esc_html_e( 'Read more', 'flavian-starter' ); ?>
			</a>
		</div>
		<?php
		return (string) ob_get_clean();
	}
}
