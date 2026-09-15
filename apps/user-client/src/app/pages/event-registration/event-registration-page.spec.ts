import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type {
  PublicEvent,
  RegistrationFieldPublic,
} from '@trefaro/shared-models';
import { PublicEventsService } from '../../features/events/public-events.service';
import { RegistrationsService } from '../../features/registrations/registration.service';
import { EventRegistrationPage } from './event-registration-page';

const EVENT = {
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

/** The event read, handed out one answer at a time. */
class DeferredEvents {
  readonly calls: { locale: string; resolve: (name: string) => void }[] = [];

  get(
    _seriesSlug: string,
    _eventSlug: string,
    locale: string,
  ): Promise<PublicEvent> {
    return new Promise((resolve) => {
      this.calls.push({
        locale,
        resolve: (name: string) => resolve({ ...EVENT, name }),
      });
    });
  }
}

/** The form definition is not part of this test, and says so by being empty. */
class QuietRegistrations {
  fields(): Promise<readonly RegistrationFieldPublic[]> {
    return Promise.resolve([]);
  }
}

/** Lets the promises the page awaits settle, then redraws. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/**
 * The registration form (FR 3.5, FR 3.12).
 *
 * The form itself is the browser suite's subject. What is worth a test here is
 * the race a browser only catches by accident: two loads are in flight the
 * moment somebody switches the language before the first answer arrives, and
 * they come back in the order of the network.
 */
describe('EventRegistrationPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('keeps the answer to the language it asked for last, whatever arrives later', async () => {
    const events = new DeferredEvents();
    const translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest(),
        { provide: PublicEventsService, useValue: events },
        { provide: RegistrationsService, useValue: new QuietRegistrations() },
        { provide: TranslationService, useValue: translations },
      ],
    });
    const fixture = TestBed.createComponent(EventRegistrationPage);
    fixture.componentRef.setInput('seriesSlug', 'climate-conference-2027');
    fixture.componentRef.setInput('eventSlug', 'kickoff');
    fixture.detectChanges();

    translations.use('de');
    fixture.detectChanges();
    expect(events.calls.map((call) => call.locale)).toEqual(['en', 'de']);
    const [english, german] = events.calls;
    const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

    // The later request answers first — a loaded server, a slow first byte.
    german.resolve('Auftakt in Köln');
    await settle(fixture);
    expect(text()).toContain('Auftakt in Köln');

    // And then the answer nobody is waiting for any more.
    english.resolve('Kickoff in Cologne');
    await settle(fixture);
    expect(text()).toContain('Auftakt in Köln');
    expect(text()).not.toContain('Kickoff in Cologne');
  });
});
