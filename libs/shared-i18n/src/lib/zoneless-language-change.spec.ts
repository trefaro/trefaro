import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TranslocoDirective,
  TranslocoPipe,
  TranslocoService,
  provideTransloco,
  translateSignal,
} from '@jsverse/transloco';
import type { Translation, TranslocoLoader } from '@jsverse/transloco';
import { firstValueFrom } from 'rxjs';

/**
 * The one check that had to come before any text was moved (AP 6 of phase 2).
 *
 * Both clients run zoneless: `zone.js` is not a dependency of this workspace at
 * all, so nothing patches `setTimeout` and nothing marks the tree dirty on its
 * own. Transloco predates that mode by several major versions and re-renders by
 * calling `markForCheck()` from a subscription — which is a no-op in a world
 * where a dirty view is not enough to schedule a pass. If that were the case
 * here, every translated template would need the signal reading instead, and
 * finding that out after extracting ten thousand lines of text would be finding
 * it out too late.
 *
 * So all three readings are pinned here: the pipe, the structural directive and
 * `translateSignal`. What the assertion actually proves is that a language
 * change reaches the DOM of an `OnPush` component without anyone calling
 * `detectChanges()` — `whenStable()` waits for whatever Angular scheduled, and
 * schedules nothing itself.
 */
const CATALOGUES: Record<string, Translation> = {
  en: { 'modules.mediaLinks': 'Media links' },
  de: { 'modules.mediaLinks': 'Medien-Links' },
};

class StubLoader implements TranslocoLoader {
  async getTranslation(lang: string): Promise<Translation> {
    return CATALOGUES[lang] ?? {};
  }
}

@Component({
  selector: 'trefaro-pipe-probe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe],
  template: `<span>{{ 'modules.mediaLinks' | transloco }}</span>`,
})
class PipeProbe {}

@Component({
  selector: 'trefaro-directive-probe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoDirective],
  template: `<span *transloco="let t">{{ t('modules.mediaLinks') }}</span>`,
})
class DirectiveProbe {}

@Component({
  selector: 'trefaro-signal-probe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ label() }}</span>`,
})
class SignalProbe {
  readonly label = translateSignal('modules.mediaLinks');
}

describe('a language change in a zoneless client', () => {
  let transloco: TranslocoService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en', 'de'],
            defaultLang: 'en',
            fallbackLang: 'en',
            reRenderOnLangChange: true,
            missingHandler: { useFallbackTranslation: true },
          },
          loader: StubLoader,
        }),
      ],
    });
    transloco = TestBed.inject(TranslocoService);
  });

  for (const probe of [PipeProbe, DirectiveProbe, SignalProbe]) {
    it(`repaints ${probe.name} without a manual change detection pass`, async () => {
      const fixture = TestBed.createComponent(probe);
      await fixture.whenStable();
      expect(fixture.nativeElement.textContent).toContain('Media links');

      await firstValueFrom(transloco.load('de'));
      transloco.setActiveLang('de');
      await fixture.whenStable();

      expect(fixture.nativeElement.textContent).toContain('Medien-Links');
    });
  }
});
