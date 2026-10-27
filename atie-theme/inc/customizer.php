<?php
/**
 * Theme Customizer settings.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register settings.
 *
 * @param WP_Customize_Manager $wp_customize Customizer.
 */
function atie_customize_register( $wp_customize ) {
	$wp_customize->add_section(
		'atie_options',
		array(
			'title'    => __( 'Options ATIE', 'atie' ),
			'priority' => 30,
		)
	);

	// Hero title (homepage).
	$wp_customize->add_setting(
		'atie_hero_title',
		array(
			'default'           => __( 'De la pensée au pixel.', 'atie' ),
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'refresh',
		)
	);
	$wp_customize->add_control(
		'atie_hero_title',
		array(
			'label'   => __( 'Titre d\'accueil (hero)', 'atie' ),
			'section' => 'atie_options',
			'type'    => 'text',
		)
	);

	// Hero subtitle (homepage) — one line, also feeds SEO.
	$wp_customize->add_setting(
		'atie_hero_subtitle',
		array(
			'default'           => __( 'Agence digitale à Genève — sites web, applications mobiles, web-marketing et IA souveraine hébergée en Suisse.', 'atie' ),
			'sanitize_callback' => 'sanitize_text_field',
			'transport'         => 'refresh',
		)
	);
	$wp_customize->add_control(
		'atie_hero_subtitle',
		array(
			'label'       => __( 'Sous-titre d\'accueil (hero)', 'atie' ),
			'description' => __( 'Une phrase courte sous le titre. Laisser vide pour la masquer.', 'atie' ),
			'section'     => 'atie_options',
			'type'        => 'text',
		)
	);

	// Contact email.
	$wp_customize->add_setting(
		'atie_contact_email',
		array(
			'default'           => 'contact@atie.ch',
			'sanitize_callback' => 'sanitize_email',
		)
	);
	$wp_customize->add_control(
		'atie_contact_email',
		array(
			'label'   => __( 'E-mail de contact', 'atie' ),
			'section' => 'atie_options',
			'type'    => 'email',
		)
	);

	// Address.
	$wp_customize->add_setting(
		'atie_contact_address',
		array(
			'default'           => 'Route des Jeunes 23, 1227 Carouge',
			'sanitize_callback' => 'sanitize_text_field',
		)
	);
	$wp_customize->add_control(
		'atie_contact_address',
		array(
			'label'   => __( 'Adresse (carte)', 'atie' ),
			'section' => 'atie_options',
			'type'    => 'text',
		)
	);

	// Forminator form ID (optional).
	$wp_customize->add_setting(
		'atie_forminator_id',
		array(
			'default'           => '',
			'sanitize_callback' => 'sanitize_text_field',
		)
	);
	$wp_customize->add_control(
		'atie_forminator_id',
		array(
			'label'       => __( 'ID du formulaire Forminator', 'atie' ),
			'description' => __( 'Laisser vide pour insérer le formulaire directement dans le contenu de la page.', 'atie' ),
			'section'     => 'atie_options',
			'type'        => 'text',
		)
	);
}
add_action( 'customize_register', 'atie_customize_register' );
