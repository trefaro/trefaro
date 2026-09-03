import { createECDH, randomBytes } from 'node:crypto';
import { createServer, type Server } from 'node:net';
import type { AddressInfo } from 'node:net';

/**
 * A push service, played by this suite — as far as it can be (FR 3.15).
 *
 * Web Push has three parties: the instance, a browser, and the push service
 * the browser's vendor runs in between. Nothing here can test against
 * Mozilla's or Google's, and a subscription pointing at one of them would be a
 * test that either notifies a stranger or asserts nothing. So the third party
 * is local — **one listening socket per device**, which is what makes the
 * audience readable: a connection on a device's own port is that device being
 * notified, and nothing else can produce one.
 *
 * **It does not speak HTTPS, and it cannot.** `web-push` sends every
 * notification with `https.request` whatever the endpoint's scheme says, so a
 * plain HTTP sink is met with a TLS handshake, and a TLS sink would need a
 * certificate the server process trusts — which means either a committed
 * certificate authority in the server's environment or an agent that skips
 * verification. Neither is worth having in a repository where the same code
 * ships to an organization's server: a test must not be the reason production
 * code can accept an unverified certificate.
 *
 * So a "delivery" here is the connection, and the instance then records a
 * failed one. What that is enough for is everything this package decides:
 * **who** is notified, when nothing is, and that both switches are asked.
 * What it deliberately does not cover:
 *
 * - what a notification *says* — decided in `push-texts.spec.ts`, against the
 *   catalogues this image really ships;
 * - that a `410 Gone` removes a subscription — decided in
 *   `push.service.spec.ts`, where the push library is a mock;
 * - that a notification appears on a screen — the device matrix in
 *   `docs/spikes/03-web-push.md`, which needs a person and four devices.
 *
 * **The keys are real.** `web-push` encrypts the payload for the subscription
 * it is sending to, so a made-up `p256dh` throws inside the library before
 * anything is sent — indistinguishable, from here, from a notification that
 * was never meant to go out. Each device therefore gets a genuine P-256 public
 * key; the private half is thrown away, because nothing here decrypts.
 */
export interface PushDevice {
  /** The name this device is asserted under. */
  readonly name: string;
  /** The endpoint the browser would have handed over. */
  readonly endpoint: string;
  readonly keys: { readonly p256dh: string; readonly auth: string };
}

export interface PushSink {
  /** A device with a listening socket of its own. */
  device(name: string): Promise<PushDevice>;
  /** How often one device has been contacted since the last {@link forget}. */
  countFor(name: string): number;
  /** The devices contacted since the last {@link forget}, sorted, with repeats. */
  notified(): readonly string[];
  forget(): void;
  /** Waits until `count` notifications have arrived in total, or gives up. */
  waitFor(count: number, timeoutMs?: number): Promise<boolean>;
  /** Waits for silence: nothing more arrives within `quietMs`. */
  quiet(quietMs?: number): Promise<void>;
  close(): Promise<void>;
}

export async function startPushSink(): Promise<PushSink> {
  const servers: Server[] = [];
  const counts = new Map<string, number>();
  let total = 0;

  return {
    async device(name) {
      const server = createServer((socket) => {
        counts.set(name, (counts.get(name) ?? 0) + 1);
        total += 1;
        // Nothing is read: what arrives is the first bytes of a TLS
        // handshake, and the connection is the fact this suite needs.
        socket.destroy();
      });
      servers.push(server);

      await new Promise<void>((resolve) => {
        // Port 0: the operating system picks one, so two runs cannot collide.
        server.listen(0, '127.0.0.1', resolve);
      });
      const { port } = server.address() as AddressInfo;

      const ecdh = createECDH('prime256v1');
      ecdh.generateKeys();
      return {
        name,
        endpoint: `http://127.0.0.1:${port}/push/${name}`,
        keys: {
          // The uncompressed point, which is what a browser hands over.
          p256dh: ecdh.getPublicKey().toString('base64url'),
          auth: randomBytes(16).toString('base64url'),
        },
      };
    },
    countFor: (name) => counts.get(name) ?? 0,
    notified: () =>
      [...counts]
        .flatMap(([name, count]) => Array.from({ length: count }, () => name))
        .sort(),
    forget: () => {
      counts.clear();
      total = 0;
    },
    async waitFor(count, timeoutMs = 8000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        if (total >= count) return true;
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return false;
    },
    async quiet(quietMs = 750) {
      // A notification is deliberately not awaited by the request that caused
      // it, so "nothing was sent" can only be asserted after waiting. Short,
      // because the alternative to waiting is an assertion that passes whether
      // or not the rule holds.
      let seen = total;
      for (;;) {
        await new Promise((resolve) => setTimeout(resolve, quietMs));
        if (total === seen) return;
        seen = total;
      }
    },
    async close() {
      await Promise.all(
        servers.map(
          (server) =>
            new Promise<void>((resolve) => server.close(() => resolve())),
        ),
      );
    },
  };
}
