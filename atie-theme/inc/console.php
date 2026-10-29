<?php
/**
 * ATIE Presence Console: entry in the WordPress admin.
 *
 * The console itself (back-office ATIE + client area) is a separate Next.js
 * application (presence-console/ in the repository), hosted at console.atie.ch
 * with its own sign-in (Supabase). WordPress only links to it.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ATIE_CONSOLE_PAGE = 'atie-console';

/**
 * Public address of the hosted console. Filter: atie_console_url.
 *
 * @return string
 */
function atie_console_url() {
	return (string) apply_filters( 'atie_console_url', 'https://console.atie.ch/' );
}

/**
 * Admin menu entry, administrators only.
 */
function atie_console_menu() {
	add_menu_page(
		__( 'Console ATIE Presence', 'atie' ),
		__( 'Console ATIE', 'atie' ),
		'manage_options',
		ATIE_CONSOLE_PAGE,
		'atie_console_render',
		'dashicons-desktop',
		3
	);
}
add_action( 'admin_menu', 'atie_console_menu' );

/**
 * Stylesheet for the console page only.
 *
 * @param string $hook Current admin page.
 */
function atie_console_assets( $hook ) {
	if ( 'toplevel_page_' . ATIE_CONSOLE_PAGE !== $hook ) {
		return;
	}
	wp_enqueue_style( 'atie-console-admin', ATIE_URI . '/assets/css/console-admin.css', array(), ATIE_VERSION );
}
add_action( 'admin_enqueue_scripts', 'atie_console_assets' );

/**
 * Console page: what it is and a link to open it.
 */
function atie_console_render() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Accès réservé aux administrateurs.', 'atie' ) );
	}

	$areas = array(
		array(
			'title' => __( 'Back-office ATIE', 'atie' ),
			'text'  => __( 'Entreprises clientes, réceptionnistes, connaissances, conversations, abonnements, facturation, intégration du widget et paramètres.', 'atie' ),
		),
		array(
			'title' => __( 'Espace client', 'atie' ),
			'text'  => __( 'Chaque entreprise y retrouve sa réceptionniste, les demandes de ses visiteurs, sa consommation de minutes, son abonnement et l’assistance ATIE.', 'atie' ),
		),
	);
	?>
	<div class="wrap atie-console">
		<h1><?php esc_html_e( 'Console ATIE Presence', 'atie' ); ?></h1>
		<p class="atie-console__lead">
			<?php esc_html_e( 'Gestion d’ATIE Presence : un seul outil pour l’équipe ATIE et pour les entreprises clientes, chacune avec son propre accès.', 'atie' ); ?>
		</p>

		<p class="atie-console__open">
			<a class="button button-primary button-hero" href="<?php echo esc_url( atie_console_url() ); ?>" target="_blank" rel="noopener">
				<?php esc_html_e( 'Ouvrir la console', 'atie' ); ?>
				<span class="screen-reader-text"><?php esc_html_e( '(nouvel onglet)', 'atie' ); ?></span>
			</a>
		</p>

		<ul class="atie-console__areas">
			<?php foreach ( $areas as $area ) : ?>
				<li class="atie-console__card">
					<div class="atie-console__meta">
						<h3><?php echo esc_html( $area['title'] ); ?></h3>
						<p><?php echo esc_html( $area['text'] ); ?></p>
					</div>
				</li>
			<?php endforeach; ?>
		</ul>

		<div class="notice notice-info inline atie-console__notice">
			<p>
				<?php esc_html_e( 'Connexion par e-mail et mot de passe, propre à la console (indépendante des comptes WordPress). Les comptes sont créés par l’équipe ATIE ; un mot de passe oublié se réinitialise depuis la page de connexion.', 'atie' ); ?>
			</p>
		</div>
	</div>
	<?php
}
