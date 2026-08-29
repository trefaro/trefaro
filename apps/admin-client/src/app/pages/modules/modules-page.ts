import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { problemOf, type Problem } from '@trefaro/shared-http';
import { TranslationService } from '@trefaro/shared-i18n';
import type { ModuleSummary } from '@trefaro/shared-models';
import {
  PluginLoaderService,
  type PluginLoadResult,
} from '@trefaro/shared-plugins';
import { ModulesAdminService } from '../../features/modules/modules-admin.service';

/** A confirmation that outlives the click that produced it. */
interface Notice {
  readonly key: string;
  readonly params: Readonly<Record<string, unknown>>;
}

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
 * 4. **Names come from the catalogue, keys stay in the row.** Every module
 *    carries a `titleKey`, resolved here against the catalogue the server
 *    serves (E22) — so this list is in the organizer's language, including the
 *    plug-ins'. The key itself stays visible beside the name: it is what the
 *    API, the database and `module_config` call the thing, and an organizer
 *    reading a log needs to recognise it.
 */
@Component({
  selector: 'trefaro-modules-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `
    <h1>{{ 'admin.modules.title' | transloco }}</h1>
    <p class="lead">{{ 'admin.modules.lead' | transloco }}</p>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }
    @if (notice(); as said) {
      <p class="notice" role="status">
        {{ said.key | transloco: said.params }}
      </p>
    }

    <table>
      <thead>
        <tr>
          <th>{{ 'admin.modules.colModule' | transloco }}</th>
          <th>{{ 'admin.modules.colKind' | transloco }}</th>
          <th>{{ 'admin.modules.colState' | transloco }}</th>
          <th>{{ 'admin.modules.colBundle' | transloco }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (module of rows(); track module.key) {
          <tr>
            <td>
              <strong>{{ module.name }}</strong>
              <br /><code>{{ module.key }}</code>
            </td>
            <td>
              {{
                (module.family === 'plugin'
                  ? 'admin.modules.plugin'
                  : 'admin.modules.core'
                ) | transloco
              }}
              @if (module.version; as version) {
                <br /><small>
                  {{ 'admin.modules.version' | transloco: { version } }}
                </small>
              }
            </td>
            <td>
              <span [class.is-on]="module.enabled">
                {{ stateKey(module.enabled) | transloco }}
              </span>
              @if (module.enabled !== module.enabledByDefault) {
                <br /><small>
                  {{
                    'admin.modules.default'
                      | transloco
                        : {
                            state:
                              stateKey(module.enabledByDefault) | transloco,
                          }
                  }}
                </small>
              }
            </td>
            <td>
              @if (module.bundleUrl) {
                <code>{{ module.bundleUrl }}</code>
                @if (loadStatus(module.key); as status) {
                  <br /><span [class.failed]="status.status === 'failed'">
                    {{ 'admin.modules.bundle.' + status.status | transloco }}
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
                {{
                  (module.enabled
                    ? 'admin.modules.disable'
                    : 'admin.modules.enable'
                  ) | transloco
                }}
              </button>
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="5">
              {{
                (loading() ? 'common.loading' : 'admin.modules.empty')
                  | transloco
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
  private readonly i18n = inject(TranslationService);

  protected readonly modules = signal<readonly ModuleSummary[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<Problem | null>(null);
  protected readonly notice = signal<Notice | null>(null);
  /** The key currently being written, so one click disables every button. */
  protected readonly busy = signal<string | null>(null);

  protected readonly stateKey = (enabled: boolean): string =>
    enabled ? 'admin.modules.enabled' : 'admin.modules.disabled';

  /**
   * The table's rows, with each name already resolved.
   *
   * The name has to be *here* rather than in a method the template calls: the
   * page is `OnPush` and this client is zoneless, so a language change repaints
   * only what depends on something that changed. Transloco's pipe registers that
   * dependency itself; a method call does not, and the table went on showing
   * English after the switch while `<html lang>` said German. Reading
   * `i18n.locale()` in this computed is what closes that — the same move the
   * participant's event tiles make for a plug-in label.
   */
  protected readonly rows = computed(() => {
    this.i18n.locale();
    return this.modules().map((module) => ({
      ...module,
      name: this.name(module),
    }));
  });

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

  /**
   * The module's name in the organizer's language.
   *
   * Resolved in TypeScript rather than with the pipe, because the confirmation
   * notices need the same string — a name spelled one way in the table and
   * another way in the message below it would read as two modules.
   */
  protected name(module: ModuleSummary): string {
    return this.i18n.translate(module.titleKey);
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
      // The key and its parameter, not the finished sentence: the notice
      // stays on screen, and a language switch while it does has to reach it
      // like everything else on the page (F72).
      this.notice.set({
        key: module.enabled
          ? 'admin.modules.switchedOff'
          : 'admin.modules.switchedOn',
        params: { name: this.name(module) },
      });
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.modules.errorSwitch'));
    } finally {
      this.busy.set(null);
    }
  }

  private async load(): Promise<void> {
    try {
      this.modules.set(await this.admin.list());
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.modules.errorLoad'));
    } finally {
      this.loading.set(false);
    }
  }
}
