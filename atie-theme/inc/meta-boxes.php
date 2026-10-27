<?php
/**
 * Meta boxes for project & service post types.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Register meta boxes.
 */
function atie_add_meta_boxes() {
	add_meta_box(
		'atie_project_details',
		__( 'Détails de la réalisation', 'atie' ),
		'atie_project_meta_box',
		'project',
		'side',
		'default'
	);

	add_meta_box(
		'atie_service_details',
		__( 'Détails du service', 'atie' ),
		'atie_service_meta_box',
		'service',
		'normal',
		'high'
	);
}
add_action( 'add_meta_boxes', 'atie_add_meta_boxes' );

/**
 * Project meta box (external URL + year).
 *
 * @param WP_Post $post Current post.
 */
function atie_project_meta_box( $post ) {
	wp_nonce_field( 'atie_save_project_meta', 'atie_project_nonce' );
	$url  = get_post_meta( $post->ID, '_atie_project_url', true );
	$year = get_post_meta( $post->ID, '_atie_project_year', true );
	?>
	<p>
		<label for="atie_project_url"><strong><?php esc_html_e( 'Lien du site (URL)', 'atie' ); ?></strong></label>
		<input type="url" id="atie_project_url" name="atie_project_url" value="<?php echo esc_attr( $url ); ?>" placeholder="https://" style="width:100%;" />
	</p>
	<p>
		<label for="atie_project_year"><strong><?php esc_html_e( 'Année', 'atie' ); ?></strong></label>
		<input type="text" id="atie_project_year" name="atie_project_year" value="<?php echo esc_attr( $year ); ?>" placeholder="2024" style="width:100%;" />
	</p>
	<?php
}

/**
 * Service meta box (icon + included items).
 *
 * @param WP_Post $post Current post.
 */
function atie_service_meta_box( $post ) {
	wp_nonce_field( 'atie_save_service_meta', 'atie_service_nonce' );
	$icon  = get_post_meta( $post->ID, '_atie_service_icon', true );
	$items = get_post_meta( $post->ID, '_atie_service_items', true );
	$icons = atie_service_icon_choices();
	?>
	<p>
		<label for="atie_service_icon"><strong><?php esc_html_e( 'Icône', 'atie' ); ?></strong></label><br />
		<select id="atie_service_icon" name="atie_service_icon">
			<?php foreach ( $icons as $key => $label ) : ?>
				<option value="<?php echo esc_attr( $key ); ?>" <?php selected( $icon, $key ); ?>><?php echo esc_html( $label ); ?></option>
			<?php endforeach; ?>
		</select>
	</p>
	<p>
		<label for="atie_service_items"><strong><?php esc_html_e( 'Prestations incluses', 'atie' ); ?></strong><br />
		<span class="description"><?php esc_html_e( 'Une prestation par ligne.', 'atie' ); ?></span></label><br />
		<textarea id="atie_service_items" name="atie_service_items" rows="6" style="width:100%;"><?php echo esc_textarea( $items ); ?></textarea>
	</p>
	<?php
}

/**
 * Save handler for both meta boxes.
 *
 * @param int $post_id Post ID.
 */
function atie_save_meta( $post_id ) {
	if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}
	if ( ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}

	// Project.
	if ( isset( $_POST['atie_project_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['atie_project_nonce'] ), 'atie_save_project_meta' ) ) {
		if ( isset( $_POST['atie_project_url'] ) ) {
			update_post_meta( $post_id, '_atie_project_url', esc_url_raw( wp_unslash( $_POST['atie_project_url'] ) ) );
		}
		if ( isset( $_POST['atie_project_year'] ) ) {
			update_post_meta( $post_id, '_atie_project_year', sanitize_text_field( wp_unslash( $_POST['atie_project_year'] ) ) );
		}
	}

	// Service.
	if ( isset( $_POST['atie_service_nonce'] ) && wp_verify_nonce( sanitize_key( $_POST['atie_service_nonce'] ), 'atie_save_service_meta' ) ) {
		if ( isset( $_POST['atie_service_icon'] ) ) {
			$allowed = array_keys( atie_service_icon_choices() );
			$icon    = sanitize_key( wp_unslash( $_POST['atie_service_icon'] ) );
			update_post_meta( $post_id, '_atie_service_icon', in_array( $icon, $allowed, true ) ? $icon : 'default' );
		}
		if ( isset( $_POST['atie_service_items'] ) ) {
			update_post_meta( $post_id, '_atie_service_items', sanitize_textarea_field( wp_unslash( $_POST['atie_service_items'] ) ) );
		}
	}
}
add_action( 'save_post', 'atie_save_meta' );
