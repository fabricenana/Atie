<?php
/**
 * Theme setup: supports, menus, i18n.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Core theme supports & registrations.
 */
function atie_setup() {
	// Translation ready (FR only for now, but strings are coded properly).
	load_theme_textdomain( 'atie', ATIE_DIR . '/languages' );

	add_theme_support( 'automatic-feed-links' );
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script', 'navigation-widgets' ) );
	add_theme_support( 'customize-selective-refresh-widgets' );
	add_theme_support( 'responsive-embeds' );

	// WooCommerce compatibility (a shop exists on the site).
	add_theme_support( 'woocommerce' );
	add_theme_support( 'wc-product-gallery-zoom' );
	add_theme_support( 'wc-product-gallery-lightbox' );
	add_theme_support( 'wc-product-gallery-slider' );

	// Logo from the design (also usable via Customizer).
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 120,
			'width'       => 120,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	register_nav_menus(
		array(
			'primary' => __( 'Menu principal', 'atie' ),
			'footer'  => __( 'Menu pied de page', 'atie' ),
		)
	);
}
add_action( 'after_setup_theme', 'atie_setup' );

/**
 * Content width.
 */
function atie_content_width() {
	$GLOBALS['content_width'] = 1180;
}
add_action( 'after_setup_theme', 'atie_content_width', 0 );

/**
 * Widget areas (footer).
 */
function atie_widgets_init() {
	register_sidebar(
		array(
			'name'          => __( 'Pied de page', 'atie' ),
			'id'            => 'footer-1',
			'description'   => __( 'Widgets affichés dans le pied de page.', 'atie' ),
			'before_widget' => '<section id="%1$s" class="footer-widget %2$s">',
			'after_widget'  => '</section>',
			'before_title'  => '<h3 class="footer-widget__title">',
			'after_title'   => '</h3>',
		)
	);
}
add_action( 'widgets_init', 'atie_widgets_init' );
