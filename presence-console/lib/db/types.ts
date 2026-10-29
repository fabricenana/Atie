/**
 * Abstraction minimale de la base : de quoi exécuter des requêtes paramétrées
 * dans une transaction. Implémentée par node-postgres (production) et par PGlite (tests).
 */

export type Row = Record<string, unknown>;

export interface Queryable {
  query<R extends Row = Row>(text: string, params?: unknown[]): Promise<{ rows: R[] }>;
}

export interface Database {
  /**
   * Ouvre une transaction, exécute `setup` (instructions SET LOCAL, sans paramètre),
   * puis `fn`. COMMIT si `fn` réussit, ROLLBACK sinon.
   */
  transaction<T>(setup: string[], fn: (q: Queryable) => Promise<T>): Promise<T>;
}
