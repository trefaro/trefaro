import { execFileSync } from 'node:child_process';
import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { zipArchive } from './zip-archive';

/**
 * The archive is written by hand, so it is read back by something that was not.
 *
 * Python's `zipfile`, not `unzip`: the Info-ZIP build Debian ships is compiled
 * without Unicode support and reads a UTF-8 name as if it were CP437, so a file
 * called `lebenslauf-öäü.txt` lands on disk under a different name than the
 * archive says. A reference implementation has to honour the flag the writer
 * sets, or the test measures the reader. `extractall` verifies every entry's
 * CRC on the way out, which is the other half of what `unzip -t` does.
 *
 * Unpacked onto a real filesystem rather than listed, because that is what a
 * person ends up with.
 */
describe('zipArchive', () => {
  const at = new Date('2026-09-18T11:22:34.000Z');
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'trefaro-zip-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  function unpack(archive: Buffer): Record<string, Buffer> {
    const file = join(dir, 'archive.zip');
    const out = join(dir, 'out');
    writeFileSync(file, archive);

    execFileSync('python3', [
      '-c',
      'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])',
      file,
      out,
    ]);

    const found: Record<string, Buffer> = {};
    for (const entry of readdirSync(out, {
      recursive: true,
      withFileTypes: true,
    })) {
      if (!entry.isFile()) continue;
      const path = join(entry.parentPath, entry.name);
      found[relative(out, path)] = readFileSync(path);
    }
    return found;
  }

  it('writes an archive a reader accepts, entry by entry', () => {
    const files = unpack(
      zipArchive(
        [
          { path: 'export.json', bytes: Buffer.from('{"a":1}', 'utf8') },
          { path: 'files/note.txt', bytes: Buffer.from('hello', 'utf8') },
        ],
        at,
      ),
    );

    expect(Object.keys(files).sort()).toEqual([
      'export.json',
      'files/note.txt',
    ]);
    expect(files['export.json'].toString('utf8')).toBe('{"a":1}');
    expect(files['files/note.txt'].toString('utf8')).toBe('hello');
  });

  it('keeps bytes that are not text intact', () => {
    const bytes = Buffer.from([0x00, 0xff, 0x10, 0x80, 0x7f, 0x00]);
    const files = unpack(zipArchive([{ path: 'blob.bin', bytes }], at));

    expect(Buffer.compare(files['blob.bin'], bytes)).toBe(0);
  });

  it('keeps a name that is not ASCII', () => {
    const files = unpack(
      zipArchive(
        [{ path: 'anmeldungen/lebenslauf-öäü.txt', bytes: Buffer.from('x') }],
        at,
      ),
    );

    expect(Object.keys(files)).toEqual([
      join('anmeldungen', 'lebenslauf-öäü.txt'),
    ]);
  });

  it('writes an empty archive as the end record alone', () => {
    // The export never produces this one — there is always a JSON — but a
    // caller that passed nothing should get a file that opens rather than a
    // truncated one: twenty-two bytes, no entries, no central directory.
    const archive = zipArchive([], at);

    expect(archive.length).toBe(22);
    expect(archive.readUInt32LE(0)).toBe(0x06054b50);
    expect(archive.readUInt16LE(10)).toBe(0);
  });
});
