import { pageWindow } from './page-window';

/**
 * The window every paginated list reads (F138).
 *
 * What is worth holding here is the *reading* the five previous copies of this
 * code disagreed about, because the disagreement was invisible: a page that is
 * not a page falls back to the default rather than to the nearest legal value.
 */
describe('pageWindow', () => {
  it('answers the first page in the default size when nothing is asked', () => {
    expect(pageWindow({}, 20, 50)).toEqual({
      page: 1,
      pageSize: 20,
      offset: 0,
    });
  });

  it('turns page and size into an offset', () => {
    expect(pageWindow({ page: 3, pageSize: 10 }, 20, 50)).toEqual({
      page: 3,
      pageSize: 10,
      offset: 20,
    });
  });

  it('caps the size at what the endpoint answers', () => {
    // What was used, not what was asked for: a client that asked for a
    // thousand has to be able to tell from the answer that it got fifty.
    expect(pageWindow({ pageSize: 1000 }, 20, 50).pageSize).toBe(50);
  });

  it('reads a zeroth page and a page of no rows as no request at all', () => {
    // The drift this helper settles. Not "the nearest legal value" — asking
    // for zero rows is not asking for one.
    expect(pageWindow({ page: 0, pageSize: 0 }, 20, 50)).toEqual({
      page: 1,
      pageSize: 20,
      offset: 0,
    });
  });

  it('refuses a fractional page rather than flooring it', () => {
    // The participant overview's copy floored it. Unreachable through the API
    // — every DTO carries `@IsInt()` — and therefore exactly the kind of
    // difference that survives five copies unnoticed.
    expect(pageWindow({ page: 2.7 }, 20, 50).page).toBe(1);
  });

  it('refuses a negative size', () => {
    expect(pageWindow({ pageSize: -5 }, 20, 50).pageSize).toBe(20);
  });
});
