<?php
/**
 * 404 template.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<section class="page-section error-404">
	<div class="container container--narrow" style="text-align:center;">
		<span class="section-eyebrow"><?php esc_html_e( 'Erreur 404', 'atie' ); ?></span>
		<h1 class="section-title"><?php esc_html_e( 'Page introuvable', 'atie' ); ?></h1>
		<p class="empty"><?php esc_html_e( 'La page que vous cherchez n\'existe pas ou a été déplacée.', 'atie' ); ?></p>
		<a class="btn btn--primary" href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Retour à l\'accueil', 'atie' ); ?></a>
	</div>
</section>

<?php
get_footer();
