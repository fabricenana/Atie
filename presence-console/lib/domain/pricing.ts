/**
 * Grille tarifaire ATIE Presence, validée le 29 oct. 2026. Source unique pour la console
 * (graine, recharges, contrôles de marge). Le thème WordPress affiche la même grille.
 */

/**
 * Coût fournisseur estimé par minute de conversation, en centimes de CHF.
 * ≈ 0,29 $/min (LemonSlice 0,22 + voix 0,045 + LiveKit 0,01 + STT 0,008 + LLM 0,005, atie-presence/phase2) ≈ CHF 0,23.
 */
export const PROVIDER_COST_CENTS_PER_MIN = 23;

export const PLAN_GRID = [
  { code: "starter", name: "Starter", monthlyPriceCents: 1200, includedMinutes: 15, concurrentSessions: 1, description: "Pour un petit site : quelques échanges par mois." },
  { code: "essentiel", name: "Essentiel", monthlyPriceCents: 2990, includedMinutes: 50, concurrentSessions: 1, description: "Pour un accueil régulier sur un site actif." },
  { code: "premium", name: "Premium", monthlyPriceCents: 8900, includedMinutes: 150, concurrentSessions: 2, description: "Pour les entreprises qui reçoivent beaucoup de visiteurs." },
  { code: "business", name: "Business", monthlyPriceCents: 24900, includedMinutes: 450, concurrentSessions: 4, description: "Grands volumes et plusieurs conversations en même temps." },
] as const;

/** Recharges de minutes, hors abonnement. */
export const TOPUP_OPTIONS = [{ minutes: 30, priceCents: 1900 }] as const;
