import {
  isCompatiblePluginApiVersion,
  PLUGIN_API_VERSION,
} from './plugin-api-version';

describe('isCompatiblePluginApiVersion', () => {
  it('accepts a plug-in built against the current version', () => {
    expect(isCompatiblePluginApiVersion(PLUGIN_API_VERSION)).toBe(true);
  });

  it('rejects a different major version in either direction', () => {
    expect(isCompatiblePluginApiVersion('0.9.0', '1.0.0')).toBe(false);
    expect(isCompatiblePluginApiVersion('2.0.0', '1.0.0')).toBe(false);
  });

  it('accepts a plug-in needing an older minor version', () => {
    expect(isCompatiblePluginApiVersion('1.1.0', '1.4.0')).toBe(true);
  });

  it('rejects a plug-in needing a newer minor version than the host offers', () => {
    expect(isCompatiblePluginApiVersion('1.5.0', '1.4.0')).toBe(false);
  });

  it('ignores the patch level', () => {
    expect(isCompatiblePluginApiVersion('1.0.9', '1.0.0')).toBe(true);
  });

  it('rejects malformed versions instead of guessing', () => {
    for (const bad of ['', '1', '1.0', 'v1.0.0', '1.0.0-beta', 'latest']) {
      expect(isCompatiblePluginApiVersion(bad)).toBe(false);
    }
  });
});
