<?php
/**
 * Template Name: ATIE Presence — Inscription
 *
 * Single sign-up page for ATIE Presence: the company describes its site and
 * chooses a plan and a receptionist (pre-selected from the Presence page
 * buttons through ?formule= and ?receptionniste=). Handled in inc/presence-signup.php.
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$choices = atie_presence_signup_choices();
// phpcs:disable WordPress.Security.NonceVerification.Recommended -- read-only pre-selection and status.
$status  = isset( $_GET['inscription'] ) ? sanitize_key( wp_unslash( $_GET['inscription'] ) ) : '';
$plan    = isset( $_GET['formule'] ) ? sanitize_key( wp_unslash( $_GET['formule'] ) ) : '';
$persona = isset( $_GET['receptionniste'] ) ? sanitize_key( wp_unslash( $_GET['receptionniste'] ) ) : '';
// phpcs:enable
$plan    = isset( $choices['plans'][ $plan ] ) ? $plan : 'essentiel';
$persona = isset( $choices['receptionists'][ $persona ] ) ? $persona : 'lea';

$errors = array(
	'incomplet' => __( 'Merci de remplir les champs obligatoires (entreprise, nom, e-mail valide, site web) et d’accepter le traitement de vos données.', 'atie' ),
	'limite'    => __( 'Plusieurs demandes ont déjà été envoyées depuis votre connexion. Réessayez dans une heure ou écrivez-nous directement.', 'atie' ),
	'expiree'   => __( 'La page a expiré. Merci de renvoyer le formulaire.', 'atie' ),
	'erreur'    => __( 'Votre demande n’a pas pu être enregistrée. Réessayez ou écrivez-nous directement.', 'atie' ),
);
$privacy = get_privacy_policy_url();
$back    = get_permalink( get_page_by_path( 'une-receptionniste-ia-pour-votre-site' ) );

while ( have_posts() ) :
	the_post();
	?>

	<div class="presence">
		<section class="presence-welcome presence-signup" id="inscription">
			<div class="presence-wrap presence-signup__wrap">
				<div class="presence-signup__intro">
					<?php if ( $back ) : ?>
						<a class="presence-link presence-signup__back" href="<?php echo esc_url( $back ); ?>"><span aria-hidden="true">‹</span> <?php esc_html_e( 'ATIE Presence', 'atie' ); ?></a>
					<?php endif; ?>
					<span class="presence-kicker"><?php esc_html_e( 'Inscription', 'atie' ); ?></span>
					<h1 class="presence-welcome__title"><?php the_title(); ?></h1>
					<p class="presence-welcome__lead"><?php esc_html_e( 'Dites-nous en quelques lignes qui vous êtes et ce que votre réceptionniste doit savoir. Nous vous répondons sous un jour ouvrable avec la mise en place et l’accès à votre espace client.', 'atie' ); ?></p>
					<ol class="presence-signup__steps">
						<li><?php esc_html_e( 'Vous envoyez cette demande (sans engagement).', 'atie' ); ?></li>
						<li><?php esc_html_e( 'Nous préparons votre réceptionniste avec vos informations.', 'atie' ); ?></li>
						<li><?php esc_html_e( 'Vous la validez, puis vous l’ajoutez à votre site en une ligne.', 'atie' ); ?></li>
					</ol>
					<?php if ( trim( wp_strip_all_tags( get_the_content() ) ) ) : ?>
						<div class="entry-content presence-intro"><?php the_content(); ?></div>
					<?php endif; ?>
				</div>

				<div class="presence-signup__panel">
					<?php if ( 'ok' === $status ) : ?>
						<div class="presence-signup__done" role="status">
							<h2 class="presence-h2"><?php esc_html_e( 'Merci, votre demande est envoyée.', 'atie' ); ?></h2>
							<p><?php esc_html_e( 'Nous revenons vers vous sous un jour ouvrable. Vous recevrez ensuite un e-mail pour accéder à votre espace client.', 'atie' ); ?></p>
							<?php if ( $back ) : ?>
								<a class="btn presence-btn--ghost" href="<?php echo esc_url( $back ); ?>"><?php esc_html_e( 'Retour à ATIE Presence', 'atie' ); ?></a>
							<?php endif; ?>
						</div>
					<?php else : ?>
						<?php if ( isset( $errors[ $status ] ) ) : ?>
							<p class="presence-signup__error" role="alert"><?php echo esc_html( $errors[ $status ] ); ?></p>
						<?php endif; ?>

						<form class="presence-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
							<input type="hidden" name="action" value="<?php echo esc_attr( ATIE_SIGNUP_ACTION ); ?>">
							<input type="hidden" name="started" value="<?php echo esc_attr( time() ); ?>">
							<?php wp_nonce_field( ATIE_SIGNUP_ACTION, '_atie_signup', false ); ?>
							<div class="presence-form__trap" aria-hidden="true">
								<label for="atie-hp"><?php esc_html_e( 'Ne pas remplir', 'atie' ); ?></label>
								<input type="text" id="atie-hp" name="website_url_confirm" tabindex="-1" autocomplete="off">
							</div>

							<fieldset class="presence-form__group">
								<legend><?php esc_html_e( 'Votre entreprise', 'atie' ); ?></legend>
								<div class="presence-form__grid">
									<p class="presence-form__field">
										<label for="atie-company"><?php esc_html_e( 'Entreprise', 'atie' ); ?> <span aria-hidden="true">*</span></label>
										<input type="text" id="atie-company" name="company" required maxlength="120" autocomplete="organization">
									</p>
									<p class="presence-form__field">
										<label for="atie-site"><?php esc_html_e( 'Site web', 'atie' ); ?> <span aria-hidden="true">*</span></label>
										<input type="url" id="atie-site" name="site" required maxlength="200" placeholder="https://" autocomplete="url">
									</p>
									<p class="presence-form__field">
										<label for="atie-name"><?php esc_html_e( 'Prénom et nom', 'atie' ); ?> <span aria-hidden="true">*</span></label>
										<input type="text" id="atie-name" name="name" required maxlength="120" autocomplete="name">
									</p>
									<p class="presence-form__field">
										<label for="atie-email"><?php esc_html_e( 'E-mail', 'atie' ); ?> <span aria-hidden="true">*</span></label>
										<input type="email" id="atie-email" name="email" required maxlength="190" autocomplete="email">
									</p>
									<p class="presence-form__field">
										<label for="atie-phone"><?php esc_html_e( 'Téléphone', 'atie' ); ?></label>
										<input type="tel" id="atie-phone" name="phone" maxlength="40" autocomplete="tel">
									</p>
								</div>
							</fieldset>

							<fieldset class="presence-form__group">
								<legend><?php esc_html_e( 'Formule', 'atie' ); ?></legend>
								<div class="presence-form__choices">
									<?php foreach ( $choices['plans'] as $key => $label ) : ?>
										<label class="presence-choice">
											<input type="radio" name="plan" value="<?php echo esc_attr( $key ); ?>" <?php checked( $plan, $key ); ?>>
											<span><?php echo esc_html( $label ); ?></span>
										</label>
									<?php endforeach; ?>
								</div>
							</fieldset>

							<fieldset class="presence-form__group">
								<legend><?php esc_html_e( 'Réceptionniste', 'atie' ); ?></legend>
								<div class="presence-form__choices presence-form__choices--row">
									<?php foreach ( $choices['receptionists'] as $key => $label ) : ?>
										<label class="presence-choice">
											<input type="radio" name="receptionist" value="<?php echo esc_attr( $key ); ?>" <?php checked( $persona, $key ); ?>>
											<span><?php echo esc_html( $label ); ?></span>
										</label>
									<?php endforeach; ?>
								</div>
							</fieldset>

							<fieldset class="presence-form__group">
								<legend><?php esc_html_e( 'Langues parlées', 'atie' ); ?></legend>
								<div class="presence-form__choices presence-form__choices--row">
									<?php foreach ( $choices['languages'] as $key => $label ) : ?>
										<label class="presence-choice">
											<input type="checkbox" name="languages[]" value="<?php echo esc_attr( $key ); ?>" <?php checked( 'fr', $key ); ?>>
											<span><?php echo esc_html( $label ); ?></span>
										</label>
									<?php endforeach; ?>
								</div>
							</fieldset>

							<p class="presence-form__field">
								<label for="atie-message"><?php esc_html_e( 'Ce que votre réceptionniste doit savoir (horaires, services, questions fréquentes…)', 'atie' ); ?></label>
								<textarea id="atie-message" name="message" rows="5" maxlength="2000"></textarea>
							</p>

							<label class="presence-choice presence-form__consent">
								<input type="checkbox" name="consent" value="1" required>
								<span>
									<?php esc_html_e( 'J’accepte qu’ATIE utilise ces informations pour répondre à ma demande.', 'atie' ); ?>
									<?php if ( $privacy ) : ?>
										<a href="<?php echo esc_url( $privacy ); ?>"><?php esc_html_e( 'Politique de confidentialité', 'atie' ); ?></a>
									<?php endif; ?>
								</span>
							</label>

							<button type="submit" class="btn btn--primary presence-form__submit"><?php esc_html_e( 'Envoyer ma demande', 'atie' ); ?></button>
							<p class="presence-note"><?php esc_html_e( 'Sans engagement. Aucun paiement à cette étape.', 'atie' ); ?></p>
						</form>
					<?php endif; ?>
				</div>
			</div>
		</section>
	</div>

	<?php
endwhile;

get_footer();
