import { isIconName, pluginCataloguePrefix } from '@trefaro/shared-models';
import {
  isCompatiblePluginApiVersion,
  PLUGIN_API_VERSION,
} from '../app/business/plugin-api';
import { CURATED_PLUGINS } from './index';

/**
 * What every curated plug-in has to be true of, whatever it does.
 *
 * The list grows by one per work package of phase 4, and each of these has a
 * way of going wrong that nothing else would catch: a key that does not match
 * its catalogue namespace shows a raw key in the module administration, a
 * duplicate key overwrites another plug-in's flag in `module_config`, and an
 * icon name outside the closed set draws nothing at all (E49).
 */
describe('the curated plug-ins', () => {
  it('ships at least the reference plug-in', () => {
    expect(CURATED_PLUGINS.length).toBeGreaterThan(0);
  });

  it('has one key per plug-in, because the key is also its module flag', () => {
    const keys = CURATED_PLUGINS.map((plugin) => plugin.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('names keys the way a catalogue key can spell them', () => {
    // Lower case and dashes: the key is a URL segment, a `module_config` row and
    // the source of the catalogue prefix below.
    for (const plugin of CURATED_PLUGINS) {
      expect(plugin.key).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  /**
   * The one thing that makes deriving the prefix safe (E48).
   *
   * The slot selects a plug-in's words by `pluginCataloguePrefix(key)` while the
   * plug-in declares its title and label as keys — two spellings of the same
   * namespace, and this is what keeps them the same one.
   */
  it('declares every key under its own catalogue prefix', () => {
    for (const plugin of CURATED_PLUGINS) {
      const prefix = pluginCataloguePrefix(plugin.key);
      expect(plugin.titleKey.startsWith(prefix)).toBe(true);
      if (plugin.client) {
        expect(plugin.client.labelKey.startsWith(prefix)).toBe(true);
      }
    }
  });

  it('names only icons this version can draw (E49)', () => {
    for (const plugin of CURATED_PLUGINS) {
      const icon = plugin.client?.icon;
      if (icon === undefined) continue;
      expect(isIconName(icon)).toBe(true);
    }
  });

  it('was built against a contract this host still honours', () => {
    for (const plugin of CURATED_PLUGINS) {
      expect(
        isCompatiblePluginApiVersion(plugin.apiVersion, PLUGIN_API_VERSION),
      ).toBe(true);
    }
  });

  it('starts switched off, so an instance offers what was asked for (NFR 1)', () => {
    for (const plugin of CURATED_PLUGINS) {
      expect(plugin.enabledByDefault ?? false).toBe(false);
    }
  });
});
