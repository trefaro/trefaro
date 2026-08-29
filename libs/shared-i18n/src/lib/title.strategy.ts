import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from './translation.service';

/**
 * What a browser tab of this instance says (FR 1.4, chapter 4).
 *
 * Until phase 2 every route carried its title as a literal ending in the product
 * name — "Participants — Trefaro" — which is the name of the tool in the place
 * where the name of the organization belongs (F60), in a language chosen when
 * the route was written rather than by the reader. A `TitleStrategy` resolves
 * both at once: the route names a catalogue key, this appends
 * {@link AppConfigService.organizationName}.
 *
 * A route with no title at all gets the organization's name on its own. That is
 * the participant client's start page: it *is* the instance, and "Event series —
 * Democracy International" would name a section of a page that has no other.
 *
 * **It re-titles outside navigation.** `updateTitle` runs once per navigation,
 * so a language switch or a rename on the design page would otherwise leave the
 * tab in the previous language until the next click. The key is kept in a
 * signal and written from an `effect` that also reads the locale and the
 * organization name — the same rule as any label assembled in TypeScript (F72),
 * applied to the one label that lives outside the document.
 */
@Injectable()
export class TrefaroTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly i18n = inject(TranslationService);
  private readonly config = inject(AppConfigService);

  /** The catalogue key of the current route, or `null` for a route with none. */
  private readonly key = signal<string | null>(null);

  private readonly text = computed(() => {
    const organization = this.config.organizationName();
    const key = this.key();
    if (!key) return organization;

    // Read in the same computation, so a language switch recomputes it: the
    // translation itself is a plain map lookup with no signal behind it (F72).
    this.i18n.locale();
    return `${this.i18n.translate(key)} — ${organization}`;
  });

  constructor() {
    super();
    effect(() => this.title.setTitle(this.text()));
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.key.set(this.buildTitle(snapshot) ?? null);
  }
}
