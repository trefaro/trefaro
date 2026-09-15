import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type { PublicEventSeries } from '@trefaro/shared-models';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';
import { StartPage } from './start-page';

const row: PublicEventSeries = {
  id: 'series-1',
  slug: 'climate-conference-2027',
  name: 'Climate Conference 2027',
  description: 'Three days on citizen participation.',
  logoUrl: null,
  websiteUrl: null,
  contactEmail: null,
};

/** Lets the promises the page awaits settle, then redraws. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

function text(fixture: { nativeElement: unknown }): string {
  return (fixture.nativeElement as HTMLElement).textContent ?? '';
}

async function render(
  list: () => Promise<readonly PublicEventSeries[]>,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      // The words this page is about, and nothing else: a key with no
      // translation renders as the key, which is what the other assertions
      // want to see.
      provideTranslationsForTest({
        'start.empty':
          'This organization has not published an event series yet.',
        'start.errorRetry':
          'The event series could not be loaded. Please try again in a moment.',
      }),
      { provide: PublicEventSeriesService, useValue: { list } },
    ],
  });

  const fixture = TestBed.createComponent(StartPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/** `locale` is a signal and `translate` is not reactive — like the real one. */
class FakeTranslations {
  readonly locale = signal('en');
  translate(key: string): string {
    return key;
  }
  stringsWithPrefix(): Record<string, string> {
    return {};
  }
  use(locale: string): void {
    this.locale.set(locale);
  }
}

/** A list whose answers this spec hands out one at a time. */
class DeferredSeries {
  readonly calls: {
    locale: string;
    resolve: (rows: readonly PublicEventSeries[]) => void;
  }[] = [];

  list(locale: string): Promise<readonly PublicEventSeries[]> {
    return new Promise((resolve) => {
      this.calls.push({ locale, resolve });
    });
  }
}

describe('StartPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the answer to the language it asked for last, whatever arrives later', async () => {
    const series = new DeferredSeries();
    const translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest(),
        { provide: PublicEventSeriesService, useValue: series },
        { provide: TranslationService, useValue: translations },
      ],
    });
    const fixture = TestBed.createComponent(StartPage);
    fixture.detectChanges();

    translations.use('de');
    fixture.detectChanges();
    const [english, german] = series.calls;
    expect(series.calls.map((call) => call.locale)).toEqual(['en', 'de']);

    // The later request answers first — a loaded server, a slow first byte.
    german.resolve([{ ...row, name: 'Klimakonferenz 2027' }]);
    await settle(fixture);
    expect(text(fixture)).toContain('Klimakonferenz 2027');

    // And then the answer to a question nobody is asking any more. It must not
    // win: the reader would get an English list under a German page.
    english.resolve([row]);
    await settle(fixture);
    expect(text(fixture)).toContain('Klimakonferenz 2027');
    expect(text(fixture)).not.toContain('Climate Conference 2027');
  });

  it('lists the published series with a link to each', async () => {
    const element = await render(() => Promise.resolve([row]));

    expect(element.textContent).toContain('Climate Conference 2027');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/series/climate-conference-2027',
    );
  });

  it('says so plainly when the organization has published nothing yet', async () => {
    const element = await render(() => Promise.resolve([]));

    expect(element.textContent).toContain('has not published an event series');
  });

  it('tells a visitor to try again when the server cannot be reached', async () => {
    const element = await render(() =>
      Promise.reject({ status: 0, message: 'nope', retryable: true }),
    );

    // The public start page is the first thing anyone sees; a stack trace or a
    // silently empty list would both be wrong (NFR 10).
    expect(element.textContent).toContain('try again');
  });
});
