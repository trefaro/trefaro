import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
} from '@angular/core';

/**
 * Room planning plug-in as a web component (FR 3.11).
 *
 * Exported through Angular Elements as `<trefaro-plugin-room-planning>` and
 * mounted by the clients' plug-in manager at the event detail hook point.
 *
 * Its styling uses only the `--trefaro-*` custom properties the host document
 * defines, never a colour or font of its own. Those properties inherit across
 * the shadow DOM boundary, which is what lets the architecture require plug-ins
 * to bring no design with them: recolour the instance and this component follows
 * without being rebuilt. Layout rules are the plug-in's own business — it is the
 * *theme* that must not be hard-coded.
 *
 * The content is phase 0's demonstration of the plug-in mechanism: it shows the
 * context the host handed over and that change detection works inside the custom
 * element. Phase 4 replaces the body with the real room list and the overbooking
 * check against programme item sign-ups.
 */
@Component({
  selector: 'trefaro-room-planning-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" part="panel">
      <header class="panel__header">
        <h2 class="panel__title">Room planning</h2>
        <span class="panel__badge">plug-in</span>
      </header>

      <dl class="facts">
        <dt>Event</dt>
        <dd>{{ eventLabel() }}</dd>
        <dt>Locale</dt>
        <dd>{{ locale() }}</dd>
      </dl>

      <p class="note">
        Loaded at runtime as a web component and themed through inherited CSS
        custom properties.
      </p>

      <button class="action" type="button" (click)="registerInterest()">
        Interested in a room ({{ interest() }})
      </button>
    </section>
  `,
  styles: `
    :host {
      display: block;
      /* Fall back only if the host document defines nothing — a plug-in loaded
         into a page without the Trefaro theme still has to be readable. */
      font-family: var(--trefaro-font-family, system-ui, sans-serif);
    }

    .panel {
      border: 1px solid var(--trefaro-color-primary-muted, #cbd5d1);
      border-radius: 0.75rem;
      padding: 1rem 1.25rem;
      background: var(--trefaro-color-primary-soft, #f2f7f5);
      color: var(--trefaro-color-primary-strong, #14352c);
    }

    .panel__header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
    }

    .panel__title {
      font-size: 1.05rem;
      font-weight: 600;
      margin: 0;
    }

    .panel__badge {
      background: var(--trefaro-color-accent, #e8a33d);
      color: var(--trefaro-color-on-accent, #000);
      border-radius: 999px;
      padding: 0.1rem 0.6rem;
      font-size: 0.7rem;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }

    .facts {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 0.25rem 0.75rem;
      margin: 0 0 0.75rem;
      font-size: 0.9rem;
    }

    .facts dt {
      font-weight: 600;
      opacity: 0.75;
    }

    .facts dd {
      margin: 0;
    }

    .note {
      font-size: 0.85rem;
      opacity: 0.8;
      margin: 0 0 0.9rem;
    }

    .action {
      font: inherit;
      cursor: pointer;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 0.9rem;
      background: var(--trefaro-color-primary, #1f6f5c);
      color: var(--trefaro-color-on-primary, #fff);
    }

    .action:hover {
      background: var(--trefaro-color-primary-strong, #14352c);
    }
  `,
})
export class RoomPlanningPlugin {
  /**
   * Context the host passes in as an element property.
   *
   * Angular Elements exposes an input as a DOM property, so a client written
   * without Angular sets `element.eventId = '…'` just the same.
   */
  readonly eventId = input<string | null>(null);

  /** Active locale, so the plug-in can follow the instance's language. */
  readonly locale = input<string>('en');

  private readonly interestCount = signal(0);
  readonly interest = this.interestCount.asReadonly();

  readonly eventLabel = computed(() => this.eventId() ?? 'none supplied');

  registerInterest(): void {
    this.interestCount.update((count) => count + 1);
  }
}
