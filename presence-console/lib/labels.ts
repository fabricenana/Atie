import type {
  EndReason,
  IndexStatus,
  InvoiceStatus,
  KnowledgeKind,
  OrgStatus,
  ReceptionistStatus,
  SessionStatus,
  SubscriptionStatus,
  SupportKind,
  VisitorRequestKind,
} from "./domain/types";

/** Teinte des badges d'état. */
export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "accent";

type Labelled = { label: string; tone: Tone };
const L = (label: string, tone: Tone): Labelled => ({ label, tone });

export const ORG_STATUS: Record<OrgStatus, Labelled> = {
  active: L("Actif", "success"),
  trial: L("Essai", "info"),
  suspended: L("Suspendu", "danger"),
  onboarding: L("En configuration", "warning"),
};

export const RECEPTIONIST_STATUS: Record<ReceptionistStatus, Labelled> = {
  draft: L("Brouillon", "neutral"),
  configured: L("Configurée", "info"),
  live: L("En service", "success"),
  paused: L("En pause", "warning"),
};

export const SESSION_STATUS: Record<SessionStatus, Labelled> = {
  pending: L("En attente", "neutral"),
  connecting: L("Connexion", "info"),
  active: L("Active", "success"),
  terminating: L("Terminaison", "warning"),
  ended: L("Terminée", "neutral"),
  failed: L("Échec", "danger"),
  close_unconfirmed: L("Fermeture non confirmée", "warning"),
};

export const END_REASON: Record<Exclude<EndReason, null>, string> = {
  visitor_end: "Fin par le visiteur",
  time_up: "Durée maximale atteinte",
  quota_exhausted: "Quota épuisé",
  disconnected: "Déconnexion",
  lease_expired: "Bail expiré",
  error: "Erreur",
};

export const INDEX_STATUS: Record<IndexStatus, Labelled> = {
  demo_not_indexed: L("Démo — non indexé", "neutral"),
  pending: L("En attente d’indexation", "info"),
  indexing: L("Indexation en cours", "info"),
  indexed: L("Indexé", "success"),
  failed: L("Échec d’indexation", "danger"),
};

export const KNOWLEDGE_KIND: Record<KnowledgeKind, string> = { text: "Texte", url: "URL", pdf: "PDF", docx: "DOCX" };

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, Labelled> = {
  trialing: L("Essai", "info"),
  active: L("Actif", "success"),
  past_due: L("Paiement en retard", "warning"),
  suspended: L("Suspendu", "danger"),
  canceled: L("Résilié", "neutral"),
};

export const INVOICE_STATUS: Record<InvoiceStatus, Labelled> = {
  draft: L("Brouillon", "neutral"),
  open: L("À payer", "info"),
  paid: L("Payée", "success"),
  overdue: L("Échue", "danger"),
  void: L("Annulée", "neutral"),
  credited: L("Avoir", "accent"),
};

export const PLAN_APPROVAL = {
  confirmed: L("Tarif confirmé", "success"),
  hypothesis: L("Hypothèse à valider", "warning"),
  draft: L("Interne — non publié", "neutral"),
} as const;

export const VISITOR_REQUEST_KIND: Record<VisitorRequestKind, string> = {
  message: "Message",
  contact: "Demande de contact",
  quote: "Demande de devis",
  appointment: "Demande de rendez-vous",
};

export const VISITOR_REQUEST_STATUS = {
  new: L("Nouvelle", "accent"),
  in_progress: L("En cours", "info"),
  done: L("Traitée", "success"),
  archived: L("Archivée", "neutral"),
} as const;

export const SUPPORT_KIND: Record<SupportKind, string> = {
  change_request: "Demande de modification",
  issue: "Signalement d’un problème",
  minutes: "Minutes supplémentaires",
  contact: "Contact ATIE",
};

export const SUPPORT_STATUS = {
  open: L("Ouverte", "accent"),
  in_progress: L("En cours", "info"),
  resolved: L("Résolue", "success"),
  closed: L("Fermée", "neutral"),
} as const;

export const TOPUP_STATUS = {
  requested: L("Demandée", "info"),
  pending: L("En attente", "warning"),
  applied: L("Appliquée", "success"),
  rejected: L("Refusée", "neutral"),
} as const;

export const WIDGET_STATUS = {
  not_configured: L("Non configuré", "neutral"),
  ready: L("Prêt à installer", "info"),
  installed: L("Installé", "success"),
  disabled: L("Désactivé", "warning"),
} as const;

export const CONNECTION_STATUS = {
  not_connected: L("Non connecté", "neutral"),
  ok: L("Opérationnel", "success"),
  degraded: L("Dégradé", "warning"),
  down: L("Hors service", "danger"),
} as const;
