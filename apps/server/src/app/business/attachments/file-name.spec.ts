import { MAX_FILE_NAME_LENGTH } from '@trefaro/shared-models';
import { contentDisposition, safeFileName } from './file-name';

describe('safeFileName', () => {
  it('keeps an ordinary name as it is', () => {
    // The name is what tells an organizer which document is whose.
    expect(safeFileName('Reisepass Amina.pdf')).toBe('Reisepass Amina.pdf');
  });

  it('drops everything that looks like a path', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\amina\\visa.pdf')).toBe('visa.pdf');
  });

  it('removes what would let a sender write headers of their own', () => {
    expect(safeFileName('pass"port\r\nX-Evil: 1.pdf')).toBe(
      'passportX-Evil: 1.pdf',
    );
  });

  it('shortens a name no filesystem would take', () => {
    const long = `${'a'.repeat(MAX_FILE_NAME_LENGTH + 50)}.pdf`;

    expect(safeFileName(long)).toHaveLength(MAX_FILE_NAME_LENGTH);
  });

  it('falls back to a neutral name rather than to nothing', () => {
    expect(safeFileName('"""')).toBe('attachment');
    expect(safeFileName('...')).toBe('attachment');
    expect(safeFileName('   ')).toBe('attachment');
  });
});

describe('contentDisposition', () => {
  it('always offers the file for download, never for display', () => {
    // The API answers on the same origin as the organizer client behind the
    // reverse proxy: a file the browser renders there would run inside it.
    expect(contentDisposition('visa.pdf')).toContain('attachment;');
  });

  it('carries a non-ASCII name twice, so every browser gets one', () => {
    const header = contentDisposition('Grüße.pdf');

    // One underscore per replaced character — ü and ß.
    expect(header).toContain('filename="Gr__e.pdf"');
    expect(header).toContain("filename*=UTF-8''Gr%C3%BC%C3%9Fe.pdf");
  });

  it('cannot be broken out of with a quote', () => {
    expect(contentDisposition('a"; evil="1.pdf')).toBe(
      'attachment; filename="a; evil=1.pdf"; filename*=UTF-8\'\'a%3B%20evil%3D1.pdf',
    );
  });
});
