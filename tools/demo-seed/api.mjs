/**
 * The two clients this seed talks to: the API, and the mailbox.
 *
 * Everything the seed creates goes through the public and administrative HTTP
 * interfaces — no SQL, no `docker exec`, no writing into the upload volume. That
 * costs a few seconds and buys three things: the seed cannot create a state the
 * application itself would refuse, it works unchanged against `nx serve` and
 * against the container stack, and a run that succeeds is also a smoke test of
 * the deployment it ran against.
 *
 * The mailbox is not decoration. A registration becomes real by being confirmed
 * from the mailed link, a participant reaches their own page through a signed
 * token in their receipt, and an objection is a token out of an invitation — so
 * a seed that wants those states has to read the mail that carries them, exactly
 * as a person would.
 */

import { deflateSync } from 'node:zlib';

/** Thin HTTP client that keeps the administrative session cookie. */
export class Api {
  #base;
  #cookie = '';

  constructor(base) {
    this.#base = base.replace(/\/+$/, '');
  }

  async login(email, password) {
    let response;
    try {
      response = await fetch(`${this.#base}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch (cause) {
      // The first request is where a wrong address shows up, and "fetch failed"
      // on its own tells nobody which address was wrong.
      throw new Error(
        `No answer from ${this.#base}. Is the instance running, and is --base ` +
          'right? The container stack listens on 8080, a development server on ' +
          `3000. (${cause instanceof Error ? cause.message : cause})`,
      );
    }
    if (response.status === 401) {
      throw new Error(
        `The administrator ${email} was not accepted. Set SEED_ADMIN_EMAIL and ` +
          'SEED_ADMIN_PASSWORD, or ADMIN_BOOTSTRAP_EMAIL and ADMIN_BOOTSTRAP_PASSWORD.',
      );
    }
    if (response.status === 429) {
      throw new Error(
        'The login is rate-limited (20 attempts per five minutes). Wait, or ' +
          'restart the server — the counter lives in memory.',
      );
    }
    if (!response.ok) {
      throw new Error(
        `login failed: ${response.status} ${await response.text()}`,
      );
    }
    this.#cookie = (response.headers.getSetCookie() ?? [])
      .map((value) => value.split(';')[0])
      .join('; ');
  }

  /** A request with the session, JSON in and JSON out. */
  admin(method, path, body) {
    return this.#request(method, path, body, true);
  }

  /** A request without the session, the way a participant's browser makes it. */
  user(method, path, body) {
    return this.#request(method, path, body, false);
  }

  /** A form submission with files, the way a browser with a file field sends it. */
  form(path, formData) {
    return this.#request('POST', path, formData, false);
  }

  /** An administrative upload — the logo and the app icon are `PUT` (E19). */
  adminForm(method, path, formData) {
    return this.#request(method, path, formData, true);
  }

  async #request(method, path, body, authenticated) {
    return send(
      this.#base,
      method,
      path,
      body,
      authenticated ? this.#cookie : '',
    );
  }
}

/**
 * One request, for both kinds of session this seed keeps.
 *
 * Shared rather than written twice: the throttle message is the one a run
 * actually hits, and a second copy of it would be a second place to keep the
 * numbers right.
 */
async function send(base, method, path, body, cookie) {
  const isForm = body instanceof FormData;
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: isForm ? body : JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  if (response.status === 429) {
    throw new Error(
      `${method} ${path} was throttled (429). The public form and the ` +
        'confirmation endpoint allow sixty calls per five minutes each, per ' +
        'client address — one seed run fits, two in a row do not. Wait five ' +
        'minutes, or restart the server to clear the counter.',
    );
  }
  if (!response.ok) {
    throw new Error(
      `${method} ${path} → ${response.status} ${text.slice(0, 400)}`,
    );
  }
  return text ? JSON.parse(text) : null;
}

/**
 * One participant's own session — the second kind of caller this seed has.
 *
 * A separate class rather than a second cookie on `Api`, because the seed holds
 * ten of these at once: every account it creates keeps its session while the
 * community half is written, and a forum post, a proposal and a message are
 * only worth anything if they carry a name. The login route is the
 * administrator's limit (twenty attempts per five minutes per client address),
 * which is why ten accounts is a number and not an accident.
 */
export class Participant {
  #base;
  #cookie = '';

  /**
   * The account itself, out of `GET /api/participant/me` — id, name, avatar.
   *
   * The endpoint answers `{ participant, expiresAt }`, because what the client
   * asks it is "who is logged in, and until when". This keeps the first half:
   * the seed never needs to know when a session lapses, and it needs the id in
   * every second line.
   */
  me = null;

  constructor(base) {
    this.#base = base.replace(/\/+$/, '');
  }

  async login(email, password) {
    const response = await fetch(`${this.#base}/api/participant/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (response.status === 403) {
      throw new Error(
        `${email} exists but is not confirmed. The confirmation link is in the ` +
          'mailbox — without it there is no session.',
      );
    }
    if (response.status === 429) {
      throw new Error(
        'The participant login is rate-limited (twenty attempts per five ' +
          'minutes, LOGIN_ATTEMPTS_PER_WINDOW). Wait, or restart the server.',
      );
    }
    if (!response.ok) {
      throw new Error(
        `login as ${email} failed: ${response.status} ${await response.text()}`,
      );
    }
    this.#cookie = (response.headers.getSetCookie() ?? [])
      .map((value) => value.split(';')[0])
      .join('; ');
    const session = await this.request('GET', '/api/participant/me');
    this.me = session.participant;
    return this;
  }

  /** A request with this participant's session. */
  request(method, path, body) {
    return send(this.#base, method, path, body, this.#cookie);
  }

  /** An upload with this participant's session — the avatar is a `PUT` (E19). */
  form(method, path, formData) {
    return send(this.#base, method, path, formData, this.#cookie);
  }
}

/** Reads what the instance actually sent. */
export class Mailbox {
  #base;

  constructor(base) {
    this.#base = base.replace(/\/+$/, '');
  }

  /** Whether the mailbox answers at all — the seed says what it will skip if not. */
  async reachable() {
    try {
      const response = await fetch(`${this.#base}/api/v1/messages?limit=1`);
      return response.ok;
    } catch {
      return false;
    }
  }

  async clear() {
    await fetch(`${this.#base}/api/v1/messages`, { method: 'DELETE' });
  }

  /**
   * The newest message to an address whose body carries `pattern`.
   *
   * The pattern rather than the subject, because what the caller needs is the
   * link, and a message without it is the wrong one however it is titled.
   */
  async waitForLink(address, pattern, timeoutMs = 20_000) {
    const deadline = Date.now() + timeoutMs;
    let seen = 0;

    while (Date.now() < deadline) {
      const list = await fetch(`${this.#base}/api/v1/messages?limit=500`);
      const { messages = [] } = await list.json();
      const candidates = messages.filter((message) =>
        (message.To ?? []).some(
          (recipient) =>
            recipient.Address.toLowerCase() === address.toLowerCase(),
        ),
      );
      seen = candidates.length;

      for (const candidate of candidates) {
        const detail = await fetch(
          `${this.#base}/api/v1/message/${candidate.ID}`,
        );
        const { Text = '' } = await detail.json();
        const match = pattern.exec(Text);
        if (match) return match[1];
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new Error(
      `no mail for ${address} matching ${pattern} within ${timeoutMs / 1000}s ` +
        `(${seen} message(s) for that address)`,
    );
  }

  /** The token of the double opt-in link (E5b). */
  confirmationToken(address) {
    return this.waitForLink(
      address,
      /registrations\/confirm\?token=([A-Za-z0-9_.%-]+)/,
    );
  }

  /** The token of the personal "my registration" link in a receipt (E11). */
  selfServiceToken(address) {
    return this.waitForLink(
      address,
      /registrations\/me\?token=([A-Za-z0-9_.%-]+)/,
    );
  }

  /** The token of the double opt-in link of a participant account (E32). */
  profileConfirmationToken(address) {
    return this.waitForLink(
      address,
      /profile\/confirm\?token=([A-Za-z0-9_.%-]+)/,
    );
  }

  /** The token of the objection link in an invitation (E15, F58). */
  objectionToken(address) {
    return this.waitForLink(
      address,
      /invitations\/unsubscribe\?token=([A-Za-z0-9_.%-]+)/,
    );
  }
}

/**
 * A PNG, drawn pixel by pixel, so the demo instance has a brand of its own.
 *
 * Generated for the same reason as the PDF below: a binary in the repository is
 * a thing that has to be explained, and the server reads the first bytes to
 * decide what a file is (F38) — and, since AP 12, reads the header again to
 * learn the app icon's size (F106). A hand-written PNG satisfies both because it
 * really is one.
 *
 * Uncompressed-in-spirit: one `IDAT` over the whole image with the "none" filter
 * on every row, which zlib then deflates. That is the simplest encoder that
 * produces a file every decoder accepts, and the images are small enough that
 * nothing better is worth the lines.
 *
 * `paint(x, y)` answers `[r, g, b, a]`, so the drawing stays in `demo-data.mjs`
 * where the rest of the content is.
 */
export function demoPng(width, height, paint) {
  const stride = 1 + width * 4;
  const raw = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    // Filter byte 0: this row is stored as it is.
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const [r, g, b, a] = paint(x, y);
      const at = row + 1 + x * 4;
      raw[at] = r;
      raw[at + 1] = g;
      raw[at + 2] = b;
      raw[at + 3] = a;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // colour type: truecolour with alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', deflateSync(raw)),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'latin1');
  data.copy(out, 8);
  // The checksum covers the type and the data, not the length.
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * A small but genuinely valid PDF, so the attachment feature has real bytes.
 *
 * Generated rather than committed: a binary in the repository is a thing that
 * has to be explained, and the server checks the first bytes against the claimed
 * type (F38) — which this satisfies because it really is a PDF.
 */
export function demoPdf(text) {
  const content = Buffer.from(
    `BT /F1 14 Tf 60 760 Td (${text}) Tj ET`,
    'latin1',
  );
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ' +
      '/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((body, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startxref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  }
  pdf +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
    `startxref\n${startxref}\n%%EOF\n`;

  return Buffer.from(pdf, 'latin1');
}
