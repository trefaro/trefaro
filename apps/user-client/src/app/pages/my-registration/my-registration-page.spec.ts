import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  MyRegistration,
  PluginDescriptor,
  PluginMountPoint,
  PublicEvent,
  RegistrationStatus,
} from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import {
  SelfServiceService,
  type SelfServiceAccess,
} from '../../features/self-service/self-service.service';
import { MyRegistrationPage } from './my-registration-page';

const EVENT: PublicEvent = {
  id: 'event-1',
  slug: 'kickoff',
  name: 'Kickoff in Cologne',
  description: 'The event this registration is for.',
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

const registration = (
  status: RegistrationStatus = 'confirmed',
): MyRegistration => ({
  firstName: 'Amina',
  lastName: 'Okonkwo',
  email: 'amina@example.org',
  status,
  registeredAt: '2026-09-01T10:00:00.000Z',
  confirmedAt: '2026-09-01T10:05:00.000Z',
  customFields: {},
  seriesSlug: 'buergerraete',
  event: EVENT,
  program: [],
});

/** Records which credential the page presented (E11, E31). */
class FakeSelfService {
  readonly viewed: SelfServiceAccess[] = [];
  readonly cancelled: SelfServiceAccess[] = [];

  async view(access: SelfServiceAccess): Promise<MyRegistration> {
    this.viewed.push(access);
    return registration();
  }

  async cancel(access: SelfServiceAccess): Promise<MyRegistration> {
    this.cancelled.push(access);
    return registration('cancelled');
  }
}

/** The plug-in host, with nothing switched on unless a test says otherwise. */
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

const CHECKIN: PluginDescriptor = {
  key: 'qr-checkin',
  version: '0.1.0',
  labelKey: 'plugins.qrCheckin.label',
  elementName: 'trefaro-plugin-qr-checkin',
  bundleUrl: '/api/plugins/qr-checkin/main.js',
  mountPoints: ['my-registration'],
  icon: 'qr_code_2',
};

/**
 * "My registration", which since AP 4 is reached in two ways (E11).
 *
 * The page itself is the browser suite's subject. What belongs here is the one
 * decision it makes on its own: which credential this visit has, and what that
 * removes from the screen.
 */
describe('MyRegistrationPage', () => {
  let selfService: FakeSelfService;
  let config: StubAppConfig;
  let loader: StubLoader;

  async function render(inputs: { token?: string; id?: string }) {
    selfService = new FakeSelfService();
    config = new StubAppConfig();
    loader = new StubLoader();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AppConfigService, useValue: config },
        { provide: PluginLoaderService, useValue: loader },
        provideTranslationsForTest({
          'mine.title': 'My registration',
          'mine.cancel': 'Cancel my registration',
          'mine.keepLink': 'Keep this link to yourself',
          'mine.list.back': 'Back to my registrations',
        }),
        { provide: SelfServiceService, useValue: selfService },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            translate: (key: string) => key,
            // The slot resolves a plug-in's words against the catalogue it
            // already has; nothing is switched on here unless a test says so.
            stringsWithPrefix: () => ({}),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(MyRegistrationPage);
    if (inputs.token !== undefined) {
      fixture.componentRef.setInput('token', inputs.token);
    }
    if (inputs.id !== undefined) {
      fixture.componentRef.setInput('id', inputs.id);
    }
    fixture.detectChanges();
    // The registration is read in an effect; a turn of the microtask queue is
    // what the fake needs to answer.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return { fixture, text: () => String(fixture.nativeElement.textContent) };
  }

  it('resolves the registration by session when there is no token', async () => {
    await render({ id: 'registration-1' });

    expect(selfService.viewed).toEqual([
      { kind: 'session', registrationId: 'registration-1' },
    ]);
  });

  it('prefers the link when a visit somehow has both', async () => {
    await render({ token: 'signed.token', id: 'registration-1' });

    // A link is what somebody is holding in their hand, and it works whether or
    // not they are also signed in.
    expect(selfService.viewed).toEqual([
      { kind: 'link', token: 'signed.token' },
    ]);
  });

  it('asks for nothing without either credential', async () => {
    const { text } = await render({});

    expect(selfService.viewed).toEqual([]);
    expect(text()).toContain('mine.noToken');
  });

  it('offers the cancellation to a session as well (FR 4.7)', async () => {
    const { text } = await render({ id: 'registration-1' });

    // AP 12 gave the rule its second claim, so the button is there for both —
    // and the way back to the list stays, because a session has one.
    expect(text()).toContain('Cancel my registration');
    expect(text()).toContain('Back to my registrations');
  });

  it('cancels with the credential this visit has', async () => {
    const { fixture } = await render({ id: 'registration-1' });
    // The one action on this page that asks first: registering again is a new
    // registration, not an undo. Answered with yes here — that the question is
    // asked at all is the browser suite's business.
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.nativeElement.querySelector('button.danger').click();
    await Promise.resolve();

    expect(selfService.cancelled).toEqual([
      { kind: 'session', registrationId: 'registration-1' },
    ]);
  });

  it('offers the hook point about this registration (plug-in API 1.2.0, E54)', async () => {
    const { fixture } = await render({ token: 'signed.token' });
    config.plugins.set([CHECKIN]);
    loader.ready.set(['qr-checkin']);
    fixture.detectChanges();

    const element = (fixture.nativeElement as HTMLElement).querySelector(
      'trefaro-plugin-qr-checkin',
    );
    expect(element).not.toBeNull();
    // The credential this visit has, handed over rather than scraped out of
    // the address bar (F202) — the token here, the id in the other case.
    expect((element as unknown as Record<string, unknown>)['token']).toBe(
      'signed.token',
    );
    expect(
      (element as unknown as Record<string, unknown>)['registrationId'],
    ).toBeNull();
  });

  it('hands the registration over when a session is what opened the page', async () => {
    const { fixture } = await render({ id: 'registration-1' });
    config.plugins.set([CHECKIN]);
    loader.ready.set(['qr-checkin']);
    fixture.detectChanges();

    const element = (fixture.nativeElement as HTMLElement).querySelector(
      'trefaro-plugin-qr-checkin',
    ) as unknown as Record<string, unknown>;
    expect(element['registrationId']).toBe('registration-1');
    expect(element['token']).toBeNull();
    // And the hook point cannot forget what the contract promises.
    expect(element['mountPoint']).toBe('my-registration');
  });

  it('mounts nothing at the hook point while the plug-in is off (E21)', async () => {
    const { fixture } = await render({ token: 'signed.token' });

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '.trefaro-plugin-slot > *',
      ),
    ).toBeNull();
  });

  it('warns about the link only when there is one', async () => {
    const { text } = await render({ token: 'signed.token' });

    // Whoever holds the link can change this registration; somebody who signed
    // in has nothing to keep to themselves.
    expect(text()).toContain('Keep this link to yourself');
    expect(text()).toContain('Cancel my registration');
  });
});
