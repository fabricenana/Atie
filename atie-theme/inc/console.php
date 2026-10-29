<?php
/**
 * ATIE Presence Console: preview page in the WordPress admin.
 *
 * The console itself (back-office ATIE + client area) is a separate Next.js
 * application (presence-console/ in the repository): WordPress cannot run it.
 * It is hosted at console.atie.ch (demo data). This page links to it and shows
 * screenshots of its screens, to administrators, inside wp-admin.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ATIE_CONSOLE_PAGE = 'atie-console';

/**
 * Public address of the hosted console (demo). Filter: atie_console_url.
 *
 * @return string
 */
function atie_console_url() {
	return (string) apply_filters( 'atie_console_url', 'https://console.atie.ch/' );
}

/**
 * Screens shown on the page, grouped by area. Files: assets/img/console/<file>.jpg.
 *
 * @return array<string, array{title:string,intro:string,items:array<int, array{file:string,title:string,text:string}>}>
 */
function atie_console_screens() {
	return array(
		'admin'  => array(
			'title' => __( 'Back-office ATIE', 'atie' ),
			'intro' => __( 'Espace interne du personnel ATIE : entreprises clientes, réceptionnistes, connaissances, sessions, abonnements, facturation et paramètres.', 'atie' ),
			'items' => array(
				array( 'file' => '01-connexion', 'title' => __( 'Connexion (démo)', 'atie' ), 'text' => __( 'Choix d’un profil fictif : personnel ATIE ou entreprise cliente. Ce n’est pas une authentification.', 'atie' ) ),
				array( 'file' => '02-admin-tableau-de-bord', 'title' => __( 'Tableau de bord', 'atie' ), 'text' => __( 'Entreprises, réceptionnistes, sessions, minutes, revenus récurrents, alertes de quotas, incidents et activité, avec filtre de période.', 'atie' ) ),
				array( 'file' => '03-admin-tableau-de-bord-sombre', 'title' => __( 'Tableau de bord — mode sombre', 'atie' ), 'text' => __( 'Thème sombre repris de la vitrine ATIE Presence.', 'atie' ) ),
				array( 'file' => '04-admin-entreprises', 'title' => __( 'Entreprises', 'atie' ), 'text' => __( 'Recherche, filtres, tri, pagination ; fiche détaillée à huit onglets, suspension et réactivation.', 'atie' ) ),
				array( 'file' => '05-admin-receptionnistes', 'title' => __( 'Réceptionnistes', 'atie' ), 'text' => __( 'Catalogue des personnages, à partir des avatars existants Léa et Maya.', 'atie' ) ),
				array( 'file' => '06-admin-receptionniste-maya', 'title' => __( 'Configuration de Maya', 'atie' ), 'text' => __( 'Voix, langues, ton, instructions, salutation, réponses de repli, durée maximale ; aperçu du widget sans session payante.', 'atie' ) ),
				array( 'file' => '07-admin-knowledge-base', 'title' => __( 'Knowledge Base', 'atie' ), 'text' => __( 'Textes, URL, PDF et DOCX par entreprise, versions et statut d’indexation (non connecté).', 'atie' ) ),
				array( 'file' => '08-admin-conversations', 'title' => __( 'Conversations', 'atie' ), 'text' => __( 'Durée, langue, statut, motif de fin, minutes facturables, coût fournisseur estimé.', 'atie' ) ),
				array( 'file' => '09-admin-sessions-actives', 'title' => __( 'Sessions actives', 'atie' ), 'text' => __( 'Suivi des sessions en cours et des fermetures non confirmées.', 'atie' ) ),
				array( 'file' => '10-admin-abonnements', 'title' => __( 'Abonnements et tarification', 'atie' ), 'text' => __( 'Starter CHF 9.90 / 15 min confirmé ; Premium CHF 79.90 / 250 min en hypothèse ; recharges et concurrence.', 'atie' ) ),
				array( 'file' => '11-admin-facturation', 'title' => __( 'Facturation', 'atie' ), 'text' => __( 'Factures, paiements, avoirs, export CSV — documents de démonstration sans valeur comptable.', 'atie' ) ),
				array( 'file' => '12-admin-integration', 'title' => __( 'Intégration du widget', 'atie' ), 'text' => __( 'Script d’intégration, préparation WordPress, domaines autorisés, aperçu mobile et ordinateur.', 'atie' ) ),
				array( 'file' => '13-admin-parametres', 'title' => __( 'Paramètres', 'atie' ), 'text' => __( 'Utilisateurs internes, rôles et permissions, notifications, audit, fournisseurs, sécurité.', 'atie' ) ),
				array( 'file' => '22-admin-tablette-768', 'title' => __( 'Tablette (768 px)', 'atie' ), 'text' => __( 'Mise en page adaptée, menu en tiroir.', 'atie' ) ),
				array( 'file' => '21-admin-mobile-390', 'title' => __( 'Mobile (390 px)', 'atie' ), 'text' => __( 'Tableaux défilants, colonnes secondaires masquées.', 'atie' ) ),
			),
		),
		'client' => array(
			'title' => __( 'Espace client', 'atie' ),
			'intro' => __( 'Espace privé de chaque entreprise, plus simple : sa réceptionniste, ses demandes, sa consommation et son abonnement, sans détail technique.', 'atie' ),
			'items' => array(
				array( 'file' => '14-client-tableau-de-bord', 'title' => __( 'Mon tableau de bord', 'atie' ), 'text' => __( 'Hôtel Chalet du Lac (fictif) : alerte de quota à 96 %, réceptionniste Maya, demandes récentes.', 'atie' ) ),
				array( 'file' => '15-client-tableau-de-bord-sombre', 'title' => __( 'Mon tableau de bord — mode sombre', 'atie' ), 'text' => __( 'Même écran en thème sombre.', 'atie' ) ),
				array( 'file' => '16-client-consommation', 'title' => __( 'Consommation', 'atie' ), 'text' => __( 'Minutes incluses, utilisées et restantes, historique quotidien et mensuel.', 'atie' ) ),
				array( 'file' => '17-client-demandes', 'title' => __( 'Conversations et demandes', 'atie' ), 'text' => __( 'Messages, demandes de contact, de devis et de rendez-vous laissés par les visiteurs.', 'atie' ) ),
				array( 'file' => '18-client-abonnement', 'title' => __( 'Mon abonnement', 'atie' ), 'text' => __( 'Formule, échéance, recharges et changement de formule en mode demande, factures.', 'atie' ) ),
				array( 'file' => '19-client-assistance', 'title' => __( 'Assistance ATIE', 'atie' ), 'text' => __( 'Demande de modification, signalement, minutes supplémentaires, contact.', 'atie' ) ),
				array( 'file' => '20-client-mobile-390', 'title' => __( 'Mobile (390 px)', 'atie' ), 'text' => __( 'Tableau de bord client sur téléphone.', 'atie' ) ),
			),
		),
	);
}

/**
 * Admin menu entry, administrators only.
 */
function atie_console_menu() {
	add_menu_page(
		__( 'Console ATIE Presence (aperçu)', 'atie' ),
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
 * Stylesheet for the preview page only.
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
 * Preview page.
 */
function atie_console_render() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Accès réservé aux administrateurs.', 'atie' ) );
	}

	$base    = ATIE_URI . '/assets/img/console/';
	$screens = atie_console_screens();
	?>
	<div class="wrap atie-console">
		<h1><?php esc_html_e( 'Console ATIE Presence', 'atie' ); ?></h1>
		<p class="atie-console__lead">
			<?php esc_html_e( 'Back-office ATIE et espace client, en démonstration avec des données entièrement fictives.', 'atie' ); ?>
		</p>

		<p class="atie-console__open">
			<a class="button button-primary button-hero" href="<?php echo esc_url( atie_console_url() ); ?>" target="_blank" rel="noopener">
				<?php esc_html_e( 'Ouvrir la console', 'atie' ); ?>
				<span class="screen-reader-text"><?php esc_html_e( '(nouvel onglet)', 'atie' ); ?></span>
			</a>
		</p>

		<div class="notice notice-info inline atie-console__notice">
			<p>
				<strong><?php esc_html_e( 'Démonstration publique.', 'atie' ); ?></strong>
				<?php esc_html_e( 'La console est une application Node.js séparée, hébergée à part : elle ne tourne pas dans WordPress et n’est connectée à aucun service (LiveKit, LemonSlice, paiement). Tout visiteur peut choisir un profil de démonstration.', 'atie' ); ?>
			</p>
		</div>

		<nav class="atie-console__toc" aria-label="<?php esc_attr_e( 'Sections', 'atie' ); ?>">
			<?php foreach ( $screens as $key => $group ) : ?>
				<a class="button" href="#atie-console-<?php echo esc_attr( $key ); ?>"><?php echo esc_html( $group['title'] ); ?> (<?php echo count( $group['items'] ); ?>)</a>
			<?php endforeach; ?>
		</nav>

		<?php foreach ( $screens as $key => $group ) : ?>
			<section class="atie-console__group" id="atie-console-<?php echo esc_attr( $key ); ?>">
				<h2><?php echo esc_html( $group['title'] ); ?></h2>
				<p class="atie-console__intro"><?php echo esc_html( $group['intro'] ); ?></p>
				<ul class="atie-console__grid">
					<?php foreach ( $group['items'] as $item ) : ?>
						<?php $src = $base . $item['file'] . '.jpg'; ?>
						<li class="atie-console__card">
							<a class="atie-console__shot" href="<?php echo esc_url( $src ); ?>" target="_blank" rel="noopener">
								<img src="<?php echo esc_url( $src ); ?>" alt="<?php echo esc_attr( $item['title'] ); ?>" loading="lazy" decoding="async">
								<span class="screen-reader-text"><?php esc_html_e( '(ouvre la capture en taille réelle dans un nouvel onglet)', 'atie' ); ?></span>
							</a>
							<div class="atie-console__meta">
								<h3><?php echo esc_html( $item['title'] ); ?></h3>
								<p><?php echo esc_html( $item['text'] ); ?></p>
							</div>
						</li>
					<?php endforeach; ?>
				</ul>
			</section>
		<?php endforeach; ?>

	</div>
	<?php
}
