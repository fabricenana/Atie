<?php
/**
 * Card — single service.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$icon = get_post_meta( get_the_ID(), '_atie_service_icon', true );
$icon = $icon ? $icon : 'default';
?>
<a class="service-card" href="<?php the_permalink(); ?>">
	<span class="service-card__icon" aria-hidden="true">
		<?php echo atie_service_icon_svg( $icon ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- trusted inline SVG. ?>
	</span>
	<h3 class="service-card__title"><?php the_title(); ?></h3>
	<p class="service-card__excerpt"><?php echo esc_html( wp_trim_words( get_the_excerpt(), 18 ) ); ?></p>
	<span class="service-card__more"><?php esc_html_e( 'En savoir plus', 'atie' ); ?> <span aria-hidden="true">&#8594;</span></span>
</a>
