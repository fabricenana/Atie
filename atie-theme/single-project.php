<?php
/**
 * Single — Réalisation (CPT project) detail.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();

	$url   = get_post_meta( get_the_ID(), '_atie_project_url', true );
	$year  = get_post_meta( get_the_ID(), '_atie_project_year', true );
	$cats  = get_the_terms( get_the_ID(), 'project_category' );
	$cat   = ( $cats && ! is_wp_error( $cats ) ) ? $cats[0]->name : '';
	?>

	<section class="page-section single single--project">
		<div class="container">
			<a class="back-link" href="<?php echo esc_url( get_post_type_archive_link( 'project' ) ); ?>">
				<span aria-hidden="true">&#8592;</span> <?php esc_html_e( 'Retour au portfolio', 'atie' ); ?>
			</a>

			<div class="single__grid">
				<div class="single__media">
					<?php if ( has_post_thumbnail() ) : ?>
						<?php the_post_thumbnail( 'large', array( 'class' => 'single__img' ) ); ?>
					<?php else : ?>
						<span class="single__placeholder"><?php esc_html_e( 'aperçu projet', 'atie' ); ?></span>
					<?php endif; ?>
				</div>

				<div class="single__body">
					<?php if ( $cat ) : ?>
						<span class="pill"><?php echo esc_html( $cat ); ?></span>
					<?php endif; ?>

					<h1 class="single__title"><?php the_title(); ?></h1>

					<div class="single__content">
						<?php the_content(); ?>
					</div>

					<div class="single__meta">
						<?php if ( $year ) : ?>
							<div class="meta-block">
								<span class="meta-label"><?php esc_html_e( 'Année', 'atie' ); ?></span>
								<span class="meta-value"><?php echo esc_html( $year ); ?></span>
							</div>
						<?php endif; ?>
						<?php if ( $cat ) : ?>
							<div class="meta-block">
								<span class="meta-label"><?php esc_html_e( 'Prestation', 'atie' ); ?></span>
								<span class="meta-value"><?php echo esc_html( $cat ); ?></span>
							</div>
						<?php endif; ?>
					</div>

					<?php if ( $url ) : ?>
						<a class="btn btn--primary" href="<?php echo esc_url( $url ); ?>" target="_blank" rel="noopener noreferrer">
							<?php esc_html_e( 'Visiter le site', 'atie' ); ?> <span aria-hidden="true">&#8599;</span>
						</a>
					<?php endif; ?>
				</div>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
