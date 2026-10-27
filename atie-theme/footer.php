<?php
/**
 * Footer (réduit — pas de pied de page visible, conformément au design ATIE).
 * wp_footer() est conservé car obligatoire (scripts, barre d'admin, etc.).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
</main><!-- #content -->

<?php wp_footer(); ?>
</body>
</html>
