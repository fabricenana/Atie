/** Navigation des deux espaces. Les icônes sont résolues côté client (components/shell/icons.tsx). */
export type IconName =
  | "dashboard" | "building" | "user-round" | "book" | "messages" | "radio" | "layers" | "receipt" | "plug" | "settings"
  | "gauge" | "credit-card" | "briefcase" | "life-buoy" | "inbox";

export interface NavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Correspondance exacte (pour la racine de l'espace). */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export const ADMIN_NAV: NavGroup[] = [
  { items: [{ href: "/admin", label: "Tableau de bord", icon: "dashboard", exact: true }] },
  {
    label: "Clients",
    items: [
      { href: "/admin/entreprises", label: "Entreprises", icon: "building" },
      { href: "/admin/receptionnistes", label: "Réceptionnistes", icon: "user-round" },
      { href: "/admin/connaissances", label: "Knowledge Bases", icon: "book" },
    ],
  },
  {
    label: "Exploitation",
    items: [
      { href: "/admin/sessions", label: "Conversations", icon: "messages" },
      { href: "/admin/sessions/actives", label: "Sessions actives", icon: "radio" },
      { href: "/admin/integrations", label: "Intégrations", icon: "plug" },
    ],
  },
  {
    label: "Commercial",
    items: [
      { href: "/admin/abonnements", label: "Abonnements", icon: "layers" },
      { href: "/admin/facturation", label: "Facturation", icon: "receipt" },
    ],
  },
  { label: "Plateforme", items: [{ href: "/admin/parametres", label: "Paramètres", icon: "settings" }] },
];

export const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      { href: "/client", label: "Mon tableau de bord", icon: "dashboard", exact: true },
      { href: "/client/receptionniste", label: "Ma réceptionniste", icon: "user-round" },
      { href: "/client/demandes", label: "Conversations et demandes", icon: "inbox" },
      { href: "/client/consommation", label: "Consommation", icon: "gauge" },
      { href: "/client/abonnement", label: "Mon abonnement", icon: "credit-card" },
      { href: "/client/entreprise", label: "Mon entreprise", icon: "briefcase" },
      { href: "/client/assistance", label: "Assistance ATIE", icon: "life-buoy" },
    ],
  },
];
