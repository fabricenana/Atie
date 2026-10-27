<?php
/**
 * Single post (blog) template.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

while ( have_posts() ) :
	the_post();
	?>
	<section class="page-section">
		<div class="container container--narrow">
			<article <?php post_class( 'entry' ); ?>>
				<header class="section-head">
					<h1 class="section-title"><?php the_title(); ?></h1>
					<div class="entry-meta"><?php echo esc_html( get_the_date() ); ?></div>
				</header>

				<?php if ( has_post_thumbnail() ) : ?>
					<div class="entry-thumb"><?php the_post_thumbnail( 'large' ); ?></div>
				<?php endif; ?>

				<div class="entry-content">
					<?php
					the_content();
					wp_link_pages(
						array(
							'before' => '<div class="page-links">' . esc_html__( 'Pages :', 'atie' ),
							'after'  => '</div>',
						)
					);
					?>
				</div>
			</article>

			<?php
			if ( comments_open() || get_comments_number() ) {
				comments_template();
			}
			?>
		</div>
	</section>
	<?php
endwhile;

get_footer();
