/**
 * How many pixels wide and tall an image is, read from its own header.
 *
 * There is exactly one caller and exactly one reason for it: the PWA manifest
 * has to declare `sizes` for the icon an organization uploaded (E26, F20), and a
 * declared size is a claim a browser acts on — it picks the icon closest to the
 * size it wants and refuses to install an application whose icons are all too
 * small. Guessing `"any"` for a raster image would be a claim we cannot back;
 * omitting the member leaves the icon last in every browser's ranking.
 *
 * This is **not** the image validation AP 2 ruled out. Nothing is refused
 * because of what this function returns, no upload path calls it, and it opens
 * no image: it reads the fixed offsets of three container headers, in the same
 * spirit and the same file neighbourhood as `file-signature.ts` — a dependency
 * would be a native module in a self-hosted image (NFR 3) for twenty lines of
 * arithmetic.
 *
 * `null` means "this header does not say", which is a legitimate answer for a
 * progressive or exotic variant. The caller has a rule for it that keeps the
 * application installable either way.
 */

/** Pixel dimensions of an image, as its header declares them. */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/**
 * The dimensions of a PNG, JPEG or WebP, or `null`.
 *
 * The type is decided by the bytes rather than passed in, for the same reason
 * `signatureType` exists: a stored branding image has no name and no type
 * column, so its own header is the only thing that can say what it is.
 */
export function imageDimensions(bytes: Buffer): ImageDimensions | null {
  return pngSize(bytes) ?? jpegSize(bytes) ?? webpSize(bytes) ?? null;
}

/**
 * PNG: the IHDR chunk is mandatory and comes first, at a fixed offset.
 *
 * Eight bytes of signature, four of chunk length, four of chunk type — so the
 * two big-endian dimensions start at byte 16.
 */
function pngSize(bytes: Buffer): ImageDimensions | null {
  const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return null;
  if (!PNG_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;
  if (bytes.subarray(12, 16).toString('latin1') !== 'IHDR') return null;

  return sane(bytes.readUInt32BE(16), bytes.readUInt32BE(20));
}

/**
 * JPEG: walk the marker segments until a start-of-frame declares the size.
 *
 * A JPEG has no fixed offset — the frame header sits behind an arbitrary number
 * of application and quantisation segments, so the segments are skipped by their
 * own length fields. Every SOFn marker carries the dimensions in the same place;
 * the four in the C0–CF range that are not frame headers are stepped over.
 */
function jpegSize(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

  // Markers that live in the SOFn range without being one.
  const NOT_A_FRAME = new Set([0xc4, 0xc8, 0xcc]);
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;

    const marker = bytes[offset + 1];
    // Padding between segments is written as repeated 0xff.
    if (marker === 0xff) {
      offset += 1;
      continue;
    }
    // Standalone markers: no length, nothing to skip.
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) {
      offset += 2;
      continue;
    }

    const length = bytes.readUInt16BE(offset + 2);
    if (length < 2) return null;

    if (marker >= 0xc0 && marker <= 0xcf && !NOT_A_FRAME.has(marker)) {
      // precision(1), height(2), width(2) — after the two length bytes.
      if (offset + 9 > bytes.length) return null;
      return sane(
        bytes.readUInt16BE(offset + 7),
        bytes.readUInt16BE(offset + 5),
      );
    }

    offset += 2 + length;
  }

  return null;
}

/**
 * WebP: three shapes of the same container, each with the size in its own place.
 *
 * `VP8 ` is lossy, `VP8L` lossless and `VP8X` the extended form that carries a
 * canvas size for animated or alpha images. All three are legal for an upload
 * this instance accepts, so all three are read.
 */
function webpSize(bytes: Buffer): ImageDimensions | null {
  if (bytes.length < 16) return null;
  if (bytes.subarray(0, 4).toString('latin1') !== 'RIFF') return null;
  if (bytes.subarray(8, 12).toString('latin1') !== 'WEBP') return null;

  // Each form is bounds-checked on its own: they need different numbers of
  // bytes, and a shared floor would reject the smallest legal lossless file.
  switch (bytes.subarray(12, 16).toString('latin1')) {
    case 'VP8 ': {
      if (bytes.length < 30) return null;
      // The frame tag, then a three-byte start code, then two 14-bit sizes.
      if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
        return null;
      }
      return sane(
        bytes.readUInt16LE(26) & 0x3fff,
        bytes.readUInt16LE(28) & 0x3fff,
      );
    }
    case 'VP8L': {
      if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
      const packed = bytes.readUInt32LE(21);
      return sane((packed & 0x3fff) + 1, ((packed >> 14) & 0x3fff) + 1);
    }
    case 'VP8X': {
      if (bytes.length < 30) return null;
      // Four bytes of flags, then two three-byte little-endian canvas sizes.
      return sane(bytes.readUIntLE(24, 3) + 1, bytes.readUIntLE(27, 3) + 1);
    }
    default:
      return null;
  }
}

/** A header that declares a zero dimension has not declared a size. */
function sane(width: number, height: number): ImageDimensions | null {
  return width > 0 && height > 0 ? { width, height } : null;
}
