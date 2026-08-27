/**
 * Uploaded files on a registration (F12, FR 3.5, E9) — the field type of AP 7.
 *
 * FR 3.5 names the case: an organization that invites people from abroad has to
 * collect visa documents, and asking for them by mail means a mailbox nobody
 * can search and a document nobody can find again. So a registration form can
 * ask for a file.
 *
 * Four decisions live in this file rather than in the code that uses it:
 *
 * 1. **An organizer picks accepted types from a catalogue, not by typing MIME
 *    types** (F38). A free-text allowlist is a way to accept `.exe`, and it puts
 *    a question to an organizer that nobody outside this file can answer.
 * 2. **There is a ceiling above the organizer's own limit.** The field carries
 *    the limit that fits the document; {@link MAX_UPLOAD_BYTES} is what the
 *    server will read at all, and it exists because the endpoint that accepts
 *    files is public and unauthenticated.
 * 3. **Sizes are shown, never guessed.** {@link formatBytes} is the one place
 *    that turns bytes into something a person reads, so the hint under the input
 *    and the participant overview say the same thing about the same file.
 * 4. **A form asks for at most {@link MAX_FILE_FIELDS} files.** One submission
 *    therefore has a bounded worst case, which a throttled public endpoint
 *    needs to have.
 */

/**
 * The multipart part that carries the form's own fields when a file is sent.
 *
 * Part of the contract rather than of either side: a registration with a file is
 * one request — the alternative, upload first and register second, needs an
 * endpoint that takes files from anybody with no registration to attach them to,
 * and leaves a file behind whenever somebody abandons the form. Multipart cannot
 * express a nested object, so the JSON body travels in a part of its own and
 * every file in a part named after its field key.
 */
export const REGISTRATION_PAYLOAD_PART = 'payload';

/** One entry of the catalogue an organizer chooses accepted types from. */
export interface UploadType {
  readonly mimeType: string;
  /** What the organizer reads in the form builder. */
  readonly label: string;
  /**
   * Extensions for the file picker's `accept` attribute.
   *
   * Alongside the MIME type, because a browser matches either — and a picker
   * that greys out the right file is worse than no filter at all.
   */
  readonly extensions: readonly string[];
}

/**
 * What this application stores.
 *
 * The documents a non-profit actually asks for: passport scans and visa letters
 * (PDF or a photo of them), and filled-in forms. Deliberately absent:
 *
 * - **Archives.** A zip hides its content from every check made here.
 * - **The legacy Office formats.** `.doc` and `.xls` carry macros, and an
 *   organizer opening an attachment should not need to think about that.
 * - **Anything the browser renders as a document.** HTML or SVG served from the
 *   same origin as the organizer client would be that client's own script.
 */
export const UPLOAD_TYPES: readonly UploadType[] = [
  { mimeType: 'application/pdf', label: 'PDF', extensions: ['.pdf'] },
  {
    mimeType: 'image/jpeg',
    label: 'JPEG image',
    extensions: ['.jpg', '.jpeg'],
  },
  { mimeType: 'image/png', label: 'PNG image', extensions: ['.png'] },
  { mimeType: 'image/webp', label: 'WebP image', extensions: ['.webp'] },
  {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    label: 'Word document (.docx)',
    extensions: ['.docx'],
  },
];

export const UPLOAD_MIME_TYPES: readonly string[] = UPLOAD_TYPES.map(
  (type) => type.mimeType,
);

/**
 * The most one uploaded file may ever be, whatever a field says.
 *
 * The endpoint that accepts it is public and unauthenticated, so this is the
 * number that bounds what a stranger can make the server read into memory.
 */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/**
 * The most one whole submission may carry, across all its file fields.
 *
 * Five files of {@link MAX_UPLOAD_BYTES} would be fifty megabytes, which is more
 * than the reverse proxy in front of a production instance accepts as a request
 * body (`client_max_body_size 25m` in `infra/nginx/trefaro.conf`). That limit
 * exists for good reasons, but a proxy refusing a body answers with a page
 * nobody wrote — so the application's own bound sits below it and says what is
 * wrong in words. Raising this means raising the proxy's limit with it.
 */
export const MAX_SUBMISSION_BYTES = 20 * 1024 * 1024;

/** What the form builder proposes — a scanned document, comfortably. */
export const DEFAULT_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

/** Below this a limit only produces failed uploads. */
export const MIN_UPLOAD_MAX_BYTES = 64 * 1024;

/**
 * How many files one registration form may ask for.
 *
 * Not a technical bound but a bounded worst case: five times
 * {@link MAX_UPLOAD_BYTES} is what one submission of a throttled public endpoint
 * can cost. A form asking for a sixth document is asking too much of a
 * participant anyway.
 */
export const MAX_FILE_FIELDS = 5;

/** The longest original file name that is kept; longer ones are shortened. */
export const MAX_FILE_NAME_LENGTH = 200;

/** The label of a catalogue entry, or the bare MIME type if it is not one. */
export function uploadTypeLabel(mimeType: string): string {
  return (
    UPLOAD_TYPES.find((type) => type.mimeType === mimeType)?.label ?? mimeType
  );
}

/** The `accept` attribute of a file input: MIME types and extensions. */
export function acceptAttribute(mimeTypes: readonly string[]): string {
  const entries = mimeTypes.flatMap((mimeType) => {
    const type = UPLOAD_TYPES.find((entry) => entry.mimeType === mimeType);
    return type ? [type.mimeType, ...type.extensions] : [mimeType];
  });
  return [...new Set(entries)].join(',');
}

/**
 * A byte count as a person reads it.
 *
 * Steps of 1024 with the familiar labels, one decimal from a megabyte upwards:
 * "4.7 MB" is what somebody comparing this to what their file manager says
 * expects to see, and the exact number is not the point of either.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, Math.round(bytes))} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${Math.round(kilobytes)} KB`;
  return `${(kilobytes / 1024).toFixed(1)} MB`;
}

/**
 * One stored file of one registration, as the organizer client shows it.
 *
 * Deliberately without a URL: the bytes are fetched from
 * `/api/admin/attachments/:id` with an administrative session, because an
 * attachment can be a passport scan and the volume is never served statically
 * (E9). What travels here is what a list needs to render — and the id the
 * download needs.
 */
export interface AttachmentSummary {
  readonly id: string;
  /** The field that asked for it (F35); stable across a rewording. */
  readonly fieldKey: string;
  /** The name the participant's file had, kept for the download. */
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** ISO 8601 — when it was uploaded, which is when the form was submitted. */
  readonly uploadedAt: string;
}
