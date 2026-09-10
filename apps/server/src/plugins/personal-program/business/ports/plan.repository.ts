/**
 * Port for the personal programme plug-in's storage (FR 3.17).
 *
 * As small as the plug-in: a person's selection is read for one screen, added
 * to, and taken from. What the port deliberately does not offer is a way to
 * read a session or an event — both are core tables the plug-in owns nothing of
 * (F21), and what it knows about a programme arrives through
 * `PluginProgramReads`.
 *
 * Two rules live in the statements rather than in a caller (F152), and both are
 * the same rule seen from two sides — **a selection exists or it does not**:
 *
 * - {@link PlanRepository.add} inserts on conflict do nothing. Two taps on a
 *   slow connection are one row, and the second one is not an error.
 * - {@link PlanRepository.remove} deletes and does not report whether it found
 *   anything. Taking out a session that is not in the plan leaves the plan the
 *   caller wanted, which is the whole of what idempotent means here.
 *
 * Neither is a place a seat could be reserved, and that is the point of E55:
 * there is no capacity in this file to compare anything against.
 */

/**
 * Raised when the session being put in a plan does not exist.
 *
 * Narrow on purpose: the foreign key cascades, so this is a session deleted
 * between reading the programme and ticking the box. The data access layer
 * translates the constraint violation into this error so the business layer can
 * answer 404 rather than 500 — the driver's error code stays where the ORM
 * does.
 */
export class UnknownProgramItemError extends Error {
  constructor(readonly programItemId: string) {
    super('No such programme item');
    this.name = 'UnknownProgramItemError';
  }
}

export interface PlanRepository {
  /**
   * Which of these sessions this person has in their plan.
   *
   * The ids of one screen in one call rather than a call per row (F49) — the
   * caller is always rendering a programme and marking it. Ids that are not in
   * the plan are simply absent from the answer.
   */
  findSelected(
    userId: string,
    programItemIds: readonly string[],
  ): Promise<ReadonlySet<string>>;

  /**
   * Puts a session in somebody's plan, idempotently.
   *
   * @throws UnknownProgramItemError when no session has that id.
   */
  add(userId: string, programItemId: string, addedAt: Date): Promise<void>;

  /** Takes it out. Absent is the same answer as removed. */
  remove(userId: string, programItemId: string): Promise<void>;
}

export const PLAN_REPOSITORY = Symbol('TREFARO_PLAN_REPOSITORY');
