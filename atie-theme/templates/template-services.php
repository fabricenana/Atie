<?php
/**
 * Template Name: Services
 *
 * A real Page that lists every `service` post. Assign it to a Page named
 * "Services": the listing then appears under Pages and can be added to a menu
 * like any other page, while the cards are pulled live from the `service` CPT.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$services = new WP_Query(
	array(
		'post_type'      => 'service',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order title',
		'order'          => 'ASC',
		'no_found_rows'  => true,
	)
);

while ( have_posts() ) :
	the_post();
	?>

	<section class="page-section services">
		<div class="container">
			<header class="section-head">
				<span class="section-eyebrow"><?php esc_html_e( 'Nos services', 'atie' ); ?></span>
				<h1 class="section-title"><?php the_title(); ?></h1>
			</header>

			<?php if ( trim( wp_strip_all_tags( get_the_content() ) ) ) : ?>
				<div class="entry-content services__intro"><?php the_content(); ?></div>
			<?php endif; ?>

			<div class="card-grid card-grid--services">
				<?php
				if ( $services->have_posts() ) :
					while ( $services->have_posts() ) :
						$services->the_post();
						get_template_part( 'template-parts/card', 'service' );
					endwhile;
					wp_reset_postdata();
				else :
					echo '<p class="empty">' . esc_html__( 'Aucun service pour le moment.', 'atie' ) . '</p>';
				endif;
				?>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
