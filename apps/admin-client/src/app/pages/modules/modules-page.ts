import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { PluginLoaderService } from '@trefaro/shared-plugins';

/**
 * Module and plug-in administration (FR 1.5).
 *
 * Read-only until phase 2: it shows what the configuration reports and how
 * each plug-in bundle fared. Turning modules on and off from here is phase 2 work,
 * together with the theme settings — until then the `module_config` table is the
 * switch.
 *
 * Showing failed plug-ins is not a diagnostic afterthought: an organizer who
 * enabled the forum and does not see it needs to learn that its bundle failed,
 * rather than conclude the product is broken.
 */
@Component({
  selector: 'trefaro-modules-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Modules</h1>

    <h2>Core modules</h2>
    @if (config.enabledModules().length > 0) {
      <ul>
        @for (moduleKey of config.enabledModules(); track moduleKey) {
          <li>
            <code>{{ moduleKey }}</code>
          </li>
        }
      </ul>
    } @else {
      <p>No optional core module is enabled.</p>
    }

    <h2>Plug-ins</h2>
    @if (plugins.loadResults().length > 0) {
      <table>
        <thead>
          <tr>
            <th>Key</th>
            <th>Version</th>
            <th>Bundle</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          @for (result of plugins.loadResults(); track result.plugin.key) {
            <tr>
              <td>
                <code>{{ result.plugin.key }}</code>
              </td>
              <td>{{ result.plugin.version }}</td>
              <td>
                <code>{{ result.plugin.bundleUrl }}</code>
              </td>
              <td [class.failed]="result.status === 'failed'">
                {{ result.status }}
                @if (result.error) {
                  <br /><small>{{ result.error }}</small>
                }
              </td>
            </tr>
          }
        </tbody>
      </table>
    } @else {
      <p>
        No plug-in is enabled. Every curated plug-in ships in this image and can
        be switched on without a redeploy.
      </p>
    }
  `,
  styles: `
    table {
      inline-size: 100%;
      font-size: 0.9rem;
    }

    th,
    td {
      text-align: start;
      padding: 0.4rem 0.6rem;
      border-block-end: 1px solid var(--trefaro-color-primary-muted);
      vertical-align: top;
    }

    .failed {
      color: #a3341f;
    }
  `,
})
export class ModulesPage {
  protected readonly config = inject(AppConfigService);
  protected readonly plugins = inject(PluginLoaderService);
}
