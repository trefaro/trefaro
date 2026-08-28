import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import type { ApiError } from '@trefaro/shared-http';
import type { ModuleSummary } from '@trefaro/shared-models';
import { moduleDisplayName } from '@trefaro/shared-models';
import {
  PluginLoaderService,
  type PluginLoadResult,
} from '@trefaro/shared-plugins';
import { ModulesAdminService } from '../../features/modules/modules-admin.service';

/**
 * Module and plug-in administration (FR 1.5, UC 1) — AP 4.
 *
 * One table for both families, because an organizer asks one question — what
 * does this instance offer? — and the answer happens to be implemented twice.
 * The `family` column says which is which, since only a plug-in can fail to
 * appear after being switched on.
 *
 * Four decisions worth naming:
 *
 * 1. **The list comes from `/api/admin/modules`, not from the configuration.**
 *    `/api/config` carries the *enabled* modules; a page for switching the
 *    others on cannot be built from it.
 * 2. **A switch takes effect on the server immediately** (F6) — the endpoint
 *    re-reads its flags as part of the request, so a module that was just
 *    enabled answers on the next call rather than fifteen seconds later. What
 *    does *not* happen is this document changing: a plug-in's web component is
 *    fetched during the client start sequence, so it appears after a reload
 *    (E20). The page says so instead of pretending otherwise.
 * 3. **Bundle failures stay visible.** An organizer who enabled the forum and
 *    does not see it needs to learn that its bundle failed, rather than conclude
 *    the product is broken. That is also the one thing this page knows and the
 *    server does not — the load happened here.
 * 4. **Names are humanised keys for now.** Every module carries a `titleKey`,
 *    and resolving it needs the catalogue AP 6 brings. Until then
 *    `moduleDisplayName` derives something readable from the key, and the key
 *    itself stays in the row — it is what the API and the database call the
 *    thing.
 */
@Component({
  selector: 'trefaro-modules-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Modules</h1>
    <p class="lead">
      Everything this image ships. Switching a module off never deletes
      anything: its data stays, and switching it on again brings it back. A
      change reaches the participant client — and the plug-in components of this
      one — the next time it loads.
    </p>

    @if (error()) {
      <p class="error" role="alert">{{ error() }}</p>
    }
    @if (notice()) {
      <p class="notice" role="status">{{ notice() }}</p>
    }

    <table>
      <thead>
        <tr>
          <th>Module</th>
          <th>Kind</th>
          <th>State</th>
          <th>Bundle</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (module of modules(); track module.key) {
          <tr>
            <td>
              <strong>{{ name(module) }}</strong>
              <br /><code>{{ module.key }}</code>
            </td>
            <td>
              {{ module.family === 'plugin' ? 'Plug-in' : 'Core module' }}
              @if (module.version) {
                <br /><small>version {{ module.version }}</small>
              }
            </td>
            <td>
              <span [class.is-on]="module.enabled">
                {{ module.enabled ? 'enabled' : 'disabled' }}
              </span>
              @if (module.enabled !== module.enabledByDefault) {
                <br /><small>
                  default:
                  {{ module.enabledByDefault ? 'enabled' : 'disabled' }}
                </small>
              }
            </td>
            <td>
              @if (module.bundleUrl) {
                <code>{{ module.bundleUrl }}</code>
                @if (loadStatus(module.key); as status) {
                  <br /><span [class.failed]="status.status === 'failed'">
                    {{ status.status }}
                  </span>
                  @if (status.error) {
                    <br /><small>{{ status.error }}</small>
                  }
                }
              } @else {
                <span class="none">—</span>
              }
            </td>
            <td>
              <button
                type="button"
                [disabled]="busy() !== null"
                (click)="toggle(module)"
              >
                {{ module.enabled ? 'Disable' : 'Enable' }}
              </button>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5">
              {{
                loading() ? 'Loading…' : 'This image ships no optional module.'
              }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .lead {
      max-inline-size: 44rem;
      color: color-mix(in oklab, currentColor 75%, transparent);
    }

    table {
      border-collapse: collapse;
      inline-size: 100%;
      font-size: 0.9rem;
    }

    th,
    td {
      text-align: start;
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid var(--trefaro-color-primary-muted);
      vertical-align: top;
    }

    .is-on {
      font-weight: 600;
      color: var(--trefaro-color-primary-strong);
    }

    .failed {
      color: #a3341f;
    }

    .none {
      color: color-mix(in oklab, currentColor 55%, transparent);
    }

    .error {
      color: #a3341f;
    }

    .notice {
      color: var(--trefaro-color-primary-strong);
    }

    button {
      padding: 0.35rem 0.8rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }
  `,
})
export class ModulesPage {
  private readonly admin = inject(ModulesAdminService);
  private readonly config = inject(AppConfigService);
  private readonly plugins = inject(PluginLoaderService);

  protected readonly modules = signal<readonly ModuleSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  /** The key currently being written, so one click disables every button. */
  protected readonly busy = signal<string | null>(null);

  /** Load results by key, so a plug-in's row can carry its bundle's fate. */
  private readonly statusByKey = computed(
    () =>
      new Map(
        this.plugins.loadResults().map((result) => [result.plugin.key, result]),
      ),
  );

  constructor() {
    void this.load();
  }

  protected name(module: ModuleSummary): string {
    return moduleDisplayName(module.key);
  }

  protected loadStatus(key: string): PluginLoadResult | null {
    return this.statusByKey().get(key) ?? null;
  }

  protected async toggle(module: ModuleSummary): Promise<void> {
    if (this.busy()) return;
    this.busy.set(module.key);
    this.error.set(null);
    this.notice.set(null);
    try {
      await this.admin.setEnabled(module.key, !module.enabled);
      // The whole list, not the one row: switching a module changes nothing
      // about the others, but reading the list back is the same guarantee the
      // design page takes — this client cannot end up showing a state the
      // server disagrees with.
      await this.load();
      // And this client's own view of what exists: the navigation and every
      // page that asks `isModuleEnabled` read the cached configuration.
      await this.config.reload();
      this.notice.set(
        module.enabled
          ? `${this.name(module)} is switched off. Its data is untouched.`
          : `${this.name(module)} is switched on. Reload this page to load its parts.`,
      );
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ?? 'The module could not be switched.',
      );
    } finally {
      this.busy.set(null);
    }
  }

  private async load(): Promise<void> {
    try {
      this.modules.set(await this.admin.list());
    } catch (error: unknown) {
      this.error.set(
        (error as ApiError)?.message ?? 'The modules could not be loaded.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
