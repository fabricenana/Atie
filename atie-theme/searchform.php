<?php
/**
 * Search form.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<form role="search" method="get" class="search-form" action="<?php echo esc_url( home_url( '/' ) ); ?>">
	<label class="screen-reader-text" for="s"><?php esc_html_e( 'Rechercher :', 'atie' ); ?></label>
	<input type="search" id="s" class="search-form__field" placeholder="<?php esc_attr_e( 'Rechercher…', 'atie' ); ?>" value="<?php echo get_search_query(); ?>" name="s" />
	<button type="submit" class="search-form__submit"><?php esc_html_e( 'OK', 'atie' ); ?></button>
</form>
