<?php
/**
 * Front page — Accueil.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

// Ticker items: pull from the service CPT, fall back to defaults.
$ticker_items = array();
$ticker_query = new WP_Query(
	array(
		'post_type'      => 'service',
		'posts_per_page' => 12,
		'orderby'        => 'menu_order title',
		'order'          => 'ASC',
		'no_found_rows'  => true,
	)
);
if ( $ticker_query->have_posts() ) {
	while ( $ticker_query->have_posts() ) {
		$ticker_query->the_post();
		$ticker_items[] = get_the_title();
	}
	wp_reset_postdata();
}
if ( empty( $ticker_items ) ) {
	$ticker_items = array(
		__( 'Création de sites web', 'atie' ),
		__( 'Applications mobiles', 'atie' ),
		__( 'Web-marketing & SEO', 'atie' ),
		__( 'Design graphique', 'atie' ),
		__( 'IA souveraine', 'atie' ),
		__( 'Support & Maintenance', 'atie' ),
	);
}

// Editable hero copy via Customizer-friendly options, with design defaults.
$hero_title    = get_theme_mod( 'atie_hero_title', __( 'De la pensée au pixel.', 'atie' ) );
$hero_subtitle = get_theme_mod( 'atie_hero_subtitle', __( 'Agence digitale à Genève — sites web, applications mobiles, web-marketing et IA souveraine hébergée en Suisse.', 'atie' ) );
?>

<section class="hero">
	<img class="hero__figure" src="<?php echo esc_url( atie_penseur_url() ); ?>" alt="<?php esc_attr_e( 'Le Penseur', 'atie' ); ?>" />

	<div class="hero__headline">
		<?php $atie_presence = function_exists( 'atie_presence_page_url' ) ? atie_presence_page_url() : ''; ?>
		<?php if ( $atie_presence ) : ?>
			<a class="hero__news" href="<?php echo esc_url( $atie_presence ); ?>">
				<span class="hero__news-tag"><?php esc_html_e( 'Nouveau', 'atie' ); ?></span>
				<?php esc_html_e( 'Une réceptionniste IA pour votre site', 'atie' ); ?>
				<span aria-hidden="true">›</span>
			</a>
		<?php endif; ?>
		<h1 class="hero__title"><?php echo esc_html( $hero_title ); ?></h1>
		<?php if ( $hero_subtitle ) : ?>
			<p class="hero__subtitle"><?php echo esc_html( $hero_subtitle ); ?></p>
		<?php endif; ?>
	</div>

	<div class="ticker" aria-hidden="true">
		<div class="ticker__track">
			<?php for ( $i = 0; $i < 2; $i++ ) : ?>
				<span class="ticker__group">
					<?php foreach ( $ticker_items as $item ) : ?>
						<span class="ticker__item"><?php echo esc_html( $item ); ?></span>
						<span class="ticker__dot"></span>
					<?php endforeach; ?>
				</span>
			<?php endfor; ?>
		</div>
	</div>

	<a class="floating-cta" href="<?php echo esc_url( atie_contact_url() ); ?>">
		<span class="floating-cta__icon" aria-hidden="true">&#9993;</span>
		<?php esc_html_e( 'Nous contacter', 'atie' ); ?>
	</a>
</section>

<?php
get_footer();
