import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { AppConfig, PluginDescriptor } from '@trefaro/shared-models';
import { PluginLoaderService } from './plugin-loader.service';

function descriptor(
  overrides: Partial<PluginDescriptor> = {},
): PluginDescriptor {
  return {
    key: 'room-planning',
    version: '0.1.0',
    labelKey: 'plugins.roomPlanning.label',
    elementName: 'trefaro-plugin-room-planning',
    bundleUrl: '/plugins/room-planning/bundle.js',
    mountPoints: ['event-detail'],
    icon: 'meeting_room',
    ...overrides,
  };
}

function config(plugins: readonly PluginDescriptor[]): AppConfig {
  return {
    organizationName: 'Democracy International e.V.',
    theme: {
      primaryColor: '#1f6f5c',
      accentColor: '#e8a33d',
      logoUrl: null,
      fontFamily: 'Inter',
    },
    defaultLocale: 'en',
    availableLocales: ['en'],
    enabledModules: [],
    plugins,
    webPushPublicKey: null,
    publicUserClientUrl: 'http://localhost:4200',
    appIconUrl: null,
  };
}

/**
 * Stands in for a real bundle: watches for the injected script element and
 * defines (or refuses to define) the custom element it claims to provide.
 */
function fakeBundleHost(behaviour: {
  onScript: (script: HTMLScriptElement) => void;
}): () => void {
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (
          node instanceof HTMLScriptElement &&
          node.dataset['trefaroPluginBundle']
        ) {
          behaviour.onScript(node);
        }
      }
    }
  });
  observer.observe(document.head, { childList: true });
  return () => observer.disconnect();
}

let elementCounter = 0;
/** A fresh element name per test — custom element definitions cannot be undone. */
function uniqueElementName(): string {
  elementCounter += 1;
  return `trefaro-plugin-test-${elementCounter}`;
}

describe('PluginLoaderService', () => {
  let loader: PluginLoaderService;
  let http: HttpTestingController;
  let stopHost: (() => void) | null = null;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    loader = TestBed.inject(PluginLoaderService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    stopHost?.();
    stopHost = null;
    for (const script of document.querySelectorAll(
      'script[data-trefaro-plugin-bundle]',
    )) {
      script.remove();
    }
  });

  it('loads nothing when no plug-in is enabled', async () => {
    const loading = loader.loadEnabledPlugins();
    http.expectOne('/api/config').flush(config([]));

    await expect(loading).resolves.toEqual([]);
  });

  it('reports a plug-in as ready once its bundle defines the element', async () => {
    const elementName = uniqueElementName();
    stopHost = fakeBundleHost({
      onScript: (script) => {
        customElements.define(elementName, class extends HTMLElement {});
        script.dispatchEvent(new Event('load'));
      },
    });

    const loading = loader.loadEnabledPlugins();
    http.expectOne('/api/config').flush(config([descriptor({ elementName })]));
    await loading;

    expect(loader.isReady('room-planning')).toBe(true);
    expect(loader.failedPlugins()).toEqual([]);
  });

  it('records a plug-in whose bundle cannot be fetched as failed, and starts anyway', async () => {
    stopHost = fakeBundleHost({
      onScript: (script) => script.dispatchEvent(new Event('error')),
    });

    const loading = loader.loadEnabledPlugins();
    http
      .expectOne('/api/config')
      .flush(config([descriptor({ elementName: uniqueElementName() })]));

    // Resolving rather than rejecting is the point: one broken plug-in must not
    // stop the application from starting.
    await expect(loading).resolves.toBeDefined();
    expect(loader.isReady('room-planning')).toBe(false);
    expect(loader.failedPlugins()).toHaveLength(1);
    expect(loader.failedPlugins()[0].error).toContain('could not be fetched');
  });

  it('keeps a working plug-in when a sibling fails', async () => {
    const goodElement = uniqueElementName();
    stopHost = fakeBundleHost({
      onScript: (script) => {
        if (script.src.includes('good')) {
          customElements.define(goodElement, class extends HTMLElement {});
          script.dispatchEvent(new Event('load'));
        } else {
          script.dispatchEvent(new Event('error'));
        }
      },
    });

    const loading = loader.loadEnabledPlugins();
    http.expectOne('/api/config').flush(
      config([
        descriptor({
          key: 'good',
          elementName: goodElement,
          bundleUrl: '/plugins/good/bundle.js',
        }),
        descriptor({
          key: 'broken',
          elementName: uniqueElementName(),
          bundleUrl: '/plugins/broken/bundle.js',
        }),
      ]),
    );
    await loading;

    expect(loader.isReady('good')).toBe(true);
    expect(loader.isReady('broken')).toBe(false);
  });

  it('treats an already defined element as ready without fetching again', async () => {
    const elementName = uniqueElementName();
    customElements.define(elementName, class extends HTMLElement {});

    const loading = loader.loadEnabledPlugins();
    http.expectOne('/api/config').flush(config([descriptor({ elementName })]));
    await loading;

    expect(loader.isReady('room-planning')).toBe(true);
    expect(
      document.querySelectorAll('script[data-trefaro-plugin-bundle]'),
    ).toHaveLength(0);
  });

  it('loads nothing when the configuration itself is unavailable', async () => {
    const loading = loader.loadEnabledPlugins();
    http
      .expectOne('/api/config')
      .error(new ProgressEvent('error'), { status: 0, statusText: '' });

    await expect(loading).resolves.toEqual([]);
  });
});
