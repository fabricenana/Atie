<?php
/**
 * Single — Service (CPT service) detail.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();

	$icon      = get_post_meta( get_the_ID(), '_atie_service_icon', true );
	$icon      = $icon ? $icon : 'default';
	$items_raw = get_post_meta( get_the_ID(), '_atie_service_items', true );
	$items     = array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', (string) $items_raw ) ) );
	?>

	<section class="page-section single single--service">
		<div class="container">
			<a class="back-link" href="<?php echo esc_url( get_post_type_archive_link( 'service' ) ); ?>">
				<span aria-hidden="true">&#8592;</span> <?php esc_html_e( 'Retour aux services', 'atie' ); ?>
			</a>

			<div class="single__grid single__grid--reverse">
				<div class="single__body">
					<span class="service-card__icon service-card__icon--lg" aria-hidden="true">
						<?php echo atie_service_icon_svg( $icon ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted inline SVG. ?>
					</span>

					<h1 class="single__title"><?php the_title(); ?></h1>

					<div class="single__content">
						<?php the_content(); ?>
					</div>

					<?php if ( ! empty( $items ) ) : ?>
						<ul class="check-list">
							<?php foreach ( $items as $item ) : ?>
								<li><span class="check-list__mark" aria-hidden="true">&#10003;</span><?php echo esc_html( $item ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>

					<a class="btn btn--primary" href="<?php echo esc_url( atie_contact_url() ); ?>">
						<?php esc_html_e( 'Demander un devis', 'atie' ); ?> <span aria-hidden="true">&#8594;</span>
					</a>
				</div>

				<div class="single__media">
					<?php if ( has_post_thumbnail() ) : ?>
						<?php the_post_thumbnail( 'large', array( 'class' => 'single__img' ) ); ?>
					<?php else : ?>
						<span class="single__glass"><?php the_title(); ?></span>
					<?php endif; ?>
				</div>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
