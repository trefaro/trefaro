/**
 * Splitting a search box into words.
 *
 * Every word has to match, so "amina okonkwo" finds the person whichever order
 * the two names are typed in — which is how people search for someone they half
 * remember. The counterpart of that rule lives in the repositories: one `ILIKE`
 * condition per word, joined with `AND` (F32, F126).
 *
 * Here because the participant overview, the contact list and now the
 * participant search all split the same way, and the third wortgleiche copy is
 * where a helper moves out (F138). The two older copies differed in one detail
 * — one capped the number of words, the other did not — which is exactly the
 * kind of drift that makes three copies two behaviours.
 */

/**
 * The most words one search may carry.
 *
 * Every word is another `ILIKE '%…%'` condition on the same row, so this is a
 * bound on what one request can ask the database to do. Five is past the point
 * where a search still finds anything: a sixth word that is silently ignored
 * would be wrong, but a sixth word only ever narrows an already empty result.
 */
export const MAX_SEARCH_TERMS = 5;

/** Words of a search box: trimmed, lowercased, empty ones dropped, capped. */
export function searchTerms(search: string | undefined): readonly string[] {
  return (search ?? '')
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0)
    .slice(0, MAX_SEARCH_TERMS);
}
