import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Indexes for the participant overview (FR 3.3).
 *
 * The overview is the highest rated function of the survey (3,86/4) and the one
 * the phase plan expects to fail first at volume, which is why its indexes
 * arrive with it rather than in phase 5.
 *
 * What is covered, and what deliberately is not:
 *
 * - **Sorting by name** and **filtering by status** each get an index that also
 *   carries the event, because every query of this table is scoped to one event.
 * - **Sorting by e-mail** needs no index of its own: the unique index over
 *   `(event_id, lower(email))` from the previous migration already orders that
 *   way.
 * - **The free-text search does not get an index.** `ILIKE '%term%'` cannot use
 *   a b-tree, and the alternative — a trigram index — needs the `pg_trgm`
 *   extension, which requires rights a small organization's managed PostgreSQL
 *   may not grant. Within a single event the search filters thousands of rows,
 *   not millions, and the two indexes below already reduce the candidate set to
 *   one event. Requiring an extension for the sake of a scan of that size would
 *   trade a real installation obstacle for an imperceptible gain (NFR 12).
 */
export class ParticipantOverview1787789200000 implements MigrationInterface {
  name = 'ParticipantOverview1787789200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    // Sorting by name, case-insensitively: "van Dijk" and "Van Dijk" belong in
    // the same place in the list.
    await queryRunner.query(`
      CREATE INDEX "IDX_registration_event_name"
        ON "registration" (
          "event_id",
          lower("last_name"),
          lower("first_name")
        )
    `);

    // The status filter, and with it the counts the overview shows beside every
    // page — including the confirmed count that decides whether an event may be
    // deleted (E14).
    await queryRunner.query(`
      CREATE INDEX "IDX_registration_event_status"
        ON "registration" ("event_id", "status", "created_at" DESC)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_registration_event_status"`);
    await queryRunner.query(`DROP INDEX "IDX_registration_event_name"`);
  }
}
