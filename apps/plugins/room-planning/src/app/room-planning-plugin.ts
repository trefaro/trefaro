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
 * **No text of its own.** Since AP 1 of phase 4 the words come from `strings` —
 * the host's catalogue selection under `plugins.roomPlanning.`, handed over as
 * an element property together with `locale` (E48, plug-in API 1.2.0). That is
 * what makes a plug-in's text maintainable by the organization like every other
 * sentence in the application (E22), without this bundle carrying a translation
 * library or fetching the catalogue a second time. A key the host has nothing
 * for shows as the key, which is what a missing translation looks like
 * everywhere else.
 *
 * The body is still phase 0's demonstration of the mechanism: the context the
 * host handed over, and that change detection works inside the custom element.
 * AP 6 replaces it with the real room list and the overbooking check against
 * programme item sign-ups.
 */
@Component({
  selector: 'trefaro-room-planning-plugin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="panel" part="panel">
      <header class="panel__header">
        <h2 class="panel__title">{{ text().title }}</h2>
      </header>

      <dl class="facts">
        <dt>{{ text().event }}</dt>
        <dd>{{ eventLabel() }}</dd>
        <dt>{{ text().language }}</dt>
        <dd>{{ locale() }}</dd>
      </dl>

      <p class="note">{{ text().note }}</p>

      <button class="action" type="button" (click)="registerInterest()">
        {{ text().action }} ({{ interest() }})
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

  /**
   * This plug-in's words, keyed without the `plugins.roomPlanning.` prefix.
   *
   * Reassigned by the host on a language switch rather than the element being
   * replaced, so the interest count below survives one — which is the point of
   * handing words over instead of text.
   */
  readonly strings = input<Readonly<Record<string, string>>>({});

  private readonly interestCount = signal(0);
  readonly interest = this.interestCount.asReadonly();

  /**
   * Every word the template needs, resolved once.
   *
   * A `computed()` rather than a call per placeholder: one place to see what
   * this plug-in asks the catalogue for, and one place for the fallback. The
   * fallback is the full key, the same thing a missing translation shows
   * anywhere else — a plug-in mounted by a host that predates 1.2.0 says what
   * it is missing instead of rendering an empty panel.
   */
  protected readonly text = computed(() => {
    const strings = this.strings();
    const word = (key: string): string =>
      strings[key] ?? `plugins.roomPlanning.${key}`;

    return {
      title: word('title'),
      event: word('event'),
      language: word('language'),
      note: word('note'),
      action: word('action'),
      noEvent: word('noEvent'),
    };
  });

  readonly eventLabel = computed(() => this.eventId() ?? this.text().noEvent);

  registerInterest(): void {
    this.interestCount.update((count) => count + 1);
  }
}
