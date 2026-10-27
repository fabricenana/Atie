<?php
/**
 * Template Name: Contact
 *
 * Contact page: form (Forminator) + Google Maps embed.
 * Assign this template to your "Contact" page, or name the page slug "contact".
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$email          = get_theme_mod( 'atie_contact_email', 'contact@atie.ch' );
$address        = get_theme_mod( 'atie_contact_address', 'Route des Jeunes 23, 1227 Carouge' );
$forminator_id  = get_theme_mod( 'atie_forminator_id', '' );
$map_src        = 'https://www.google.com/maps?q=' . rawurlencode( $address ) . '&output=embed';
$map_link       = 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( $address );

while ( have_posts() ) :
	the_post();
	?>

	<section class="page-section contact">
		<div class="container">
			<div class="contact__grid">
				<div class="contact__form-col">
					<span class="section-eyebrow"><?php esc_html_e( 'Contact', 'atie' ); ?></span>
					<h1 class="section-title section-title--sm"><?php the_title(); ?></h1>

					<div class="contact__intro"><?php the_content(); ?></div>

					<div class="contact__form">
						<?php
						if ( $forminator_id && function_exists( 'do_shortcode' ) ) {
							echo do_shortcode( '[forminator_form id="' . esc_attr( $forminator_id ) . '"]' );
						}
						?>
					</div>

					<div class="contact__details">
						<div class="meta-block">
							<span class="meta-label"><?php esc_html_e( 'Adresse', 'atie' ); ?></span>
							<span class="meta-value"><?php echo esc_html( $address ); ?></span>
						</div>
						<div class="meta-block">
							<span class="meta-label"><?php esc_html_e( 'E-mail', 'atie' ); ?></span>
							<a class="meta-value" href="mailto:<?php echo esc_attr( $email ); ?>"><?php echo esc_html( $email ); ?></a>
						</div>
					</div>
				</div>

				<div class="contact__map-col">
					<div class="contact__map">
						<iframe
							title="<?php echo esc_attr( $address ); ?>"
							src="<?php echo esc_url( $map_src ); ?>"
							loading="lazy"
							referrerpolicy="no-referrer-when-downgrade"
							allowfullscreen></iframe>
						<a class="contact__map-pin" href="<?php echo esc_url( $map_link ); ?>" target="_blank" rel="noopener noreferrer">
							<span class="contact__map-dot" aria-hidden="true"></span>
							<?php echo esc_html( $address ); ?>
						</a>
					</div>
				</div>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
