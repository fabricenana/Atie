<?php
/**
 * Page template (default).
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
			<header class="section-head">
				<h1 class="section-title"><?php the_title(); ?></h1>
			</header>
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
		</div>
	</section>
	<?php
endwhile;

get_footer();
