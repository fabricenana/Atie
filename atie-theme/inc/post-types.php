<?php
/**
 * Custom Post Types & taxonomies.
 *
 * Re-registers the `project` CPT and `project_category` taxonomy that were
 * previously provided by Divi, so existing content keeps working after Divi
 * is removed. Also registers the `service` CPT.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register CPTs and taxonomies.
 */
function atie_register_post_types() {

	/* ---------------------------------------------------------------------
	 * Réalisations — CPT "project" (compatible Divi legacy content)
	 * ------------------------------------------------------------------- */
	$project_labels = array(
		'name'               => __( 'Réalisations', 'atie' ),
		'singular_name'      => __( 'Réalisation', 'atie' ),
		'menu_name'          => __( 'Réalisations', 'atie' ),
		'add_new'            => __( 'Ajouter', 'atie' ),
		'add_new_item'       => __( 'Ajouter une réalisation', 'atie' ),
		'edit_item'          => __( 'Modifier la réalisation', 'atie' ),
		'new_item'           => __( 'Nouvelle réalisation', 'atie' ),
		'view_item'          => __( 'Voir la réalisation', 'atie' ),
		'search_items'       => __( 'Rechercher une réalisation', 'atie' ),
		'not_found'          => __( 'Aucune réalisation trouvée', 'atie' ),
		'not_found_in_trash' => __( 'Aucune réalisation dans la corbeille', 'atie' ),
		'all_items'          => __( 'Toutes les réalisations', 'atie' ),
	);

	register_post_type(
		'project',
		array(
			'labels'        => $project_labels,
			'public'        => true,
			'has_archive'   => false,
			'rewrite'       => array( 'slug' => 'project', 'with_front' => false ),
			'menu_icon'     => 'dashicons-portfolio',
			'menu_position' => 20,
			'supports'      => array( 'title', 'editor', 'thumbnail', 'excerpt', 'page-attributes' ),
			'show_in_rest'  => true,
			'taxonomies'    => array( 'project_category' ),
		)
	);

	$project_cat_labels = array(
		'name'              => __( 'Catégories de réalisation', 'atie' ),
		'singular_name'     => __( 'Catégorie de réalisation', 'atie' ),
		'search_items'      => __( 'Rechercher une catégorie', 'atie' ),
		'all_items'         => __( 'Toutes les catégories', 'atie' ),
		'edit_item'         => __( 'Modifier la catégorie', 'atie' ),
		'update_item'       => __( 'Mettre à jour la catégorie', 'atie' ),
		'add_new_item'      => __( 'Ajouter une catégorie', 'atie' ),
		'new_item_name'     => __( 'Nom de la nouvelle catégorie', 'atie' ),
		'menu_name'         => __( 'Catégories', 'atie' ),
	);

	register_taxonomy(
		'project_category',
		'project',
		array(
			'labels'            => $project_cat_labels,
			'public'            => true,
			'hierarchical'      => true,
			'show_admin_column' => true,
			'show_in_rest'      => true,
			'rewrite'           => array( 'slug' => 'project_category', 'with_front' => false ),
		)
	);

	/* ---------------------------------------------------------------------
	 * Services — CPT "service"
	 * ------------------------------------------------------------------- */
	$service_labels = array(
		'name'               => __( 'Services', 'atie' ),
		'singular_name'      => __( 'Service', 'atie' ),
		'menu_name'          => __( 'Services', 'atie' ),
		'add_new'            => __( 'Ajouter', 'atie' ),
		'add_new_item'       => __( 'Ajouter un service', 'atie' ),
		'edit_item'          => __( 'Modifier le service', 'atie' ),
		'new_item'           => __( 'Nouveau service', 'atie' ),
		'view_item'          => __( 'Voir le service', 'atie' ),
		'search_items'       => __( 'Rechercher un service', 'atie' ),
		'not_found'          => __( 'Aucun service trouvé', 'atie' ),
		'not_found_in_trash' => __( 'Aucun service dans la corbeille', 'atie' ),
		'all_items'          => __( 'Tous les services', 'atie' ),
	);

	register_post_type(
		'service',
		array(
			'labels'        => $service_labels,
			'public'        => true,
			'has_archive'   => false,
			'rewrite'       => array( 'slug' => 'services', 'with_front' => false ),
			'menu_icon'     => 'dashicons-screenoptions',
			'menu_position' => 21,
			'supports'      => array( 'title', 'editor', 'thumbnail', 'excerpt', 'page-attributes' ),
			'show_in_rest'  => true,
		)
	);
}
add_action( 'init', 'atie_register_post_types' );

/**
 * Flush rewrite rules on theme activation so the new CPT permalinks work.
 */
function atie_rewrite_flush() {
	atie_register_post_types();
	flush_rewrite_rules();
}
add_action( 'after_switch_theme', 'atie_rewrite_flush' );
