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

  it('keeps mounting a 1.0 plug-in now that the host offers 1.1', () => {
    // What the minor step of AP 9 means in practice (E12): the read port is an
    // addition, so a plug-in that predates it and never asks still runs.
    expect(isCompatiblePluginApiVersion('1.0.0', '1.1.0')).toBe(true);
  });

  it('refuses a plug-in that needs the read port from a host without it', () => {
    // The other direction of the same step: a plug-in built against 1.1 would
    // inject a token a 1.0 host does not provide, and failing at boot with a
    // named reason beats failing on the first request (NFR 10).
    expect(isCompatiblePluginApiVersion('1.1.0', '1.0.0')).toBe(false);
  });

  it('keeps mounting a 1.1 plug-in now that the host offers 1.2', () => {
    // The step of phase 4 (E46). Everything 1.2.0 adds is an addition — the
    // words a slot hands over, the icon a descriptor names, the prerequisite a
    // plug-in may declare, the ports for participants and registrations — so
    // a plug-in written against 1.1 is still mounted and simply never asks.
    expect(isCompatiblePluginApiVersion('1.1.0', '1.2.0')).toBe(true);
    expect(isCompatiblePluginApiVersion('1.0.0', '1.2.0')).toBe(true);
  });

  it('refuses a plug-in that needs 1.2 from a 1.1 host', () => {
    // The other direction, and the reason the step is a step at all: a plug-in
    // that expects `strings` on its element, a prerequisite to be enforced or
    // `PLUGIN_REGISTRATION_READS` to be injectable would be silently wrong on
    // a host that promises none of them — the check-in would fail at its first
    // request rather than at boot (NFR 10).
    expect(isCompatiblePluginApiVersion('1.2.0', '1.1.0')).toBe(false);
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
