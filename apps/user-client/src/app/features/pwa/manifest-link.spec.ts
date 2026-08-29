import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { WEB_MANIFEST_PATH } from '@trefaro/shared-models';

/**
 * The one address in this client that cannot be typed by TypeScript.
 *
 * `index.html` is not compiled against `shared-models`, so the manifest's path
 * appears there as a literal — and a literal that is wrong by one character
 * leaves the application silently uninstallable, with the browser reporting
 * nothing a page can see. The browser suite checks the same thing against a
 * running client; this one costs a file read and fails in the quality job.
 */
describe('the participant client document', () => {
  const html = readFileSync(
    join(process.cwd(), 'apps/user-client/src/index.html'),
    'utf8',
  );

  it('links the manifest the server builds (E26)', () => {
    expect(html).toContain(`<link rel="manifest" href="${WEB_MANIFEST_PATH}"`);
  });

  it('carries a theme colour before the configuration arrives', () => {
    // ThemeService rewrites this tag; what is pinned here is that there is one
    // to rewrite, so the very first paint is not chrome-coloured by accident.
    expect(html).toMatch(/<meta name="theme-color" content="#[0-9a-f]{6}"/i);
  });

  it('names an apple-touch-icon for AppIconService to point at', () => {
    // iOS reads this link out of the live document; the service can only move a
    // link that exists.
    expect(html).toMatch(/<link rel="apple-touch-icon" href="[^"]+"/);
  });
});
