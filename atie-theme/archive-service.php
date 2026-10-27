<?php
/**
 * Archive — Services (CPT service) grid.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<section class="page-section services">
	<div class="container">
		<header class="section-head">
			<span class="section-eyebrow"><?php esc_html_e( 'Nos services', 'atie' ); ?></span>
			<h1 class="section-title"><?php esc_html_e( 'Une équipe, tous vos besoins digitaux', 'atie' ); ?></h1>
		</header>

		<div class="card-grid card-grid--services">
			<?php
			if ( have_posts() ) :
				while ( have_posts() ) :
					the_post();
					get_template_part( 'template-parts/card', 'service' );
				endwhile;
			else :
				echo '<p class="empty">' . esc_html__( 'Aucun service pour le moment.', 'atie' ) . '</p>';
			endif;
			?>
		</div>
	</div>
</section>

<?php
get_footer();
