<?php
/**
 * Template Name: ATIE Presence — Inscription
 *
 * Sign-up path for ATIE Presence, in four steps on one page: receptionist, plan,
 * company, confirmation. The Presence page buttons pre-select through ?formule=
 * and ?receptionniste=, and the path opens on the first step left to answer.
 * Without JavaScript all the steps show one under the other and the form still
 * works. Handled in inc/presence-signup.php.
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
$has_plan    = isset( $choices['plans'][ $plan ] );
$has_persona = isset( $choices['receptionists'][ $persona ] );
$plan        = $has_plan ? $plan : 'essentiel';
$persona     = $has_persona ? $persona : 'lea';

// First step left to answer. After an error the visitor returns to the company step.
$start = 1;
if ( $has_persona ) {
	$start = $has_plan ? 3 : 2;
}
if ( '' !== $status ) {
	$start = 3;
}

$errors = array(
	'incomplet' => __( 'Merci de remplir les champs obligatoires (entreprise, nom, e-mail valide, site web) et d’accepter le traitement de vos données.', 'atie' ),
	'limite'    => __( 'Plusieurs demandes ont déjà été envoyées depuis votre connexion. Réessayez dans une heure ou écrivez-nous directement.', 'atie' ),
	'expiree'   => __( 'La page a expiré. Merci de renvoyer le formulaire.', 'atie' ),
	'erreur'    => __( 'Votre demande n’a pas pu être enregistrée. Réessayez ou écrivez-nous directement.', 'atie' ),
);
$privacy   = get_privacy_policy_url();
$back      = get_permalink( get_page_by_path( 'une-receptionniste-ia-pour-votre-site' ) );
$personas  = atie_presence_personas();
$plan_list = atie_presence_plans()['plans'];
$labels    = array(
	1 => __( 'Réceptionniste', 'atie' ),
	2 => __( 'Formule', 'atie' ),
	3 => __( 'Entreprise', 'atie' ),
	4 => __( 'Confirmation', 'atie' ),
);

while ( have_posts() ) :
	the_post();
	?>

	<div class="presence presence-flow" id="inscription">
		<div class="presence-wrap">
			<?php if ( $back ) : ?>
				<a class="presence-link presence-signup__back" href="<?php echo esc_url( $back ); ?>"><span aria-hidden="true">‹</span> <?php esc_html_e( 'ATIE Presence', 'atie' ); ?></a>
			<?php endif; ?>

			<?php if ( 'ok' === $status ) : ?>
				<section class="presence-done" role="status">
					<span class="presence-done__mark" aria-hidden="true">
						<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>
					</span>
					<h1 class="presence-welcome__title"><?php esc_html_e( 'Votre demande est envoyée', 'atie' ); ?></h1>
					<p class="presence-welcome__lead"><?php esc_html_e( 'Nous revenons vers vous sous un jour ouvrable. Vous recevrez ensuite un e-mail pour accéder à votre espace client.', 'atie' ); ?></p>
					<ol class="presence-signup__steps">
						<li><?php esc_html_e( 'Nous préparons votre réceptionniste avec vos informations.', 'atie' ); ?></li>
						<li><?php esc_html_e( 'Vous la validez depuis votre espace client.', 'atie' ); ?></li>
						<li><?php esc_html_e( 'Vous l’ajoutez à votre site en une ligne.', 'atie' ); ?></li>
					</ol>
					<?php if ( $back ) : ?>
						<a class="btn presence-btn--ghost" href="<?php echo esc_url( $back ); ?>"><?php esc_html_e( 'Retour à ATIE Presence', 'atie' ); ?></a>
					<?php endif; ?>
				</section>
			<?php else : ?>
				<header class="presence-flow__head">
					<span class="presence-kicker"><?php esc_html_e( 'Créer votre réceptionniste', 'atie' ); ?></span>
					<h1 class="presence-flow__title"><?php the_title(); ?></h1>
				</header>

				<ol class="presence-stepper" data-stepper hidden>
					<?php foreach ( $labels as $number => $label ) : ?>
						<li class="presence-stepper__item" data-stepper-item="<?php echo esc_attr( $number ); ?>">
							<button type="button" class="presence-stepper__btn" data-step-goto="<?php echo esc_attr( $number ); ?>">
								<span class="presence-stepper__num" aria-hidden="true"><?php echo esc_html( $number ); ?></span>
								<span class="presence-stepper__label"><?php echo esc_html( $label ); ?></span>
							</button>
						</li>
					<?php endforeach; ?>
				</ol>

				<?php if ( isset( $errors[ $status ] ) ) : ?>
					<p class="presence-signup__error" role="alert"><?php echo esc_html( $errors[ $status ] ); ?></p>
				<?php endif; ?>

				<div class="presence-flow__grid">
					<form class="presence-form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" data-flow data-start="<?php echo esc_attr( $start ); ?>">
						<input type="hidden" name="action" value="<?php echo esc_attr( ATIE_SIGNUP_ACTION ); ?>">
						<input type="hidden" name="started" value="<?php echo esc_attr( time() ); ?>">
						<?php wp_nonce_field( ATIE_SIGNUP_ACTION, '_atie_signup', false ); ?>
						<div class="presence-form__trap" aria-hidden="true">
							<label for="atie-hp"><?php esc_html_e( 'Ne pas remplir', 'atie' ); ?></label>
							<input type="text" id="atie-hp" name="website_url_confirm" tabindex="-1" autocomplete="off">
						</div>

						<section class="presence-step-panel" data-step="1">
							<h2 class="presence-h2" tabindex="-1"><?php esc_html_e( 'Qui accueille vos visiteurs ?', 'atie' ); ?></h2>
							<p class="presence-flow__lead"><?php esc_html_e( 'Partez d’une réceptionniste prête à l’emploi, ou demandez votre propre visage de marque.', 'atie' ); ?></p>
							<div class="presence-pick">
								<?php foreach ( $personas as $item ) : ?>
									<label class="presence-pick__card">
										<input type="radio" name="receptionist" value="<?php echo esc_attr( $item['id'] ); ?>" <?php checked( $persona, $item['id'] ); ?>>
										<?php if ( $item['image'] ) : ?>
											<img src="<?php echo esc_url( $item['image'] ); ?>" alt="" loading="lazy">
										<?php endif; ?>
										<span class="presence-pick__info">
											<strong><?php echo esc_html( $item['name'] ); ?></strong>
											<span><?php echo esc_html( $item['role'] ); ?></span>
										</span>
									</label>
								<?php endforeach; ?>
								<label class="presence-pick__card presence-pick__card--custom">
									<input type="radio" name="receptionist" value="sur-mesure" <?php checked( $persona, 'sur-mesure' ); ?>>
									<span class="presence-card__plus" aria-hidden="true">+</span>
									<span class="presence-pick__info">
										<strong><?php esc_html_e( 'Sur mesure', 'atie' ); ?></strong>
										<span><?php esc_html_e( 'Votre visage de marque et votre voix', 'atie' ); ?></span>
									</span>
								</label>
							</div>
						</section>

						<section class="presence-step-panel" data-step="2">
							<h2 class="presence-h2" tabindex="-1"><?php esc_html_e( 'Quelle formule vous convient ?', 'atie' ); ?></h2>
							<p class="presence-flow__lead"><?php esc_html_e( 'Prix mensuels en CHF, sans engagement. Vous pourrez changer de formule ensuite.', 'atie' ); ?></p>
							<div class="presence-form__choices">
								<?php foreach ( $plan_list as $item ) : ?>
									<?php $key = sanitize_key( $item['name'] ); ?>
									<label class="presence-choice presence-choice--plan">
										<input type="radio" name="plan" value="<?php echo esc_attr( $key ); ?>" <?php checked( $plan, $key ); ?>>
										<span class="presence-choice__main">
											<strong>
												<?php echo esc_html( $item['name'] ); ?>
												<?php if ( $item['featured'] ) : ?>
													<em><?php esc_html_e( 'Recommandé', 'atie' ); ?></em>
												<?php endif; ?>
											</strong>
											<span><?php echo esc_html( sprintf( /* translators: %d: minutes per month */ __( '%d minutes par mois', 'atie' ), $item['minutes'] ) ); ?> · <?php echo esc_html( $item['text'] ); ?></span>
										</span>
										<span class="presence-choice__price">CHF <?php echo esc_html( $item['price'] ); ?></span>
									</label>
								<?php endforeach; ?>
								<label class="presence-choice">
									<input type="radio" name="plan" value="conseil" <?php checked( $plan, 'conseil' ); ?>>
									<span><?php echo esc_html( $choices['plans']['conseil'] ); ?></span>
								</label>
							</div>
						</section>

						<section class="presence-step-panel" data-step="3">
							<h2 class="presence-h2" tabindex="-1"><?php esc_html_e( 'Parlez-nous de votre entreprise', 'atie' ); ?></h2>
							<p class="presence-flow__lead"><?php esc_html_e( 'Ces informations nous servent à préparer votre réceptionniste.', 'atie' ); ?></p>
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
								<textarea id="atie-message" name="message" rows="4" maxlength="2000"></textarea>
							</p>
						</section>

						<section class="presence-step-panel" data-step="4">
							<h2 class="presence-h2" tabindex="-1"><?php esc_html_e( 'Tout est prêt ?', 'atie' ); ?></h2>
							<p class="presence-flow__lead"><?php esc_html_e( 'Vérifiez votre choix avant d’envoyer votre demande. Nous vous répondons sous un jour ouvrable.', 'atie' ); ?></p>
							<dl class="presence-review">
								<div><dt><?php esc_html_e( 'Entreprise', 'atie' ); ?></dt><dd data-review="company"></dd></div>
								<div><dt><?php esc_html_e( 'Contact', 'atie' ); ?></dt><dd data-review="name"></dd></div>
								<div><dt><?php esc_html_e( 'E-mail', 'atie' ); ?></dt><dd data-review="email"></dd></div>
								<div><dt><?php esc_html_e( 'Site web', 'atie' ); ?></dt><dd data-review="site"></dd></div>
							</dl>
							<label class="presence-choice presence-form__consent">
								<input type="checkbox" name="consent" value="1" required>
								<span>
									<?php esc_html_e( 'J’accepte qu’ATIE utilise ces informations pour répondre à ma demande.', 'atie' ); ?>
									<?php if ( $privacy ) : ?>
										<a href="<?php echo esc_url( $privacy ); ?>"><?php esc_html_e( 'Politique de confidentialité', 'atie' ); ?></a>
									<?php endif; ?>
								</span>
							</label>
							<p class="presence-note"><?php esc_html_e( 'Sans engagement. Aucun paiement à cette étape.', 'atie' ); ?></p>
						</section>

						<div class="presence-flow__bar">
							<button type="button" class="btn presence-btn--ghost" data-step-back hidden><?php esc_html_e( 'Retour', 'atie' ); ?></button>
							<button type="button" class="btn btn--primary" data-step-next hidden><?php esc_html_e( 'Continuer', 'atie' ); ?></button>
							<button type="submit" class="btn btn--primary" data-step-submit><?php esc_html_e( 'Envoyer ma demande', 'atie' ); ?></button>
						</div>
					</form>

					<aside class="presence-summary" aria-label="<?php esc_attr_e( 'Votre sélection', 'atie' ); ?>">
						<?php foreach ( $personas as $item ) : ?>
							<div class="presence-summary__persona" data-summary-persona="<?php echo esc_attr( $item['id'] ); ?>"<?php echo $persona === $item['id'] ? '' : ' hidden'; ?>>
								<?php if ( $item['image'] ) : ?>
									<img src="<?php echo esc_url( $item['image'] ); ?>" alt="" width="72" height="72">
								<?php endif; ?>
								<span><strong><?php echo esc_html( $item['name'] ); ?></strong> <?php echo esc_html( $item['role'] ); ?></span>
							</div>
						<?php endforeach; ?>
						<div class="presence-summary__persona" data-summary-persona="sur-mesure"<?php echo 'sur-mesure' === $persona ? '' : ' hidden'; ?>>
							<span class="presence-card__plus" aria-hidden="true">+</span>
							<span><strong><?php esc_html_e( 'Sur mesure', 'atie' ); ?></strong> <?php esc_html_e( 'Votre visage de marque et votre voix', 'atie' ); ?></span>
						</div>
						<?php foreach ( $plan_list as $item ) : ?>
							<p class="presence-summary__plan" data-summary-plan="<?php echo esc_attr( sanitize_key( $item['name'] ) ); ?>"<?php echo sanitize_key( $item['name'] ) === $plan ? '' : ' hidden'; ?>>
								<span><?php echo esc_html( $item['name'] ); ?> · <?php echo esc_html( sprintf( /* translators: %d: minutes per month */ __( '%d min par mois', 'atie' ), $item['minutes'] ) ); ?></span>
								<strong>CHF <?php echo esc_html( $item['price'] ); ?></strong>
							</p>
						<?php endforeach; ?>
						<p class="presence-summary__plan" data-summary-plan="conseil"<?php echo 'conseil' === $plan ? '' : ' hidden'; ?>>
							<span><?php esc_html_e( 'Formule à définir avec vous', 'atie' ); ?></span>
						</p>
						<p class="presence-summary__note"><?php esc_html_e( 'Sans engagement. Mise en place sur devis.', 'atie' ); ?></p>
					</aside>
				</div>
			<?php endif; ?>
		</div>
		<?php get_template_part( 'template-parts/presence-footer' ); ?>
	</div>

	<?php
endwhile;

get_footer();
