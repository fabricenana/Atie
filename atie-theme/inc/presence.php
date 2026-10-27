<?php
/**
 * ATIE Presence page: assets loaded only on the "ATIE Presence" template.
 *
 * The receptionist widget is a self-contained script (Shadow DOM). On this
 * page it has no data-api attribute, so it runs in simulated demo mode:
 * no microphone, no network call, no paid session.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ATIE_PRESENCE_TEMPLATE = 'templates/template-presence.php';

/**
 * Contact page URL (page with the "contact" slug), or the site home as fallback.
 *
 * @return string
 */
function atie_presence_contact_url() {
	$page = get_page_by_path( 'contact' );

	return $page ? get_permalink( $page ) : home_url( '/' );
}

/**
 * Page styles and widget, only where the template is used.
 */
function atie_presence_assets() {
	if ( ! is_page_template( ATIE_PRESENCE_TEMPLATE ) ) {
		return;
	}

	wp_enqueue_style( 'atie-presence', ATIE_URI . '/assets/css/presence.css', array( 'atie-main' ), ATIE_VERSION );
	wp_enqueue_script( 'atie-presence-widget', ATIE_URI . '/assets/presence/atie-presence.js', array(), ATIE_VERSION, array( 'in_footer' => true ) );

	// Buttons open the widget; "leave a message" leads to the contact page.
	$contact = wp_json_encode( atie_presence_contact_url() );
	wp_add_inline_script(
		'atie-presence-widget',
		"(function(){document.querySelectorAll('[data-presence-open]').forEach(function(b){b.addEventListener('click',function(){if(window.AtiePresence)window.AtiePresence.open();});});" .
		"document.addEventListener('atie:fallback',function(){window.location.href={$contact};});})();"
	);
}
add_action( 'wp_enqueue_scripts', 'atie_presence_assets' );

/**
 * Widget options as data- attributes on its script tag.
 *
 * @param string $tag    Script tag.
 * @param string $handle Script handle.
 * @return string
 */
function atie_presence_script_attributes( $tag, $handle ) {
	if ( 'atie-presence-widget' !== $handle ) {
		return $tag;
	}

	$lang  = substr( (string) get_bloginfo( 'language' ), 0, 2 );
	$attrs = sprintf(
		' data-avatar-name="%s" data-lang="%s"',
		esc_attr( __( 'Léa', 'atie' ) ),
		esc_attr( in_array( $lang, array( 'fr', 'de', 'it', 'en' ), true ) ? $lang : 'fr' )
	);

	return preg_replace( '/<script(?=[^>]*\sid=["\']atie-presence-widget-js["\'])/', '<script' . $attrs, $tag, 1 );
}
add_filter( 'script_loader_tag', 'atie_presence_script_attributes', 10, 2 );
