import { UPLOAD_MIME_TYPES } from '@trefaro/shared-models';
import { matchesSignature, typesWithoutSignature } from './file-signature';

/**
 * The check that makes the allowlist mean something (E9).
 *
 * Without it, "this field accepts PDF" says only that the sender wrote `PDF` in
 * a header they control.
 */
describe('matchesSignature', () => {
  const pdf = Buffer.from('%PDF-1.7\n', 'latin1');
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Buffer.concat([
    Buffer.from('RIFF', 'latin1'),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from('WEBP', 'latin1'),
  ]);
  const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
  const docxType =
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  it('recognizes every type the catalogue offers', () => {
    expect(matchesSignature('application/pdf', pdf)).toBe(true);
    expect(matchesSignature('image/jpeg', jpeg)).toBe(true);
    expect(matchesSignature('image/png', png)).toBe(true);
    expect(matchesSignature('image/webp', webp)).toBe(true);
    expect(matchesSignature(docxType, docx)).toBe(true);
  });

  it('refuses an executable that says it is a PDF', () => {
    // The case this exists for: `passport.pdf` with a DOS header.
    expect(
      matchesSignature('application/pdf', Buffer.from('MZ\u0090\u0000')),
    ).toBe(false);
  });

  it('refuses one catalogue type presented as another', () => {
    expect(matchesSignature('application/pdf', png)).toBe(false);
    expect(matchesSignature('image/png', pdf)).toBe(false);
  });

  it('refuses a RIFF container that is not WebP', () => {
    const wav = Buffer.concat([
      Buffer.from('RIFF', 'latin1'),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from('WAVE', 'latin1'),
    ]);

    expect(matchesSignature('image/webp', wav)).toBe(false);
  });

  it('refuses a file too short to have a signature', () => {
    expect(matchesSignature('application/pdf', Buffer.from('%P'))).toBe(false);
    expect(matchesSignature('application/pdf', Buffer.alloc(0))).toBe(false);
  });

  it('refuses a type it does not know', () => {
    // Safe because the catalogue is closed: a field cannot accept a type that
    // has no signature here, so this answer is only ever reached by a request
    // that was going to be refused anyway.
    expect(matchesSignature('application/zip', docx)).toBe(false);
  });

  it('has a signature for every accepted type', () => {
    // The one that would break silently: adding a type to the catalogue without
    // a signature would make every upload of it fail with "not what it claims".
    expect(typesWithoutSignature()).toEqual([]);
    expect(UPLOAD_MIME_TYPES.length).toBeGreaterThan(0);
  });
});
