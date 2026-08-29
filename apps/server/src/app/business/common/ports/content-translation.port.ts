/**
 * The shape every content translation port has (FR 3.12, E25).
 *
 * Three tables translate three things and the operations over them are the same
 * four: read one language for many parents (a landing page), read every language
 * of one parent (the translation screen), write one, remove one. Spelling that
 * out three times would be three places for the fallback rule to drift, so the
 * shape is generic and each parent declares its own payload and its own token.
 *
 * Generic in the *payload* only. The parent id stays a plain string: an id is an
 * id, and a phantom type over it would buy a compile error that the injection
 * token already gives — you cannot hand series translations to the event port
 * without naming the wrong token.
 */

/** One stored translation: which language, and what it says. */
export interface ContentTranslationRecord<T> {
  readonly locale: string;
  readonly value: T;
}

/**
 * Reading translations — what a public page needs, and nothing more.
 *
 * Split from the write half for the same reason `TranslationOverrideReader` is
 * (E22): the services that render a landing page inject this, so no amount of
 * refactoring inside them can start writing translations. Both halves share one
 * token, so the split costs nothing at wiring time.
 */
export interface ContentTranslationReader<T> {
  /**
   * One language, for a set of parents, as a map from parent id.
   *
   * Many parents in one call rather than one call per row: the participant start
   * page lists every published series, and a per-row lookup would turn one page
   * into N+1 queries the moment an organization has a real number of them.
   * Parents without a row are simply absent from the map — that *is* "no
   * translation", and the caller falls back to the original.
   */
  findForParents(
    parentIds: readonly string[],
    locale: string,
  ): Promise<ReadonlyMap<string, T>>;
}

/** Reading and writing — what the organizer's translation screen needs. */
export interface ContentTranslationRepository<
  T,
> extends ContentTranslationReader<T> {
  /** Every language one parent has been translated into, in no promised order. */
  findAllForParent(
    parentId: string,
  ): Promise<readonly ContentTranslationRecord<T>[]>;

  /** Every language of a set of parents, keyed by parent id. */
  findAllForParents(
    parentIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly ContentTranslationRecord<T>[]>>;

  /**
   * Writes one language of one parent, replacing whatever was there.
   *
   * A replace rather than a merge: the screen sends the whole translation of one
   * thing, so a field the request leaves out is a field the translator cleared.
   * Merging here would make an emptied box impossible to express.
   */
  save(parentId: string, locale: string, value: T): Promise<void>;

  /** Removes one language of one parent. `false` if there was nothing to remove. */
  remove(parentId: string, locale: string): Promise<boolean>;
}
