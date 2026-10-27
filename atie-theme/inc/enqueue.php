<?php
/**
 * Enqueue styles & scripts.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Front-end assets.
 */
function atie_enqueue_assets() {
	// Fonts actually used by the site: Archivo (display), Work Sans (body), Roboto (UI/alt).
	wp_enqueue_style(
		'atie-fonts',
		'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800&family=Work+Sans:wght@400;500;600;700&family=Roboto:wght@400;500;700&display=swap',
		array(),
		null
	);

	// Theme header stylesheet (required by WP).
	wp_enqueue_style( 'atie-style', get_stylesheet_uri(), array(), ATIE_VERSION );

	// Main design stylesheet.
	wp_enqueue_style( 'atie-main', ATIE_URI . '/assets/css/main.css', array( 'atie-style' ), ATIE_VERSION );

	// Scripts.
	wp_enqueue_script( 'atie-theme', ATIE_URI . '/assets/js/theme.js', array(), ATIE_VERSION, true );

	// Portfolio tab filtering only where needed.
	if ( is_post_type_archive( 'project' ) || is_tax( 'project_category' ) || is_page_template( 'templates/template-portfolio.php' ) ) {
		wp_enqueue_script( 'atie-portfolio', ATIE_URI . '/assets/js/portfolio.js', array(), ATIE_VERSION, true );
	}

	if ( is_singular() && comments_open() && get_option( 'thread_comments' ) ) {
		wp_enqueue_script( 'comment-reply' );
	}
}
add_action( 'wp_enqueue_scripts', 'atie_enqueue_assets' );

/**
 * Editor styles for a closer match in the block editor.
 */
function atie_admin_assets() {
	add_editor_style( 'assets/css/main.css' );
}
add_action( 'after_setup_theme', 'atie_admin_assets' );
