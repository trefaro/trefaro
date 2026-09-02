import { MAX_SEARCH_TERMS, searchTerms } from './search-terms';

/**
 * The one splitter three lists share (F138).
 *
 * Its rules are small and all three callers depend on every one of them: a
 * search that keeps an empty word asks for `%%` and matches everybody, and one
 * that keeps the case asks `ILIKE` to do work it does not have to.
 */
describe('searchTerms', () => {
  it('has nothing to say about an empty box', () => {
    expect(searchTerms(undefined)).toEqual([]);
    expect(searchTerms('')).toEqual([]);
    expect(searchTerms('   ')).toEqual([]);
  });

  it('splits on whitespace and lowercases, so word order does not matter', () => {
    expect(searchTerms('Amina Okonkwo')).toEqual(['amina', 'okonkwo']);
  });

  it('drops the gaps rather than turning them into words', () => {
    // A double space used to become an empty term, and an empty term is
    // `%%` — a condition every row satisfies.
    expect(searchTerms('  amina   okonkwo \t')).toEqual(['amina', 'okonkwo']);
  });

  it('caps the number of words', () => {
    const many = 'one two three four five six seven';

    expect(searchTerms(many)).toHaveLength(MAX_SEARCH_TERMS);
    expect(searchTerms(many)).toEqual(['one', 'two', 'three', 'four', 'five']);
  });
});
