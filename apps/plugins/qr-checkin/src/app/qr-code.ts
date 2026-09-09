import { toString as qrToString } from 'qrcode';

/**
 * A check-in code as a scannable QR code (FR 3.16).
 *
 * **In the bundle, never from a network.** `qrcode` is MIT, compatible with
 * AGPL-3.0-or-later, and it travels in this plug-in's own bundle like every
 * other byte the browser runs — a code generator loaded from a CDN would be
 * foreign code on the page that promises the opposite (NFR 9), and a door in a
 * cellar has no network anyway.
 *
 * `type: 'svg'` is spelled out although the browser build of that package
 * renders nothing else: its Node entry defaults to a picture drawn in block
 * characters for a terminal, and a test runner resolves whichever entry it
 * likes. Saying which one is wanted costs a line and removes the question.
 *
 * **Black on white, and that is deliberate.** This is the one component of
 * this application that does **not** follow the instance's design: a QR code
 * tinted in a brand colour drops its contrast, and a scanner at a door that
 * fails on half the tickets is worse than a section that looks foreign for
 * three centimetres. The frame around it is the quiet zone the format
 * requires; without it a reader finds no code at all.
 *
 * The result is a detached element rather than a string: a component appends
 * it, so nothing has to be handed through `innerHTML` and no sanitizer has to
 * be talked out of its job.
 */
export async function renderQrCode(code: string): Promise<SVGElement> {
  const svg = await qrToString(code, {
    type: 'svg',
    // Medium recovers a quarter of a damaged symbol — a ticket is a screen
    // held at an angle, or a page folded in a pocket.
    errorCorrectionLevel: 'M',
    // Four modules of quiet zone, which is what the specification asks for.
    margin: 4,
    color: { dark: '#000000ff', light: '#ffffffff' },
  });

  const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
  const element = parsed.documentElement as unknown as SVGElement;
  // The characters are printed underneath, where a screen reader and a person
  // reading them out over a telephone both find them; the picture of them adds
  // nothing to either.
  element.setAttribute('aria-hidden', 'true');
  element.setAttribute('focusable', 'false');
  // Sized here rather than in a stylesheet: this element is appended by hand,
  // so it carries none of the attributes emulated encapsulation selects on and
  // a component's own rules would never reach it.
  element.style.width = '100%';
  element.style.height = 'auto';
  return element;
}
