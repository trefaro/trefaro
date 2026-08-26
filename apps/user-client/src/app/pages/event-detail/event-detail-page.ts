import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { PluginSlot } from '@trefaro/shared-plugins';

/**
 * Event detail view (FR 3.6).
 *
 * Carries the second plug-in hook point. The mockups show this view as a set of
 * tiles — programme, room plan, networking, proposals, forum — where a tile only
 * appears when its module is enabled, and plug-ins add their own.
 *
 * Phase 1 fills in the event's own information; phase 0 proves that a plug-in
 * web component mounts here and receives the event as context.
 */
@Component({
  selector: 'trefaro-event-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PluginSlot],
  template: `
    <h1>Event</h1>
    <p class="meta">
      Event id: <code>{{ eventId() }}</code>
    </p>

    <section class="tiles">
      @for (moduleKey of config.enabledModules(); track moduleKey) {
        <span class="tile">{{ moduleKey }}</span>
      } @empty {
        <p class="meta">No optional modules are enabled on this instance.</p>
      }
    </section>

    <!-- Plug-in hook point two: the event detail view. The context is handed to
         each plug-in as element properties. -->
    <trefaro-plugin-slot
      mountPoint="event-detail"
      [context]="pluginContext()"
    />
  `,
  styles: `
    .meta {
      color: var(--trefaro-color-primary-strong);
      font-size: 0.9rem;
    }

    .tiles {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-block: 1rem;
    }

    .tile {
      border-radius: 999px;
      padding: 0.2rem 0.7rem;
      font-size: 0.8rem;
      background: var(--trefaro-color-accent-soft);
      color: var(--trefaro-color-primary-strong);
    }
  `,
})
export class EventDetailPage {
  /** Bound from the route parameter by the router's component input binding. */
  readonly eventId = input.required<string>();

  protected readonly config = inject(AppConfigService);

  protected readonly pluginContext = computed(() => ({
    eventId: this.eventId(),
    locale: this.config.config()?.defaultLocale ?? 'en',
  }));
}
