<?php
/**
 * Footer of the ATIE Presence pages: who sells, how to reach us, privacy.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$privacy = get_privacy_policy_url();
?>
<footer class="presence-foot">
	<div class="presence-wrap presence-foot__inner">
		<span>© <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?></span>
		<nav class="presence-foot__links" aria-label="<?php esc_attr_e( 'Liens ATIE Presence', 'atie' ); ?>">
			<a href="<?php echo esc_url( atie_presence_contact_url() ); ?>"><?php esc_html_e( 'Nous contacter', 'atie' ); ?></a>
			<?php if ( $privacy ) : ?>
				<a href="<?php echo esc_url( $privacy ); ?>"><?php esc_html_e( 'Politique de confidentialité', 'atie' ); ?></a>
			<?php endif; ?>
		</nav>
	</div>
</footer>
