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

  async #request(method, path, body, authenticated) {
    const isForm = body instanceof FormData;
    const response = await fetch(`${this.#base}${path}`, {
      method,
      headers: {
        ...(body && !isForm ? { 'content-type': 'application/json' } : {}),
        ...(authenticated && this.#cookie ? { cookie: this.#cookie } : {}),
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

  /** The token of the objection link in an invitation (E15, F58). */
  objectionToken(address) {
    return this.waitForLink(
      address,
      /invitations\/unsubscribe\?token=([A-Za-z0-9_.%-]+)/,
    );
  }
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
