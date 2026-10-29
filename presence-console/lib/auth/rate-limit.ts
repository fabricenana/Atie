/**
 * Limiteur de tentatives en mémoire (fenêtre fixe), par clé « IP|e-mail ».
 * Suffisant pour une instance unique ; à remplacer par un stockage partagé si la
 * console tourne un jour sur plusieurs instances.
 */
export interface Limiter {
  /** Enregistre une tentative ; `allowed` est faux au-delà du maximum dans la fenêtre. */
  hit(key: string, now?: number): { allowed: boolean; retryAfterMs: number };
  reset(key: string): void;
}

export function createLimiter({ max, windowMs }: { max: number; windowMs: number }): Limiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    hit(key, now = Date.now()) {
      if (buckets.size > 10_000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      let b = buckets.get(key);
      if (!b || b.resetAt <= now) {
        b = { count: 0, resetAt: now + windowMs };
        buckets.set(key, b);
      }
      b.count++;
      return { allowed: b.count <= max, retryAfterMs: b.count <= max ? 0 : b.resetAt - now };
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}
