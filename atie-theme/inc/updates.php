<?php
/**
 * Theme updates from GitHub.
 *
 * The theme is not on wordpress.org: without this module every version had to
 * be uploaded by hand. WordPress now asks the latest release of the private
 * repository fabricenana/Atie and offers the update like any other theme
 * (Dashboard → Updates, or Appearance → Themes).
 *
 * Each release carries an atie-theme-x.y.z.zip asset whose root folder is
 * atie-theme/. The version is the tag (v1.1.0 → 1.1.0) and must match the
 * style.css header.
 *
 * Public repository: works without a token (anonymous GitHub API, cached six
 * hours). Private repository: a read-only GitHub token is required, entered in
 * Appearance → Mises à jour ATIE (option not autoloaded) or defined as the
 * ATIE_GITHUB_TOKEN constant in wp-config.php.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

const ATIE_GH_REPO    = 'fabricenana/Atie';
const ATIE_GH_CACHE   = 'atie_gh_release';
const ATIE_GH_OPTION  = 'atie_github_token';
const ATIE_THEME_SLUG = 'atie-theme';

/**
 * GitHub token, or empty string.
 *
 * @return string
 */
function atie_gh_token() {
	if ( defined( 'ATIE_GITHUB_TOKEN' ) && ATIE_GITHUB_TOKEN ) {
		return (string) ATIE_GITHUB_TOKEN;
	}

	return (string) get_option( ATIE_GH_OPTION, '' );
}

/**
 * Latest published release, cached for six hours.
 *
 * @param bool $force Ignore the cache.
 * @return array{version:string,url:string,asset:string,notes:string}|null
 */
function atie_gh_release( $force = false ) {
	$token = atie_gh_token();
	$cache = $force ? false : get_site_transient( ATIE_GH_CACHE );

	if ( is_array( $cache ) ) {
		return $cache['version'] ? $cache : null;
	}

	$response = wp_remote_get(
		'https://api.github.com/repos/' . ATIE_GH_REPO . '/releases/latest',
		array(
			'timeout' => 10,
			'headers' => array_filter(
				array(
					'Authorization'        => '' !== $token ? 'Bearer ' . $token : '',
					'Accept'               => 'application/vnd.github+json',
					'X-GitHub-Api-Version' => '2022-11-28',
				)
			),
		)
	);

	$code = (int) wp_remote_retrieve_response_code( $response );
	$data = json_decode( (string) wp_remote_retrieve_body( $response ), true );

	$release = array( 'version' => '', 'url' => '', 'asset' => '', 'notes' => '', 'error' => '' );

	if ( 200 !== $code || ! is_array( $data ) ) {
		$release['error'] = is_wp_error( $response ) ? $response->get_error_message() : 'HTTP ' . $code;
	} else {
		foreach ( (array) ( $data['assets'] ?? array() ) as $asset ) {
			if ( preg_match( '/\.zip$/i', (string) ( $asset['name'] ?? '' ) ) ) {
				// With a token: API address of the asset (private repository). Without: public download link.
				$release['asset'] = (string) ( '' !== $token ? $asset['url'] : $asset['browser_download_url'] );
				break;
			}
		}

		$release['version'] = ltrim( (string) ( $data['tag_name'] ?? '' ), 'vV' );
		$release['url']     = (string) ( $data['html_url'] ?? '' );
		$release['notes']   = (string) ( $data['body'] ?? '' );
	}

	// A failure is cached for a shorter time, to retry soon.
	set_site_transient( ATIE_GH_CACHE, $release, $release['version'] ? 6 * HOUR_IN_SECONDS : 30 * MINUTE_IN_SECONDS );

	return $release['version'] ? $release : null;
}

/**
 * Report the new version to WordPress.
 *
 * @param object $transient Theme update data.
 * @return object
 */
function atie_gh_report( $transient ) {
	if ( ! is_object( $transient ) ) {
		return $transient;
	}

	$release = atie_gh_release();
	$current = (string) wp_get_theme( ATIE_THEME_SLUG )->get( 'Version' );

	if ( $release && $release['asset'] && $current && version_compare( $release['version'], $current, '>' ) ) {
		$transient->response[ ATIE_THEME_SLUG ] = array(
			'theme'       => ATIE_THEME_SLUG,
			'new_version' => $release['version'],
			'url'         => $release['url'],
			'package'     => $release['asset'],
		);
	} elseif ( isset( $transient->response[ ATIE_THEME_SLUG ] ) ) {
		unset( $transient->response[ ATIE_THEME_SLUG ] );
	}

	return $transient;
}
add_filter( 'pre_set_site_transient_update_themes', 'atie_gh_report' );

/**
 * Download the release archive.
 *
 * The asset API address requires the token, then redirects to a signed storage
 * link that rejects any authorization header. So the redirect is requested
 * without following it, and the signed link is downloaded without the token.
 *
 * @param bool|string|WP_Error $reply   Result of a previous filter.
 * @param string               $package Package address.
 * @return bool|string|WP_Error Downloaded file path, or false to let WordPress handle it.
 */
function atie_gh_download( $reply, $package ) {
	$prefix = 'https://api.github.com/repos/' . ATIE_GH_REPO . '/releases/assets/';

	if ( false !== $reply || 0 !== strpos( (string) $package, $prefix ) || '' === atie_gh_token() ) {
		return $reply;
	}

	$step = wp_remote_get(
		$package,
		array(
			'timeout'     => 15,
			'redirection' => 0,
			'headers'     => array(
				'Authorization' => 'Bearer ' . atie_gh_token(),
				'Accept'        => 'application/octet-stream',
			),
		)
	);

	$link = (string) wp_remote_retrieve_header( $step, 'location' );

	if ( '' === $link ) {
		return new WP_Error( 'atie_gh_download', __( 'GitHub n’a pas fourni l’archive du thème. Vérifiez le jeton dans Apparence → Mises à jour ATIE.', 'atie' ) );
	}

	if ( ! function_exists( 'download_url' ) ) {
		require_once ABSPATH . 'wp-admin/includes/file.php';
	}

	return download_url( $link, 300 );
}
add_filter( 'upgrader_pre_download', 'atie_gh_download', 10, 2 );

/* =========================================================================
 * Appearance → Mises à jour ATIE.
 * ====================================================================== */

/**
 * Menu entry, administrators only.
 */
function atie_gh_menu() {
	add_theme_page( __( 'Mises à jour du thème ATIE', 'atie' ), __( 'Mises à jour ATIE', 'atie' ), 'manage_options', 'atie-mises-a-jour', 'atie_gh_page' );
}
add_action( 'admin_menu', 'atie_gh_menu' );

/**
 * Save the token and check on demand.
 */
function atie_gh_actions() {
	if ( ! current_user_can( 'manage_options' ) ) {
		wp_die( esc_html__( 'Action non autorisée.', 'atie' ) );
	}

	check_admin_referer( 'atie_gh' );

	$result = 'checked';

	if ( isset( $_POST['atie_gh_token'] ) ) {
		$token = trim( sanitize_text_field( wp_unslash( $_POST['atie_gh_token'] ) ) );

		if ( '' !== $token ) {
			update_option( ATIE_GH_OPTION, $token, false );
			$result = 'saved';
		}
	}

	if ( ! empty( $_POST['atie_gh_clear'] ) ) {
		delete_option( ATIE_GH_OPTION );
		$result = 'cleared';
	}

	delete_site_transient( ATIE_GH_CACHE );
	atie_gh_release( true );
	wp_update_themes();

	wp_safe_redirect( admin_url( 'themes.php?page=atie-mises-a-jour&atie_gh=' . $result ) );
	exit;
}
add_action( 'admin_post_atie_gh', 'atie_gh_actions' );

/**
 * Page rendering.
 */
function atie_gh_page() {
	$current  = (string) wp_get_theme( ATIE_THEME_SLUG )->get( 'Version' );
	$constant = defined( 'ATIE_GITHUB_TOKEN' ) && ATIE_GITHUB_TOKEN;
	$has      = '' !== atie_gh_token();
	$release  = atie_gh_release();
	$cache    = get_site_transient( ATIE_GH_CACHE );
	$error    = is_array( $cache ) ? (string) ( $cache['error'] ?? '' ) : '';
	$message  = isset( $_GET['atie_gh'] ) ? sanitize_key( wp_unslash( $_GET['atie_gh'] ) ) : '';
	$messages = array(
		'saved'   => __( 'Jeton enregistré. La vérification a été relancée.', 'atie' ),
		'cleared' => __( 'Jeton effacé.', 'atie' ),
		'checked' => __( 'Vérification relancée.', 'atie' ),
	);
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Mises à jour du thème ATIE', 'atie' ); ?></h1>

		<?php if ( isset( $messages[ $message ] ) ) : ?>
			<div class="notice notice-success is-dismissible"><p><?php echo esc_html( $messages[ $message ] ); ?></p></div>
		<?php endif; ?>

		<table class="form-table" role="presentation">
			<tr>
				<th scope="row"><?php esc_html_e( 'Version installée', 'atie' ); ?></th>
				<td><strong><?php echo esc_html( $current ); ?></strong></td>
			</tr>
			<tr>
				<th scope="row"><?php esc_html_e( 'Dernière version publiée', 'atie' ); ?></th>
				<td>
					<?php if ( $release ) : ?>
						<strong><?php echo esc_html( $release['version'] ); ?></strong>
						<?php if ( version_compare( $release['version'], $current, '>' ) ) : ?>
							— <a href="<?php echo esc_url( admin_url( 'update-core.php' ) ); ?>"><?php esc_html_e( 'Mettre à jour maintenant', 'atie' ); ?></a>
						<?php else : ?>
							— <?php esc_html_e( 'le thème est à jour.', 'atie' ); ?>
						<?php endif; ?>
					<?php else : ?>
						<?php
						/* translators: %s: technical error message. */
						echo esc_html( sprintf( __( 'GitHub ne répond pas (%s). Dépôt privé : vérifiez le jeton.', 'atie' ), $error ?: '?' ) );
						?>
					<?php endif; ?>
				</td>
			</tr>
		</table>

		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
			<input type="hidden" name="action" value="atie_gh">
			<?php wp_nonce_field( 'atie_gh' ); ?>

			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><label for="atie-gh-token"><?php esc_html_e( 'Jeton GitHub', 'atie' ); ?></label></th>
					<td>
						<?php if ( $constant ) : ?>
							<p><?php esc_html_e( 'Défini dans wp-config.php (ATIE_GITHUB_TOKEN).', 'atie' ); ?></p>
						<?php else : ?>
							<input type="password" id="atie-gh-token" name="atie_gh_token" class="regular-text" autocomplete="off" placeholder="<?php echo esc_attr( $has ? __( '•••••••• (enregistré)', 'atie' ) : 'github_pat_…' ); ?>">
							<p class="description"><?php esc_html_e( 'Nécessaire seulement si le dépôt est privé : jeton « fine-grained » limité au dépôt Atie, permission Contents en lecture seule. Laissez vide pour garder le jeton actuel.', 'atie' ); ?></p>
							<?php if ( $has ) : ?>
								<p><label><input type="checkbox" name="atie_gh_clear" value="1"> <?php esc_html_e( 'Effacer le jeton enregistré', 'atie' ); ?></label></p>
							<?php endif; ?>
						<?php endif; ?>
					</td>
				</tr>
			</table>

			<?php submit_button( __( 'Enregistrer et vérifier', 'atie' ) ); ?>
		</form>
	</div>
	<?php
}
