<?php
/**
 * Header.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="profile" href="https://gmpg.org/xfn/11" />
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="skip-link screen-reader-text" href="#content"><?php esc_html_e( 'Aller au contenu', 'atie' ); ?></a>

<header class="site-header" id="site-header">
	<div class="site-header__inner">
		<div class="site-header__brand">
			<?php atie_brand_logo(); ?>
		</div>

		<button class="nav-toggle" aria-controls="primary-nav" aria-expanded="false">
			<span class="nav-toggle__bar"></span>
			<span class="nav-toggle__bar"></span>
			<span class="nav-toggle__bar"></span>
			<span class="screen-reader-text"><?php esc_html_e( 'Menu', 'atie' ); ?></span>
		</button>

		<nav class="main-nav" id="primary-nav" aria-label="<?php esc_attr_e( 'Menu principal', 'atie' ); ?>">
			<?php atie_primary_menu(); ?>
		</nav>
	</div>
</header>

<main id="content" class="site-main">
