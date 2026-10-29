/**
 * Jeu de données de TEST — entièrement fictif (domaines .example, numéros DEMO-).
 *
 * N'est jamais chargé par l'application : sert uniquement de fixture aux tests, qui
 * l'insèrent dans une base PGlite (tests/helpers/db.ts). Généré de façon déterministe
 * (graine fixe) relativement à une date de référence.
 */
import type {
  AuditEvent,
  Avatar,
  ConcurrencyEntitlement,
  Conversation,
  ConversationEvent,
  EndReason,
  Incident,
  Invoice,
  KnowledgeDocument,
  KnowledgeSource,
  Lang,
  MinuteTopup,
  Notification,
  Organization,
  OrganizationUser,
  Payment,
  Plan,
  PlatformSettings,
  ProviderStatus,
  ProviderUsage,
  Receptionist,
  SessionStatus,
  Subscription,
  SupportRequest,
  UsageRecord,
  User,
  VisitorRequest,
  WebsiteDomain,
  WidgetInstallation,
} from "../../lib/domain/types";
import { PLAN_GRID, PROVIDER_COST_CENTS_PER_MIN } from "../../lib/domain/pricing";

/** Ensemble des données de la fixture (ancien store local). */
export interface Dataset {
  version: number;
  generatedAt: string;
  users: User[];
  organizationUsers: OrganizationUser[];
  organizations: Organization[];
  websiteDomains: WebsiteDomain[];
  avatars: Avatar[];
  receptionists: Receptionist[];
  knowledgeSources: KnowledgeSource[];
  knowledgeDocuments: KnowledgeDocument[];
  widgetInstallations: WidgetInstallation[];
  conversations: Conversation[];
  conversationEvents: ConversationEvent[];
  usageRecords: UsageRecord[];
  providerUsage: ProviderUsage[];
  plans: Plan[];
  subscriptions: Subscription[];
  minuteTopups: MinuteTopup[];
  concurrencyEntitlements: ConcurrencyEntitlement[];
  invoices: Invoice[];
  payments: Payment[];
  visitorRequests: VisitorRequest[];
  supportRequests: SupportRequest[];
  notifications: Notification[];
  auditEvents: AuditEvent[];
  incidents: Incident[];
  providerStatuses: ProviderStatus[];
  settings: PlatformSettings;
}

export const SEED_VERSION = 1;

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;
const iso = (d: Date | number) => new Date(d).toISOString();
const dayKey = (d: Date | number | string) => new Date(d).toISOString().slice(0, 10);

/** Début du mois UTC contenant `d`. */
function monthStart(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonths(d: Date, n: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

interface OrgPlan {
  org: Omit<Organization, "createdAt" | "updatedAt" | "activatedAt"> & { activatedDaysAgo: number | null };
  planId: string | null;
  /** Minutes facturables visées sur la période en cours. */
  currentMinutes: number;
  /** Minutes moyennes par mois sur les mois précédents. */
  pastMinutes: number;
  langs: Lang[];
}

export function buildSeed(now: Date = new Date()): Dataset {
  const r = rng(20261029);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const nowMs = now.getTime();
  const periodStart = monthStart(now);
  const periodEnd = addMonths(periodStart, 1);

  // -------------------------------------------------------------------------
  // Utilisateurs (fictifs)
  // -------------------------------------------------------------------------
  const users: Dataset["users"] = [
    { id: "usr_super", email: "direction@atie.example", fullName: "Direction ATIE (démo)", atieRole: "super_admin", status: "active", lastLoginAt: iso(nowMs - 2 * 3600_000), createdAt: iso(nowMs - 400 * DAY) },
    { id: "usr_admin", email: "admin@atie.example", fullName: "Camille Admin (démo)", atieRole: "atie_admin", status: "active", lastLoginAt: iso(nowMs - 26 * 3600_000), createdAt: iso(nowMs - 300 * DAY) },
    { id: "usr_ops", email: "operations@atie.example", fullName: "Noah Opérateur (démo)", atieRole: "atie_operator", status: "active", lastLoginAt: iso(nowMs - 5 * 3600_000), createdAt: iso(nowMs - 200 * DAY) },
    { id: "usr_lumiere_admin", email: "direction@lumiere.example", fullName: "Dr Claire Morel (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 3 * DAY), createdAt: iso(nowMs - 180 * DAY) },
    { id: "usr_lumiere_view", email: "secretariat@lumiere.example", fullName: "Inès Secrétariat (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 1 * DAY), createdAt: iso(nowMs - 170 * DAY) },
    { id: "usr_chalet_admin", email: "reception@chaletdulac.example", fullName: "Marc Favre (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 8 * 3600_000), createdAt: iso(nowMs - 150 * DAY) },
    { id: "usr_horizon_admin", email: "gerance@horizon.example", fullName: "Sophie Rochat (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 2 * DAY), createdAt: iso(nowMs - 12 * DAY) },
    { id: "usr_alpes_admin", email: "atelier@garagedesalpes.example", fullName: "Luca Bonvin (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 40 * DAY), createdAt: iso(nowMs - 120 * DAY) },
    { id: "usr_moser_admin", email: "kanzlei@moser.example", fullName: "Anna Moser (démo)", atieRole: null, status: "invited", lastLoginAt: null, createdAt: iso(nowMs - 4 * DAY) },
    { id: "usr_rive_admin", email: "bonjour@florale-rive.example", fullName: "Julie Perrin (démo)", atieRole: null, status: "active", lastLoginAt: iso(nowMs - 6 * DAY), createdAt: iso(nowMs - 90 * DAY) },
  ];

  // -------------------------------------------------------------------------
  // Offres : grille validée (lib/domain/pricing.ts).
  // -------------------------------------------------------------------------
  const planDates = { createdAt: iso(nowMs - 365 * DAY), updatedAt: iso(nowMs - 1 * DAY) };
  const plans: Dataset["plans"] = PLAN_GRID.map((p) => ({ id: `pln_${p.code}`, ...p, approval: "confirmed", active: true, ...planDates }));

  // -------------------------------------------------------------------------
  // Entreprises fictives
  // -------------------------------------------------------------------------
  const prefs = { quotaAlerts: true, newRequests: true, monthlyReport: true };
  const orgPlans: OrgPlan[] = [
    {
      org: { id: "org_lumiere", slug: "cabinet-lumiere", name: "Cabinet dentaire Lumière", sector: "Santé — cabinet dentaire", contactName: "Dr Claire Morel", contactEmail: "direction@lumiere.example", phone: "+41 22 000 00 01", address: "Rue de l’Exemple 12", city: "Genève", country: "CH", status: "active", activatedDaysAgo: 175, billingEmail: "compta@lumiere.example", billingAddress: "Rue de l’Exemple 12, 1204 Genève", vatNumber: "CHE-000.000.001 TVA", notificationPrefs: prefs, retentionDays: 90, transcriptsEnabled: false },
      planId: "pln_premium", currentMinutes: 142, pastMinutes: 190, langs: ["fr", "fr", "fr", "en", "de", "it"],
    },
    {
      org: { id: "org_chalet", slug: "chalet-du-lac", name: "Hôtel Chalet du Lac", sector: "Hôtellerie", contactName: "Marc Favre", contactEmail: "reception@chaletdulac.example", phone: "+41 21 000 00 02", address: "Quai Fictif 3", city: "Montreux", country: "CH", status: "active", activatedDaysAgo: 148, billingEmail: "admin@chaletdulac.example", billingAddress: "Quai Fictif 3, 1820 Montreux", vatNumber: "CHE-000.000.002 TVA", notificationPrefs: prefs, retentionDays: 60, transcriptsEnabled: false },
      planId: "pln_premium", currentMinutes: 236, pastMinutes: 228, langs: ["fr", "en", "en", "de", "de", "it"],
    },
    {
      org: { id: "org_horizon", slug: "regie-horizon", name: "Régie Horizon", sector: "Immobilier — gérance", contactName: "Sophie Rochat", contactEmail: "gerance@horizon.example", phone: "+41 21 000 00 03", address: "Avenue Témoin 8", city: "Lausanne", country: "CH", status: "trial", activatedDaysAgo: 11, billingEmail: "gerance@horizon.example", billingAddress: "Avenue Témoin 8, 1003 Lausanne", vatNumber: null, notificationPrefs: prefs, retentionDays: 30, transcriptsEnabled: false },
      planId: "pln_starter", currentMinutes: 6, pastMinutes: 0, langs: ["fr", "fr", "en"],
    },
    {
      org: { id: "org_alpes", slug: "garage-des-alpes", name: "Garage des Alpes", sector: "Automobile — garage", contactName: "Luca Bonvin", contactEmail: "atelier@garagedesalpes.example", phone: "+41 27 000 00 04", address: "Route Modèle 21", city: "Sion", country: "CH", status: "suspended", activatedDaysAgo: 118, billingEmail: "atelier@garagedesalpes.example", billingAddress: "Route Modèle 21, 1950 Sion", vatNumber: null, notificationPrefs: prefs, retentionDays: 30, transcriptsEnabled: false },
      planId: "pln_starter", currentMinutes: 0, pastMinutes: 12, langs: ["fr", "de"],
    },
    {
      org: { id: "org_moser", slug: "etude-moser", name: "Étude Moser & Partner", sector: "Juridique — étude d’avocats", contactName: "Anna Moser", contactEmail: "kanzlei@moser.example", phone: "+41 44 000 00 05", address: "Beispielstrasse 5", city: "Zurich", country: "CH", status: "onboarding", activatedDaysAgo: null, billingEmail: "kanzlei@moser.example", billingAddress: "Beispielstrasse 5, 8001 Zurich", vatNumber: "CHE-000.000.005 MWST", notificationPrefs: prefs, retentionDays: 30, transcriptsEnabled: false },
      planId: null, currentMinutes: 0, pastMinutes: 0, langs: ["de"],
    },
    {
      org: { id: "org_rive", slug: "florale-rive", name: "Boutique Florale Rive", sector: "Commerce — fleuriste", contactName: "Julie Perrin", contactEmail: "bonjour@florale-rive.example", phone: "+41 22 000 00 06", address: "Place Factice 2", city: "Genève", country: "CH", status: "active", activatedDaysAgo: 88, billingEmail: "bonjour@florale-rive.example", billingAddress: "Place Factice 2, 1201 Genève", vatNumber: null, notificationPrefs: { quotaAlerts: true, newRequests: true, monthlyReport: false }, retentionDays: 30, transcriptsEnabled: false },
      planId: "pln_starter", currentMinutes: 9, pastMinutes: 11, langs: ["fr", "fr", "en"],
    },
  ];

  const organizations: Organization[] = orgPlans.map(({ org }) => {
    const { activatedDaysAgo, ...rest } = org;
    const created = nowMs - ((activatedDaysAgo ?? 6) + 10) * DAY;
    return {
      ...rest,
      activatedAt: activatedDaysAgo === null ? null : iso(nowMs - activatedDaysAgo * DAY),
      createdAt: iso(created),
      updatedAt: iso(nowMs - Math.floor(r() * 10) * DAY),

    };
  });

  const organizationUsers: Dataset["organizationUsers"] = [
    ["org_lumiere", "usr_lumiere_admin", "org_admin"],
    ["org_lumiere", "usr_lumiere_view", "org_viewer"],
    ["org_chalet", "usr_chalet_admin", "org_admin"],
    ["org_horizon", "usr_horizon_admin", "org_admin"],
    ["org_alpes", "usr_alpes_admin", "org_admin"],
    ["org_moser", "usr_moser_admin", "org_admin"],
    ["org_rive", "usr_rive_admin", "org_admin"],
  ].map(([organizationId, userId, role], i) => ({
    id: `oru_${i + 1}`,
    organizationId,
    userId,
    role: role as "org_admin" | "org_viewer",
    createdAt: iso(nowMs - 100 * DAY),
  }));

  const websiteDomains: Dataset["websiteDomains"] = [
    ["org_lumiere", "cabinet-lumiere.example", true],
    ["org_lumiere", "www.cabinet-lumiere.example", true],
    ["org_chalet", "chaletdulac.example", true],
    ["org_chalet", "booking.chaletdulac.example", false],
    ["org_horizon", "regie-horizon.example", true],
    ["org_alpes", "garagedesalpes.example", true],
    ["org_moser", "moser-partner.example", false],
    ["org_rive", "florale-rive.example", true],
  ].map(([organizationId, domain, verified], i) => ({
    id: `dom_${i + 1}`,
    organizationId: organizationId as string,
    domain: domain as string,
    verified: verified as boolean,
    verifiedAt: verified ? iso(nowMs - (60 - i) * DAY) : null,
    createdAt: iso(nowMs - (70 - i) * DAY),
  }));

  // -------------------------------------------------------------------------
  // Avatars existants (LemonSlice) — références seulement, aucun appel.
  // -------------------------------------------------------------------------
  const avatars: Dataset["avatars"] = [
    { id: "avt_lea", name: "Léa", provider: "lemonslice", providerAvatarId: "agent_ee494dab89f98682", portraitUrl: "/presence/lea.jpg", createdAt: iso(nowMs - 200 * DAY) },
    { id: "avt_maya", name: "Maya", provider: "lemonslice", providerAvatarId: "agent_fd6544c9c1935c9e", portraitUrl: "/presence/maya.jpg", createdAt: iso(nowMs - 190 * DAY) },
  ];

  const baseRcp = {
    voice: "Voix féminine douce (démo)",
    primaryLang: "fr" as Lang,
    secondaryLangs: ["de", "it", "en"] as Lang[],
    fallbackReply: "Je n’ai pas cette information. Souhaitez-vous laisser un message à l’équipe ?",
    afterHoursBehavior: "message" as const,
    maxConversationSeconds: 180,
  };
  const receptionists: Receptionist[] = [
    {
      ...baseRcp, id: "rcp_lea_lumiere", organizationId: "org_lumiere", avatarId: "avt_lea", name: "Léa", role: "Réceptionniste de cabinet dentaire",
      tone: "Chaleureuse et rassurante, phrases courtes.",
      businessInstructions: "Renseigner les horaires, orienter les premiers rendez-vous et les urgences, puis passer la main au secrétariat. Ne jamais donner d’avis médical.",
      greeting: "Bonjour, je suis Léa, la réceptionniste du Cabinet dentaire Lumière. Comment puis-je vous aider ?",
      allowedServices: ["Horaires", "Premier rendez-vous", "Urgences", "Accès et parking"],
      status: "live", lastActivityAt: iso(nowMs - 40 * 60_000), createdAt: iso(nowMs - 176 * DAY), updatedAt: iso(nowMs - 9 * DAY),
    },
    {
      ...baseRcp, id: "rcp_maya_chalet", organizationId: "org_chalet", avatarId: "avt_maya", name: "Maya", role: "Réceptionniste d’hôtel",
      voice: "Voix féminine claire (démo)",
      tone: "Courtoise et enjouée, sens de l’accueil.",
      businessInstructions: "Informer sur l’arrivée, le petit-déjeuner et les activités autour du lac. Les réservations sont redirigées vers le moteur de réservation.",
      greeting: "Bienvenue à l’Hôtel Chalet du Lac ! Je suis Maya. Que puis-je faire pour vous ?",
      allowedServices: ["Arrivée et départ", "Petit-déjeuner", "Activités", "Accès"],
      afterHoursBehavior: "inform_hours", maxConversationSeconds: 240,
      status: "live", lastActivityAt: iso(nowMs - 6 * 60_000), createdAt: iso(nowMs - 149 * DAY), updatedAt: iso(nowMs - 3 * DAY),
    },
    {
      ...baseRcp, id: "rcp_lea_horizon", organizationId: "org_horizon", avatarId: "avt_lea", name: "Léa", role: "Réceptionniste de gérance (essai)",
      tone: "Professionnelle et claire.",
      businessInstructions: "Renseigner sur les visites, les dossiers de candidature et les contacts de la gérance.",
      greeting: "Bonjour, je suis Léa, de la Régie Horizon. Que puis-je pour vous ?",
      secondaryLangs: ["en"], allowedServices: ["Visites", "Dossier de candidature", "Contacts"],
      status: "live", lastActivityAt: iso(nowMs - 1 * DAY), createdAt: iso(nowMs - 11 * DAY), updatedAt: iso(nowMs - 11 * DAY),
    },
    {
      ...baseRcp, id: "rcp_maya_alpes", organizationId: "org_alpes", avatarId: "avt_maya", name: "Maya", role: "Réceptionniste de garage",
      tone: "Directe et serviable.",
      businessInstructions: "Horaires d’atelier, prise de rendez-vous pour service et pneus, devis sur demande.",
      greeting: "Bonjour, ici Maya du Garage des Alpes. Comment puis-je vous aider ?",
      secondaryLangs: ["de"], allowedServices: ["Horaires", "Rendez-vous atelier", "Devis"],
      status: "paused", lastActivityAt: iso(nowMs - 38 * DAY), createdAt: iso(nowMs - 118 * DAY), updatedAt: iso(nowMs - 30 * DAY),
    },
    {
      ...baseRcp, id: "rcp_lea_rive", organizationId: "org_rive", avatarId: "avt_lea", name: "Léa", role: "Réceptionniste de boutique",
      tone: "Souriante et créative.",
      businessInstructions: "Horaires, commandes de bouquets, livraisons à Genève. Les commandes sont transmises par message.",
      greeting: "Bonjour, je suis Léa de la Boutique Florale Rive. Une envie de fleurs ?",
      secondaryLangs: ["en"], allowedServices: ["Horaires", "Commandes", "Livraisons"],
      status: "live", lastActivityAt: iso(nowMs - 2 * DAY), createdAt: iso(nowMs - 88 * DAY), updatedAt: iso(nowMs - 20 * DAY),
    },
    {
      ...baseRcp, id: "rcp_draft_moser", organizationId: "org_moser", avatarId: "avt_maya", name: "Maya", role: "Réceptionniste d’étude (brouillon)",
      primaryLang: "de", secondaryLangs: ["fr", "en"],
      tone: "Sobre et précise.",
      businessInstructions: "À compléter avec l’étude : domaines d’activité, prise de contact, documents à préparer.",
      greeting: "Guten Tag, ich bin Maya von der Kanzlei Moser & Partner.",
      allowedServices: [], status: "draft", lastActivityAt: null, createdAt: iso(nowMs - 3 * DAY), updatedAt: iso(nowMs - 3 * DAY),
    },
  ];

  // -------------------------------------------------------------------------
  // Knowledge Base
  // -------------------------------------------------------------------------
  const kb: Array<[string, "text" | "url" | "pdf" | "docx", string, string, string, string]> = [
    ["org_lumiere", "text", "Horaires du cabinet", "Horaires", "Saisie manuelle", "Lundi à vendredi : 8 h – 18 h. Samedi : 9 h – 12 h (urgences). Fermé le dimanche."],
    ["org_lumiere", "text", "Procédure urgences", "Urgences", "Saisie manuelle", "En cas d’urgence pendant les heures d’ouverture, appeler le secrétariat. Hors horaires : service de garde cantonal (numéro fictif)."],
    ["org_lumiere", "url", "Page Soins", "Prestations", "https://cabinet-lumiere.example/soins", "Contenu de démonstration : aucune page n’a été récupérée."],
    ["org_lumiere", "pdf", "Tarifs indicatifs 2026.pdf", "Tarifs", "tarifs-2026.pdf", "Document de démonstration : aucun fichier réel."],
    ["org_chalet", "text", "Arrivée et départ", "Séjour", "Saisie manuelle", "Arrivée dès 15 h, départ jusqu’à 11 h. Bagagerie disponible."],
    ["org_chalet", "text", "Petit-déjeuner", "Restauration", "Saisie manuelle", "Servi de 7 h à 10 h 30 en salle panoramique."],
    ["org_chalet", "docx", "Activités autour du lac.docx", "Activités", "activites-lac.docx", "Document de démonstration : aucun fichier réel."],
    ["org_chalet", "url", "Plan d’accès", "Accès", "https://chaletdulac.example/acces", "Contenu de démonstration : aucune page n’a été récupérée."],
    ["org_horizon", "text", "Visites d’appartements", "Location", "Saisie manuelle", "Les visites se réservent par téléphone ou formulaire, du lundi au vendredi."],
    ["org_alpes", "text", "Horaires atelier", "Horaires", "Saisie manuelle", "Lundi à vendredi : 7 h 30 – 12 h, 13 h 30 – 18 h."],
    ["org_rive", "text", "Livraisons", "Commandes", "Saisie manuelle", "Livraison à Genève du mardi au samedi, commande la veille avant 17 h."],
  ];
  const statuses = ["pending", "pending", "pending", "failed"] as const;
  const knowledgeSources: Dataset["knowledgeSources"] = [];
  const knowledgeDocuments: Dataset["knowledgeDocuments"] = [];
  kb.forEach(([organizationId, kind, title, category, origin, content], i) => {
    const id = `kbs_${i + 1}`;
    const versions = 1 + (i % 3 === 0 ? 1 : 0);
    const updatedAt = iso(nowMs - (i * 3 + 2) * DAY);
    knowledgeSources.push({
      id, organizationId, kind, title, category, origin,
      indexStatus: kind === "text" ? "pending" : statuses[i % statuses.length],
      currentVersion: versions, createdAt: iso(nowMs - (i * 3 + 30) * DAY), updatedAt, updatedBy: "usr_admin",
    });
    for (let v = 1; v <= versions; v++) {
      const text = v === versions ? content : `${content} (version précédente)`;
      knowledgeDocuments.push({
        id: `kbd_${i + 1}_${v}`, sourceId: id, organizationId, version: v, content: text,
        sizeBytes: text.length, createdAt: v === versions ? updatedAt : iso(nowMs - (i * 3 + 25) * DAY), createdBy: "usr_admin",
      });
    }
  });

  // -------------------------------------------------------------------------
  // Widget
  // -------------------------------------------------------------------------
  const widgetInstallations: Dataset["widgetInstallations"] = [
    ["org_lumiere", "rcp_lea_lumiere", "installed", "wordpress"],
    ["org_chalet", "rcp_maya_chalet", "installed", "generic"],
    ["org_horizon", "rcp_lea_horizon", "ready", "wordpress"],
    ["org_alpes", "rcp_maya_alpes", "disabled", "generic"],
    ["org_moser", null, "not_configured", "generic"],
    ["org_rive", "rcp_lea_rive", "installed", "wordpress"],
  ].map(([organizationId, receptionistId, status, platform], i) => ({
    id: `wdg_${i + 1}`,
    organizationId: organizationId as string,
    receptionistId: receptionistId as string | null,
    publicKey: `pk_demo_${(organizationId as string).slice(4)}`,
    position: "right" as const,
    accent: "#E31E24",
    status: status as "installed",
    platform: platform as "generic",
    lastSeenAt: status === "installed" ? iso(nowMs - (i + 1) * 3600_000) : null,
    createdAt: iso(nowMs - (100 - i * 10) * DAY),
  }));

  // -------------------------------------------------------------------------
  // Conversations : générées jusqu'aux minutes visées par période.
  // -------------------------------------------------------------------------
  const conversations: Conversation[] = [];
  const conversationEvents: ConversationEvent[] = [];
  let convSeq = 0;
  const rcpByOrg = new Map(receptionists.map((x) => [x.organizationId, x]));

  const pushConversation = (organizationId: string, start: number, seconds: number, lang: Lang, status: SessionStatus, endReason: EndReason, error: string | null = null) => {
    const rcp = rcpByOrg.get(organizationId)!;
    convSeq++;
    const id = `cnv_${String(convSeq).padStart(5, "0")}`;
    const ended = status === "ended" || status === "failed" || status === "close_unconfirmed";
    const billable = status === "failed" ? 0 : seconds;
    conversations.push({
      id, organizationId, receptionistId: rcp.id, backendSessionId: `demo-${id}`,
      startedAt: iso(start), endedAt: ended ? iso(start + seconds * 1000) : null,
      durationSeconds: seconds, lang, status, endReason, billableSeconds: billable,
      // Coût fournisseur : estimation (PROVIDER_COST_CENTS_PER_MIN), jamais une mesure.
      providerCostCents: Math.round((billable / 60) * PROVIDER_COST_CENTS_PER_MIN), providerCostOrigin: "estimated",
      error, transcriptAvailable: false,
    });
    const ev = (type: ConversationEvent["type"], at: number, detail: string) =>
      conversationEvents.push({ id: `cev_${conversationEvents.length + 1}`, conversationId: id, organizationId, at: iso(at), type, detail });
    ev("reserved", start - 1500, "Place réservée (bail atomique)");
    ev("token_issued", start - 900, "Jeton LiveKit court émis");
    if (status !== "failed") ev("connected", start, "Agent et avatar connectés");
    if (status === "failed") ev("error", start, error ?? "Échec de connexion");
    if (ended && status !== "failed") ev("ended", start + seconds * 1000, `Fin : ${endReason ?? "—"}`);
    if (status === "ended") ev("room_closed", start + seconds * 1000 + 800, "Salle LiveKit fermée, avatar libéré");
    if (status === "close_unconfirmed") ev("heartbeat_lost", start + seconds * 1000, "Fermeture non confirmée par le fournisseur");
  };

  const fill = (op: OrgPlan, from: number, to: number, targetMinutes: number) => {
    let used = 0;
    const span = to - from;
    let guard = 0;
    while (used < targetMinutes * 60 && guard++ < 2000) {
      const max = (rcpByOrg.get(op.org.id)?.maxConversationSeconds ?? 180);
      const seconds = Math.min(max, 25 + Math.floor(r() * (max - 25)));
      const start = from + Math.floor(r() * span);
      const roll = r();
      let status: SessionStatus = "ended";
      let reason: EndReason = roll < 0.62 ? "visitor_end" : roll < 0.9 ? "time_up" : "disconnected";
      let err: string | null = null;
      if (roll > 0.975) { status = "failed"; reason = "error"; err = pick(["Délai de connexion dépassé", "Avatar indisponible (fournisseur)", "Micro refusé après réservation"]); }
      pushConversation(op.org.id, start, seconds, pick(op.langs), status, reason, err);
      if (status !== "failed") used += seconds;
    }
  };

  for (const op of orgPlans) {
    if (!rcpByOrg.get(op.org.id) || op.org.activatedDaysAgo === null) continue;
    const activated = nowMs - op.org.activatedDaysAgo * DAY;
    // Trois mois précédents
    for (let m = 3; m >= 1; m--) {
      const ps = addMonths(periodStart, -m).getTime();
      const pe = addMonths(periodStart, -m + 1).getTime();
      const from = Math.max(ps, activated);
      if (from >= pe || op.pastMinutes === 0) continue;
      const share = (pe - from) / (pe - ps);
      fill(op, from, pe, Math.round(op.pastMinutes * share * (0.85 + r() * 0.3)));
    }
    if (op.org.status === "suspended") continue;
    // Période en cours, jusqu'à maintenant (moins une heure, pour ne pas chevaucher les sessions actives)
    fill(op, Math.max(periodStart.getTime(), activated), nowMs - 3600_000, op.currentMinutes);
  }

  // Cas particuliers lisibles dans les écrans
  pushConversation("org_rive", nowMs - 2 * DAY - 3 * 3600_000, 47, "fr", "ended", "disconnected", "Connexion interrompue côté visiteur");
  pushConversation("org_lumiere", nowMs - 5 * 3600_000, 95, "fr", "close_unconfirmed", "lease_expired", "Fermeture de la salle non confirmée");
  pushConversation("org_chalet", nowMs - 26 * 3600_000, 0, "de", "failed", "error", "Avatar indisponible (fournisseur)");
  // Sessions actuellement actives (démo)
  const active = (organizationId: string, ago: number, lang: Lang, status: SessionStatus) => {
    pushConversation(organizationId, nowMs - ago * 1000, ago, lang, status, null);
  };
  active("org_chalet", 72, "en", "active");
  active("org_lumiere", 31, "fr", "active");
  active("org_chalet", 4, "de", "connecting");

  conversations.sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  // Agrégats quotidiens dérivés des conversations (même source).
  const usageMap = new Map<string, UsageRecord>();
  for (const c of conversations) {
    if (c.status === "active" || c.status === "connecting") continue;
    const key = `${c.organizationId}|${dayKey(c.startedAt)}`;
    const u = usageMap.get(key) ?? { id: `use_${usageMap.size + 1}`, organizationId: c.organizationId, day: dayKey(c.startedAt), sessions: 0, billableSeconds: 0, origin: "estimated" as const };
    u.sessions++;
    u.billableSeconds += c.billableSeconds;
    usageMap.set(key, u);
  }
  const usageRecords = [...usageMap.values()].sort((a, b) => a.day.localeCompare(b.day));

  // -------------------------------------------------------------------------
  // Fournisseurs : aucune donnée réelle disponible.
  // -------------------------------------------------------------------------
  const providerUsage: Dataset["providerUsage"] = [
    { id: "pvu_livekit", provider: "livekit", periodStart: iso(periodStart), periodEnd: iso(periodEnd), minutesUsed: null, minutesAvailable: null, costCents: null, origin: "estimated" },
    { id: "pvu_lemonslice", provider: "lemonslice", periodStart: iso(periodStart), periodEnd: iso(periodEnd), minutesUsed: null, minutesAvailable: null, costCents: null, origin: "estimated" },
    { id: "pvu_inference", provider: "livekit_inference", periodStart: iso(periodStart), periodEnd: iso(periodEnd), minutesUsed: null, minutesAvailable: null, costCents: null, origin: "estimated" },
  ];

  // -------------------------------------------------------------------------
  // Abonnements, recharges, factures (fictives, préfixe DEMO-)
  // -------------------------------------------------------------------------
  const subscriptions: Dataset["subscriptions"] = orgPlans
    .filter((op) => op.planId && op.org.activatedDaysAgo !== null)
    .map((op, i) => ({
      id: `sub_${i + 1}`,
      organizationId: op.org.id,
      planId: op.planId!,
      status: op.org.status === "trial" ? "trialing" : op.org.status === "suspended" ? "suspended" : "active",
      activatedAt: iso(nowMs - op.org.activatedDaysAgo! * DAY),
      currentPeriodStart: iso(periodStart),
      currentPeriodEnd: iso(periodEnd),
      autoRenew: op.org.status !== "suspended",
      alertThresholdPct: 80,
      createdAt: iso(nowMs - op.org.activatedDaysAgo! * DAY),
      updatedAt: iso(nowMs - 5 * DAY),
    }));

  const minuteTopups: Dataset["minuteTopups"] = [
    { id: "top_1", organizationId: "org_chalet", minutes: 30, priceCents: 1900, status: "pending", requestedAt: iso(nowMs - 1 * DAY), appliedAt: null, requestedBy: "usr_chalet_admin" },
    { id: "top_2", organizationId: "org_lumiere", minutes: 30, priceCents: 1900, status: "applied", requestedAt: iso(nowMs - 40 * DAY), appliedAt: iso(nowMs - 39 * DAY), requestedBy: "usr_lumiere_admin" },
  ];
  const concurrencyEntitlements: Dataset["concurrencyEntitlements"] = [
    { id: "cce_1", organizationId: "org_chalet", extraSessions: 1, monthlyPriceCents: 1990, status: "requested", startsAt: iso(periodEnd) },
  ];

  const invoices: Dataset["invoices"] = [];
  const payments: Dataset["payments"] = [];
  let invSeq = 0;
  for (const s of subscriptions) {
    const plan = plans.find((p) => p.id === s.planId)!;
    for (let m = 3; m >= 0; m--) {
      const issued = addMonths(periodStart, -m);
      if (issued.getTime() < new Date(s.activatedAt).getTime() - 31 * DAY) continue;
      if (s.status === "trialing") continue;
      invSeq++;
      const id = `inv_${invSeq}`;
      const due = issued.getTime() + 30 * DAY;
      let status: Dataset["invoices"][number]["status"] = due < nowMs ? "paid" : "open";
      if (s.organizationId === "org_alpes" && m <= 1) status = "overdue";
      if (s.organizationId === "org_alpes" && m === 0) status = "overdue";
      invoices.push({
        id, organizationId: s.organizationId, number: `DEMO-${issued.getUTCFullYear()}-${String(invSeq).padStart(4, "0")}`,
        issuedAt: iso(issued), dueAt: iso(due), status, kind: "invoice",
        lines: [{ label: `Abonnement ${plan.name} — ${issued.toISOString().slice(0, 7)}`, quantity: 1, unitPriceCents: plan.monthlyPriceCents }],
        totalCents: plan.monthlyPriceCents,
      });
      if (status === "paid") payments.push({ id: `pay_${payments.length + 1}`, invoiceId: id, organizationId: s.organizationId, amountCents: plan.monthlyPriceCents, method: "bank_transfer", status: "recorded", at: iso(due - 12 * DAY) });
    }
  }
  invoices.push({
    id: "inv_credit_1", organizationId: "org_lumiere", number: `DEMO-AV-${now.getUTCFullYear()}-0001`, issuedAt: iso(nowMs - 25 * DAY), dueAt: iso(nowMs - 25 * DAY),
    status: "credited", kind: "credit_note", lines: [{ label: "Avoir — interruption de service (démo)", quantity: 1, unitPriceCents: -1000 }], totalCents: -1000,
  });
  invoices.push({
    id: "inv_topup_1", organizationId: "org_lumiere", number: `DEMO-${now.getUTCFullYear()}-R001`, issuedAt: iso(nowMs - 39 * DAY), dueAt: iso(nowMs - 9 * DAY),
    status: "paid", kind: "invoice", lines: [{ label: "Recharge 30 minutes", quantity: 1, unitPriceCents: 1900 }], totalCents: 1900,
  });
  payments.push({ id: `pay_${payments.length + 1}`, invoiceId: "inv_topup_1", organizationId: "org_lumiere", amountCents: 1900, method: "card", status: "recorded", at: iso(nowMs - 30 * DAY) });

  // -------------------------------------------------------------------------
  // Demandes visiteurs (résumés fictifs, pas de transcription)
  // -------------------------------------------------------------------------
  const vr: Array<[string, Dataset["visitorRequests"][number]["kind"], string, string, Lang, Dataset["visitorRequests"][number]["status"], number]> = [
    ["org_lumiere", "appointment", "Visiteur A. (démo)", "Souhaite un premier rendez-vous de contrôle, de préférence le matin.", "fr", "new", 0.2],
    ["org_lumiere", "message", "Visiteur B. (démo)", "Demande si le cabinet accepte les nouveaux patients.", "fr", "in_progress", 1.4],
    ["org_lumiere", "contact", "Visitor C. (demo)", "Asks to be called back about an emergency appointment.", "en", "done", 3.1],
    ["org_chalet", "quote", "Gast D. (Demo)", "Anfrage für ein Familienzimmer, 3 Nächte im Juli.", "de", "new", 0.1],
    ["org_chalet", "message", "Guest E. (demo)", "Late check-in around 23:00 — is the reception open?", "en", "new", 0.6],
    ["org_chalet", "contact", "Visiteur F. (démo)", "Souhaite organiser un repas d’anniversaire pour 12 personnes.", "fr", "in_progress", 2.2],
    ["org_horizon", "appointment", "Visiteur G. (démo)", "Visite de l’appartement 3,5 pièces, rue Témoin.", "fr", "new", 0.9],
    ["org_rive", "quote", "Visiteur H. (démo)", "Devis pour la décoration florale d’un mariage.", "fr", "new", 1.8],
    ["org_rive", "message", "Visiteur I. (démo)", "Livraison possible samedi à Carouge ?", "fr", "done", 6],
  ];
  const visitorRequests: Dataset["visitorRequests"] = vr.map(([organizationId, kind, visitorName, summary, lang, status, daysAgo], i) => ({
    id: `vrq_${i + 1}`, organizationId, conversationId: conversations.find((c) => c.organizationId === organizationId && c.status === "ended")?.id ?? null,
    kind, visitorName, visitorContact: `visiteur${i + 1}@exemple.invalid`, summary, lang, status, createdAt: iso(nowMs - daysAgo * DAY),
  }));

  const supportRequests: Dataset["supportRequests"] = [
    { id: "sup_1", organizationId: "org_chalet", kind: "minutes", subject: "Minutes presque épuisées", message: "Nous approchons de la limite mensuelle avant le week-end. Est-il possible d’ajouter des minutes ?", status: "open", createdAt: iso(nowMs - 1 * DAY), updatedAt: iso(nowMs - 1 * DAY), createdBy: "usr_chalet_admin" },
    { id: "sup_2", organizationId: "org_lumiere", kind: "change_request", subject: "Modifier la salutation de Léa", message: "Merci d’ajouter que le cabinet est accessible en fauteuil roulant.", status: "in_progress", createdAt: iso(nowMs - 4 * DAY), updatedAt: iso(nowMs - 2 * DAY), createdBy: "usr_lumiere_admin" },
    { id: "sup_3", organizationId: "org_rive", kind: "issue", subject: "La bulle masque le bouton panier sur mobile", message: "Sur iPhone, la bulle recouvre le bouton du panier.", status: "resolved", createdAt: iso(nowMs - 15 * DAY), updatedAt: iso(nowMs - 12 * DAY), createdBy: "usr_rive_admin" },
  ];

  const notifications: Dataset["notifications"] = [
    { id: "ntf_1", organizationId: "org_chalet", level: "warning", title: "Quota à 94 %", body: "Hôtel Chalet du Lac a utilisé 94 % de ses minutes incluses.", createdAt: iso(nowMs - 10 * 3600_000), readAt: null },
    { id: "ntf_2", organizationId: "org_alpes", level: "critical", title: "Facture impayée (démo)", body: "Garage des Alpes : service suspendu après échéance dépassée.", createdAt: iso(nowMs - 9 * DAY), readAt: null },
    { id: "ntf_3", organizationId: null, level: "info", title: "Nouvelle entreprise en configuration", body: "Étude Moser & Partner attend sa réceptionniste.", createdAt: iso(nowMs - 3 * DAY), readAt: iso(nowMs - 2 * DAY) },
    { id: "ntf_4", organizationId: "org_lumiere", level: "info", title: "Nouvelle demande de rendez-vous", body: "Une demande a été laissée à Léa.", createdAt: iso(nowMs - 5 * 3600_000), readAt: null },
  ];

  const auditEvents: Dataset["auditEvents"] = [
    ["org_alpes", "usr_admin", "organization.suspend", "Garage des Alpes", "Suspension après facture échue (démo)", 9],
    ["org_moser", "usr_admin", "organization.create", "Étude Moser & Partner", "Création de l’entreprise", 4],
    ["org_moser", "usr_ops", "receptionist.create", "Maya (brouillon)", "Réceptionniste en brouillon", 3],
    ["org_chalet", "usr_ops", "receptionist.update", "Maya", "Durée maximale portée à 4 min", 3],
    ["org_lumiere", "usr_ops", "knowledge.update", "Horaires du cabinet", "Version 2", 2],
    [null, "usr_super", "plan.update", "Premium", "Grille validée : CHF 89 / 150 min", 1],
  ].map(([organizationId, actorId, action, target, detail, d], i) => ({
    id: `aud_${i + 1}`, organizationId: organizationId as string | null, actorId: actorId as string, action: action as string,
    target: target as string, detail: detail as string, at: iso(nowMs - (d as number) * DAY - i * 3600_000),
  }));

  const incidents: Dataset["incidents"] = [
    { id: "inc_1", service: "lemonslice", severity: "minor", title: "Avatar indisponible ponctuellement (démo)", status: "monitoring", startedAt: iso(nowMs - 26 * 3600_000), resolvedAt: null },
    { id: "inc_2", service: "api", severity: "minor", title: "Fermeture de salle non confirmée (démo)", status: "open", startedAt: iso(nowMs - 5 * 3600_000), resolvedAt: null },
    { id: "inc_3", service: "widget", severity: "minor", title: "Bulle masquant un bouton sur mobile (démo)", status: "resolved", startedAt: iso(nowMs - 15 * DAY), resolvedAt: iso(nowMs - 12 * DAY) },
  ];

  const providerStatuses: Dataset["providerStatuses"] = [
    { id: "prv_api", provider: "atie_api", label: "API ATIE Presence (Python)", configured: false, keyHint: null, connection: "not_connected", note: "Console non connectée : définir ATIE_API_URL côté serveur." },
    { id: "prv_livekit", provider: "livekit", label: "LiveKit Cloud", configured: false, keyHint: null, connection: "not_connected", note: "Géré par le backend Python. Aucune clé dans la console." },
    { id: "prv_lemonslice", provider: "lemonslice", label: "LemonSlice", configured: false, keyHint: null, connection: "not_connected", note: "Géré par le backend Python. Aucune clé dans la console." },
    { id: "prv_inference", provider: "livekit_inference", label: "LiveKit Inference (STT, LLM, TTS)", configured: false, keyHint: null, connection: "not_connected", note: "Géré par l’agent Python." },
    { id: "prv_payment", provider: "payment", label: "Prestataire de paiement", configured: false, keyHint: null, connection: "not_connected", note: "Aucun prestataire choisi. Paiements désactivés." },
  ];

  return {
    version: SEED_VERSION,
    generatedAt: iso(now),
    users, organizationUsers, organizations, websiteDomains, avatars, receptionists,
    knowledgeSources, knowledgeDocuments, widgetInstallations,
    conversations, conversationEvents, usageRecords, providerUsage,
    plans, subscriptions, minuteTopups, concurrencyEntitlements, invoices, payments,
    visitorRequests, supportRequests, notifications, auditEvents, incidents, providerStatuses,
    settings: {
      platformName: "ATIE Presence",
      defaultLang: "fr",
      enabledLangs: ["fr", "de", "it", "en"],
      defaultMaxConversationSeconds: 180,
      defaultRetentionDays: 30,
      quotaAlertPct: 80,
      sessionTimeoutMinutes: 30,
      require2fa: true,
      notifyEmail: "alertes@atie.example",
    },
  };
}
