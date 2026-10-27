<?php
/**
 * ATIE theme bootstrap.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'ATIE_VERSION', '1.3.0' );
define( 'ATIE_DIR', get_template_directory() );
define( 'ATIE_URI', get_template_directory_uri() );

/**
 * Load theme modules.
 */
require_once ATIE_DIR . '/inc/theme-setup.php';
require_once ATIE_DIR . '/inc/enqueue.php';
require_once ATIE_DIR . '/inc/post-types.php';
require_once ATIE_DIR . '/inc/meta-boxes.php';
require_once ATIE_DIR . '/inc/customizer.php';
require_once ATIE_DIR . '/inc/template-tags.php';
require_once ATIE_DIR . '/inc/presence.php';
require_once ATIE_DIR . '/inc/updates.php';
