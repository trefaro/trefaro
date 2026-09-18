import { crc32 } from 'node:zlib';

/** One file in the archive: where it sits and what is in it. */
export interface ArchiveEntry {
  /** Path inside the archive, `/` as the separator and never absolute. */
  readonly path: string;
  readonly bytes: Buffer;
}

const LOCAL_HEADER = 0x04034b50;
const CENTRAL_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;

/** ZIP 2.0, which is what "stored, no encryption, no spanning" needs. */
const VERSION = 20;
/** Bit 11: names and comments are UTF-8. */
const UTF8_NAMES = 0x0800;
/** 0 = stored. See {@link zipArchive} for why nothing is deflated. */
const STORED = 0;

/**
 * Writes a ZIP archive with every entry stored rather than compressed.
 *
 * **Why by hand and not with a library.** The archive has one reader — a person
 * who asked for their data — and one writer, here. Everything it carries is
 * either JSON of a few kilobytes or a file somebody uploaded, and those are
 * JPEG, PNG or PDF bytes, all three of which are compressed already: deflating
 * them costs CPU on a request that already reads a person's whole history and
 * buys single-digit percents. What is left of a ZIP library after removing
 * compression and streaming is the byte layout below, and a dependency that
 * ships with the image for one function is a dependency an operator has to
 * update for the rest of the instance's life.
 *
 * **What this deliberately does not do.** No ZIP64, so the archive must stay
 * below 4 GB and 65,535 entries — bounded twice over by `MAX_UPLOAD_BYTES` and
 * by what one person can register for. No directory entries: a path with `/` in
 * it is a directory to every unpacker, and empty directories carry nothing.
 * Whole buffers rather than a stream, for the reason {@link FileStore} gives
 * for the same choice.
 *
 * @param at the timestamp every entry gets, in UTC — one archive is one moment,
 * and a per-file time would be the time a row was read rather than anything
 * about the file.
 */
export function zipArchive(entries: readonly ArchiveEntry[], at: Date): Buffer {
  const time = dosTime(at);
  const date = dosDate(at);

  const local: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.path, 'utf8');
    const sum = crc32(entry.bytes);
    const size = entry.bytes.length;

    const header = Buffer.alloc(30);
    header.writeUInt32LE(LOCAL_HEADER, 0);
    header.writeUInt16LE(VERSION, 4);
    header.writeUInt16LE(UTF8_NAMES, 6);
    header.writeUInt16LE(STORED, 8);
    header.writeUInt16LE(time, 10);
    header.writeUInt16LE(date, 12);
    header.writeUInt32LE(sum, 14);
    header.writeUInt32LE(size, 18);
    header.writeUInt32LE(size, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);

    local.push(header, name, entry.bytes);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(CENTRAL_HEADER, 0);
    record.writeUInt16LE(VERSION, 4);
    record.writeUInt16LE(VERSION, 6);
    record.writeUInt16LE(UTF8_NAMES, 8);
    record.writeUInt16LE(STORED, 10);
    record.writeUInt16LE(time, 12);
    record.writeUInt16LE(date, 14);
    record.writeUInt32LE(sum, 16);
    record.writeUInt32LE(size, 20);
    record.writeUInt32LE(size, 24);
    record.writeUInt16LE(name.length, 28);
    // Extra field, comment, disk number, internal and external attributes are
    // all zero: a file with no attributes is unpacked with the umask of
    // whoever unpacks it, which is what a downloaded archive should do.
    record.writeUInt32LE(offset, 42);

    central.push(record, name);
    offset += header.length + name.length + size;
  }

  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);

  return Buffer.concat([...local, directory, end]);
}

/** MS-DOS time: hours, minutes and two-second steps packed into 16 bits. */
function dosTime(at: Date): number {
  return (
    (at.getUTCHours() << 11) |
    (at.getUTCMinutes() << 5) |
    (at.getUTCSeconds() >> 1)
  );
}

/** MS-DOS date: years since 1980, month and day packed into 16 bits. */
function dosDate(at: Date): number {
  return (
    ((at.getUTCFullYear() - 1980) << 9) |
    ((at.getUTCMonth() + 1) << 5) |
    at.getUTCDate()
  );
}
