import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type { PublicEvent, PublicEventSeries } from '@trefaro/shared-models';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';
import { PublicEventsService } from '../../features/events/public-events.service';
import { SeriesDetailPage } from './series-detail-page';

const SERIES: PublicEventSeries = {
  id: 'series-1',
  slug: 'climate-conference-2027',
  name: 'Climate Conference 2027',
  description: 'Three days on citizen participation.',
  logoUrl: null,
  websiteUrl: null,
  contactEmail: null,
};

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  seriesSlug: 'climate-conference-2027',
  name: 'Kickoff in Cologne',
  description: null,
  eventType: 'onsite',
  venueName: 'Bürgerhaus',
  onlineUrl: null,
  startsAt: '2027-06-14T08:00:00.000Z',
  endsAt: '2027-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  languages: ['de'],
  registrationOpen: true,
  logoUrl: null,
  followUpText: null,
} as unknown as PublicEvent;

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

/** Both reads of one load, handed out one answer at a time. */
class DeferredContent {
  readonly calls: {
    locale: string;
    resolve: (name: string) => void;
  }[] = [];

  private pending:
    | ((value: { series: PublicEventSeries; events: PublicEvent[] }) => void)
    | null = null;

  bySlug(_slug: string, locale: string): Promise<PublicEventSeries> {
    return new Promise((resolve) => {
      this.calls.push({
        locale,
        resolve: (name: string) => resolve({ ...SERIES, name }),
      });
    });
  }

  listBySeries(): Promise<readonly PublicEvent[]> {
    return Promise.resolve([EVENT]);
  }
}

/** Lets the promises the page awaits settle, then redraws. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/**
 * The series page (FR 1.5, FR 3.12).
 *
 * The markup is the browser suite's subject. What is worth a test here is the
 * one thing a browser can only catch by accident: two loads are in flight the
 * moment somebody switches the language before the first answer arrives, and
 * the answers come back in the order of the network rather than in the order
 * they were asked for.
 */
describe('SeriesDetailPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the answer to the language it asked for last, whatever arrives later', async () => {
    const content = new DeferredContent();
    const translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest(),
        { provide: PublicEventSeriesService, useValue: content },
        { provide: PublicEventsService, useValue: content },
        { provide: TranslationService, useValue: translations },
      ],
    });
    const fixture = TestBed.createComponent(SeriesDetailPage);
    fixture.componentRef.setInput('slug', 'climate-conference-2027');
    fixture.detectChanges();

    translations.use('de');
    fixture.detectChanges();
    expect(content.calls.map((call) => call.locale)).toEqual(['en', 'de']);
    const [english, german] = content.calls;

    // The later request answers first — a loaded server, a slow first byte.
    german.resolve('Klimakonferenz 2027');
    await settle(fixture);
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text()).toContain('Klimakonferenz 2027');

    // And then the answer nobody is waiting for any more.
    english.resolve('Climate Conference 2027');
    await settle(fixture);
    expect(text()).toContain('Klimakonferenz 2027');
    expect(text()).not.toContain('Climate Conference 2027');
  });
});
