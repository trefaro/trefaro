/**
 * A file as it arrives from a form submission, before anything is stored.
 *
 * The business layer's own shape, not the web framework's: what a multipart
 * parser hands over is an implementation detail of the transport, and a service
 * that took it directly could not be tested without one.
 *
 * `mimeType` and `fileName` come from the browser and are therefore claims, not
 * facts. Both are checked before a byte is written — the type against the
 * field's allowlist *and* against the file's own signature, the name by being
 * reduced to something safe to hand back as a download.
 */
export interface UploadedFile {
  /** The field this answers — the name of the multipart part (F35). */
  readonly fieldKey: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Buffer;
}
