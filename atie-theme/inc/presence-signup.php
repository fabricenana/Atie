<?php
/**
 * ATIE Presence sign-up: one page where a company asks for its receptionist.
 *
 * The form (templates/template-presence-signup.php) posts to admin-post.php.
 * Each request is stored as a private "presence_signup" entry (visible in the
 * admin under « Inscriptions Presence ») and sent by e-mail to the site
 * administrator. Protections: nonce, honeypot field, minimum fill time and a
 * limit per visitor (hashed IP, never stored in clear).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ATIE_SIGNUP_TEMPLATE = 'templates/template-presence-signup.php';
const ATIE_SIGNUP_ACTION   = 'atie_presence_signup';

/**
 * Private post type holding the requests (admin only).
 */
function atie_presence_signup_post_type() {
	register_post_type(
		'presence_signup',
		array(
			'labels'          => array(
				'name'          => __( 'Inscriptions Presence', 'atie' ),
				'singular_name' => __( 'Inscription Presence', 'atie' ),
				'menu_name'     => __( 'Inscriptions Presence', 'atie' ),
				'all_items'     => __( 'Toutes les inscriptions', 'atie' ),
				'edit_item'     => __( 'Inscription', 'atie' ),
			),
			'public'          => false,
			'show_ui'         => true,
			'show_in_menu'    => true,
			'show_in_rest'    => false,
			'menu_position'   => 4,
			'menu_icon'       => 'dashicons-id-alt',
			'supports'        => array( 'title', 'editor' ),
			'capability_type' => 'post',
			'capabilities'    => array( 'create_posts' => 'do_not_allow' ),
			'map_meta_cap'    => true,
		)
	);
}
add_action( 'init', 'atie_presence_signup_post_type' );

/**
 * URL of the sign-up page (page using the sign-up template), contact page as fallback.
 *
 * @param array<string, string> $args Query arguments (formule, receptionniste).
 * @return string
 */
function atie_presence_signup_url( $args = array() ) {
	static $base = null;
	if ( null === $base ) {
		$pages = get_posts(
			array(
				'post_type'      => 'page',
				'post_status'    => 'publish',
				'meta_key'       => '_wp_page_template', // phpcs:ignore WordPress.DB.SlowDBQuery -- one indexed lookup per request.
				'meta_value'     => ATIE_SIGNUP_TEMPLATE, // phpcs:ignore WordPress.DB.SlowDBQuery
				'posts_per_page' => 1,
				'fields'         => 'ids',
			)
		);
		$base = $pages ? get_permalink( $pages[0] ) : atie_presence_contact_url();
	}

	return $args ? add_query_arg( array_map( 'rawurlencode', $args ), $base ) : $base;
}

/**
 * Choices offered by the form.
 *
 * @return array{plans:array<string,string>,receptionists:array<string,string>,languages:array<string,string>}
 */
function atie_presence_signup_choices() {
	$plans = array();
	foreach ( atie_presence_plans()['plans'] as $plan ) {
		/* translators: 1: plan name, 2: price in CHF, 3: minutes per month */
		$plans[ sanitize_key( $plan['name'] ) ] = sprintf( __( '%1$s — CHF %2$s / mois, %3$d min', 'atie' ), $plan['name'], $plan['price'], $plan['minutes'] );
	}
	$plans['conseil'] = __( 'Je ne sais pas encore : conseillez-moi', 'atie' );

	$receptionists = array();
	foreach ( atie_presence_personas() as $persona ) {
		$receptionists[ $persona['id'] ] = $persona['name'];
	}
	$receptionists['sur-mesure'] = __( 'Sur mesure (votre visage de marque)', 'atie' );

	return array(
		'plans'         => $plans,
		'receptionists' => $receptionists,
		'languages'     => array(
			'fr' => __( 'Français', 'atie' ),
			'de' => __( 'Allemand', 'atie' ),
			'it' => __( 'Italien', 'atie' ),
			'en' => __( 'Anglais', 'atie' ),
		),
	);
}

/**
 * Visitor key for the rate limit: salted hash, never the address itself.
 *
 * @return string
 */
function atie_presence_signup_visitor() {
	$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
	return 'atie_signup_' . substr( hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) ), 0, 32 );
}

/**
 * Redirect back to the form with a status.
 *
 * @param string               $status ok | error code.
 * @param array<string,string> $keep   Values to keep in the URL.
 */
function atie_presence_signup_back( $status, $keep = array() ) {
	$url = add_query_arg( array_merge( $keep, array( 'inscription' => $status ) ), atie_presence_signup_url() );
	wp_safe_redirect( $url . '#inscription' );
	exit;
}

/**
 * Form handler (visitors and logged-in users).
 */
function atie_presence_signup_handle() {
	// phpcs:disable WordPress.Security.NonceVerification.Missing -- verified just below.
	if ( ! isset( $_POST['_atie_signup'] ) || ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_atie_signup'] ) ), ATIE_SIGNUP_ACTION ) ) {
		atie_presence_signup_back( 'expiree' );
	}

	$field = static function ( $key, $max = 200 ) {
		return isset( $_POST[ $key ] ) ? mb_substr( sanitize_text_field( wp_unslash( $_POST[ $key ] ) ), 0, $max ) : '';
	};
	$keep = array(
		'formule'        => sanitize_key( $field( 'plan', 40 ) ),
		'receptionniste' => sanitize_key( $field( 'receptionist', 40 ) ),
	);

	// Robots: hidden field filled, or form sent in less than 3 seconds.
	$started = absint( $field( 'started', 20 ) );
	if ( '' !== $field( 'website_url_confirm' ) || ! $started || time() - $started < 3 ) {
		atie_presence_signup_back( 'ok' ); // Answer as if it worked; nothing is stored.
	}

	$visitor = atie_presence_signup_visitor();
	$count   = (int) get_transient( $visitor );
	if ( $count >= 3 ) {
		atie_presence_signup_back( 'limite', $keep );
	}

	$choices  = atie_presence_signup_choices();
	$company  = $field( 'company', 120 );
	$name     = $field( 'name', 120 );
	$email    = sanitize_email( $field( 'email', 190 ) );
	$phone    = $field( 'phone', 40 );
	$site     = esc_url_raw( $field( 'site', 200 ) );
	$plan     = isset( $choices['plans'][ $keep['formule'] ] ) ? $keep['formule'] : 'conseil';
	$persona  = isset( $choices['receptionists'][ $keep['receptionniste'] ] ) ? $keep['receptionniste'] : 'sur-mesure';
	$message  = isset( $_POST['message'] ) ? mb_substr( sanitize_textarea_field( wp_unslash( $_POST['message'] ) ), 0, 2000 ) : '';
	$langs    = isset( $_POST['languages'] ) ? array_intersect( array_map( 'sanitize_key', (array) wp_unslash( $_POST['languages'] ) ), array_keys( $choices['languages'] ) ) : array();
	$consent  = ! empty( $_POST['consent'] );
	// phpcs:enable

	if ( ! $company || ! $name || ! is_email( $email ) || ! $site || ! $consent ) {
		atie_presence_signup_back( 'incomplet', $keep );
	}
	if ( ! $langs ) {
		$langs = array( 'fr' );
	}

	$lines = array(
		__( 'Entreprise', 'atie' )     => $company,
		__( 'Contact', 'atie' )        => $name,
		__( 'E-mail', 'atie' )         => $email,
		__( 'Téléphone', 'atie' )      => $phone ? $phone : '—',
		__( 'Site web', 'atie' )       => $site,
		__( 'Formule', 'atie' )        => $choices['plans'][ $plan ],
		__( 'Réceptionniste', 'atie' ) => $choices['receptionists'][ $persona ],
		__( 'Langues', 'atie' )        => implode( ', ', array_map( static fn( $l ) => $choices['languages'][ $l ], $langs ) ),
		__( 'Message', 'atie' )        => $message ? $message : '—',
	);
	$body = '';
	foreach ( $lines as $label => $value ) {
		$body .= $label . ' : ' . $value . "\n";
	}

	$id = wp_insert_post(
		array(
			'post_type'    => 'presence_signup',
			'post_status'  => 'private',
			/* translators: 1: company, 2: plan */
			'post_title'   => sprintf( __( '%1$s — %2$s', 'atie' ), $company, $choices['plans'][ $plan ] ),
			'post_content' => $body,
			'meta_input'   => array(
				'_atie_signup_email' => $email,
				'_atie_signup_plan'  => $plan,
				'_atie_signup_rcp'   => $persona,
			),
		),
		true
	);
	if ( is_wp_error( $id ) ) {
		atie_presence_signup_back( 'erreur', $keep );
	}
	set_transient( $visitor, $count + 1, HOUR_IN_SECONDS );

	/* translators: %s: company */
	$subject = sprintf( __( '[ATIE Presence] Nouvelle inscription : %s', 'atie' ), $company );
	wp_mail( get_option( 'admin_email' ), $subject, $body . "\n" . admin_url( 'post.php?post=' . $id . '&action=edit' ), array( 'Reply-To: ' . $name . ' <' . $email . '>' ) );

	atie_presence_signup_back( 'ok' );
}
add_action( 'admin_post_nopriv_' . ATIE_SIGNUP_ACTION, 'atie_presence_signup_handle' );
add_action( 'admin_post_' . ATIE_SIGNUP_ACTION, 'atie_presence_signup_handle' );

/**
 * Same dark styles and body class on the sign-up page as on the Presence page.
 */
function atie_presence_signup_assets() {
	if ( is_page_template( ATIE_SIGNUP_TEMPLATE ) ) {
		wp_enqueue_style( 'atie-presence', ATIE_URI . '/assets/css/presence.css', array( 'atie-main' ), ATIE_VERSION );
	}
}
add_action( 'wp_enqueue_scripts', 'atie_presence_signup_assets' );

/**
 * Dark body class on the sign-up page.
 *
 * @param string[] $classes Body classes.
 * @return string[]
 */
function atie_presence_signup_body_class( $classes ) {
	if ( is_page_template( ATIE_SIGNUP_TEMPLATE ) ) {
		$classes[] = 'atie-presence-dark';
	}
	return $classes;
}
add_filter( 'body_class', 'atie_presence_signup_body_class' );

/**
 * The sign-up page must not be cached (nonce and start time are per visitor).
 */
function atie_presence_signup_nocache() {
	if ( is_page_template( ATIE_SIGNUP_TEMPLATE ) ) {
		if ( ! defined( 'DONOTCACHEPAGE' ) ) {
			define( 'DONOTCACHEPAGE', true ); // LiteSpeed Cache, WP Fastest Cache.
		}
		do_action( 'litespeed_control_set_nocache', 'ATIE sign-up form' );
		nocache_headers();
	}
}
add_action( 'template_redirect', 'atie_presence_signup_nocache' );
