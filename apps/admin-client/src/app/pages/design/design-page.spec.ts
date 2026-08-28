import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import type {
  AppConfig,
  AppConfigChange,
  AppConfigSettings,
} from '@trefaro/shared-models';
import { signal } from '@angular/core';
import { ConfigAdminService } from '../../features/config/config-admin.service';
import { DesignPage } from './design-page';

const STORED: AppConfigSettings = {
  organizationName: 'Democracy International e.V.',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  fontFamily: 'inter',
};

function appConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    organizationName: STORED.organizationName,
    theme: {
      primaryColor: STORED.primaryColor,
      accentColor: STORED.accentColor,
      logoUrl: '/api/media/branding/logo?v=17',
      fontFamily: "'Inter', system-ui, sans-serif",
    },
    defaultLocale: 'de',
    availableLocales: ['en', 'de'],
    enabledModules: [],
    plugins: [],
    webPushPublicKey: null,
    publicUserClientUrl: 'http://localhost:4200',
    appIconUrl: null,
    ...overrides,
  };
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  form: {
    patchValue: (value: Partial<Record<string, string>>) => void;
    getRawValue: () => Record<string, string>;
  };
  changed: () => boolean;
  readings: () => readonly {
    label: string;
    onColor: number;
    surface: boolean;
    tooPale: boolean;
  }[];
  save: () => Promise<void>;
  discard: () => void;
  reread: () => Promise<void>;
  error: () => string | null;
}

class FakeConfigAdminService {
  settings: AppConfigSettings = { ...STORED };
  readonly patches: AppConfigChange[] = [];
  failWith: unknown = null;

  getSettings(): Promise<AppConfigSettings> {
    return Promise.resolve({ ...this.settings });
  }

  updateSettings(change: AppConfigChange): Promise<AppConfigSettings> {
    if (this.failWith) return Promise.reject(this.failWith);
    this.patches.push(change);
    this.settings = { ...this.settings, ...change };
    return Promise.resolve({ ...this.settings });
  }
}

class FakeAppConfigService {
  readonly state = signal<AppConfig | null>(appConfig());
  reloads = 0;

  readonly config = this.state.asReadonly();

  reload(): Promise<AppConfig> {
    this.reloads += 1;
    // What the real one does: the server answers with the stored values, so the
    // theme that comes back carries the font as a stack.
    return Promise.resolve(this.state() ?? appConfig());
  }
}

describe('DesignPage', () => {
  let admin: FakeConfigAdminService;
  let config: FakeAppConfigService;

  async function render() {
    admin = new FakeConfigAdminService();
    config = new FakeAppConfigService();
    TestBed.configureTestingModule({
      providers: [
        { provide: ConfigAdminService, useValue: admin },
        { provide: AppConfigService, useValue: config },
      ],
    });
    const fixture = TestBed.createComponent(DesignPage);
    fixture.detectChanges();
    // The settings are fetched in the constructor.
    await Promise.resolve();
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.componentInstance as unknown as PageInternals,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    };
  }

  /** What a plug-in web component would read, and what the preview writes. */
  function variable(name: string): string {
    return document.documentElement.style.getPropertyValue(name).trim();
  }

  it('shows what is stored, and nothing to save yet', async () => {
    const { page, text } = await render();

    expect(page.form.getRawValue()).toEqual({
      organizationName: 'Democracy International e.V.',
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      fontFamily: 'inter',
    });
    expect(page.changed()).toBe(false);
    expect(text()).toContain('Democracy International e.V.');
  });

  it('previews a colour on this document before it is saved (E20)', async () => {
    const { fixture, page } = await render();

    page.form.patchValue({ primaryColor: '#123456' });
    fixture.detectChanges();

    expect(variable('--trefaro-color-primary')).toBe('#123456');
    // Derived, so a plug-in reading only the custom properties follows along.
    expect(variable('--trefaro-color-on-primary')).toBe('#ffffff');
    expect(page.changed()).toBe(true);
    // Nothing was written: a preview is not a save.
    expect(admin.patches).toEqual([]);
  });

  it('expands the font key into the stack the preview needs', async () => {
    const { fixture, page } = await render();

    page.form.patchValue({ fontFamily: 'lora' });
    fixture.detectChanges();

    expect(variable('--trefaro-font-family')).toContain('Lora');
  });

  it('takes a preview back when the change is discarded', async () => {
    const { fixture, page } = await render();
    page.form.patchValue({ primaryColor: '#123456', organizationName: 'Nope' });
    fixture.detectChanges();

    page.discard();
    fixture.detectChanges();

    expect(variable('--trefaro-color-primary')).toBe('#1f6f5c');
    expect(page.form.getRawValue()['organizationName']).toBe(
      'Democracy International e.V.',
    );
    expect(page.changed()).toBe(false);
  });

  it('takes a preview back when the page is left, not only on Discard', async () => {
    const { fixture, page } = await render();
    page.form.patchValue({ primaryColor: '#123456' });
    fixture.detectChanges();
    expect(variable('--trefaro-color-primary')).toBe('#123456');

    // An unsaved colour must not follow an organizer into the participant list.
    fixture.destroy();

    expect(variable('--trefaro-color-primary')).toBe('#1f6f5c');
  });

  it('writes the form and reads the configuration back', async () => {
    const { fixture, page } = await render();
    page.form.patchValue({
      organizationName: 'Mehr Demokratie e.V.',
      primaryColor: '#123456',
    });
    fixture.detectChanges();

    await page.save();
    fixture.detectChanges();

    expect(admin.patches).toEqual([
      {
        organizationName: 'Mehr Demokratie e.V.',
        primaryColor: '#123456',
        accentColor: '#e8a33d',
        fontFamily: 'inter',
      },
    ]);
    // Re-read rather than merged: the server owns the trimmed name, the stack
    // behind the font key and the version in the logo URL.
    expect(config.reloads).toBe(1);
    expect(page.changed()).toBe(false);
    expect(page.error()).toBeNull();
  });

  it('keeps the message and the form when the save is refused', async () => {
    const { fixture, page } = await render();
    admin.failWith = { status: 400, message: 'Not a hexadecimal colour.' };
    page.form.patchValue({ organizationName: 'Kept' });
    fixture.detectChanges();

    await page.save();
    fixture.detectChanges();

    expect(page.error()).toBe('Not a hexadecimal colour.');
    expect(page.form.getRawValue()['organizationName']).toBe('Kept');
    expect(page.changed()).toBe(true);
  });

  it('warns about a primary colour that vanishes into the page (NFR 4)', async () => {
    const { fixture, page, text } = await render();

    page.form.patchValue({ primaryColor: '#f4f4f4' });
    fixture.detectChanges();

    expect(page.readings()[0]).toMatchObject({
      label: 'Primary colour',
      tooPale: true,
    });
    expect(text()).toContain('hard to make out');
  });

  it('leaves the accent unwarned, whatever it is', async () => {
    const { fixture, page } = await render();

    // Including the shipped default, which reads 2.2:1 against a white page.
    // The accent is never the surface somebody has to find — it is a badge or a
    // border inside something already found, with its derived text colour on
    // top, and the focus ring uses the darkened shade. A warning here would fire
    // out of the box and train an organizer to ignore the panel.
    expect(page.readings()[1]).toMatchObject({
      label: 'Accent colour',
      surface: false,
      tooPale: false,
    });

    page.form.patchValue({ accentColor: '#ffffff' });
    fixture.detectChanges();
    expect(page.readings()[1].tooPale).toBe(false);
  });

  it('reports the text contrast as a fact, because it cannot fall through', async () => {
    const { fixture, page } = await render();

    // White is the extreme case: the derived text colour turns black and the
    // ratio on the colour stays above 4.5:1. Nothing an organizer can pick
    // makes text on their own colour illegible, so nothing here checks it.
    page.form.patchValue({ primaryColor: '#ffffff', accentColor: '#ffffff' });
    fixture.detectChanges();

    for (const reading of page.readings()) {
      expect(reading.onColor).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('re-reads the configuration when an image was uploaded', async () => {
    const { page } = await render();

    // What the two upload fields emit: the image is already stored, and only the
    // server can produce the new version in its URL.
    await page.reread();

    expect(config.reloads).toBe(1);
  });
});
