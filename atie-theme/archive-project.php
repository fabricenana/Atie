<?php
/**
 * Archive — Réalisations (CPT project) with category tabs.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$terms = get_terms(
	array(
		'taxonomy'   => 'project_category',
		'hide_empty' => true,
	)
);
?>

<section class="page-section portfolio">
	<div class="container">
		<header class="section-head">
			<span class="section-eyebrow"><?php esc_html_e( 'Portfolio', 'atie' ); ?></span>
			<h1 class="section-title"><?php esc_html_e( 'Nos réalisations', 'atie' ); ?></h1>
		</header>

		<?php if ( ! is_wp_error( $terms ) && ! empty( $terms ) ) : ?>
			<div class="tabs" role="tablist">
				<button class="tab is-active" data-filter="all" type="button"><?php esc_html_e( 'Tout', 'atie' ); ?></button>
				<?php foreach ( $terms as $term ) : ?>
					<button class="tab" data-filter="<?php echo esc_attr( $term->slug ); ?>" type="button"><?php echo esc_html( $term->name ); ?></button>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>

		<div class="card-grid card-grid--projects">
			<?php
			if ( have_posts() ) :
				while ( have_posts() ) :
					the_post();
					get_template_part( 'template-parts/card', 'project' );
				endwhile;
			else :
				echo '<p class="empty">' . esc_html__( 'Aucune réalisation pour le moment.', 'atie' ) . '</p>';
			endif;
			?>
		</div>

		<?php
		the_posts_pagination(
			array(
				'mid_size'  => 1,
				'prev_text' => __( '← Précédent', 'atie' ),
				'next_text' => __( 'Suivant →', 'atie' ),
			)
		);
		?>
	</div>
</section>

<?php
get_footer();
