import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AppConfig } from '@trefaro/shared-models';
import { AppConfigService } from './app-config.service';
import { STARTUP_TIMEOUT_MS } from './startup-timeout';

const config: AppConfig = {
  theme: {
    primaryColor: '#1f6f5c',
    accentColor: '#e8a33d',
    logoUrl: null,
    fontFamily: 'Inter',
  },
  defaultLocale: 'de',
  availableLocales: ['en', 'de'],
  enabledModules: ['media-links', 'chat'],
  plugins: [
    {
      key: 'room-planning',
      version: '0.1.0',
      labelKey: 'plugins.roomPlanning.label',
      elementName: 'trefaro-plugin-room-planning',
      bundleUrl: '/plugins/room-planning/bundle.js',
      mountPoints: ['event-detail'],
      icon: 'meeting_room',
    },
    {
      key: 'forum',
      version: '0.1.0',
      labelKey: 'plugins.forum.label',
      elementName: 'trefaro-plugin-forum',
      bundleUrl: '/plugins/forum/bundle.js',
      mountPoints: ['navigation', 'event-detail'],
      icon: null,
    },
  ],
  webPushPublicKey: 'vapid-public-key',
};

describe('AppConfigService', () => {
  let service: AppConfigService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppConfigService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('exposes safe defaults before the configuration arrives', () => {
    expect(service.config()).toBeNull();
    expect(service.enabledModules()).toEqual([]);
    expect(service.plugins()).toEqual([]);
    expect(service.webPushPublicKey()).toBeNull();
    expect(service.isModuleEnabled('chat')).toBe(false);
  });

  it('fetches the configuration from the public endpoint', async () => {
    const loaded = service.ensureLoaded();
    http.expectOne('/api/config').flush(config);

    await loaded;

    expect(service.config()).toEqual(config);
    expect(service.isModuleEnabled('chat')).toBe(true);
    expect(service.isModuleEnabled('profiles')).toBe(false);
    expect(service.webPushPublicKey()).toBe('vapid-public-key');
  });

  it('requests the configuration only once, however many callers await it', async () => {
    const first = service.ensureLoaded();
    const second = service.ensureLoaded();
    http.expectOne('/api/config').flush(config);

    await Promise.all([first, second]);

    // A second expectOne would fail if the request had been made twice; verify()
    // in afterEach catches a stray one either way.
    expect(service.config()).toEqual(config);
  });

  it('selects plug-ins by mount point', async () => {
    const loaded = service.ensureLoaded();
    http.expectOne('/api/config').flush(config);
    await loaded;

    expect(service.pluginsAt('navigation').map((p) => p.key)).toEqual([
      'forum',
    ]);
    expect(service.pluginsAt('event-detail').map((p) => p.key)).toEqual([
      'room-planning',
      'forum',
    ]);
  });

  it('gives up when the server accepts the request and never answers', async () => {
    // The case that showed up in development: a dev-server proxy in front of a
    // stopped API keeps the request open, the startup promise never settles and
    // Angular renders nothing at all. A blank page is worse than a plain one.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: STARTUP_TIMEOUT_MS, useValue: 10 },
      ],
    });
    const bounded = TestBed.inject(AppConfigService);
    const pending = bounded.ensureLoaded();
    // Requested, never flushed.
    TestBed.inject(HttpTestingController).expectOne('/api/config');

    await expect(pending).rejects.toBeDefined();
    expect(bounded.config()).toBeNull();
  });

  it('allows a retry after a failed fetch instead of caching the failure', async () => {
    const failed = service.ensureLoaded();
    http.expectOne('/api/config').flush(null, {
      status: 503,
      statusText: 'Service Unavailable',
    });
    await expect(failed).rejects.toBeDefined();
    expect(service.config()).toBeNull();

    const retried = service.ensureLoaded();
    http.expectOne('/api/config').flush(config);

    await retried;
    expect(service.config()).toEqual(config);
  });
});
