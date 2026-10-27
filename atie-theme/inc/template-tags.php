<?php
/**
 * Template helpers.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Available service icon choices (key => label).
 *
 * @return array
 */
function atie_service_icon_choices() {
	return array(
		'web'     => __( 'Création de sites web', 'atie' ),
		'mobile'  => __( 'Applications mobiles', 'atie' ),
		'seo'     => __( 'Web-marketing & SEO', 'atie' ),
		'design'  => __( 'Design graphique', 'atie' ),
		'ia'      => __( 'IA souveraine', 'atie' ),
		'support' => __( 'Support & Maintenance', 'atie' ),
		'default' => __( 'Générique', 'atie' ),
	);
}

/**
 * Inline SVG for a service icon. Stroke uses currentColor (red set by CSS).
 *
 * @param string $key Icon key.
 * @return string SVG markup.
 */
function atie_service_icon_svg( $key ) {
	$common = 'width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
	$icons  = array(
		'web'     => '<rect x="3" y="4" width="18" height="16" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>',
		'mobile'  => '<rect x="7" y="3" width="10" height="18" rx="2.5"/><line x1="10.5" y1="18" x2="13.5" y2="18"/>',
		'seo'     => '<circle cx="11" cy="11" r="6"/><line x1="15.5" y1="15.5" x2="20" y2="20"/>',
		'design'  => '<circle cx="9" cy="9" r="5"/><rect x="11" y="11" width="9" height="9" rx="1.5"/>',
		'ia'      => '<rect x="7" y="7" width="10" height="10" rx="2"/><rect x="10" y="10" width="4" height="4" rx="1"/><line x1="9.5" y1="4" x2="9.5" y2="7"/><line x1="14.5" y1="4" x2="14.5" y2="7"/><line x1="9.5" y1="17" x2="9.5" y2="20"/><line x1="14.5" y1="17" x2="14.5" y2="20"/><line x1="4" y1="9.5" x2="7" y2="9.5"/><line x1="4" y1="14.5" x2="7" y2="14.5"/><line x1="17" y1="9.5" x2="20" y2="9.5"/><line x1="17" y1="14.5" x2="20" y2="14.5"/>',
		'support' => '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
		'default' => '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3 2.4c-.7.2-1 .6-1 1.3v.3"/><line x1="11.5" y1="16.5" x2="11.5" y2="16.6"/>',
	);
	$path = isset( $icons[ $key ] ) ? $icons[ $key ] : $icons['default'];
	return '<svg ' . $common . '>' . $path . '</svg>';
}

/**
 * Echo the inline Penseur/brand background data attribute helper.
 * Returns the URL of the hero figure used on the homepage.
 *
 * @return string
 */
function atie_penseur_url() {
	return ATIE_URI . '/assets/img/penseur.png';
}

/**
 * Primary menu with a sensible fallback when no menu is assigned.
 */
function atie_primary_menu() {
	if ( has_nav_menu( 'primary' ) ) {
		wp_nav_menu(
			array(
				'theme_location' => 'primary',
				'container'      => false,
				'menu_class'     => 'main-nav__list',
				'depth'          => 2,
			)
		);
		return;
	}

	// Fallback: link to the CPT archives + contact page if present.
	$contact = get_page_by_path( 'contact' );
	echo '<ul class="main-nav__list">';
	printf( '<li><a href="%s">%s</a></li>', esc_url( home_url( '/' ) ), esc_html__( 'Accueil', 'atie' ) );
	printf( '<li><a href="%s">%s</a></li>', esc_url( home_url( '/realisations/' ) ), esc_html__( 'Portfolio', 'atie' ) );
	printf( '<li><a href="%s">%s</a></li>', esc_url( home_url( '/services/' ) ), esc_html__( 'Services', 'atie' ) );
	if ( $contact ) {
		printf( '<li><a href="%s">%s</a></li>', esc_url( get_permalink( $contact ) ), esc_html__( 'Contact', 'atie' ) );
	}
	echo '</ul>';
}

/**
 * URL of the Contact page (by slug), falling back to home.
 *
 * @return string
 */
function atie_contact_url() {
	$contact = get_page_by_path( 'contact' );
	if ( $contact ) {
		return get_permalink( $contact );
	}
	return home_url( '/contact/' );
}

/**
 * Output the brand logo (custom logo if set, else the bundled ATIE mark).
 */
function atie_brand_logo() {
	if ( has_custom_logo() ) {
		the_custom_logo();
		return;
	}
	printf(
		'<a class="brand" href="%1$s" rel="home"><img src="%2$s" alt="%3$s" /></a>',
		esc_url( home_url( '/' ) ),
		esc_url( ATIE_URI . '/assets/img/logo-atie.png' ),
		esc_attr( get_bloginfo( 'name' ) )
	);
}
