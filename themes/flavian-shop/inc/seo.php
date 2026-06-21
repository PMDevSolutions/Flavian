<?php
/**
 * Front-end SEO metadata: meta description, Open Graph, Twitter Card, and JSON-LD
 * structured data rendered from the queried object via wp_head.
 *
 * Deliberately minimal and plugin-aware — it bails when a dedicated SEO plugin is
 * active so the theme never emits duplicate tags. The document <title> is left to
 * WordPress (title-tag support), so this only adds what core doesn't.
 *
 * @package Flavian_Shop
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Whether a dedicated SEO plugin is already managing head output.
 *
 * @return bool
 */
function flavian_shop_seo_plugin_active() {
	return defined( 'WPSEO_VERSION' )      // Yoast SEO.
		|| defined( 'RANK_MATH_VERSION' )  // Rank Math.
		|| defined( 'AIOSEO_VERSION' )     // All in One SEO.
		|| defined( 'SEOPRESS_VERSION' );  // SEOPress.
}

/**
 * Resolve a clean, length-capped description for the current view.
 *
 * @return string
 */
function flavian_shop_seo_description() {
	$description = '';

	if ( is_singular() ) {
		$post = get_queried_object();
		if ( $post instanceof WP_Post ) {
			$description = has_excerpt( $post ) ? get_the_excerpt( $post ) : $post->post_content;
		}
	} elseif ( is_category() || is_tag() || is_tax() ) {
		$description = term_description();
	}

	if ( '' === trim( $description ) ) {
		$description = get_bloginfo( 'description', 'display' );
	}

	$description = trim( (string) preg_replace( '/\s+/', ' ', wp_strip_all_tags( $description ) ) );

	return wp_html_excerpt( $description, 160, '' );
}

/**
 * Canonical URL for the current view.
 *
 * @return string
 */
function flavian_shop_seo_url() {
	$canonical = is_singular() ? wp_get_canonical_url() : false;

	return $canonical ? $canonical : home_url( '/' );
}

/**
 * Featured-image URL for the current singular view, or '' when none.
 *
 * @return string
 */
function flavian_shop_seo_image() {
	if ( is_singular() && has_post_thumbnail() ) {
		$src = get_the_post_thumbnail_url( get_queried_object_id(), 'full' );
		if ( $src ) {
			return $src;
		}
	}

	return '';
}

/**
 * Output meta description, Open Graph, and Twitter Card tags.
 *
 * @return void
 */
function flavian_shop_seo_meta_tags() {
	if ( flavian_shop_seo_plugin_active() ) {
		return;
	}

	$title       = wp_get_document_title();
	$description = flavian_shop_seo_description();
	$url         = flavian_shop_seo_url();
	$image       = flavian_shop_seo_image();
	$type        = is_singular( 'post' ) ? 'article' : 'website';
	$card        = '' !== $image ? 'summary_large_image' : 'summary';

	printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $description ) );

	printf( '<meta property="og:type" content="%s" />' . "\n", esc_attr( $type ) );
	printf( '<meta property="og:title" content="%s" />' . "\n", esc_attr( $title ) );
	printf( '<meta property="og:description" content="%s" />' . "\n", esc_attr( $description ) );
	printf( '<meta property="og:url" content="%s" />' . "\n", esc_url( $url ) );
	printf( '<meta property="og:site_name" content="%s" />' . "\n", esc_attr( get_bloginfo( 'name' ) ) );

	printf( '<meta name="twitter:card" content="%s" />' . "\n", esc_attr( $card ) );
	printf( '<meta name="twitter:title" content="%s" />' . "\n", esc_attr( $title ) );
	printf( '<meta name="twitter:description" content="%s" />' . "\n", esc_attr( $description ) );

	if ( '' !== $image ) {
		printf( '<meta property="og:image" content="%s" />' . "\n", esc_url( $image ) );
		printf( '<meta name="twitter:image" content="%s" />' . "\n", esc_url( $image ) );
	}
}
add_action( 'wp_head', 'flavian_shop_seo_meta_tags', 5 );

/**
 * Output JSON-LD structured data for the current view (Article for posts,
 * WebSite otherwise).
 *
 * @return void
 */
function flavian_shop_seo_jsonld() {
	if ( flavian_shop_seo_plugin_active() ) {
		return;
	}

	if ( is_singular( 'post' ) ) {
		$post = get_queried_object();
		if ( ! $post instanceof WP_Post ) {
			return;
		}
		$data = array(
			'@context'         => 'https://schema.org',
			'@type'            => 'Article',
			'headline'         => wp_strip_all_tags( get_the_title( $post ) ),
			'datePublished'    => get_post_time( 'c', true, $post ),
			'dateModified'     => get_post_modified_time( 'c', true, $post ),
			'author'           => array(
				'@type' => 'Person',
				'name'  => get_the_author_meta( 'display_name', (int) $post->post_author ),
			),
			'mainEntityOfPage' => flavian_shop_seo_url(),
		);

		$image = flavian_shop_seo_image();
		if ( '' !== $image ) {
			$data['image'] = $image;
		}
	} else {
		$data = array(
			'@context' => 'https://schema.org',
			'@type'    => 'WebSite',
			'name'     => get_bloginfo( 'name' ),
			'url'      => home_url( '/' ),
		);
	}

	$json = wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
	if ( false === $json ) {
		return;
	}

	// wp_json_encode with JSON_HEX_* escapes <, >, &, ', " so the payload is safe inside <script>.
	echo '<script type="application/ld+json">' . $json . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
add_action( 'wp_head', 'flavian_shop_seo_jsonld', 6 );
