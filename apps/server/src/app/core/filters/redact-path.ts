/**
 * A request URL as a log line may carry it (NFR 11, NFR 7).
 *
 * The path stays, because it is what an operator reads to find out where a
 * fault was. The **values** of the query string go, because they are the one
 * place in a URL where a caller — or an organizer — puts a person: the
 * participant overview searches by surname and by address (F32), a
 * confirmation link carries a signed token, and a page of a list carries
 * nothing at all. The keys stay, which is the difference between a line that
 * says "a search failed" and one that says only "something failed".
 *
 * A fragment cannot reach a server, but a caller can put a `#` in a URL all
 * the same, and everything after it is dropped for the same reason: nothing
 * reads it, so nothing should log it.
 */
export function redactPath(url: string): string {
  const [pathAndQuery] = url.split('#');
  const separator = pathAndQuery.indexOf('?');
  if (separator === -1) return pathAndQuery;

  const path = pathAndQuery.slice(0, separator);
  const keys = pathAndQuery
    .slice(separator + 1)
    .split('&')
    .filter((pair) => pair.length > 0)
    .map((pair) => `${pair.split('=')[0]}=…`);

  return keys.length === 0 ? path : `${path}?${keys.join('&')}`;
}
