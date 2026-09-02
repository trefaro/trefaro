/**
 * The window a paginated list reads (F138 applied to the sixth copy).
 *
 * Every list of this application does the same three things with the two
 * numbers a client sends: fall back to a default when the page is not a page,
 * cap the size at what the endpoint will answer, and turn the pair into an
 * offset. Five services had that as two private helpers each, and the sixth
 * would have been the chat's — so it moved here, which is what the rule says
 * happens at the third one.
 *
 * It also settles a drift, which is the other half of that rule. Four of the
 * five copies refused a non-integer and fell back to the default; the
 * participant overview's copy read `2.7` as page 2 (`Number.isFinite` plus
 * `Math.floor`). Nothing observable changes by unifying them — every DTO
 * involved carries `@IsInt()`, so a fractional page is a 400 long before a
 * service sees it — and that is exactly why the difference could sit there
 * unnoticed: two readings of the same input, neither of them reachable.
 *
 * The reading that wins is the stricter one: a zeroth page and a page of zero
 * rows are not smaller requests, they are no request, so they get the default
 * rather than the nearest legal value.
 */

/** What a client may say about the window it wants. */
export interface PageRequest {
  readonly page?: number;
  readonly pageSize?: number;
}

/** What a repository is asked for, and what the answer reports back. */
export interface PageWindow {
  /** One-based, and what the answer carries — never what was asked for. */
  readonly page: number;
  /** Capped at the endpoint's maximum. */
  readonly pageSize: number;
  /** Rows to skip: `(page - 1) * pageSize`. */
  readonly offset: number;
}

export function pageWindow(
  request: PageRequest,
  defaultPageSize: number,
  maxPageSize: number,
): PageWindow {
  const pageSize = Math.min(
    Math.max(positive(request.pageSize, defaultPageSize), 1),
    maxPageSize,
  );
  const page = positive(request.page, 1);
  return { page, pageSize, offset: (page - 1) * pageSize };
}

function positive(value: number | undefined, fallback: number): number {
  return Number.isInteger(value) && (value as number) > 0
    ? (value as number)
    : fallback;
}
