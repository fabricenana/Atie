<?php
/**
 * Template Name: ATIE Presence
 *
 * Landing page for ATIE Presence, the animated AI receptionist for websites.
 * Dark "product showcase" layout: welcome, three action cards, featured
 * receptionists as large portraits, then how it works and trust.
 * The page content (editor) is shown under the welcome when it is not empty.
 * The receptionist widget runs in simulated demo mode here: no microphone,
 * no network call, no paid session (see inc/presence.php).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

$contact  = atie_presence_contact_url();
$personas = atie_presence_personas();

$actions = array(
	array(
		'tone'  => 'red',
		'icon'  => '<path d="M12 5v14M5 12h14"/>',
		'label' => __( 'Créer votre réceptionniste', 'atie' ),
		'href'  => $contact,
		'open'  => false,
	),
	array(
		'tone'  => 'green',
		'icon'  => '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="17" cy="9" r="2.4"/><path d="M15.8 14.2c2.4.1 4.1 1.7 4.7 4.3"/>',
		'label' => __( 'Voir les réceptionnistes', 'atie' ),
		'href'  => '#receptionnistes',
		'open'  => false,
	),
	array(
		'tone'  => 'blue',
		'icon'  => '<rect x="4" y="5" width="16" height="14" rx="2.5"/><path d="M8 10l2.5 2L8 14M12.5 14H16"/>',
		'label' => __( 'Essayer la démonstration', 'atie' ),
		'href'  => '',
		'open'  => true,
	),
);

$steps = array(
	array(
		'title' => __( 'Le visiteur clique', 'atie' ),
		'text'  => __( 'Une bulle animée attend discrètement dans un coin de votre site. Un clic ouvre la conversation.', 'atie' ),
	),
	array(
		'title' => __( 'Il donne son accord', 'atie' ),
		'text'  => __( 'Le micro ne s’active qu’après son accord explicite. Il sait d’emblée qu’il parle à une IA.', 'atie' ),
	),
	array(
		'title' => __( 'Il parle, elle répond', 'atie' ),
		'text'  => __( 'La réceptionniste répond à voix haute, avec sous-titres, à partir des informations de votre entreprise.', 'atie' ),
	),
);

$trust = array(
	__( 'Micro activé seulement après accord du visiteur', 'atie' ),
	__( 'Conversation non enregistrée par défaut', 'atie' ),
	__( 'Intelligence artificielle annoncée clairement', 'atie' ),
	__( 'Durée et nombre de conversations plafonnés', 'atie' ),
	__( 'Aucune clé ni donnée sensible dans le navigateur', 'atie' ),
	__( 'Un message ou un contact humain toujours proposé', 'atie' ),
);

while ( have_posts() ) :
	the_post();
	?>

	<div class="presence">

		<section class="presence-welcome">
			<div class="presence-wrap">
				<span class="presence-kicker"><?php esc_html_e( 'ATIE Presence', 'atie' ); ?></span>
				<h1 class="presence-welcome__title"><?php the_title(); ?></h1>
				<p class="presence-welcome__lead"><?php esc_html_e( 'Des réceptionnistes numériques expressives et interactives, qui accueillent vos visiteurs de vive voix.', 'atie' ); ?></p>

				<div class="presence-actions">
					<?php foreach ( $actions as $action ) : ?>
						<?php
						$tag   = $action['open'] ? 'button' : 'a';
						$attrs = $action['open'] ? ' type="button" data-presence-open' : ' href="' . esc_url( $action['href'] ) . '"';
						?>
						<<?php echo $tag . $attrs; // phpcs:ignore WordPress.Security.EscapeOutput -- built above from static values and esc_url. ?> class="presence-action">
							<span class="presence-action__icon presence-action__icon--<?php echo esc_attr( $action['tone'] ); ?>" aria-hidden="true">
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><?php echo $action['icon']; // phpcs:ignore WordPress.Security.EscapeOutput -- static SVG. ?></svg>
							</span>
							<span class="presence-action__label"><?php echo esc_html( $action['label'] ); ?> <span aria-hidden="true">›</span></span>
						</<?php echo $tag; // phpcs:ignore WordPress.Security.EscapeOutput -- static tag name. ?>>
					<?php endforeach; ?>
				</div>

				<?php if ( trim( wp_strip_all_tags( get_the_content() ) ) ) : ?>
					<div class="entry-content presence-intro"><?php the_content(); ?></div>
				<?php endif; ?>
			</div>
		</section>

		<section class="presence-featured" id="receptionnistes">
			<div class="presence-wrap">
				<header class="presence-featured__head">
					<h2 class="presence-h2"><?php esc_html_e( 'Réceptionnistes en vedette', 'atie' ); ?></h2>
					<a class="presence-link" href="<?php echo esc_url( $contact ); ?>"><?php esc_html_e( 'Sur mesure', 'atie' ); ?> <span aria-hidden="true">›</span></a>
				</header>

				<div class="presence-gallery">
					<?php foreach ( $personas as $persona ) : ?>
						<article class="presence-card">
							<button type="button" class="presence-card__hit" data-presence-open="<?php echo esc_attr( $persona['id'] ); ?>">
								<span class="screen-reader-text"><?php echo esc_html( sprintf( /* translators: %s: receptionist name. */ __( 'Essayer avec %s', 'atie' ), $persona['name'] ) ); ?></span>
							</button>
							<div class="presence-card__media">
								<?php if ( $persona['video'] ) : ?>
									<video src="<?php echo esc_url( $persona['video'] ); ?>" poster="<?php echo esc_url( $persona['image'] ); ?>" muted loop playsinline autoplay preload="metadata" aria-hidden="true" width="416" height="672"></video>
								<?php elseif ( $persona['image'] ) : ?>
									<img src="<?php echo esc_url( $persona['image'] ); ?>" alt="<?php echo esc_attr( sprintf( /* translators: %s: receptionist name. */ __( 'Portrait de %s, réceptionniste fictive', 'atie' ), $persona['name'] ) ); ?>" loading="lazy" width="900" height="1221">
								<?php else : ?>
									<div class="presence-card__face" data-presence-face="<?php echo esc_attr( $persona['variant'] ); ?>" aria-hidden="true"></div>
								<?php endif; ?>
							</div>
							<div class="presence-card__info">
								<ul class="presence-card__langs" aria-label="<?php esc_attr_e( 'Langues', 'atie' ); ?>">
									<?php foreach ( $persona['languages'] as $lang ) : ?>
										<li><?php echo esc_html( $lang ); ?></li>
									<?php endforeach; ?>
								</ul>
								<h3 class="presence-card__name"><?php echo esc_html( $persona['name'] ); ?></h3>
								<p class="presence-card__role"><?php echo esc_html( $persona['role'] ); ?> · <span><?php echo esc_html( $persona['company'] ); ?></span></p>
								<p class="presence-card__text"><?php echo esc_html( $persona['greeting'] ); ?></p>
								<span class="presence-card__try" aria-hidden="true"><?php echo esc_html( sprintf( /* translators: %s: receptionist name. */ __( 'Essayer avec %s', 'atie' ), $persona['name'] ) ); ?> ›</span>
							</div>
						</article>
					<?php endforeach; ?>

					<a class="presence-card presence-card--custom" href="<?php echo esc_url( $contact ); ?>">
						<span class="presence-card__plus" aria-hidden="true">+</span>
						<span class="presence-card__name"><?php esc_html_e( 'Votre réceptionniste', 'atie' ); ?></span>
						<span class="presence-card__text"><?php esc_html_e( 'Votre visage de marque, votre voix, vos langues et vos informations.', 'atie' ); ?></span>
						<span class="presence-card__try"><?php esc_html_e( 'En parler avec nous', 'atie' ); ?> ›</span>
					</a>
				</div>
				<p class="presence-note"><?php esc_html_e( 'Entreprises fictives, à titre de démonstration. Démonstration simulée : aucune connexion, aucun micro.', 'atie' ); ?></p>
			</div>
		</section>

		<section class="presence-steps">
			<div class="presence-wrap">
				<h2 class="presence-h2"><?php esc_html_e( 'Comment ça marche', 'atie' ); ?></h2>
				<ol class="presence-steps__list">
					<?php foreach ( $steps as $i => $step ) : ?>
						<li class="presence-step">
							<span class="presence-step__num" aria-hidden="true"><?php echo esc_html( $i + 1 ); ?></span>
							<h3 class="presence-step__title"><?php echo esc_html( $step['title'] ); ?></h3>
							<p class="presence-step__text"><?php echo esc_html( $step['text'] ); ?></p>
						</li>
					<?php endforeach; ?>
				</ol>
			</div>
		</section>

		<?php $grid = atie_presence_plans(); ?>
		<section class="presence-pricing" id="tarifs">
			<div class="presence-wrap">
				<h2 class="presence-h2"><?php esc_html_e( 'Tarifs', 'atie' ); ?></h2>
				<p class="presence-pricing__lead"><?php esc_html_e( 'Un abonnement mensuel avec des minutes de conversation incluses. Sans engagement, prix en CHF.', 'atie' ); ?></p>
				<ul class="presence-plans">
					<?php foreach ( $grid['plans'] as $plan ) : ?>
						<li class="presence-plan<?php echo $plan['featured'] ? ' presence-plan--featured' : ''; ?>">
							<?php if ( $plan['featured'] ) : ?>
								<span class="presence-plan__badge"><?php esc_html_e( 'Recommandé', 'atie' ); ?></span>
							<?php endif; ?>
							<h3 class="presence-plan__name"><?php echo esc_html( $plan['name'] ); ?></h3>
							<p class="presence-plan__price">
								<span class="presence-plan__currency">CHF</span>
								<span class="presence-plan__amount"><?php echo esc_html( $plan['price'] ); ?></span>
								<span class="presence-plan__period"><?php esc_html_e( '/ mois', 'atie' ); ?></span>
							</p>
							<p class="presence-plan__text"><?php echo esc_html( $plan['text'] ); ?></p>
							<ul class="presence-plan__features">
								<?php /* translators: %d: minutes of conversation included per month */ ?>
								<li><?php echo esc_html( sprintf( __( '%d minutes de conversation par mois', 'atie' ), $plan['minutes'] ) ); ?></li>
								<li>
									<?php
									echo esc_html(
										1 === $plan['sessions']
											? __( '1 conversation à la fois', 'atie' )
											/* translators: %d: simultaneous conversations */
											: sprintf( __( '%d conversations en même temps', 'atie' ), $plan['sessions'] )
									);
									?>
								</li>
								<li><?php esc_html_e( 'Français, allemand, italien, anglais', 'atie' ); ?></li>
							</ul>
							<a class="btn <?php echo $plan['featured'] ? 'btn--primary' : 'presence-btn--ghost'; ?> presence-plan__cta" href="<?php echo esc_url( add_query_arg( 'formule', strtolower( $plan['name'] ), $contact ) ); ?>"><?php esc_html_e( 'Choisir', 'atie' ); ?></a>
						</li>
					<?php endforeach; ?>
				</ul>
				<p class="presence-note">
					<?php
					/* translators: 1: top-up price in CHF, 2: minutes */
					echo esc_html( sprintf( __( 'Besoin de plus ? Recharge de %2$d minutes pour CHF %1$s, à tout moment. Mise en place de votre réceptionniste sur devis.', 'atie' ), $grid['topup']['price'], $grid['topup']['minutes'] ) );
					?>
				</p>
			</div>
		</section>

		<section class="presence-trust">
			<div class="presence-wrap">
				<div class="presence-trust__box">
					<h2 class="presence-h2"><?php esc_html_e( 'Pensée pour le respect du visiteur', 'atie' ); ?></h2>
					<ul class="presence-trust__list">
						<?php foreach ( $trust as $item ) : ?>
							<li><?php echo esc_html( $item ); ?></li>
						<?php endforeach; ?>
					</ul>
				</div>
			</div>
		</section>

		<section class="presence-cta">
			<div class="presence-wrap">
				<h2 class="presence-h2"><?php esc_html_e( 'Une réceptionniste pour votre site ?', 'atie' ); ?></h2>
				<p class="presence-cta__text"><?php esc_html_e( 'ATIE Presence est en phase pilote. Parlons de votre accueil, de vos langues et de votre image.', 'atie' ); ?></p>
				<div class="presence-cta__actions">
					<a class="btn btn--primary" href="<?php echo esc_url( $contact ); ?>"><?php esc_html_e( 'Nous contacter', 'atie' ); ?></a>
					<?php if ( function_exists( 'atie_console_url' ) ) : ?>
						<a class="btn presence-btn--ghost" href="<?php echo esc_url( atie_console_url() ); ?>" target="_blank" rel="noopener">
							<?php esc_html_e( 'Voir la console (démo)', 'atie' ); ?>
							<span class="screen-reader-text"><?php esc_html_e( '(nouvel onglet)', 'atie' ); ?></span>
						</a>
					<?php endif; ?>
				</div>
			</div>
		</section>

	</div>

	<?php
endwhile;

get_footer();
