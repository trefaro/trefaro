/**
 * Whether the database answers, and how quickly (NFR 10, NFR 11).
 *
 * A port of four lines, and it exists for the reason the whole layering does:
 * until AP 10 of phase 5 the health endpoint injected TypeORM's `DataSource`
 * and ran `SELECT 1` itself, which made a controller the second place in this
 * server that speaks to PostgreSQL. Nothing was wrong with the query; what was
 * wrong was the sentence it made false — that swapping the database means
 * replacing one layer. Found by the security review of AP 9 (point E2) and
 * fixed here rather than in AP 12, which has to *describe* the architecture.
 */
export interface DatabaseHealth {
  /**
   * The round trip in milliseconds, or `null` when it could not be made.
   *
   * `null` rather than a throw: a database that is gone is a state this server
   * reports, not an error it raises — a health endpoint that answered 500
   * would tell a proxy that the server is down when the server is the part
   * that still works.
   */
  probe(): Promise<number | null>;
}

export const DATABASE_HEALTH = Symbol('TREFARO_DATABASE_HEALTH');
