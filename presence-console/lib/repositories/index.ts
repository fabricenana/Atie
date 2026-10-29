import "server-only";
import type { DemoStore, ID, Organization, Plan, Subscription } from "../domain/types";
import { readStore } from "../demo/store";

/**
 * Couche de lecture (repositories).
 *
 * Toutes les pages passent par ces fonctions, jamais par le store directement.
 * Pour brancher PostgreSQL ou l'API Python, il suffit de réimplémenter ce module
 * (mêmes signatures) : voir docs/API-CONTRACTS.md.
 *
 * Isolation multi-tenant : les fonctions « ForOrg » filtrent toujours sur
 * l'organisation reçue. Dans l'espace client, cet identifiant provient
 * exclusivement de la session serveur (requireClient).
 */

const s = () => readStore();

// ---------------------------------------------------------------------------
// Entreprises
// ---------------------------------------------------------------------------

export const listOrganizations = () => [...s().organizations].sort((a, b) => a.name.localeCompare(b.name, "fr"));
export const getOrganization = (id: ID) => s().organizations.find((o) => o.id === id) ?? null;
export const listDomainsForOrg = (orgId: ID) => s().websiteDomains.filter((d) => d.organizationId === orgId);
export const listOrgUsers = (orgId: ID) =>
  s()
    .organizationUsers.filter((m) => m.organizationId === orgId)
    .map((m) => ({ membership: m, user: s().users.find((u) => u.id === m.userId)! }))
    .filter((x) => x.user);
export const listAtieUsers = () => s().users.filter((u) => u.atieRole);
export const getUser = (id: ID) => s().users.find((u) => u.id === id) ?? null;

// ---------------------------------------------------------------------------
// Réceptionnistes et avatars
// ---------------------------------------------------------------------------

export const listAvatars = () => s().avatars;
export const getAvatar = (id: ID) => s().avatars.find((a) => a.id === id) ?? null;
export const listReceptionists = () => s().receptionists;
export const getReceptionist = (id: ID) => s().receptionists.find((r) => r.id === id) ?? null;
export const getReceptionistForOrg = (orgId: ID) => s().receptionists.find((r) => r.organizationId === orgId) ?? null;

// ---------------------------------------------------------------------------
// Knowledge Base
// ---------------------------------------------------------------------------

export const listKnowledgeForOrg = (orgId: ID) =>
  s()
    .knowledgeSources.filter((k) => k.organizationId === orgId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

/** Un document n'est rendu que si la source appartient à l'organisation demandée. */
export function getKnowledgeSourceForOrg(orgId: ID, sourceId: ID) {
  const src = s().knowledgeSources.find((k) => k.id === sourceId && k.organizationId === orgId);
  if (!src) return null;
  const versions = s()
    .knowledgeDocuments.filter((d) => d.sourceId === src.id && d.organizationId === orgId)
    .sort((a, b) => b.version - a.version);
  return { source: src, versions };
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

export const listWidgets = () => s().widgetInstallations;
export const getWidgetForOrg = (orgId: ID) => s().widgetInstallations.find((w) => w.organizationId === orgId) ?? null;

// ---------------------------------------------------------------------------
// Sessions et consommation
// ---------------------------------------------------------------------------

export const listConversations = () => s().conversations;
export const listConversationsForOrg = (orgId: ID) => s().conversations.filter((c) => c.organizationId === orgId);
export const listConversationEvents = (conversationId: ID) =>
  s().conversationEvents.filter((e) => e.conversationId === conversationId).sort((a, b) => a.at.localeCompare(b.at));
export const LIVE_STATUSES = ["pending", "connecting", "active", "terminating"] as const;
export const listLiveSessions = () =>
  s().conversations.filter((c) => (LIVE_STATUSES as readonly string[]).includes(c.status) || c.status === "close_unconfirmed");

export const listUsageForOrg = (orgId: ID) => s().usageRecords.filter((u) => u.organizationId === orgId);
export const listUsage = () => s().usageRecords;
export const listProviderUsage = () => s().providerUsage;

// ---------------------------------------------------------------------------
// Offres, abonnements, quotas
// ---------------------------------------------------------------------------

export const listPlans = () => s().plans;
export const getPlan = (id: ID) => s().plans.find((p) => p.id === id) ?? null;
export const listSubscriptions = () => s().subscriptions;
export const getSubscriptionForOrg = (orgId: ID) =>
  s().subscriptions.find((x) => x.organizationId === orgId && x.status !== "canceled") ?? null;
export const listTopups = () => s().minuteTopups;
export const listTopupsForOrg = (orgId: ID) => s().minuteTopups.filter((t) => t.organizationId === orgId);
export const listConcurrencyForOrg = (orgId: ID) => s().concurrencyEntitlements.filter((c) => c.organizationId === orgId);
export const listConcurrency = () => s().concurrencyEntitlements;

export interface QuotaState {
  subscription: Subscription | null;
  plan: Plan | null;
  includedMinutes: number;
  topupMinutes: number;
  usedSeconds: number;
  usedMinutes: number;
  remainingMinutes: number;
  pctUsed: number;
  sessions: number;
  concurrent: number;
  alert: "none" | "warning" | "exhausted";
}

/**
 * Quota commercial du client sur la période en cours.
 * En production, valeur fournie par le backend Python (GET /tenants/{id}/usage) :
 * la console ne recalcule jamais un quota faisant foi.
 */
export function quotaForOrg(orgId: ID, store: DemoStore = s()): QuotaState {
  const subscription = store.subscriptions.find((x) => x.organizationId === orgId && x.status !== "canceled") ?? null;
  const plan = subscription ? store.plans.find((p) => p.id === subscription.planId) ?? null : null;
  const start = subscription?.currentPeriodStart ?? "9999";
  const end = subscription?.currentPeriodEnd ?? "9999";
  const inPeriod = store.conversations.filter((c) => c.organizationId === orgId && c.startedAt >= start && c.startedAt < end);
  const usedSeconds = inPeriod.reduce((n, c) => n + c.billableSeconds, 0);
  const topupMinutes = store.minuteTopups
    .filter((t) => t.organizationId === orgId && t.status === "applied" && t.appliedAt && t.appliedAt >= start && t.appliedAt < end)
    .reduce((n, t) => n + t.minutes, 0);
  const includedMinutes = plan?.includedMinutes ?? 0;
  const total = includedMinutes + topupMinutes;
  const usedMinutes = Math.round((usedSeconds / 60) * 10) / 10;
  const remainingMinutes = Math.max(0, Math.round((total - usedMinutes) * 10) / 10);
  const pctUsed = total ? Math.min(100, Math.round((usedMinutes / total) * 100)) : 0;
  const threshold = subscription?.alertThresholdPct ?? 80;
  const extra = store.concurrencyEntitlements
    .filter((c) => c.organizationId === orgId && c.status === "active")
    .reduce((n, c) => n + c.extraSessions, 0);
  return {
    subscription,
    plan,
    includedMinutes,
    topupMinutes,
    usedSeconds,
    usedMinutes,
    remainingMinutes,
    pctUsed,
    sessions: inPeriod.filter((c) => c.status !== "failed").length,
    concurrent: (plan?.concurrentSessions ?? 0) + extra,
    alert: total && usedMinutes >= total ? "exhausted" : pctUsed >= threshold ? "warning" : "none",
  };
}

// ---------------------------------------------------------------------------
// Facturation
// ---------------------------------------------------------------------------

export const listInvoices = () => [...s().invoices].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
export const listInvoicesForOrg = (orgId: ID) => listInvoices().filter((i) => i.organizationId === orgId);
export const listPayments = () => [...s().payments].sort((a, b) => b.at.localeCompare(a.at));

// ---------------------------------------------------------------------------
// Demandes, support, notifications, audit, incidents, paramètres
// ---------------------------------------------------------------------------

export const listVisitorRequestsForOrg = (orgId: ID) =>
  s()
    .visitorRequests.filter((v) => v.organizationId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const listSupportRequests = () => [...s().supportRequests].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const listSupportForOrg = (orgId: ID) => listSupportRequests().filter((x) => x.organizationId === orgId);
export const listNotifications = (orgId: ID | null) =>
  s()
    .notifications.filter((n) => (orgId === null ? true : n.organizationId === orgId))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
export const listAuditEvents = (orgId?: ID) =>
  s()
    .auditEvents.filter((a) => (orgId ? a.organizationId === orgId : true))
    .sort((a, b) => b.at.localeCompare(a.at));
export const listIncidents = () => [...s().incidents].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
export const listProviderStatuses = () => s().providerStatuses;
export const getSettings = () => s().settings;
export const getDemoMeta = () => ({ generatedAt: s().generatedAt, version: s().version });

// ---------------------------------------------------------------------------
// Vue enrichie pour les tableaux d'entreprises
// ---------------------------------------------------------------------------

export interface OrganizationRow {
  org: Organization;
  receptionistName: string | null;
  planName: string | null;
  usedMinutes: number;
  includedMinutes: number;
  domain: string | null;
}

export function listOrganizationRows(): OrganizationRow[] {
  const store = s();
  return listOrganizations().map((org) => {
    const q = quotaForOrg(org.id, store);
    return {
      org,
      receptionistName: store.receptionists.find((r) => r.organizationId === org.id)?.name ?? null,
      planName: q.plan?.name ?? null,
      usedMinutes: q.usedMinutes,
      includedMinutes: q.includedMinutes + q.topupMinutes,
      domain: store.websiteDomains.find((d) => d.organizationId === org.id)?.domain ?? null,
    };
  });
}
