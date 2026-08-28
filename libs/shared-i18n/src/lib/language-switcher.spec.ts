import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageSwitcher } from './language-switcher';
import { TranslationService } from './translation.service';
import { provideTranslationsForTest } from './testing';

/**
 * The control itself: that it appears only when there is a choice, that it shows
 * the current language as selected, and that choosing goes through the service
 * rather than straight to Transloco.
 */
class FakeTranslations {
  // Signals, like the real service: the component is `OnPush`, so a plain field
  // would change without anything marking the view for a new check — and the
  // test would then be asserting on a stale DOM rather than on the component.
  readonly availableLocales = signal<readonly string[]>(['en', 'de']);
  readonly locale = signal('en');
  readonly switching = signal(false);
  readonly chosen: string[] = [];

  languageName(locale: string): string {
    return locale === 'de' ? 'Deutsch' : 'English';
  }

  async use(locale: string): Promise<void> {
    this.chosen.push(locale);
    this.locale.set(locale);
  }
}

describe('LanguageSwitcher', () => {
  let translations: FakeTranslations;

  function render() {
    TestBed.resetTestingModule();
    translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({ 'language.switcher.label': 'Language' }),
        { provide: TranslationService, useValue: translations },
      ],
    });

    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    return {
      fixture,
      select: () => element.querySelector('select'),
      options: () =>
        [...element.querySelectorAll('option')] as HTMLOptionElement[],
      text: () => element.textContent ?? '',
    };
  }

  it('offers one option per language the organization maintains', () => {
    const view = render();

    expect(view.options().map((option) => option.textContent?.trim())).toEqual([
      'English',
      'Deutsch',
    ]);
  });

  it('labels itself from the catalogue', () => {
    expect(render().text()).toContain('Language');
  });

  it('renders nothing while there is only one language', () => {
    const view = render();
    translations.availableLocales.set(['en']);
    view.fixture.detectChanges();

    // Every instance has at least English, so this is the state a fresh
    // installation is in — and a control whose only option is the current state
    // invites a click that does nothing.
    expect(view.select()).toBeNull();
  });

  it('marks the active language as selected', () => {
    const view = render();
    translations.locale.set('de');
    view.fixture.detectChanges();

    // Through `[selected]` on the options: Angular writes a `[value]` on the
    // select before the loop has produced them, and drops the assignment.
    expect(view.options().find((option) => option.selected)?.value).toBe('de');
  });

  it('goes through the service, which loads before it activates', async () => {
    const view = render();
    const select = view.select();
    if (!select) throw new Error('the switcher rendered no select');

    select.value = 'de';
    select.dispatchEvent(new Event('change'));
    await view.fixture.whenStable();

    expect(translations.chosen).toEqual(['de']);
  });

  it('cannot be operated while a catalogue is in flight', () => {
    const view = render();
    translations.switching.set(true);
    view.fixture.detectChanges();

    expect(view.select()?.disabled).toBe(true);
  });
});
