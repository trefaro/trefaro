import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { problemOf, type Problem } from '@trefaro/shared-http';
import type { EventSeries } from '@trefaro/shared-models';
import { eventSeriesStatusKey } from '@trefaro/shared-models';
import { EventSeriesAdminService } from '../../features/event-series/event-series-admin.service';

/**
 * Organizer start page — every event series (FR 2.2), as the mockups have it.
 *
 * The status column is the whole point of the page: a draft is invisible to
 * participants, and an organizer has to be able to see at a glance which of
 * their series are actually public.
 *
 * Deleting happens on the series itself, not from this row: there the events
 * that would go with it are on screen, so the confirmation can say what is
 * actually at stake.
 */
@Component({
  selector: 'trefaro-series-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, TranslocoPipe],
  template: `
    <header class="head">
      <h1>{{ 'admin.series.title' | transloco }}</h1>
      <a class="button" routerLink="/series/new">
        {{ 'admin.series.new' | transloco }}
      </a>
    </header>

    @if (error(); as problem) {
      <p class="error" role="alert">
        {{ problem.key | transloco }}
        @if (problem.detail; as detail) {
          <span class="error__detail">{{ detail }}</span>
        }
      </p>
    }

    <table>
      <thead>
        <tr>
          <th>{{ 'admin.series.name' | transloco }}</th>
          <th>{{ 'admin.series.publicAddress' | transloco }}</th>
          <th>{{ 'admin.series.status' | transloco }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (item of admin.series(); track item.id) {
          <tr>
            <td>
              <a [routerLink]="['/series', item.id]">{{ item.name }}</a>
            </td>
            <td>
              <code>/series/{{ item.slug }}</code>
            </td>
            <td>
              <span class="status" [class]="'status--' + item.status">
                {{ statusKey(item.status) | transloco }}
              </span>
            </td>
            <td class="actions">
              @if (item.status === 'published') {
                <button type="button" (click)="setStatus(item, 'draft')">
                  {{ 'admin.series.unpublish' | transloco }}
                </button>
              } @else {
                <button type="button" (click)="setStatus(item, 'published')">
                  {{ 'admin.series.publish' | transloco }}
                </button>
              }
            </td>
          </tr>
        } @empty {
          <tr>
            <td colspan="4">
              {{
                (admin.isLoading() ? 'common.loading' : 'admin.series.empty')
                  | transloco
              }}
            </td>
          </tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    .head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
    }

    .button {
      padding: 0.5rem 0.9rem;
      border-radius: 0.4rem;
      background: var(--trefaro-color-primary);
      color: var(--trefaro-color-on-primary);
      font-weight: 600;
      text-decoration: none;
    }

    table {
      border-collapse: collapse;
      inline-size: 100%;
    }

    th,
    td {
      padding: 0.5rem 0.6rem;
      border-block-end: 1px solid
        color-mix(in oklab, currentColor 15%, transparent);
      text-align: start;
    }

    .status {
      padding: 0.1rem 0.5rem;
      border-radius: 1rem;
      font-size: 0.85rem;
      background: color-mix(in oklab, currentColor 12%, transparent);
    }

    .status--published {
      background: color-mix(
        in oklab,
        var(--trefaro-color-primary) 22%,
        transparent
      );
    }

    .actions {
      display: flex;
      gap: 0.4rem;
      justify-content: end;
    }

    .actions button {
      padding: 0.3rem 0.6rem;
      border: 1px solid color-mix(in oklab, currentColor 30%, transparent);
      border-radius: 0.4rem;
      background: transparent;
      font: inherit;
      cursor: pointer;
    }

    .error {
      color: #a3341f;
    }
  `,
})
export class SeriesListPage {
  protected readonly admin = inject(EventSeriesAdminService);
  protected readonly error = signal<Problem | null>(null);
  protected readonly statusKey = eventSeriesStatusKey;

  constructor() {
    void this.run(() => this.admin.reload());
  }

  protected setStatus(
    series: EventSeries,
    status: EventSeries['status'],
  ): void {
    void this.run(() => this.admin.update(series.id, { status }));
  }

  private async run(action: () => Promise<unknown>): Promise<void> {
    this.error.set(null);
    try {
      await action();
    } catch (error: unknown) {
      this.error.set(problemOf(error, 'admin.common.requestFailed'));
    }
  }
}
