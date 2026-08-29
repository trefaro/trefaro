import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { SHIPPED_APP_ICONS } from '@trefaro/shared-models';

/**
 * The icons the server promises are the icons this client serves (E26, F20).
 *
 * `SHIPPED_APP_ICONS` lives in `shared-models` because two projects have to
 * agree on it: the server writes those paths into the manifest, and this
 * container is what answers for them. Nothing else connects the two — a renamed
 * or deleted file would leave a manifest full of 404s, and an instance whose
 * icons all 404 is not installable at all.
 *
 * `process.cwd()` is the workspace root under Vitest (it is the project
 * directory under Jest), so the path is built from there rather than guessed.
 */
describe('the shipped app icons', () => {
  it.each(SHIPPED_APP_ICONS.map((icon) => icon.src))(
    'is served at %s',
    (src) => {
      expect(
        existsSync(join(process.cwd(), 'apps/user-client/public', src)),
      ).toBe(true);
    },
  );

  it('offers a square icon a browser will install from', () => {
    // 512×512 is what a splash screen is scaled from; below 144 nothing
    // installs at all.
    expect(SHIPPED_APP_ICONS.some((icon) => icon.sizes === '512x512')).toBe(
      true,
    );
  });

  it('declares every shipped icon usable both masked and plain', () => {
    for (const icon of SHIPPED_APP_ICONS) {
      expect(icon.purpose).toBe('maskable any');
      expect(icon.type).toBe('image/png');
    }
  });
});
