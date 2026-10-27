<?php
/**
 * Generic fallback template (blog / archives).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<section class="page-section">
	<div class="container">
		<?php if ( have_posts() ) : ?>

			<?php if ( is_home() && ! is_front_page() ) : ?>
				<header class="section-head">
					<h1 class="section-title"><?php single_post_title(); ?></h1>
				</header>
			<?php elseif ( is_archive() ) : ?>
				<header class="section-head">
					<h1 class="section-title"><?php the_archive_title(); ?></h1>
					<?php the_archive_description( '<div class="archive-desc">', '</div>' ); ?>
				</header>
			<?php elseif ( is_search() ) : ?>
				<header class="section-head">
					<h1 class="section-title">
						<?php
						/* translators: %s: search query. */
						printf( esc_html__( 'Résultats pour : %s', 'atie' ), '<span>' . esc_html( get_search_query() ) . '</span>' );
						?>
					</h1>
				</header>
			<?php endif; ?>

			<div class="post-list">
				<?php
				while ( have_posts() ) :
					the_post();
					?>
					<article <?php post_class( 'post-list__item' ); ?>>
						<?php if ( has_post_thumbnail() ) : ?>
							<a class="post-list__thumb" href="<?php the_permalink(); ?>"><?php the_post_thumbnail( 'medium_large' ); ?></a>
						<?php endif; ?>
						<h2 class="post-list__title"><a href="<?php the_permalink(); ?>"><?php the_title(); ?></a></h2>
						<div class="post-list__excerpt"><?php the_excerpt(); ?></div>
						<a class="read-more" href="<?php the_permalink(); ?>"><?php esc_html_e( 'Lire la suite', 'atie' ); ?> &rarr;</a>
					</article>
					<?php
				endwhile;
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

		<?php else : ?>
			<header class="section-head">
				<h1 class="section-title"><?php esc_html_e( 'Rien à afficher', 'atie' ); ?></h1>
			</header>
			<p class="empty"><?php esc_html_e( 'Aucun contenu trouvé.', 'atie' ); ?></p>
			<?php get_search_form(); ?>
		<?php endif; ?>
	</div>
</section>

<?php
get_footer();
