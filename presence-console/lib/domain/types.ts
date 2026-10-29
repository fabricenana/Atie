/**
 * Modèle de domaine ATIE Presence (console).
 *
 * Miroir TypeScript du schéma PostgreSQL cible (db/schema.sql).
 * Conventions :
 *  - identifiants : chaînes préfixées (org_, usr_, rcp_…), UUID en production ;
 *  - dates : ISO 8601 UTC ;
 *  - montants : centimes de CHF (entiers) pour éviter les erreurs d'arrondi ;
 *  - durées : secondes (entiers). Les minutes facturables sont dérivées.
 *
 * Source de vérité : le backend Python Phase 2 reste l'autorité pour les sessions,
 * les quotas, les durées et la consommation. La console ne fait qu'afficher ces
 * valeurs (ou des valeurs de démonstration clairement marquées).
 */

export type ID = string;
export type ISODate = string;
export type Cents = number;
export type Lang = "fr" | "de" | "it" | "en";
export const LANGS: Lang[] = ["fr", "de", "it", "en"];

/** Provenance d'une valeur affichée : jamais d'estimation présentée comme une mesure. */
export type DataOrigin = "demo" | "measured" | "estimated";

// ---------------------------------------------------------------------------
// Utilisateurs et rôles
// ---------------------------------------------------------------------------

export type AtieRole = "super_admin" | "atie_admin" | "atie_operator";
export type OrgRole = "org_admin" | "org_viewer";
export type Role = AtieRole | OrgRole;

export interface User {
  id: ID;
  email: string;
  fullName: string;
  /** Rôle interne ATIE, absent pour un utilisateur client. */
  atieRole: AtieRole | null;
  status: "active" | "invited" | "disabled";
  lastLoginAt: ISODate | null;
  createdAt: ISODate;
  demo: true;
}

export interface OrganizationUser {
  id: ID;
  organizationId: ID;
  userId: ID;
  role: OrgRole;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Entreprises
// ---------------------------------------------------------------------------

export type OrgStatus = "active" | "trial" | "suspended" | "onboarding";

export interface Organization {
  id: ID;
  /** Identifiant public utilisé par le widget et le backend (config/tenants.json : tenant_id). */
  slug: string;
  name: string;
  sector: string;
  contactName: string;
  contactEmail: string;
  phone: string;
  address: string;
  city: string;
  country: "CH";
  status: OrgStatus;
  activatedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
  billingEmail: string;
  billingAddress: string;
  vatNumber: string | null;
  notificationPrefs: { quotaAlerts: boolean; newRequests: boolean; monthlyReport: boolean };
  /** Durée de conservation des demandes visiteurs (jours). */
  retentionDays: number;
  /** Conservation des transcriptions : désactivée par défaut. */
  transcriptsEnabled: boolean;
  demo: true;
}

export interface WebsiteDomain {
  id: ID;
  organizationId: ID;
  domain: string;
  verified: boolean;
  verifiedAt: ISODate | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Réceptionnistes et avatars
// ---------------------------------------------------------------------------

export interface Avatar {
  id: ID;
  name: string;
  provider: "lemonslice";
  /** Identifiant d'agent côté LemonSlice (référence seulement, aucun appel). */
  providerAvatarId: string;
  /** Portrait autorisé, servi par la console (copie des visuels du site ATIE). */
  portraitUrl: string | null;
  createdAt: ISODate;
}

export type ReceptionistStatus = "draft" | "configured" | "live" | "paused";

export interface Receptionist {
  id: ID;
  organizationId: ID | null;
  avatarId: ID;
  name: string;
  role: string;
  voice: string;
  primaryLang: Lang;
  secondaryLangs: Lang[];
  tone: string;
  businessInstructions: string;
  greeting: string;
  fallbackReply: string;
  afterHoursBehavior: "message" | "inform_hours" | "redirect_contact";
  maxConversationSeconds: number;
  allowedServices: string[];
  status: ReceptionistStatus;
  lastActivityAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

// ---------------------------------------------------------------------------
// Knowledge Base (isolée par entreprise)
// ---------------------------------------------------------------------------

export type KnowledgeKind = "text" | "url" | "pdf" | "docx";
/** "demo_not_indexed" : aucun moteur d'indexation n'est branché. */
export type IndexStatus = "demo_not_indexed" | "pending" | "indexing" | "indexed" | "failed";

export interface KnowledgeSource {
  id: ID;
  organizationId: ID;
  kind: KnowledgeKind;
  title: string;
  category: string;
  /** URL d'origine, nom de fichier ou « Saisie manuelle ». */
  origin: string;
  indexStatus: IndexStatus;
  currentVersion: number;
  createdAt: ISODate;
  updatedAt: ISODate;
  updatedBy: ID;
}

export interface KnowledgeDocument {
  id: ID;
  sourceId: ID;
  organizationId: ID;
  version: number;
  content: string;
  sizeBytes: number;
  createdAt: ISODate;
  createdBy: ID;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export interface WidgetInstallation {
  id: ID;
  organizationId: ID;
  receptionistId: ID | null;
  /** Identifiant public (non secret) inscrit dans le script d'intégration. */
  publicKey: string;
  position: "right" | "left";
  accent: string;
  status: "not_configured" | "ready" | "installed" | "disabled";
  platform: "generic" | "wordpress";
  lastSeenAt: ISODate | null;
  createdAt: ISODate;
}

// ---------------------------------------------------------------------------
// Conversations, sessions et consommation
// ---------------------------------------------------------------------------

export type SessionStatus =
  | "pending"
  | "connecting"
  | "active"
  | "terminating"
  | "ended"
  | "failed"
  | "close_unconfirmed";

export type EndReason =
  | "visitor_end"
  | "time_up"
  | "quota_exhausted"
  | "disconnected"
  | "lease_expired"
  | "error"
  | null;

export interface Conversation {
  id: ID;
  organizationId: ID;
  receptionistId: ID;
  /** session_id renvoyé par l'API Python (POST /session). */
  backendSessionId: string;
  startedAt: ISODate;
  endedAt: ISODate | null;
  durationSeconds: number;
  lang: Lang;
  status: SessionStatus;
  endReason: EndReason;
  billableSeconds: number;
  providerCostCents: Cents;
  providerCostOrigin: DataOrigin;
  error: string | null;
  /** Transcription conservée uniquement si l'entreprise l'a activée. Jamais générée en démo. */
  transcriptAvailable: false;
}

export interface ConversationEvent {
  id: ID;
  conversationId: ID;
  organizationId: ID;
  at: ISODate;
  type: "reserved" | "token_issued" | "connected" | "heartbeat_lost" | "ended" | "room_closed" | "error";
  detail: string;
}

export interface UsageRecord {
  id: ID;
  organizationId: ID;
  /** Jour (AAAA-MM-JJ). Agrégat quotidien fourni par le backend. */
  day: string;
  sessions: number;
  billableSeconds: number;
  origin: DataOrigin;
}

export interface ProviderUsage {
  id: ID;
  provider: "livekit" | "lemonslice" | "livekit_inference";
  periodStart: ISODate;
  periodEnd: ISODate;
  /** Minutes consommées auprès du fournisseur (null si aucune donnée réelle). */
  minutesUsed: number | null;
  /** Minutes disponibles dans le pool (null si aucune donnée réelle). */
  minutesAvailable: number | null;
  costCents: Cents | null;
  origin: DataOrigin;
}

// ---------------------------------------------------------------------------
// Offres, abonnements et facturation
// ---------------------------------------------------------------------------

export interface Plan {
  id: ID;
  code: string;
  name: string;
  monthlyPriceCents: Cents;
  includedMinutes: number;
  concurrentSessions: number;
  /** "confirmed" : tarif validé ; "hypothesis" : à valider ; "draft" : interne. */
  approval: "confirmed" | "hypothesis" | "draft";
  active: boolean;
  description: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type SubscriptionStatus = "trialing" | "active" | "past_due" | "suspended" | "canceled";

export interface Subscription {
  id: ID;
  organizationId: ID;
  planId: ID;
  status: SubscriptionStatus;
  activatedAt: ISODate;
  currentPeriodStart: ISODate;
  currentPeriodEnd: ISODate;
  autoRenew: boolean;
  /** Seuil d'alerte (pourcentage des minutes incluses). */
  alertThresholdPct: number;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface MinuteTopup {
  id: ID;
  organizationId: ID;
  minutes: number;
  priceCents: Cents;
  status: "requested" | "pending" | "applied" | "rejected";
  requestedAt: ISODate;
  appliedAt: ISODate | null;
  requestedBy: ID;
}

export interface ConcurrencyEntitlement {
  id: ID;
  organizationId: ID;
  extraSessions: number;
  monthlyPriceCents: Cents;
  status: "requested" | "active" | "ended";
  startsAt: ISODate;
}

export type InvoiceStatus = "draft" | "open" | "paid" | "overdue" | "void" | "credited";

export interface InvoiceLine {
  label: string;
  quantity: number;
  unitPriceCents: Cents;
}

export interface Invoice {
  id: ID;
  organizationId: ID;
  /** Numéro de démonstration : préfixe DEMO-, jamais un numéro officiel. */
  number: string;
  issuedAt: ISODate;
  dueAt: ISODate;
  status: InvoiceStatus;
  lines: InvoiceLine[];
  totalCents: Cents;
  kind: "invoice" | "credit_note";
}

export interface Payment {
  id: ID;
  invoiceId: ID;
  organizationId: ID;
  amountCents: Cents;
  method: "bank_transfer" | "card" | "manual";
  status: "recorded" | "failed" | "refunded";
  at: ISODate;
}

// ---------------------------------------------------------------------------
// Demandes visiteurs, support, notifications, audit
// ---------------------------------------------------------------------------

export type VisitorRequestKind = "message" | "contact" | "quote" | "appointment";

export interface VisitorRequest {
  id: ID;
  organizationId: ID;
  conversationId: ID | null;
  kind: VisitorRequestKind;
  visitorName: string;
  visitorContact: string;
  summary: string;
  lang: Lang;
  status: "new" | "in_progress" | "done" | "archived";
  createdAt: ISODate;
}

export type SupportKind = "change_request" | "issue" | "minutes" | "contact";

export interface SupportRequest {
  id: ID;
  organizationId: ID;
  kind: SupportKind;
  subject: string;
  message: string;
  status: "open" | "in_progress" | "resolved" | "closed";
  createdAt: ISODate;
  updatedAt: ISODate;
  createdBy: ID;
}

export interface Notification {
  id: ID;
  /** null : notification interne ATIE. */
  organizationId: ID | null;
  level: "info" | "warning" | "critical";
  title: string;
  body: string;
  createdAt: ISODate;
  readAt: ISODate | null;
}

export interface AuditEvent {
  id: ID;
  organizationId: ID | null;
  actorId: ID;
  action: string;
  target: string;
  detail: string;
  at: ISODate;
}

export interface Incident {
  id: ID;
  service: "api" | "livekit" | "lemonslice" | "inference" | "widget";
  severity: "minor" | "major";
  title: string;
  status: "open" | "monitoring" | "resolved";
  startedAt: ISODate;
  resolvedAt: ISODate | null;
}

/** État de configuration d'un fournisseur : jamais la valeur d'un secret. */
export interface ProviderStatus {
  id: ID;
  provider: "livekit" | "lemonslice" | "livekit_inference" | "atie_api" | "payment";
  label: string;
  configured: boolean;
  /** Derniers caractères seulement, jamais la clé. null tant que non connecté. */
  keyHint: string | null;
  connection: "not_connected" | "ok" | "degraded" | "down";
  note: string;
}

export interface PlatformSettings {
  platformName: string;
  defaultLang: Lang;
  enabledLangs: Lang[];
  defaultMaxConversationSeconds: number;
  defaultRetentionDays: number;
  quotaAlertPct: number;
  sessionTimeoutMinutes: number;
  require2fa: boolean;
  notifyEmail: string;
}

/** Ensemble des données de démonstration persistées localement. */
export interface DemoStore {
  version: number;
  generatedAt: ISODate;
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
  /** Paramètres de facturation (optionnels : valeurs par défaut dans lib/repositories/billing.ts). */
  billingSettings?: { [key: string]: unknown };
}
