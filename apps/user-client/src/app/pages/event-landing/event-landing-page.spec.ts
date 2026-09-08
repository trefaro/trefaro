import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type {
  PluginDescriptor,
  PluginMountPoint,
  PublicEvent,
  PublicMediaLink,
  PublicProgramItem,
} from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { ContactService } from '../../features/contact/contact.service';
import { PublicEventsService } from '../../features/events/public-events.service';
import { PublicMediaLinksService } from '../../features/media-links/public-media-links.service';
import { PublicProgramService } from '../../features/program/public-program.service';
import { EventLandingPage } from './event-landing-page';

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event this page is about.',
  logoUrl: null,
  eventType: 'onsite',
  startsAt: '2099-06-14T06:00:00.000Z',
  endsAt: '2099-06-14T16:00:00.000Z',
  timezone: 'Europe/Berlin',
  venueName: 'Bürgerhaus Kalk',
  venueAddress: null,
  onlineUrl: null,
  languages: ['de'],
  followUpBody: null,
};

interface Pending {
  readonly locale: string;
  resolve(event: PublicEvent): void;
}

/**
 * The event endpoint, answering only when the test says so.
 *
 * What is under test is the order of two answers, so the fake hands the test
 * the resolver of each call instead of answering by itself.
 */
class DeferredEvents {
  readonly calls: Pending[] = [];

  get(_seriesSlug: string, _eventSlug: string, locale: string) {
    return new Promise<PublicEvent>((resolve) => {
      this.calls.push({ locale, resolve });
    });
  }
}

class QuietProgram {
  list(): Promise<readonly PublicProgramItem[]> {
    return Promise.resolve([]);
  }
}

class QuietMediaLinks {
  list(): Promise<readonly PublicMediaLink[]> {
    return Promise.resolve([]);
  }
}

class StubAppConfig {
  readonly plugins = signal<readonly PluginDescriptor[]>([]);
  pluginsAt(mountPoint: PluginMountPoint): readonly PluginDescriptor[] {
    return this.plugins().filter((plugin) =>
      plugin.mountPoints.includes(mountPoint),
    );
  }
  isModuleEnabled(): boolean {
    return false;
  }
}

class StubLoader {
  readonly ready = signal<readonly string[]>([]);
  loadResults(): readonly unknown[] {
    return this.ready();
  }
  isReady(key: string): boolean {
    return this.ready().includes(key);
  }
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

/** Lets the promises the page awaits settle, then redraws. */
async function settle(fixture: { detectChanges(): void }): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  fixture.detectChanges();
}

/**
 * The event landing page (FR 1.5, FR 3.12).
 *
 * The markup is the browser suite's subject. What is worth a test here is the
 * one thing a browser can only show by accident: the page fetches its content
 * again when the language changes, and two answers can arrive in either order.
 */
describe('EventLandingPage', () => {
  let events: DeferredEvents;
  let translations: FakeTranslations;

  function render() {
    events = new DeferredEvents();
    translations = new FakeTranslations();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest(),
        { provide: PublicEventsService, useValue: events },
        { provide: PublicProgramService, useValue: new QuietProgram() },
        { provide: PublicMediaLinksService, useValue: new QuietMediaLinks() },
        { provide: AppConfigService, useValue: new StubAppConfig() },
        { provide: PluginLoaderService, useValue: new StubLoader() },
        { provide: TranslationService, useValue: translations },
        { provide: ContactService, useValue: { send: () => Promise.reject() } },
      ],
    });
    const fixture = TestBed.createComponent(EventLandingPage);
    fixture.componentRef.setInput('seriesSlug', 'buergerraete');
    fixture.componentRef.setInput('eventSlug', 'kickoff');
    fixture.detectChanges();
    return fixture;
  }

  const heading = (fixture: ReturnType<typeof render>): string | null =>
    (fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent ??
    null;

  it('asks again in the new language when the reader switches (FR 3.12)', async () => {
    const fixture = render();

    translations.use('de');
    fixture.detectChanges();

    // The translation lives on the server, so a switch is a second request —
    // a page that only re-rendered would keep the sentences it already had.
    expect(events.calls.map((call) => call.locale)).toEqual(['en', 'de']);
  });

  it('keeps the answer to the language it asked for last, whatever arrives later', async () => {
    const fixture = render();
    translations.use('de');
    fixture.detectChanges();
    const [english, german] = events.calls;

    // The later request answers first — a loaded server, a slow first byte.
    german.resolve({ ...EVENT, name: 'Auftakt in Köln' });
    await settle(fixture);
    expect(heading(fixture)).toContain('Auftakt in Köln');

    // Then the answer nobody is waiting for any more. It must not win: the
    // reader would see a German page with an English event on it, which is
    // exactly what the browser suite once caught under eight workers.
    english.resolve({ ...EVENT, name: 'Kickoff in Cologne' });
    await settle(fixture);
    expect(heading(fixture)).toContain('Auftakt in Köln');
  });
});
