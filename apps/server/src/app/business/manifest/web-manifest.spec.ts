import { SHIPPED_APP_ICONS } from '@trefaro/shared-models';
import {
  buildWebManifest,
  webManifestEtag,
  type WebManifestInput,
} from './web-manifest';

const INSTANCE: WebManifestInput = {
  organizationName: 'Democracy International e.V.',
  description: 'Event series, programme and community.',
  locale: 'de',
  themeColor: '#1f6f5c',
  appIcon: null,
};

const icon = (
  width: number | null,
  height: number | null = width,
): WebManifestInput => ({
  ...INSTANCE,
  appIcon: {
    url: '/api/media/branding/app-icon?v=1756370460000',
    width,
    height,
  },
});

describe('buildWebManifest', () => {
  it('names the organization rather than the product (E26)', () => {
    const manifest = buildWebManifest(INSTANCE);

    expect(manifest.name).toBe('Democracy International e.V.');
    expect(manifest.short_name).toBe('Democracy International e.V.');
    expect(manifest.name).not.toContain('Trefaro');
  });

  it('takes the splash and chrome colour from the primary colour', () => {
    expect(buildWebManifest(INSTANCE).theme_color).toBe('#1f6f5c');
  });

  it('starts and scopes at the root, with a stable identity', () => {
    const manifest = buildWebManifest(INSTANCE);

    expect(manifest.start_url).toBe('/');
    expect(manifest.scope).toBe('/');
    // Pinned: `id` is what keeps a changed start URL from installing a second
    // copy beside the first.
    expect(manifest.id).toBe('/');
  });

  it('speaks the language of the instance', () => {
    expect(buildWebManifest(INSTANCE).lang).toBe('de');
  });

  it('ships its own icons while no app icon is uploaded', () => {
    expect(buildWebManifest(INSTANCE).icons).toEqual(SHIPPED_APP_ICONS);
  });

  it('replaces them with a square upload that is big enough', () => {
    expect(buildWebManifest(icon(512)).icons).toEqual([
      {
        src: '/api/media/branding/app-icon?v=1756370460000',
        sizes: '512x512',
        purpose: 'any',
      },
    ]);
  });

  it('never declares an uploaded icon maskable (E26)', () => {
    const [uploaded] = buildWebManifest(icon(512)).icons;

    // The safe zone of an image nobody has seen is not something to claim: a
    // launcher would crop to it and shave the logo's edges off.
    expect(uploaded.purpose).toBe('any');
    expect(uploaded.purpose).not.toContain('maskable');
  });

  it('states no type for an uploaded icon', () => {
    // There is no type column, and the bytes would have to be read again for a
    // hint a browser may ignore.
    expect(buildWebManifest(icon(512)).icons[0].type).toBeUndefined();
  });

  it.each([
    ['is not square', icon(800, 200)],
    ['is smaller than a browser installs from', icon(64)],
    ['has a header that does not say its size', icon(null, null)],
  ])('keeps the shipped icons beside an upload that %s', (_case, input) => {
    const { icons } = buildWebManifest(input);

    // The organization's icon first, so a browser that can use it does — and the
    // shipped set behind it, so the instance stays installable either way.
    expect(icons[0].src).toContain('/api/media/branding/app-icon');
    expect(icons.slice(1)).toEqual(SHIPPED_APP_ICONS);
  });

  it('calls an unmeasurable icon scalable rather than inventing a size', () => {
    expect(buildWebManifest(icon(null, null)).icons[0].sizes).toBe('any');
  });
});

describe('webManifestEtag', () => {
  it('is the same tag for the same document', () => {
    expect(webManifestEtag(buildWebManifest(INSTANCE))).toBe(
      webManifestEtag(buildWebManifest(INSTANCE)),
    );
  });

  it.each([
    ['name', { organizationName: 'Another Organization' }],
    ['colour', { themeColor: '#123456' }],
    ['language', { locale: 'en' }],
    ['description', { description: 'Something else entirely.' }],
  ])('changes when the %s does', (_what, change) => {
    expect(
      webManifestEtag(buildWebManifest({ ...INSTANCE, ...change })),
    ).not.toBe(webManifestEtag(buildWebManifest(INSTANCE)));
  });

  it('is quoted, as an entity tag has to be', () => {
    expect(webManifestEtag(buildWebManifest(INSTANCE))).toMatch(/^".+"$/);
  });
});
