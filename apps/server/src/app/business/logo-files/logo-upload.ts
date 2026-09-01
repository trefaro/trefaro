import { MAX_BRANDING_BYTES } from '@trefaro/shared-models';

/**
 * One multipart part, and nothing else.
 *
 * `files: 1` and `fields: 0` because that is the whole request: an image
 * replaces an image. Anything else in the body is a caller doing something other
 * than what these endpoints do, and refusing it here is cheaper than reasoning
 * about it later.
 *
 * The size limit is the same number `LogoImageService` checks. Both, on purpose:
 * the parser's limit is what keeps the bytes from being read into memory at all,
 * the service's is what still holds for a caller that never went through a
 * controller (a seed script, a later import).
 *
 * Shared between the series and the event endpoint rather than declared twice —
 * two copies of a byte ceiling are two chances for one of them to be raised.
 */
export const LOGO_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_BRANDING_BYTES, files: 1, fields: 0 },
};

/**
 * What the multipart parser hands over — the two properties this needs.
 *
 * Declared here rather than imported, like `MultipartFile` in the branding and
 * registration controllers: the business layer has no other reason to depend on
 * the type package of a parser, and neither the part name nor the original file
 * name matters to a logo. Nothing about the name is kept — a logo is served
 * under a route of its own, never as a download.
 */
export interface LogoMultipartFile {
  readonly mimetype: string;
  readonly buffer: Buffer;
}
