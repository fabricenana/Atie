/*!
 * ATIE Presence — widget Phase 2 (POC conversation)
 * Bulle animée → consentement → micro → jeton de l'API ATIE → salle LiveKit (agent + avatar LemonSlice).
 * Sans data-api : conversation simulée, aucun appel réseau (comme la Phase 1).
 * Intégration : <script src="atie-presence.js" defer data-api="http://127.0.0.1:8800" data-tenant="cabinet-lumiere"></script>
 *
 * Attributs data- du <script> :
 *   data-api             URL de l'API ATIE (sans / final). Absent : mode simulé
 *   data-tenant          identifiant de l'entreprise (config/tenants.json)
 *   data-avatar-name     Nom affiché (défaut « Léa »)
 *   data-avatar-image    Image fixe de l'avatar (remplace le dessin animé de substitution)
 *   data-avatar-variant  Dessin de substitution : lea | marco (défaut lea)
 *   data-idle-src        Boucle vidéo idle (WebM/MP4), prioritaire ; data-avatar-image sert d'affiche
 *   data-poster          Image fixe de repli (réseau en échec, économie de données, reduced motion)
 *   data-position        right | left (défaut right)
 *   data-offset-bottom   marge basse en px (défaut 20) — à augmenter pour éviter bandeaux/boutons existants
 *   data-offset-side     marge latérale en px (défaut 20)
 *   data-lang            fr | de | it | en (défaut : langue de <html>, sinon fr)
 *   data-accent          couleur d'action (défaut : rouge du thème #E31E24)
 *   data-demo-state      ok | quota-low | quota-empty | saturated (mode simulé seulement)
 *
 * Aucun appel réseau ni micro avant le clic de consentement. Le client LiveKit n'est chargé qu'à ce moment.
 */
(function () {
  'use strict';
  if (window.__atiePresenceLoaded) return;
  window.__atiePresenceLoaded = true;

  // Client LiveKit épinglé (version + empreinte SRI). Changer les deux ensemble.
  var LK_SRC = 'https://cdn.jsdelivr.net/npm/livekit-client@2.22.3/dist/livekit-client.umd.js';
  var LK_SRI = 'sha384-G/xxtkVytOx/ia9Q8MXxM+V0ohsaY1fZAgVP3iSGTPz4wJ0s3+ulJNKXh/gnzEDZ';
  var HEARTBEAT_MS = 15000; // bail serveur de 45 s par défaut : 3 battements avant expiration
  var CONNECT_TIMEOUT_MS = 30000; // création de l'avatar LemonSlice : 7 à 22 s observées

  var script = document.currentScript;
  var ds = (script && script.dataset) || {};
  var cfg = {
    api: (ds.api || '').replace(/\/+$/, ''),
    tenant: ds.tenant || '',
    name: ds.avatarName || 'Léa',
    image: ds.avatarImage || '',
    variant: ds.avatarVariant === 'marco' ? 'marco' : 'lea',
    idleSrc: ds.idleSrc || '',
    poster: ds.poster || '',
    position: ds.position === 'left' ? 'left' : 'right',
    offsetBottom: parseInt(ds.offsetBottom, 10) || 20,
    offsetSide: parseInt(ds.offsetSide, 10) || 20,
    lang: ds.lang || (document.documentElement.lang || 'fr').slice(0, 2).toLowerCase(),
    accent: /^#[0-9a-f]{3,8}$/i.test(ds.accent || '') ? ds.accent : '',
    demoState: ds.demoState || 'ok'
  };
  var simulated = !cfg.api || !cfg.tenant;

  var T = {
    fr: {
      invite: 'Parler à notre réceptionniste', title: 'Réceptionniste numérique IA',
      ai: 'Vous échangez avec une intelligence artificielle, pas avec une personne.',
      consent: 'Pour parler, votre micro sera activé uniquement après votre accord. La conversation n’est pas enregistrée par défaut.',
      start: 'Autoriser le micro et démarrer', textOnly: 'Laisser un message à la place',
      connecting: 'Connexion…', waiting: 'Votre réceptionniste arrive…', listening: 'Je vous écoute', thinking: 'Je réfléchis…', speaking: 'Je vous réponds',
      mic: 'Micro', micOn: 'Micro activé', micOff: 'Micro coupé', captions: 'Sous-titres', close: 'Fermer', open: 'Ouvrir la réceptionniste',
      lang: 'Langue', end: 'Terminer', quotaLow: 'Cette réceptionniste sera bientôt indisponible. Vous pouvez aussi nous contacter directement.',
      unavailable: 'La réceptionniste n’est pas disponible pour le moment.', saturated: 'La réceptionniste est déjà en conversation. Réessayez dans un instant.',
      trialUsed: 'Vous avez déjà profité de votre essai gratuit aujourd’hui. Parlons de votre projet : écrivez-nous.',
      micDenied: 'Le micro n’est pas autorisé. Vous pouvez l’activer dans votre navigateur, ou nous laisser un message.',
      failed: 'La connexion a échoué.', ended: 'Conversation terminée. Merci !', timeUp: 'Durée maximale atteinte, la conversation est terminée.',
      fallback: 'Laisser un message', contact: 'Contacter l’entreprise',
      sample: 'Bonjour, je suis {name}. Comment puis-je vous aider ?', demoNote: 'Démonstration : aucune connexion réelle.'
    },
    de: {
      invite: 'Mit unserer Rezeption sprechen', title: 'Digitale KI-Empfangsmitarbeiterin',
      ai: 'Sie sprechen mit einer künstlichen Intelligenz, nicht mit einer Person.',
      consent: 'Ihr Mikrofon wird erst nach Ihrer Zustimmung aktiviert. Das Gespräch wird standardmässig nicht aufgezeichnet.',
      start: 'Mikrofon erlauben und starten', textOnly: 'Stattdessen Nachricht hinterlassen',
      connecting: 'Verbindung…', waiting: 'Ihre Empfangsmitarbeiterin kommt…', listening: 'Ich höre zu', thinking: 'Ich überlege…', speaking: 'Ich antworte',
      mic: 'Mikrofon', micOn: 'Mikrofon an', micOff: 'Mikrofon aus', captions: 'Untertitel', close: 'Schliessen', open: 'Empfang öffnen',
      lang: 'Sprache', end: 'Beenden', quotaLow: 'Diese Empfangsmitarbeiterin ist bald nicht mehr verfügbar. Sie können uns auch direkt kontaktieren.',
      unavailable: 'Die Empfangsmitarbeiterin ist momentan nicht verfügbar.', saturated: 'Die Empfangsmitarbeiterin ist gerade im Gespräch. Bitte versuchen Sie es gleich noch einmal.',
      trialUsed: 'Sie haben Ihren kostenlosen Test heute bereits genutzt. Sprechen wir über Ihr Projekt: Schreiben Sie uns.',
      micDenied: 'Das Mikrofon ist nicht erlaubt. Sie können es im Browser aktivieren oder uns eine Nachricht hinterlassen.',
      failed: 'Die Verbindung ist fehlgeschlagen.', ended: 'Gespräch beendet. Vielen Dank!', timeUp: 'Maximale Dauer erreicht, das Gespräch ist beendet.',
      fallback: 'Nachricht hinterlassen', contact: 'Unternehmen kontaktieren',
      sample: 'Guten Tag, ich bin {name}. Wie kann ich Ihnen helfen?', demoNote: 'Demo: keine echte Verbindung.'
    },
    it: {
      invite: 'Parla con la nostra receptionist', title: 'Receptionist digitale IA',
      ai: 'Stai parlando con un’intelligenza artificiale, non con una persona.',
      consent: 'Il microfono verrà attivato solo dopo il tuo consenso. La conversazione non viene registrata per impostazione predefinita.',
      start: 'Consenti il microfono e inizia', textOnly: 'Lascia un messaggio',
      connecting: 'Connessione…', waiting: 'La receptionist sta arrivando…', listening: 'Ti ascolto', thinking: 'Sto pensando…', speaking: 'Ti rispondo',
      mic: 'Microfono', micOn: 'Microfono attivo', micOff: 'Microfono spento', captions: 'Sottotitoli', close: 'Chiudi', open: 'Apri la receptionist',
      lang: 'Lingua', end: 'Termina', quotaLow: 'Questa receptionist sarà presto non disponibile. Puoi anche contattarci direttamente.',
      unavailable: 'La receptionist non è al momento disponibile.', saturated: 'La receptionist è già in conversazione. Riprova tra un istante.',
      trialUsed: 'Hai già usato la tua prova gratuita di oggi. Parliamo del tuo progetto: scrivici.',
      micDenied: 'Il microfono non è autorizzato. Puoi attivarlo nel browser oppure lasciarci un messaggio.',
      failed: 'La connessione non è riuscita.', ended: 'Conversazione terminata. Grazie!', timeUp: 'Durata massima raggiunta, la conversazione è terminata.',
      fallback: 'Lascia un messaggio', contact: 'Contatta l’azienda',
      sample: 'Buongiorno, sono {name}. Come posso aiutarti?', demoNote: 'Demo: nessuna connessione reale.'
    },
    en: {
      invite: 'Talk to our receptionist', title: 'AI digital receptionist',
      ai: 'You are talking to an artificial intelligence, not a person.',
      consent: 'Your microphone is only turned on after you agree. Conversations are not recorded by default.',
      start: 'Allow microphone and start', textOnly: 'Leave a message instead',
      connecting: 'Connecting…', waiting: 'Your receptionist is on the way…', listening: 'I’m listening', thinking: 'Thinking…', speaking: 'Answering',
      mic: 'Microphone', micOn: 'Microphone on', micOff: 'Microphone off', captions: 'Captions', close: 'Close', open: 'Open the receptionist',
      lang: 'Language', end: 'End', quotaLow: 'This receptionist will soon be unavailable. You can also contact us directly.',
      unavailable: 'The receptionist is not available right now.', saturated: 'The receptionist is already in a conversation. Please try again shortly.',
      trialUsed: 'You have already used today’s free trial. Let’s talk about your project: write to us.',
      micDenied: 'Microphone access is not allowed. You can enable it in your browser, or leave us a message.',
      failed: 'The connection failed.', ended: 'Conversation ended. Thank you!', timeUp: 'Maximum duration reached, the conversation has ended.',
      fallback: 'Leave a message', contact: 'Contact the company',
      sample: 'Hello, I’m {name}. How can I help you?', demoNote: 'Demo: no real connection.'
    }
  };
  if (!T[cfg.lang]) cfg.lang = 'fr';

  var reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);

  // Avatar de substitution : à remplacer par la boucle licenciée (data-idle-src).
  // Deux variantes : cheveux longs (lea) ou courts avec barbe légère (marco).
  var HAIR = {
    lea: { back: '<path d="M52 96c0-40 22-62 48-62s48 22 48 62c0 6-2 10-4 12 0-22-8-34-18-42-10 8-34 10-52 4-14 8-20 22-22 38-2-2-0-8 0-12z" fill="#3a2a22"/>',
      front: '<path d="M62 92c8-26 28-34 40-32 16 0 34 10 36 32-10-16-26-22-40-22s-28 8-36 22z" fill="#3a2a22"/>', beard: '' },
    marco: { back: '',
      front: '<path d="M61 90c0-30 17-48 39-48s39 18 39 48c-4-12-12-20-22-22-10 4-26 4-38-2-8 6-14 14-18 24z" fill="#2b211c"/>',
      beard: '<path d="M66 112q4 30 34 32 30-2 34-32-6 14-14 16-8-6-20-6t-20 6q-8-2-14-16z" fill="#2b211c" opacity=".55"/>' }
  };
  function face(variant) {
    var h = HAIR[variant] || HAIR.lea;
    return (
    '<svg class="face" viewBox="0 0 200 200" aria-hidden="true" focusable="false">' +
    '<rect width="200" height="200" fill="var(--sand)"/>' +
    '<g class="body"><path d="M30 200c4-38 34-58 70-58s66 20 70 58z" fill="var(--ink)"/><path d="M86 140h28v22q-14 10-28 0z" fill="#d9a98a"/></g>' +
    '<g class="head">' +
      h.back +
      '<ellipse cx="100" cy="98" rx="38" ry="46" fill="#e2b898"/>' +
      h.beard + h.front +
      '<g class="eyes"><g class="eye l"><ellipse cx="85" cy="98" rx="6" ry="4.2" fill="#fff"/><circle class="iris" cx="85" cy="98" r="2.8" fill="#3b2a1f"/><rect class="lid" x="78" y="93" width="14" height="10" fill="#e2b898"/></g>' +
      '<g class="eye r"><ellipse cx="115" cy="98" rx="6" ry="4.2" fill="#fff"/><circle class="iris" cx="115" cy="98" r="2.8" fill="#3b2a1f"/><rect class="lid" x="108" y="93" width="14" height="10" fill="#e2b898"/></g></g>' +
      '<path d="M77 89q8-5 16-1M107 88q8-4 16 1" stroke="#3a2a22" stroke-width="2.2" fill="none" stroke-linecap="round"/>' +
      '<path d="M100 100v12q-4 3 0 4" stroke="#c99a7a" stroke-width="2" fill="none" stroke-linecap="round"/>' +
      '<path class="mouth" d="M88 124q12 9 24 0" stroke="#a8453f" stroke-width="3.2" fill="none" stroke-linecap="round"/>' +
    '</g></svg>');
  }

  // Couleurs du thème (rouge d'action, encre, sable, papier) : une seule source, surchargeable par data-accent.
  var CSS =
    ':host{all:initial;--accent:#E31E24;--ink:#141414;--sand:#e9e3dc;--paper:#fff;--muted:#5b616b;--ok:#00d084;--warn:#fcb900;--warn-bg:#fff7e0;' +
    '--crisp:6px 6px 0 var(--ink);position:fixed;z-index:99000;bottom:calc(var(--ob) + env(safe-area-inset-bottom,0px));' +
    'font-family:"Work Sans",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;color:var(--ink);line-height:1.4}' +
    ':host(.right){right:calc(var(--os) + env(safe-area-inset-right,0px))}:host(.left){left:calc(var(--os) + env(safe-area-inset-left,0px))}' +
    '*{box-sizing:border-box}button{font:inherit;cursor:pointer;color:inherit}button:disabled{cursor:not-allowed;opacity:.55}' +
    '.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}' +
    ':focus-visible{outline:3px solid var(--accent);outline-offset:2px}' +
    /* bulle */
    '.bubble{position:relative;display:block;width:96px;height:96px;padding:0;border:3px solid var(--paper);border-radius:50%;background:var(--sand);overflow:hidden;' +
    'box-shadow:0 12px 30px rgba(0,0,0,.35);animation:ring 2.8s ease-out infinite;transition:transform .2s}' +
    '.bubble:hover,.bubble:focus-visible{transform:translateY(-2px) scale(1.04)}' +
    '@keyframes ring{0%{box-shadow:0 12px 30px rgba(0,0,0,.35),0 0 0 0 rgba(227,30,36,.45)}70%,100%{box-shadow:0 12px 30px rgba(0,0,0,.35),0 0 0 14px rgba(227,30,36,0)}}' +
    '.bubble .media,.panel .media{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%}' +
    '.bubble .dot{position:absolute;right:8px;bottom:8px;width:14px;height:14px;border-radius:50%;background:var(--ok);border:2px solid var(--paper)}' +
    '.invite{position:absolute;bottom:calc(100% + 12px);white-space:nowrap;background:#111113;color:#fff;border-radius:999px;box-shadow:0 10px 26px rgba(0,0,0,.3);padding:9px 14px;font-weight:600;font-size:14px;opacity:0;transform:translateY(4px);pointer-events:none;transition:opacity .2s,transform .2s}' +
    ':host(.right) .invite{right:0}:host(.left) .invite{left:0}' +
    '.wrap:hover .invite,.bubble:focus-visible~.invite{opacity:1;transform:none}' +
    /* animations avatar de substitution */
    '.face{display:block;width:100%;height:100%}' +
    '.head{transform-origin:100px 150px;animation:sway 6s ease-in-out infinite}.body{transform-origin:100px 200px;animation:breathe 4.2s ease-in-out infinite}' +
    '.lid{transform-origin:50% 0;transform-box:fill-box;transform:scaleY(0);animation:blink 5.4s infinite}' +
    '.iris{animation:glance 9s ease-in-out infinite}.mouth{animation:smile 7s ease-in-out infinite;transform-origin:100px 124px}' +
    '.speaking .mouth{animation:talk .32s ease-in-out infinite alternate}' +
    '@keyframes sway{0%,100%{transform:rotate(-1.2deg) translateY(0)}50%{transform:rotate(1.4deg) translateY(-1.5px)}}' +
    '@keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.025)}}' +
    '@keyframes blink{0%,92%,100%{transform:scaleY(0)}95%{transform:scaleY(1)}97%{transform:scaleY(0)}}' +
    '@keyframes glance{0%,40%,100%{transform:translate(0,0)}50%,60%{transform:translate(2.5px,-.5px)}75%{transform:translate(-2.5px,0)}}' +
    '@keyframes smile{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.25)}}' +
    '@keyframes talk{from{transform:scaleY(.5)}to{transform:scaleY(2.4)}}' +
    '.paused .head,.paused .body,.paused .lid,.paused .iris,.paused .mouth{animation-play-state:paused}' +
    '.still .head,.still .body,.still .lid,.still .iris,.still .mouth{animation:none}' +
    /* panneau : carte d'appel sombre, la vidéo occupe le cadre, en-tête et états en surimpression */
    '.panel{position:absolute;bottom:0;width:380px;max-width:calc(100vw - 2 * var(--os));background:#0e0e10;color:#f4f4f5;' +
    'border:1px solid rgba(255,255,255,.1);border-radius:24px;box-shadow:0 30px 80px rgba(0,0,0,.45);display:none;flex-direction:column;overflow:hidden;' +
    'max-height:calc(100vh - var(--ob) - 12px);max-height:calc(100dvh - var(--ob) - 12px)}' +
    '.body-box{flex:0 0 auto}' +
    ':host(.right) .panel{right:0}:host(.left) .panel{left:0}' +
    ':host(.open) .panel{display:flex;animation:pop .22s ease-out}:host(.open) .wrap{display:none}' +
    '@keyframes pop{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}' +
    '.stage{position:relative;flex:1 1 auto;height:min(540px,calc(100vh - var(--ob) - 220px));min-height:220px;background:#1b1b1e;isolation:isolate}' +
    '.stage::before,.stage::after{content:"";position:absolute;left:0;right:0;z-index:1;pointer-events:none}' +
    '.stage::before{top:0;height:120px;background:linear-gradient(rgba(0,0,0,.62),rgba(0,0,0,0))}' +
    '.stage::after{bottom:0;height:150px;background:linear-gradient(rgba(0,0,0,0),rgba(0,0,0,.7))}' +
    '.stage .remote{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 18%;background:#1b1b1e}' +
    '.head-bar{position:absolute;top:0;left:0;right:0;z-index:3;display:flex;align-items:flex-start;gap:8px;padding:14px 14px 0;color:#fff}' +
    '.who{flex:1;min-width:0}.nm{display:block;font:600 18px/1.2 Archivo,system-ui,sans-serif;letter-spacing:-.01em}' +
    '.head-bar h2{margin:2px 0 0;font-size:12px;font-weight:500;line-height:1.3;color:rgba(255,255,255,.78)}' +
    '.head-bar select{appearance:none;-webkit-appearance:none;background:rgba(255,255,255,.16);color:#fff;border:0;border-radius:999px;padding:7px 12px;font:inherit;font-size:12.5px;font-weight:600;cursor:pointer;backdrop-filter:blur(6px)}' +
    '.head-bar select option{color:#111}' +
    '.icon{background:rgba(255,255,255,.16);border:0;border-radius:50%;color:#fff;width:34px;height:34px;display:grid;place-items:center;font-size:20px;line-height:1;backdrop-filter:blur(6px);transition:background .15s}' +
    '.icon:hover{background:rgba(255,255,255,.28)}' +
    '.badge{display:flex;align-items:flex-start;gap:8px;font-size:12.5px;font-weight:500;color:#e4e4e7}' +
    '.badge::before{content:"IA";flex:none;margin-top:1px;padding:1px 6px;border-radius:6px;background:var(--accent);color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.04em}' +
    '.timer{position:absolute;right:14px;bottom:16px;z-index:2;background:var(--accent);color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700;font-variant-numeric:tabular-nums}' +
    '.state{position:absolute;left:14px;bottom:14px;z-index:2;max-width:calc(100% - 28px);background:rgba(0,0,0,.55);color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:999px;padding:7px 14px;font-size:13.5px;display:flex;align-items:center;gap:8px;backdrop-filter:blur(6px)}' +
    '.pulse{width:9px;height:9px;border-radius:50%;background:var(--accent);animation:pulse 1.2s infinite}@keyframes pulse{50%{opacity:.25}}' +
    '.state.listening .pulse{background:var(--ok)}' +
    '.captions{position:absolute;left:14px;right:14px;bottom:60px;z-index:2;max-height:40%;overflow:auto;background:rgba(0,0,0,.6);color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:8px 12px;font-size:14px;line-height:1.45;backdrop-filter:blur(6px);display:none}.captions.on{display:block}' +
    '.body-box{padding:16px;display:flex;flex-direction:column;gap:12px;font-size:13.5px;line-height:1.5;color:#d4d4d8;background:#0e0e10}' +
    '.body-box p{margin:0}.muted{color:#8b8b94;font-size:12px}' +
    '.btn{border:0;border-radius:999px;background:var(--accent);color:#fff;padding:12px 16px;font-weight:600;font-size:14px;box-shadow:0 8px 22px rgba(227,30,36,.32);transition:filter .15s,transform .15s,background .15s}' +
    '.btn:hover:not(:disabled){filter:brightness(1.08)}.btn:active:not(:disabled){transform:scale(.98)}' +
    '.btn.alt{background:rgba(255,255,255,.08);color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}' +
    '.btn.alt[aria-pressed=false].mic{background:#fff;color:#111113}.btn.alt[aria-pressed=true].cc{background:rgba(255,255,255,.22)}' +
    '.row{display:flex;gap:8px;flex-wrap:wrap}.row .btn{flex:1;min-width:110px}' +
    '.notice{border-left:3px solid var(--warn);background:rgba(252,185,0,.1);color:#fde68a;border-radius:10px;padding:10px 12px}' +
    '[hidden]{display:none!important}' +
    '@media (max-width:600px){.panel{position:fixed;inset:0;width:auto;max-width:none;max-height:none;border:0;border-radius:0;box-shadow:none;bottom:0}' +
    ':host(.right) .panel,:host(.left) .panel{right:0;left:0}.stage{height:auto;flex:1;min-height:0}.panel{padding-bottom:env(safe-area-inset-bottom,0px)}.bubble{width:80px;height:80px}}' +
    '@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}';

  var host = document.createElement('div');
  host.id = 'atie-presence-root';
  host.className = cfg.position;
  host.style.setProperty('--ob', cfg.offsetBottom + 'px');
  host.style.setProperty('--os', cfg.offsetSide + 'px');
  if (cfg.accent) host.style.setProperty('--accent', cfg.accent);
  var root = host.attachShadow({ mode: 'open' });
  var t = T[cfg.lang];

  function attr(v) { return String(v).replace(/[&"<>]/g, function (c) { return { '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function media() {
    var still = cfg.image || cfg.poster;
    if (cfg.idleSrc && !(reduceMotion || saveData)) {
      return '<video class="media" muted loop playsinline preload="metadata"' + (still ? ' poster="' + attr(still) + '"' : '') +
        ' src="' + attr(cfg.idleSrc) + '" aria-hidden="true"></video>';
    }
    if (still) return '<img class="media" alt="" src="' + attr(still) + '">';
    return face(cfg.variant);
  }

  root.innerHTML =
    '<style>' + CSS + '</style>' +
    '<div class="wrap">' +
      '<button class="bubble" type="button" aria-haspopup="dialog"><span class="sr"></span>' + media() + '<span class="dot" aria-hidden="true"></span></button>' +
      '<span class="invite" aria-hidden="true"></span>' +
    '</div>' +
    '<section class="panel" role="dialog" aria-modal="false" aria-labelledby="ttl">' +
      '<div class="stage">' + media() +
        '<div class="head-bar"><div class="who"><strong class="nm"></strong><h2 id="ttl"></h2></div><label class="sr" for="lang"></label>' +
        '<select id="lang"><option value="fr">FR</option><option value="de">DE</option><option value="it">IT</option><option value="en">EN</option></select>' +
        '<button class="icon close" type="button">×</button></div>' +
        '<span class="timer" hidden></span><div class="captions" aria-live="polite"></div>' +
        '<div class="state" role="status" hidden><span class="pulse"></span><span class="txt"></span></div></div>' +
      '<div class="body-box">' +
        '<p class="badge"></p>' +
        '<div class="pre"><p class="consent"></p><div class="row"><button class="btn start" type="button"></button><button class="btn alt textonly" type="button"></button></div></div>' +
        '<div class="live" hidden><div class="row"><button class="btn alt mic" type="button" aria-pressed="true"></button><button class="btn alt cc" type="button" aria-pressed="false"></button><button class="btn end" type="button"></button></div></div>' +
        '<div class="notice" role="alert" hidden></div>' +
        '<p class="muted demo"></p>' +
      '</div>' +
    '</section>';

  var $ = function (s) { return root.querySelector(s); };
  var bubble = $('.bubble'), stage = $('.stage'), stateBox = $('.state'), stateTxt = $('.state .txt'), timerBox = $('.timer');
  var pre = $('.pre'), live = $('.live'), notice = $('.notice'), caps = $('.captions');
  var timers = [], opened = false, micOn = true;
  // Session réelle en cours : { id, room, stream, pub, beat, tick, deadline, ending }
  var S = null;

  function label() {
    t = T[cfg.lang];
    $('.bubble .sr').textContent = t.open;
    $('.invite').textContent = t.invite;
    $('#ttl').textContent = t.title;
    $('.nm').textContent = cfg.name;
    $('label[for=lang]').textContent = t.lang;
    $('.close').setAttribute('aria-label', t.close);
    $('.badge').textContent = t.ai;
    $('.consent').textContent = t.consent;
    $('.start').textContent = t.start;
    $('.textonly').textContent = t.textOnly;
    $('.cc').textContent = t.captions;
    $('.end').textContent = t.end;
    $('.demo').textContent = simulated ? t.demoNote : '';
    $('.demo').hidden = !simulated;
    setMic(micOn);
  }
  function setMic(on) {
    micOn = on;
    var b = $('.mic');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? t.micOn : t.micOff;
  }
  function setState(txt, speaking, kind) {
    stateBox.hidden = !txt;
    stateTxt.textContent = txt || '';
    stateBox.className = 'state' + (kind ? ' ' + kind : '');
    root.querySelectorAll('.stage .face').forEach(function (f) { f.classList.toggle('speaking', !!speaking); });
  }
  function showNotice(msg, withActions) {
    notice.hidden = !msg;
    notice.textContent = msg || '';
    if (msg && withActions) {
      notice.appendChild(document.createElement('br'));
      [t.fallback, t.contact].forEach(function (l) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'btn alt'; b.style.marginTop = '8px'; b.style.marginRight = '8px';
        b.textContent = l; b.addEventListener('click', function () { emit('atie:fallback', { action: l === t.fallback ? 'message' : 'contact' }); });
        notice.appendChild(b);
      });
    }
  }
  function emit(name, detail) { host.dispatchEvent(new CustomEvent(name, { detail: detail || {}, bubbles: true, composed: true })); }
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function showCaption(text) {
    caps.textContent = text;
    if ($('.cc').getAttribute('aria-pressed') === 'true') caps.classList.toggle('on', !!text);
    caps.scrollTop = caps.scrollHeight;
  }

  function open() {
    if (opened) return; opened = true;
    host.classList.add('open'); if (!S) resetPanel();
    var v = root.querySelector('.stage video.media'); if (v && !reduceMotion && !saveData) v.play().catch(function () {});
    $(S ? '.end' : '.start').focus(); emit('atie:open');
  }
  // Fermer le panneau termine la conversation : jamais de session payante qui tourne panneau fermé.
  function close() {
    if (!opened) return; opened = false;
    if (S) endSession('closed'); else { clearTimers(); setState(''); }
    host.classList.remove('open'); emit('atie:close'); bubble.focus();
  }
  function resetPanel() {
    clearTimers(); pre.hidden = false; live.hidden = true; caps.textContent = ''; caps.classList.remove('on');
    $('.cc').setAttribute('aria-pressed', 'false'); setState(''); setMic(true);
    $('.start').disabled = false; $('#lang').disabled = false; timerBox.hidden = true;
    if (simulated && cfg.demoState === 'quota-low') showNotice(t.quotaLow, false);
    else if (simulated && (cfg.demoState === 'quota-empty' || cfg.demoState === 'saturated')) { showNotice(t.unavailable, true); $('.start').disabled = true; }
    else showNotice('');
  }
  function goLive() { showNotice(''); pre.hidden = true; live.hidden = false; $('#lang').disabled = true; setState(t.connecting); }
  function backToStart(msg, withActions) { resetPanel(); showNotice(msg, withActions); }

  function start() {
    emit('atie:consent', { microphone: true });
    if (simulated) return startSimulated();
    startSession();
  }

  // --- Mode simulé (aucun réseau) ---
  function startSimulated() {
    goLive();
    later(function () { setState(t.speaking, true); showCaption(t.sample.replace('{name}', cfg.name)); }, 1400);
    later(function () { setState(t.listening, false, 'listening'); }, 4200);
    later(function () { setState(t.thinking, false); }, 8000);
    later(function () { setState(t.speaking, true); }, 9500);
    later(function () { setState(t.listening, false, 'listening'); }, 12500);
    emit('atie:session-start', { simulated: true });
  }

  // --- Session réelle ---
  var lkPromise = null;
  function loadLiveKit() {
    if (window.LivekitClient) return Promise.resolve(window.LivekitClient);
    if (lkPromise) return lkPromise;
    lkPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = LK_SRC; s.integrity = LK_SRI; s.crossOrigin = 'anonymous'; s.async = true;
      s.onload = function () { window.LivekitClient ? resolve(window.LivekitClient) : reject(new Error('livekit')); };
      s.onerror = function () { lkPromise = null; reject(new Error('livekit')); };
      document.head.appendChild(s);
    });
    return lkPromise;
  }
  function api(path, method, body) {
    return fetch(cfg.api + path, {
      method: method, credentials: 'omit', keepalive: method === 'DELETE',
      headers: body ? { 'content-type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  }
  function fmt(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }

  function startSession() {
    if (S) return;
    goLive(); $('.start').disabled = true;
    var cur = S = { id: null, room: null, stream: null, pub: null, beat: null, tick: null, deadline: 0, ending: false };
    var stale = function () { return S !== cur || cur.ending; };

    // 1. Micro, après le clic de consentement uniquement.
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      .then(function (stream) {
        cur.stream = stream;
        if (stale()) throw new Error('stale');
        // 2. Place réservée et jeton court auprès de l'API ATIE.
        return api('/session', 'POST', { tenant_id: cfg.tenant, language: cfg.lang });
      }, function () { throw { kind: 'mic' }; })
      .then(function (r) {
        // 429 « trial_limit » : l'essai gratuit du jour est déjà utilisé (sinon : réceptionniste occupée).
        if (r.status !== 429) return r;
        return r.json().catch(function () { return {}; }).then(function (b) { r.trial = !!(b && b.detail && b.detail.code === 'trial_limit'); return r; });
      })
      .then(function (r) {
        if (r.trial) throw { kind: 'trial' };
        if (r.status === 429) throw { kind: 'saturated' };
        if (!r.ok) throw { kind: 'unavailable' };
        return r.json();
      })
      .then(function (sess) {
        cur.id = sess.session_id;
        if (stale()) throw new Error('stale');
        cur.beat = setInterval(function () {
          api('/session/' + cur.id + '/heartbeat', 'POST').then(function (r) { if (r.status === 404) endSession('expired'); }).catch(function () {});
        }, HEARTBEAT_MS);
        cur.deadline = Date.now() + (sess.max_minutes || 3) * 60000;
        return loadLiveKit().then(function (LK) { return connect(LK, cur, sess); });
      })
      .catch(function (e) {
        if (S !== cur) return;
        var kind = (e && e.kind) || 'failed';
        teardown(cur);
        if (kind === 'mic') backToStart(t.micDenied, true);
        else if (kind === 'saturated') backToStart(t.saturated, true);
        else if (kind === 'trial') backToStart(t.trialUsed, true);
        else if (kind === 'unavailable') backToStart(t.unavailable, true);
        else if (e && e.message === 'stale') resetPanel();
        else backToStart(t.failed + ' ' + t.unavailable, true);
        emit('atie:error', { reason: kind });
      });
  }

  function connect(LK, cur, sess) {
    var E = LK.RoomEvent;
    // adaptiveStream désactivé : la vidéo de l'avatar ne doit jamais être mise en pause par le client.
    var room = cur.room = new LK.Room({ adaptiveStream: false, dynacast: false });
    var agentIds = {};

    room.on(E.TrackSubscribed, function (track, pub, p) {
      if (track.kind === 'video') {
        var v = track.attach(); v.className = 'remote'; v.muted = true; v.playsInline = true; v.setAttribute('aria-hidden', 'true');
        stage.insertBefore(v, stage.querySelector('.badge'));
      } else if (track.kind === 'audio') {
        var a = track.attach(); a.hidden = true; root.appendChild(a);
      }
    });
    room.on(E.TrackUnsubscribed, function (track) { track.detach().forEach(function (el) { el.remove(); }); });
    room.on(E.ParticipantAttributesChanged, function (changed, p) {
      var st = changed && changed['lk.agent.state'];
      if (!st) return;
      agentIds[p.identity] = true;
      if (st === 'listening') setState(t.listening, false, 'listening');
      else if (st === 'thinking') setState(t.thinking);
      else if (st === 'speaking') setState(t.speaking, true);
      else setState(t.waiting);
    });
    room.on(E.Disconnected, function () { if (S === cur && !cur.ending) endSession('disconnected'); });

    // Sous-titres : transcription de l'agent (texte diffusé au fil de la voix).
    room.registerTextStreamHandler('lk.transcription', function (reader, info) {
      if (info.identity === room.localParticipant.identity) return;
      var text = '';
      (async function () {
        for await (var chunk of reader) { text += chunk; if (S === cur) showCaption(text); }
      })().catch(function () {});
    });

    var guard;
    var timeout = new Promise(function (_, reject) { guard = setTimeout(function () { reject(new Error('timeout')); }, CONNECT_TIMEOUT_MS); });
    return Promise.race([room.connect(sess.url, sess.token), timeout])
      .finally(function () { clearTimeout(guard); })
      .then(function () {
        if (S !== cur || cur.ending) throw new Error('stale');
        return room.localParticipant.publishTrack(cur.stream.getAudioTracks()[0], { source: LK.Track.Source.Microphone });
      })
      .then(function (pub) {
        cur.pub = pub;
        room.startAudio().catch(function () {});
        setState(t.waiting);
        timerBox.hidden = false;
        var tick = function () {
          var left = (cur.deadline - Date.now()) / 1000;
          timerBox.textContent = fmt(left);
          if (left <= 0) endSession('time_up');
        };
        tick(); cur.tick = setInterval(tick, 1000);
        emit('atie:session-start', { session_id: cur.id });
      });
  }

  // Libère tout côté navigateur et prévient l'API (fermeture de la salle LiveKit + libération de la place).
  function teardown(cur) {
    cur.ending = true;
    clearInterval(cur.beat); clearInterval(cur.tick);
    if (cur.room) { try { cur.room.disconnect(); } catch (e) {} }
    if (cur.stream) cur.stream.getTracks().forEach(function (tr) { tr.stop(); });
    stage.querySelectorAll('.remote').forEach(function (el) { el.remove(); });
    root.querySelectorAll(':scope > audio').forEach(function (el) { el.remove(); });
    if (cur.id) api('/session/' + cur.id, 'DELETE').catch(function () {});
    if (S === cur) S = null;
  }
  function endSession(reason) {
    var cur = S;
    clearTimers();
    if (!cur) { resetPanel(); emit('atie:session-end', { reason: reason }); return; }
    if (cur.ending) return;
    teardown(cur);
    resetPanel();
    if (reason === 'time_up') showNotice(t.timeUp, false);
    else if (reason === 'end') showNotice(t.ended, false);
    else if (reason === 'disconnected' || reason === 'expired') showNotice(t.ended, false);
    emit('atie:session-end', { reason: reason, session_id: cur.id });
  }

  bubble.addEventListener('click', open);
  $('.close').addEventListener('click', close);
  $('.start').addEventListener('click', start);
  $('.textonly').addEventListener('click', function () { showNotice(t.fallback, true); emit('atie:fallback', { action: 'message' }); });
  $('.end').addEventListener('click', function () { if (S) endSession('end'); else { clearTimers(); resetPanel(); emit('atie:session-end', { reason: 'end' }); } });
  $('.mic').addEventListener('click', function () {
    var on = !micOn; setMic(on);
    if (S && S.pub) (on ? S.pub.unmute() : S.pub.mute()).catch(function () {});
  });
  $('.cc').addEventListener('click', function () {
    var on = $('.cc').getAttribute('aria-pressed') !== 'true';
    $('.cc').setAttribute('aria-pressed', String(on)); caps.classList.toggle('on', on && !!caps.textContent);
  });
  $('#lang').addEventListener('change', function (e) { cfg.lang = e.target.value; label(); if (opened && !S) resetPanel(); emit('atie:language', { lang: cfg.lang }); });
  root.querySelector('.panel').addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
  // Quitter la page termine la session (requête keepalive) : la place et la salle sont libérées sans attendre le bail.
  window.addEventListener('pagehide', function () { if (S) teardown(S); });

  // Économie : l'animation s'arrête hors viewport ou onglet masqué ; figée si mouvement réduit.
  var bubbleMedia = bubble.querySelector('.face, video, img');
  // Change d'avatar (nom, image, dessin) hors conversation : la page peut présenter plusieurs réceptionnistes.
  function setPersona(p) {
    if (S || !p) return false;
    if (p.tenant) cfg.tenant = p.tenant;
    cfg.name = p.name || cfg.name; cfg.image = p.image || ''; cfg.idleSrc = p.video || ''; cfg.variant = p.variant === 'marco' ? 'marco' : 'lea';
    [bubble, stage].forEach(function (box) {
      var old = box.querySelector(':scope > .face, :scope > .media');
      var tmp = document.createElement('div'); tmp.innerHTML = media();
      var el = tmp.firstChild; if (old) box.replaceChild(el, old); else box.insertBefore(el, box.firstChild);
      if ((reduceMotion || saveData) && el.classList.contains('face')) el.classList.add('still');
    });
    bubbleMedia = bubble.querySelector('.face, video, img');
    setIdle(visible && tabOn);
    // Panneau déjà ouvert : open() ne relancera pas la lecture, on démarre la vidéo de la nouvelle réceptionniste ici.
    var sv = stage.querySelector(':scope > video.media');
    if (opened && sv && !reduceMotion && !saveData) sv.play().catch(function () {});
    label();
    clearTimers(); caps.textContent = ''; caps.classList.remove('on'); setState('');
    emit('atie:persona', { name: cfg.name });
    return true;
  }
  function setIdle(running) {
    var el = bubbleMedia; if (!el) return;
    if (el.tagName === 'VIDEO') { if (running && !reduceMotion && !saveData) el.play().catch(function () {}); else el.pause(); }
    else el.classList.toggle('paused', !running);
  }
  if (reduceMotion || saveData) { root.querySelectorAll('.face').forEach(function (f) { f.classList.add('still'); }); }
  var visible = true, tabOn = !document.hidden;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { visible = en[0].isIntersecting; setIdle(visible && tabOn); }).observe(host);
  }
  document.addEventListener('visibilitychange', function () { tabOn = !document.hidden; setIdle(visible && tabOn); });

  label();
  $('#lang').value = cfg.lang;
  document.body.appendChild(host);
  setIdle(true);

  window.AtiePresence = { open: open, close: close, setPersona: setPersona, faceMarkup: face, end: function () { endSession('end'); }, element: host, config: cfg, simulated: simulated };
})();
