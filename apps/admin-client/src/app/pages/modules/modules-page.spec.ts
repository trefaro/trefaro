import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import {
  PluginLoaderService,
  type PluginLoadResult,
} from '@trefaro/shared-plugins';
import { ModulesPage } from './modules-page';

function loadResult(
  key: string,
  status: PluginLoadResult['status'],
  error?: string,
): PluginLoadResult {
  return {
    plugin: {
      key,
      version: '0.1.0',
      labelKey: `plugins.${key}`,
      elementName: `trefaro-plugin-${key}`,
      bundleUrl: `/api/plugins/${key}/main.js`,
      mountPoints: ['event-detail'],
      icon: null,
    },
    status,
    ...(error ? { error } : {}),
  };
}

describe('ModulesPage', () => {
  function render(options: {
    modules?: readonly string[];
    plugins?: readonly PluginLoadResult[];
  }) {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AppConfigService,
          useValue: { enabledModules: () => options.modules ?? [] },
        },
        {
          provide: PluginLoaderService,
          useValue: { loadResults: () => options.plugins ?? [] },
        },
      ],
    });
    const fixture = TestBed.createComponent(ModulesPage);
    fixture.detectChanges();
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('says so when nothing optional is enabled', () => {
    const text = render({});

    expect(text).toContain('No optional core module is enabled');
    expect(text).toContain('No plug-in is enabled');
  });

  it('lists the enabled core modules', () => {
    const text = render({ modules: ['chat', 'media-links'] });

    expect(text).toContain('chat');
    expect(text).toContain('media-links');
  });

  it('shows a plug-in with its version and bundle URL', () => {
    const text = render({ plugins: [loadResult('room-planning', 'ready')] });

    expect(text).toContain('room-planning');
    expect(text).toContain('0.1.0');
    expect(text).toContain('/api/plugins/room-planning/main.js');
    expect(text).toContain('ready');
  });

  it('surfaces why a plug-in failed, so an enabled plug-in that never appears is explainable', () => {
    const text = render({
      plugins: [
        loadResult(
          'forum',
          'failed',
          'Bundle /api/plugins/forum/main.js could not be fetched',
        ),
      ],
    });

    expect(text).toContain('failed');
    expect(text).toContain('could not be fetched');
  });
});
