<?php
/**
 * Settings page using the WordPress Settings API.
 *
 * @package Flavian\Plugins\FlavianStarter
 */

declare( strict_types=1 );

namespace Flavian\Plugins\FlavianStarter\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Registers an options page under Settings → Flavian Starter.
 */
final class Settings {

	public const OPTION_GROUP = 'flavian-starter_settings';
	public const OPTION_NAME  = 'flavian-starter_options';
	public const PAGE_SLUG    = 'flavian-starter';

	/**
	 * Hook menu and Settings API registration.
	 *
	 * @return void
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
	}

	/**
	 * Add the page under Settings.
	 *
	 * @return void
	 */
	public function add_menu(): void {
		add_options_page(
			__( 'Flavian Starter', 'flavian-starter' ),
			__( 'Flavian Starter', 'flavian-starter' ),
			'manage_options',
			self::PAGE_SLUG,
			array( $this, 'render_page' )
		);
	}

	/**
	 * Register option group, section and field.
	 *
	 * @return void
	 */
	public function register_settings(): void {
		register_setting(
			self::OPTION_GROUP,
			self::OPTION_NAME,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize' ),
				'default'           => array( 'greeting' => '' ),
				'show_in_rest'      => false,
			)
		);

		add_settings_section(
			'flavian-starter_general',
			__( 'General', 'flavian-starter' ),
			'__return_false',
			self::PAGE_SLUG
		);

		add_settings_field(
			'flavian-starter_greeting',
			__( 'Greeting', 'flavian-starter' ),
			array( $this, 'render_greeting_field' ),
			self::PAGE_SLUG,
			'flavian-starter_general'
		);
	}

	/**
	 * Sanitize the option array before save.
	 *
	 * @param mixed $input Raw submitted value.
	 * @return array<string, string>
	 */
	public function sanitize( $input ): array {
		$input = is_array( $input ) ? $input : array();
		return array(
			'greeting' => isset( $input['greeting'] ) ? sanitize_text_field( (string) $input['greeting'] ) : '',
		);
	}

	/**
	 * Render the single text-input field.
	 *
	 * @return void
	 */
	public function render_greeting_field(): void {
		$options  = get_option( self::OPTION_NAME, array( 'greeting' => '' ) );
		$greeting = isset( $options['greeting'] ) ? (string) $options['greeting'] : '';
		printf(
			'<input type="text" name="%1$s[greeting]" value="%2$s" class="regular-text" />',
			esc_attr( self::OPTION_NAME ),
			esc_attr( $greeting )
		);
	}

	/**
	 * Render the page wrapper.
	 *
	 * @return void
	 */
	public function render_page(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		?>
		<div class="wrap">
			<h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
			<form action="options.php" method="post">
				<?php
				settings_fields( self::OPTION_GROUP );
				do_settings_sections( self::PAGE_SLUG );
				submit_button();
				?>
			</form>
		</div>
		<?php
	}
}
