import { imageDimensions } from './image-dimensions';

/**
 * The headers are hand-built here rather than checked in as fixture files.
 *
 * Three formats, three offsets, and the point of the test is exactly those
 * offsets — a fixture would prove that one particular export of one particular
 * image reads correctly, and hide which byte the answer came from.
 */
function png(width: number, height: number): Buffer {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write('IHDR', 12, 'latin1');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

/** A JPEG with an application segment in front of the frame header. */
function jpeg(width: number, height: number, marker = 0xc0): Buffer {
  const app0 = Buffer.alloc(18);
  app0.writeUInt16BE(0xffe0, 0);
  app0.writeUInt16BE(16, 2);
  app0.write('JFIF\0', 4, 'latin1');

  const frame = Buffer.alloc(11);
  frame.writeUInt8(0xff, 0);
  frame.writeUInt8(marker, 1);
  frame.writeUInt16BE(9, 2);
  frame.writeUInt8(8, 4);
  frame.writeUInt16BE(height, 5);
  frame.writeUInt16BE(width, 7);

  return Buffer.concat([Buffer.from([0xff, 0xd8]), app0, frame]);
}

function riff(form: string, chunk: Buffer): Buffer {
  const header = Buffer.alloc(20);
  header.write('RIFF', 0, 'latin1');
  header.writeUInt32LE(12 + chunk.length, 4);
  header.write('WEBP', 8, 'latin1');
  header.write(form, 12, 'latin1');
  header.writeUInt32LE(chunk.length, 16);
  return Buffer.concat([header, chunk]);
}

function webpLossy(width: number, height: number): Buffer {
  const chunk = Buffer.alloc(10);
  Buffer.from([0x9d, 0x01, 0x2a]).copy(chunk, 3);
  chunk.writeUInt16LE(width, 6);
  chunk.writeUInt16LE(height, 8);
  return riff('VP8 ', chunk);
}

function webpLossless(width: number, height: number): Buffer {
  const chunk = Buffer.alloc(5);
  chunk.writeUInt8(0x2f, 0);
  chunk.writeUInt32LE((width - 1) | ((height - 1) << 14), 1);
  return riff('VP8L', chunk);
}

function webpExtended(width: number, height: number): Buffer {
  const chunk = Buffer.alloc(10);
  chunk.writeUIntLE(width - 1, 4, 3);
  chunk.writeUIntLE(height - 1, 7, 3);
  return riff('VP8X', chunk);
}

describe('imageDimensions', () => {
  it('reads a PNG from its IHDR chunk', () => {
    expect(imageDimensions(png(512, 512))).toEqual({
      width: 512,
      height: 512,
    });
  });

  it('reads a JPEG behind an application segment', () => {
    expect(imageDimensions(jpeg(192, 96))).toEqual({ width: 192, height: 96 });
  });

  it('reads a progressive JPEG, whose frame marker is a different one', () => {
    expect(imageDimensions(jpeg(300, 200, 0xc2))).toEqual({
      width: 300,
      height: 200,
    });
  });

  it('does not mistake a Huffman table for a frame header', () => {
    // 0xc4 sits in the SOFn range without being one — reading it as a frame
    // would answer with two bytes of a table.
    const table = Buffer.alloc(8);
    table.writeUInt16BE(0xffc4, 0);
    table.writeUInt16BE(6, 2);
    const withTable = Buffer.concat([
      Buffer.from([0xff, 0xd8]),
      table,
      jpeg(64, 64).subarray(2),
    ]);
    expect(imageDimensions(withTable)).toEqual({ width: 64, height: 64 });
  });

  it.each([
    ['lossy', webpLossy(144, 144)],
    ['lossless', webpLossless(256, 128)],
    ['extended', webpExtended(1024, 768)],
  ])('reads a %s WebP', (_form, bytes) => {
    expect(imageDimensions(bytes)).not.toBeNull();
  });

  it('reads each WebP form at its own offset', () => {
    expect(imageDimensions(webpLossy(144, 144))).toEqual({
      width: 144,
      height: 144,
    });
    expect(imageDimensions(webpLossless(256, 128))).toEqual({
      width: 256,
      height: 128,
    });
    expect(imageDimensions(webpExtended(1024, 768))).toEqual({
      width: 1024,
      height: 768,
    });
  });

  it('answers null for bytes that are not an image it reads', () => {
    expect(imageDimensions(Buffer.from('%PDF-1.7'))).toBeNull();
    expect(imageDimensions(Buffer.alloc(0))).toBeNull();
    // A PNG signature with nothing behind it: a truncated file says nothing
    // about its size, and must not answer with whatever the padding holds.
    expect(imageDimensions(png(8, 8).subarray(0, 18))).toBeNull();
  });

  it('answers null for a header that declares a zero dimension', () => {
    expect(imageDimensions(png(0, 512))).toBeNull();
  });
});
