import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ApplicationInitStatus } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FALLBACK_THEME, ThemeService } from '@trefaro/shared-theming';
import { AppConfigService } from './app-config.service';
import { provideTrefaroConfig } from './provide-trefaro-config';

const theme = {
  primaryColor: '#123456',
  accentColor: '#abcdef',
  logoUrl: '/api/media/branding/logo?v=1787790100000',
  fontFamily: 'Inter',
};

/**
 * Drives the startup initializer the way Angular does: injecting
 * ApplicationInitStatus is what runs the registered initializers.
 */
async function runStartup(): Promise<void> {
  await TestBed.inject(ApplicationInitStatus).donePromise;
}

describe('provideTrefaroConfig', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideTrefaroConfig(),
      ],
    });
  });

  it('loads the configuration and applies its theme before the app renders', async () => {
    const startup = runStartup();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/config')
      .flush({
        theme,
        defaultLocale: 'en',
        availableLocales: ['en'],
        enabledModules: [],
        plugins: [],
        webPushPublicKey: null,
      });

    await startup;

    expect(TestBed.inject(ThemeService).theme()).toEqual(theme);
    expect(TestBed.inject(AppConfigService).config()).not.toBeNull();
  });

  it('starts on the fallback theme when the server cannot be reached', async () => {
    const startup = runStartup();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/config')
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });

    // Startup must resolve: a public landing page has to work even while the
    // server is restarting.
    await expect(startup).resolves.toBeUndefined();
    expect(TestBed.inject(ThemeService).theme()).toEqual(FALLBACK_THEME);
  });
});
