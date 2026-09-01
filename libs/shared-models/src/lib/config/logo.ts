/**
 * The logo of a single series or event (FR 2.1, FR 3.1 — both P1).
 *
 * A second kind of brand image next to the instance's own (`branding.ts`), and
 * the difference is whose brand it is: the organization has one logo for the
 * whole instance, while a series may be run with a partner and an event may
 * carry a campaign mark of its own. Both functional requirements list the logo
 * among the *mandatory* fields, which is why this exists at all — the columns
 * have been in the schema since phase 1 and nothing ever wrote them.
 *
 * **The rules are the branding rules**, deliberately: the same catalogue of
 * types, the same byte ceiling, the same multipart part name. An organizer
 * uploading a picture should not have to learn two answers to "what may I
 * upload here", and a second, laxer set would be the one an attacker picks.
 * So this file adds no rules — only the shape of the answer.
 *
 * **The URL carries no stored path** (E19), like the branding routes: it names
 * the row, and the route resolves the file through that row. The reason is the
 * same and it is the important one — the neighbours of a stored path are
 * registration attachments, which may be passport scans (E9).
 */

/**
 * What the upload and removal endpoints answer with.
 *
 * One URL rather than the pair `BrandingImages` carries, because a row has one
 * image: there is no second field whose `?v=` would go stale alongside it.
 *
 * `null` means the row has no logo and the client falls back — to the
 * organization's own logo where there is a frame for one, to the name otherwise.
 */
export interface LogoImage {
  readonly logoUrl: string | null;
}
