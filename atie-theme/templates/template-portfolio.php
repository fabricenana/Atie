<?php
/**
 * Template Name: Réalisations (portfolio)
 *
 * A real Page that lists every `project` post with category filter tabs.
 * Assign this template to a Page (e.g. "Réalisations"): the portfolio then
 * appears under Pages and can be added to a menu like any other page, while
 * the project tiles are still pulled live from the `project` CPT.
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

$projects = new WP_Query(
	array(
		'post_type'      => 'project',
		'posts_per_page' => -1,
		'orderby'        => 'menu_order date',
		'order'          => 'DESC',
		'no_found_rows'  => true,
	)
);

while ( have_posts() ) :
	the_post();
	?>

	<section class="page-section portfolio">
		<div class="container">
			<header class="section-head">
				<span class="section-eyebrow"><?php esc_html_e( 'Portfolio', 'atie' ); ?></span>
				<h1 class="section-title"><?php the_title(); ?></h1>
			</header>

			<?php if ( trim( wp_strip_all_tags( get_the_content() ) ) ) : ?>
				<div class="entry-content portfolio__intro"><?php the_content(); ?></div>
			<?php endif; ?>

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
				if ( $projects->have_posts() ) :
					while ( $projects->have_posts() ) :
						$projects->the_post();
						get_template_part( 'template-parts/card', 'project' );
					endwhile;
					wp_reset_postdata();
				else :
					echo '<p class="empty">' . esc_html__( 'Aucune réalisation pour le moment.', 'atie' ) . '</p>';
				endif;
				?>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
