import { MAX_MESSAGE_IMAGE_BYTES } from '@trefaro/shared-models';

/**
 * What the multipart parser may accept for one message (E40).
 *
 * `files: 1` because a message carries at most one picture, and `fields: 1`
 * because the only field is its text — anything else in the body is a caller
 * doing something other than what this endpoint does, and refusing it here is
 * cheaper than reasoning about it later.
 *
 * Its own options rather than `IMAGE_UPLOAD_OPTIONS`: that one allows no
 * fields at all (an image replaces an image) and carries the much smaller
 * `MAX_BRANDING_BYTES`. The size limit is the same number `ImageFileService`
 * checks, and both on purpose — the parser's limit is what keeps the bytes
 * from being read into memory at all, the service's is what still holds for a
 * caller that never went through a controller.
 */
export const MESSAGE_UPLOAD_OPTIONS = {
  limits: { fileSize: MAX_MESSAGE_IMAGE_BYTES, files: 1, fields: 1 },
};

/**
 * One multipart file part, as the parser hands it over.
 *
 * Declared here rather than imported, like `MultipartFile` in the registration
 * controller and `ImageMultipartFile` in `business/common/`: the business layer
 * has no other reason to depend on the type package of a parser. Unlike the
 * branding and avatar uploads this one keeps the **name** — the `attachment`
 * row wants one, and it is what an operator matching a file in the volume to a
 * line in a conversation has.
 */
export interface MessageMultipartFile {
  readonly originalname: string;
  readonly mimetype: string;
  readonly buffer: Buffer;
}
