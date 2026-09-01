/**
 * Port for "which logo files hang below this series" (FR 2.1, FR 3.1 — E9).
 *
 * A port of its own rather than a method on the two entity repositories, and it
 * exists for exactly one caller: deleting a series cascades to its events, and
 * the cascade removes rows without touching files. Somebody has to ask, while
 * the rows can still say it, which files are about to become unreachable.
 *
 * Narrow on purpose, the same way `RegistrationTally` is narrow: whoever needs
 * to unlink files does not need to read series or events. It answers paths and
 * nothing else — no ids, no names, nothing that would let a caller learn about a
 * row it has no business reading.
 */
export interface LogoPathsRepository {
  /**
   * Every stored logo path a delete of this series would orphan: the series'
   * own, plus one per event below it. Rows without a logo contribute nothing, so
   * an empty array is the normal answer.
   */
  underSeries(seriesId: string): Promise<readonly string[]>;
}

export const LOGO_PATHS_REPOSITORY = Symbol('TREFARO_LOGO_PATHS_REPOSITORY');
