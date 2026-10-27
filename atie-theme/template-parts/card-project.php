<?php
/**
 * Card — single project tile (glass title overlay).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$cats     = get_the_terms( get_the_ID(), 'project_category' );
$cat_slug = ( $cats && ! is_wp_error( $cats ) ) ? implode( ' ', wp_list_pluck( $cats, 'slug' ) ) : '';
?>
<a class="project-card" href="<?php the_permalink(); ?>" data-category="<?php echo esc_attr( $cat_slug ); ?>">
	<div class="project-card__media">
		<?php if ( has_post_thumbnail() ) : ?>
			<?php the_post_thumbnail( 'large', array( 'class' => 'project-card__img', 'loading' => 'lazy' ) ); ?>
		<?php else : ?>
			<span class="project-card__placeholder"><?php esc_html_e( 'aperçu', 'atie' ); ?></span>
		<?php endif; ?>
		<span class="project-card__glass"><?php the_title(); ?></span>
	</div>
</a>
