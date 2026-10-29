import type { Role } from "../domain/types";

/**
 * Matrice des permissions (source unique, utilisée côté serveur).
 * L'interface masque les actions non autorisées, mais chaque action serveur
 * revérifie la permission : masquer un bouton n'est jamais une protection.
 */
export const PERMISSIONS = [
  // Back-office ATIE
  "admin.access",
  "org.read_all",
  "org.write",
  "org.suspend",
  "receptionist.write",
  "knowledge.read_all",
  "knowledge.write",
  "session.read_all",
  "plan.write",
  "subscription.write",
  "billing.read",
  "billing.write",
  "integration.write",
  "settings.read",
  "settings.write",
  "users.manage",
  "audit.read",
  "demo.reset",
  // Espace client (toujours limité à sa propre entreprise)
  "client.access",
  "client.requests.update",
  "client.org.write",
  "client.support.create",
  "client.topup.request",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ATIE_OPERATOR: Permission[] = [
  "admin.access",
  "org.read_all",
  "receptionist.write",
  "knowledge.read_all",
  "knowledge.write",
  "session.read_all",
  "billing.read",
  "integration.write",
  "settings.read",
];

const ATIE_ADMIN: Permission[] = [
  ...ATIE_OPERATOR,
  "org.write",
  "org.suspend",
  "subscription.write",
  "billing.write",
  "audit.read",
];

const SUPER_ADMIN: Permission[] = [...ATIE_ADMIN, "plan.write", "settings.write", "users.manage", "demo.reset"];

const ORG_VIEWER: Permission[] = ["client.access"];
const ORG_ADMIN: Permission[] = [
  ...ORG_VIEWER,
  "client.requests.update",
  "client.org.write",
  "client.support.create",
  "client.topup.request",
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  super_admin: new Set(SUPER_ADMIN),
  atie_admin: new Set(ATIE_ADMIN),
  atie_operator: new Set(ATIE_OPERATOR),
  org_admin: new Set(ORG_ADMIN),
  org_viewer: new Set(ORG_VIEWER),
};

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: "Super administrateur ATIE",
  atie_admin: "Administrateur ATIE",
  atie_operator: "Opérateur ATIE",
  org_admin: "Administrateur entreprise",
  org_viewer: "Utilisateur entreprise (lecture seule)",
};

export const PERMISSION_LABELS: Record<Permission, string> = {
  "admin.access": "Accéder au back-office",
  "org.read_all": "Consulter toutes les entreprises",
  "org.write": "Créer et modifier les entreprises",
  "org.suspend": "Suspendre et réactiver",
  "receptionist.write": "Configurer les réceptionnistes",
  "knowledge.read_all": "Consulter les Knowledge Bases",
  "knowledge.write": "Modifier les Knowledge Bases",
  "session.read_all": "Consulter les sessions",
  "plan.write": "Gérer les formules",
  "subscription.write": "Gérer les abonnements",
  "billing.read": "Consulter la facturation",
  "billing.write": "Gérer la facturation",
  "integration.write": "Préparer les intégrations",
  "settings.read": "Consulter les paramètres",
  "settings.write": "Modifier les paramètres plateforme",
  "users.manage": "Gérer les utilisateurs internes",
  "audit.read": "Consulter le journal d’audit",
  "demo.reset": "Réinitialiser la démonstration",
  "client.access": "Accéder à l’espace client",
  "client.requests.update": "Traiter les demandes visiteurs",
  "client.org.write": "Modifier les informations de l’entreprise",
  "client.support.create": "Créer une demande d’assistance",
  "client.topup.request": "Demander des minutes ou un changement de formule",
};

export function can(role: Role, permission: Permission) {
  return ROLE_PERMISSIONS[role].has(permission);
}

export function isAtieRole(role: Role) {
  return role === "super_admin" || role === "atie_admin" || role === "atie_operator";
}
