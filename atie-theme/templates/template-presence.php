<?php
/**
 * Template Name: ATIE Presence
 *
 * Landing page for ATIE Presence, the animated AI receptionist for websites.
 * The page content (editor) is shown under the hero when it is not empty.
 * The receptionist widget runs in simulated demo mode here: no microphone,
 * no network call, no paid session (see inc/presence.php).
 *
 * @package ATIE
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();

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

$features = array(
	array(
		'icon'  => 'ia',
		'title' => __( 'Un visage pour votre accueil', 'atie' ),
		'text'  => __( 'Un avatar vidéo animé, à l’image de votre marque, qui écoute, réfléchit et répond.', 'atie' ),
	),
	array(
		'icon'  => 'web',
		'title' => __( 'Quatre langues', 'atie' ),
		'text'  => __( 'Français, allemand, italien et anglais : le visiteur choisit sa langue en un clic.', 'atie' ),
	),
	array(
		'icon'  => 'support',
		'title' => __( 'Vos informations, pas d’invention', 'atie' ),
		'text'  => __( 'Horaires, services, contacts : elle s’appuie sur ce que vous lui confiez et passe la main à votre équipe au besoin.', 'atie' ),
	),
	array(
		'icon'  => 'mobile',
		'title' => __( 'Ordinateur et mobile', 'atie' ),
		'text'  => __( 'Un panneau compact sur ordinateur, plein écran sur téléphone, sans gêner la navigation.', 'atie' ),
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

	<section class="page-section presence-hero">
		<div class="container">
			<span class="section-eyebrow"><?php esc_html_e( 'ATIE Presence', 'atie' ); ?></span>
			<h1 class="presence-hero__title"><?php the_title(); ?></h1>
			<p class="presence-hero__lead"><?php esc_html_e( 'Une réceptionniste numérique animée qui accueille vos visiteurs, répond à leurs questions de vive voix et les oriente vers vous.', 'atie' ); ?></p>
			<div class="presence-hero__actions">
				<button type="button" class="btn btn--primary" data-presence-open><?php esc_html_e( 'Essayer la démonstration', 'atie' ); ?></button>
				<a class="btn btn--ghost" href="<?php echo esc_url( atie_presence_contact_url() ); ?>"><?php esc_html_e( 'En parler avec nous', 'atie' ); ?></a>
			</div>
			<p class="presence-hero__note"><?php esc_html_e( 'Démonstration simulée : aucune connexion, aucun micro.', 'atie' ); ?></p>
		</div>
	</section>

	<section class="page-section presence-avatars" id="receptionnistes">
		<div class="container">
			<header class="section-head">
				<span class="section-eyebrow"><?php esc_html_e( 'Nos réceptionnistes', 'atie' ); ?></span>
				<h2 class="section-title section-title--sm"><?php esc_html_e( 'Un visage, une voix, un ton pour chaque métier', 'atie' ); ?></h2>
			</header>
			<div class="presence-avatars__grid">
				<?php foreach ( atie_presence_personas() as $persona ) : ?>
					<article class="presence-avatar">
						<div class="presence-avatar__visual">
							<?php if ( $persona['image'] ) : ?>
								<img src="<?php echo esc_url( $persona['image'] ); ?>" alt="<?php echo esc_attr( sprintf( /* translators: %s: receptionist name. */ __( 'Avatar de %s', 'atie' ), $persona['name'] ) ); ?>" loading="lazy">
							<?php else : ?>
								<div class="presence-avatar__face" data-presence-face="<?php echo esc_attr( $persona['variant'] ); ?>" aria-hidden="true"></div>
							<?php endif; ?>
						</div>
						<div class="presence-avatar__body">
							<h3 class="presence-avatar__name"><?php echo esc_html( $persona['name'] ); ?></h3>
							<p class="presence-avatar__role"><?php echo esc_html( $persona['role'] ); ?></p>
							<p class="presence-avatar__company"><?php echo esc_html( $persona['company'] ); ?></p>
							<p class="presence-avatar__text"><?php echo esc_html( $persona['greeting'] ); ?></p>
							<p class="presence-avatar__tone"><?php echo esc_html( $persona['tone'] ); ?></p>
							<ul class="presence-avatar__langs" aria-label="<?php esc_attr_e( 'Langues', 'atie' ); ?>">
								<?php foreach ( $persona['languages'] as $lang ) : ?>
									<li><?php echo esc_html( $lang ); ?></li>
								<?php endforeach; ?>
							</ul>
							<button type="button" class="btn btn--primary presence-avatar__try" data-presence-open="<?php echo esc_attr( $persona['id'] ); ?>">
								<?php echo esc_html( sprintf( /* translators: %s: receptionist name. */ __( 'Essayer avec %s', 'atie' ), $persona['name'] ) ); ?>
							</button>
						</div>
					</article>
				<?php endforeach; ?>
			</div>
			<p class="presence-hero__note"><?php esc_html_e( 'Entreprises fictives, à titre de démonstration. Chaque réceptionniste est adaptée à votre marque : visage, voix, langues et informations.', 'atie' ); ?></p>
		</div>
	</section>

	<?php if ( trim( wp_strip_all_tags( get_the_content() ) ) ) : ?>
		<section class="page-section presence-intro">
			<div class="container container--narrow">
				<div class="entry-content"><?php the_content(); ?></div>
			</div>
		</section>
	<?php endif; ?>

	<section class="page-section presence-steps">
		<div class="container">
			<header class="section-head">
				<span class="section-eyebrow"><?php esc_html_e( 'Comment ça marche', 'atie' ); ?></span>
				<h2 class="section-title section-title--sm"><?php esc_html_e( 'Trois étapes, aucune installation pour le visiteur', 'atie' ); ?></h2>
			</header>
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

	<section class="page-section presence-features">
		<div class="container">
			<header class="section-head">
				<span class="section-eyebrow"><?php esc_html_e( 'Ce qu’elle apporte', 'atie' ); ?></span>
				<h2 class="section-title section-title--sm"><?php esc_html_e( 'Un accueil humain, même quand personne n’est disponible', 'atie' ); ?></h2>
			</header>
			<div class="card-grid presence-features__grid">
				<?php foreach ( $features as $feature ) : ?>
					<div class="service-card presence-feature">
						<span class="service-card__icon" aria-hidden="true"><?php echo atie_service_icon_svg( $feature['icon'] ); // phpcs:ignore WordPress.Security.EscapeOutput -- static SVG. ?></span>
						<h3 class="service-card__title"><?php echo esc_html( $feature['title'] ); ?></h3>
						<p class="service-card__excerpt"><?php echo esc_html( $feature['text'] ); ?></p>
					</div>
				<?php endforeach; ?>
			</div>
		</div>
	</section>

	<section class="page-section presence-trust">
		<div class="container">
			<div class="presence-trust__box">
				<div>
					<span class="section-eyebrow"><?php esc_html_e( 'Confiance', 'atie' ); ?></span>
					<h2 class="section-title section-title--sm"><?php esc_html_e( 'Pensée pour le respect du visiteur', 'atie' ); ?></h2>
				</div>
				<ul class="presence-trust__list">
					<?php foreach ( $trust as $item ) : ?>
						<li><?php echo esc_html( $item ); ?></li>
					<?php endforeach; ?>
				</ul>
			</div>
		</div>
	</section>

	<section class="page-section presence-cta">
		<div class="container">
			<h2 class="section-title section-title--sm"><?php esc_html_e( 'Une réceptionniste pour votre site ?', 'atie' ); ?></h2>
			<p class="presence-cta__text"><?php esc_html_e( 'ATIE Presence est en phase pilote. Parlons de votre accueil, de vos langues et de votre image.', 'atie' ); ?></p>
			<div class="presence-hero__actions">
				<a class="btn btn--primary" href="<?php echo esc_url( atie_presence_contact_url() ); ?>"><?php esc_html_e( 'Nous contacter', 'atie' ); ?></a>
				<button type="button" class="btn btn--ghost" data-presence-open><?php esc_html_e( 'Revoir la démonstration', 'atie' ); ?></button>
			</div>
		</div>
	</section>

	<?php
endwhile;

get_footer();
