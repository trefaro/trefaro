import { MAX_FILE_NAME_LENGTH } from '@trefaro/shared-models';

/**
 * The name a browser sent, reduced to something safe to keep and to hand back.
 *
 * A file name from a form is attacker-controlled text that ends up in two
 * dangerous places: a `Content-Disposition` header, where a quote or a newline
 * would let the sender write headers of their own, and an organizer's own
 * filesystem when they save the download. So: no directories, no control
 * characters, no quotes, and a length a filesystem accepts.
 *
 * The name is kept at all — rather than replaced by the generated one — because
 * an organizer collecting forty visa documents needs to know which is whose, and
 * "3f9c1a…" tells them nothing.
 */
export function safeFileName(raw: string): string {
  const base = raw
    // Everything up to the last separator is a path, whichever platform sent it.
    .replace(/^.*[\\/]/, '')
    // eslint-disable-next-line no-control-regex -- exactly what has to go
    .replace(/[\u0000-\u001f\u007f"'\\]/g, '')
    .trim();
  const trimmed = base.slice(0, MAX_FILE_NAME_LENGTH);
  // A name made entirely of removed characters — or of dots, which some
  // filesystems read as a directory — gets a neutral one.
  return /[^.\s]/.test(trimmed) ? trimmed : 'attachment';
}

/**
 * The `Content-Disposition` of a download.
 *
 * Always `attachment`, never `inline`: the API answers on the same origin as the
 * organizer client behind the reverse proxy, and a file the browser decides to
 * render there would be running inside that client. The plain `filename` is the
 * ASCII fallback; `filename*` carries the real one for every browser of the last
 * fifteen years (RFC 5987).
 */
export function contentDisposition(fileName: string): string {
  const safe = safeFileName(fileName);
  const ascii = safe.replace(/[^\x20-\x7e]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`;
}
