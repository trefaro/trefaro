import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import type { PluginDescriptor } from '@trefaro/shared-models';

/** How long a bundle gets to define its custom element before it is given up on. */
const DEFINITION_TIMEOUT_MS = 10_000;

export type PluginStatus = 'loading' | 'ready' | 'failed';

export interface PluginLoadResult {
  readonly plugin: PluginDescriptor;
  readonly status: PluginStatus;
  /** Why it failed, for the module administration and the console. */
  readonly error?: string;
}

/**
 * Client plug-in manager (architecture rule 3).
 *
 * Third step of the client start sequence: after the configuration is loaded and
 * the theme applied, this fetches the web component bundle of every enabled
 * plug-in and waits for its custom element to be defined.
 *
 * Bundles are framework-independent web components, so a plug-in written without
 * Angular loads the same way. They ship no CSS — the whitelabel design reaches
 * them through inherited CSS custom properties.
 *
 * Every plug-in is loaded in isolation: one that 404s, throws on evaluation or
 * never defines its element is recorded as failed and the application starts
 * without it (NFR 10 — a faulty plug-in may not take the instance down).
 */
@Injectable({ providedIn: 'root' })
export class PluginLoaderService {
  private readonly config = inject(AppConfigService);
  private readonly document = inject(DOCUMENT);
  private readonly results = signal<ReadonlyMap<string, PluginLoadResult>>(
    new Map(),
  );

  /** Load outcome per plug-in key. */
  readonly loadResults = computed(() => [...this.results().values()]);

  readonly failedPlugins = computed(() =>
    this.loadResults().filter((result) => result.status === 'failed'),
  );

  /** Whether a plug-in's custom element is defined and safe to render. */
  isReady(pluginKey: string): boolean {
    return this.results().get(pluginKey)?.status === 'ready';
  }

  /**
   * Loads the bundles of all enabled plug-ins.
   *
   * Awaits the configuration itself, so it does not matter whether this runs
   * before or after the configuration initializer.
   */
  async loadEnabledPlugins(): Promise<readonly PluginLoadResult[]> {
    let plugins: readonly PluginDescriptor[];
    try {
      plugins = (await this.config.ensureLoaded()).plugins;
    } catch {
      // No configuration means no plug-ins; the configuration initializer
      // already reported the failure.
      return [];
    }

    await Promise.all(plugins.map((plugin) => this.loadPlugin(plugin)));
    return this.loadResults();
  }

  private async loadPlugin(plugin: PluginDescriptor): Promise<void> {
    this.record({ plugin, status: 'loading' });

    try {
      // Already defined: the bundle was loaded by the other startup path, or two
      // plug-ins ship in one bundle.
      if (!this.document.defaultView?.customElements.get(plugin.elementName)) {
        await this.loadScript(plugin.bundleUrl);
        await this.awaitElementDefinition(plugin.elementName);
      }
      this.record({ plugin, status: 'ready' });
    } catch (error) {
      this.record({
        plugin,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
      });
      console.error(
        `Trefaro plug-in "${plugin.key}" could not be loaded and was skipped.`,
        error,
      );
    }
  }

  /**
   * Adds the bundle as a module script.
   *
   * A script element rather than a dynamic `import()`, because the application's
   * own bundler would try to resolve an `import()` at build time — and the URL is
   * only known at runtime, from the configuration.
   */
  private loadScript(bundleUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Compared through the dataset rather than an attribute selector: a bundle
      // URL may contain characters that would need CSS escaping, and `CSS.escape`
      // is not available in every environment the tests run in.
      const alreadyRequested = Array.from(
        this.document.querySelectorAll<HTMLScriptElement>(
          'script[data-trefaro-plugin-bundle]',
        ),
      ).some((script) => script.dataset['trefaroPluginBundle'] === bundleUrl);
      if (alreadyRequested) {
        resolve();
        return;
      }

      const script = this.document.createElement('script');
      script.type = 'module';
      script.src = bundleUrl;
      script.dataset['trefaroPluginBundle'] = bundleUrl;
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener(
        'error',
        () => reject(new Error(`Bundle ${bundleUrl} could not be fetched`)),
        { once: true },
      );
      this.document.head.appendChild(script);
    });
  }

  /**
   * Waits for the bundle to register its custom element.
   *
   * A module script's `load` event fires even when the module throws while
   * evaluating, so the element definition is the only reliable signal that the
   * plug-in is actually usable.
   */
  private awaitElementDefinition(elementName: string): Promise<void> {
    const registry = this.document.defaultView?.customElements;
    if (!registry) {
      return Promise.reject(
        new Error('This browser has no custom element registry'),
      );
    }

    return Promise.race([
      registry.whenDefined(elementName).then(() => undefined),
      new Promise<never>((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Bundle loaded but did not define <${elementName}> within ${DEFINITION_TIMEOUT_MS} ms`,
              ),
            ),
          DEFINITION_TIMEOUT_MS,
        ),
      ),
    ]);
  }

  private record(result: PluginLoadResult): void {
    this.results.update((current) =>
      new Map(current).set(result.plugin.key, result),
    );
  }
}
