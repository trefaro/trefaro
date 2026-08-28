import { isTranslationKey } from '@trefaro/shared-models';
import { CURATED_PLUGINS } from '../../../plugins';
import { CORE_MODULES } from './core-modules';

/**
 * That every switchable thing has a name that can be looked up (AP 6 of phase 2).
 *
 * From AP 6 the module administration and the participant's tiles resolve
 * `titleKey` and `labelKey` against the catalogue, so a descriptor whose key is
 * not a well-formed translation key is a blank name on a screen — and blank in a
 * way nothing else in the build notices, because the string type says nothing.
 *
 * The keys are **declared** in each descriptor, not derived from the module key:
 * `media-links` carries `modules.mediaLinks.title`, `room-planning` carries
 * `plugins.roomPlanning.title`. A hyphen is not a legal key segment, so deriving
 * one mechanically would produce keys the convention rejects — and the more
 * important reason is that an identifier and a name are different things. What
 * this test enforces is only that a declared key is addressable; that the
 * catalogue actually has it is asserted against a running server, in
 * `apps/server-e2e/src/api/i18n.spec.ts`, where the catalogue exists.
 */
describe('the keys the module administration hands out', () => {
  it('gives every core module an addressable name', () => {
    for (const module of CORE_MODULES) {
      expect({
        key: module.key,
        ok: isTranslationKey(module.titleKey),
      }).toEqual({ key: module.key, ok: true });
      expect(module.titleKey.startsWith('modules.')).toBe(true);
    }
  });

  it('gives every curated plug-in an addressable name and label', () => {
    for (const plugin of CURATED_PLUGINS) {
      for (const key of [plugin.titleKey, plugin.client?.labelKey]) {
        // A server-only plug-in has no client half and therefore no label.
        if (key === undefined) continue;
        expect({ plugin: plugin.key, ok: isTranslationKey(key) }).toEqual({
          plugin: plugin.key,
          ok: true,
        });
        expect(key.startsWith('plugins.')).toBe(true);
      }
    }
  });

  it('gives no two modules the same name key', () => {
    const keys = [
      ...CORE_MODULES.map((module) => module.titleKey),
      ...CURATED_PLUGINS.map((plugin) => plugin.titleKey),
    ];

    expect(new Set(keys).size).toBe(keys.length);
  });
});
