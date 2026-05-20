/* global window */
/**
 * Editor-side registration for the Featured Event block.
 *
 * Uses the WordPress runtime globals (wp.blocks, wp.element, wp.blockEditor,
 * wp.i18n) directly so the block works without an ESM/JSX build step.
 */
( function ( blocks, element, blockEditor, i18n ) {
	'use strict';

	var registerBlockType = blocks.registerBlockType;
	var useBlockProps     = blockEditor.useBlockProps;
	var el                = element.createElement;
	var __                = i18n.__;

	registerBlockType( 'flavian-starter/featured-event', {
		edit: function () {
			var props = useBlockProps( {
				className: 'flavian-starter-featured-event-placeholder',
			} );
			return el(
				'div',
				props,
				el( 'strong', null, __( 'Featured Event', 'flavian-starter' ) ),
				el(
					'p',
					null,
					__(
						'Rendered server-side from the most recent published event.',
						'flavian-starter'
					)
				)
			);
		},
		save: function () {
			return null;
		},
	} );
}( window.wp.blocks, window.wp.element, window.wp.blockEditor, window.wp.i18n ) );
