import { UPLOAD_MIME_TYPES } from '@trefaro/shared-models';

/**
 * Whether a file's first bytes match the type it claims to be.
 *
 * The `Content-Type` of a multipart part is set by whoever sends the request. A
 * check against the field's allowlist therefore proves nothing on its own: an
 * executable announced as `application/pdf` passes it. What cannot be renamed is
 * the file's own header, which is why every accepted type is checked against it.
 *
 * This is not a virus scanner and does not pretend to be one. It closes one
 * specific hole — "the type is whatever the uploader says it is" — and the
 * uploads are handed back as downloads rather than executed or rendered.
 *
 * Deliberately hand-written rather than a dependency: five signatures are
 * fifteen lines, and every dependency of a self-hosted application is something
 * an organization has to keep updated (NFR 3).
 */

/** The magic numbers of the catalogue, in the order they are checked. */
const SIGNATURES: Readonly<Record<string, (bytes: Buffer) => boolean>> = {
  // "%PDF-", followed by the version.
  'application/pdf': (bytes) => starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]),
  // Start of image, then the first marker.
  'image/jpeg': (bytes) => starts(bytes, [0xff, 0xd8, 0xff]),
  'image/png': (bytes) =>
    starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  // A RIFF container whose form type is WEBP — the type is at offset 8.
  'image/webp': (bytes) =>
    starts(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    bytes.length >= 12 &&
    bytes.subarray(8, 12).toString('latin1') === 'WEBP',
  // A .docx is a zip archive; its local file header is what identifies it.
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (
    bytes,
  ) => starts(bytes, [0x50, 0x4b, 0x03, 0x04]),
};

/**
 * Whether these bytes are of the claimed type.
 *
 * A type this function does not know answers `false`, which is safe because the
 * catalogue of acceptable types is closed (F38): a field cannot accept a type
 * that has no signature here, so the answer can only be reached by a request
 * that was going to be refused anyway.
 */
export function matchesSignature(mimeType: string, bytes: Buffer): boolean {
  return SIGNATURES[mimeType]?.(bytes) ?? false;
}

/** Every type of the catalogue has a signature — asserted by a unit test. */
export function typesWithoutSignature(): readonly string[] {
  return UPLOAD_MIME_TYPES.filter((mimeType) => !(mimeType in SIGNATURES));
}

function starts(bytes: Buffer, magic: readonly number[]): boolean {
  if (bytes.length < magic.length) return false;
  return magic.every((byte, index) => bytes[index] === byte);
}
