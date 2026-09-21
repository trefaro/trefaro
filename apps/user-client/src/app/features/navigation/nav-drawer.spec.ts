import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import {
  TranslationService,
  provideTranslationsForTest,
} from '@trefaro/shared-i18n';
import type {
  ParticipantAccount,
  PluginDescriptor,
} from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { NavDrawer } from './nav-drawer';

/**
 * The navigation of the participant client, as the mockups draw it (E66) — a
 * drawer that slides in over the page, with the person at the top and the way
 * out pinned at the bottom.
 *
 * What is worth a test here is not the sliding but the three rules the old
 * bottom bar carried and the drawer has to keep: an entry exists only where its
 * module is on (E42), the entries behind a login are not offered to somebody
 * without one, and signing out is a button because it changes something.
 * Everything else a unit test can say about a drawer is about focus: it opens
 * onto its own close button and hands the focus back when it closes, because
 * somebody who navigates by keyboard would otherwise land at the top of a page
 * they just left.
 */
const account: ParticipantAccount = {
  id: 'p-1',
  email: 'jerry.mattedi@example.org',
  firstName: 'Jerry',
  lastName: 'Mattedi',
  preferredLocale: 'en',
  avatarUrl: null,
  activityAreas: null,
  customFields: {},
  searchable: false,
  confirmedAt: '2026-09-01T10:00:00.000Z',
};

class FakeSession {
  readonly participant = signal<ParticipantAccount | null>(null);
  readonly isLoggedIn = signal(false);
  readonly accountsEnabled = signal(true);
  logOutCalls = 0;

  async logOut(): Promise<void> {
    this.logOutCalls++;
    this.participant.set(null);
    this.isLoggedIn.set(false);
  }
}

class FakeConfig {
  readonly enabled = new Set<string>(['profile-search', 'chat']);

  isModuleEnabled(key: string): boolean {
    return this.enabled.has(key);
  }

  // The drawer carries the navigation hook point, so it needs a configuration
  // that can be asked about plug-ins — none in these tests.
  readonly plugins = signal<readonly PluginDescriptor[]>([]);
  pluginsAt(): readonly PluginDescriptor[] {
    return [];
  }
}

/** Nothing to mount, so the slot draws nothing. */
class StubLoader {
  readonly ready = signal<readonly string[]>([]);
  loadResults(): readonly unknown[] {
    return this.ready();
  }
  isReady(): boolean {
    return false;
  }
}

/** The locale the initials are upper-cased in (F138). */
class FakeTranslations {
  readonly locale = signal('en');
  translate(key: string): string {
    return key;
  }
}

describe('NavDrawer', () => {
  let session: FakeSession;
  let config: FakeConfig;

  function render() {
    TestBed.resetTestingModule();
    session = new FakeSession();
    config = new FakeConfig();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'app.nav.label': 'Navigation',
          'app.nav.open': 'Menu',
          'app.nav.close': 'Close menu',
          'app.nav.series': 'Event series',
          'app.nav.signOut': 'Sign out',
          'mine.list.title': 'My registrations',
          'people.title': 'Find participants',
          'chat.title': 'Messages',
          'profile.title': 'Your profile',
          'profile.login.title': 'Sign in',
        }),
        { provide: ParticipantSessionService, useValue: session },
        { provide: AppConfigService, useValue: config },
        { provide: PluginLoaderService, useValue: new StubLoader() },
        { provide: TranslationService, useValue: new FakeTranslations() },
      ],
    });

    const fixture = TestBed.createComponent(NavDrawer);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      toggle: () => element.querySelector<HTMLButtonElement>('.toggle'),
      drawer: () => element.querySelector<HTMLElement>('.drawer'),
      entries: () =>
        [...element.querySelectorAll('.entry__label')].map((row) =>
          (row.textContent ?? '').trim(),
        ),
      text: () => element.textContent ?? '',
      open() {
        element.querySelector<HTMLButtonElement>('.toggle')?.click();
        fixture.detectChanges();
      },
    };
  }

  it('keeps the navigation away until somebody asks for it', () => {
    const view = render();

    expect(view.drawer()).toBeNull();
    expect(view.toggle()?.getAttribute('aria-expanded')).toBe('false');

    view.open();

    expect(view.drawer()).not.toBeNull();
    expect(view.toggle()?.getAttribute('aria-expanded')).toBe('true');
  });

  it('offers a visitor without an account nothing but the way in', () => {
    const view = render();
    view.open();

    expect(view.entries()).toEqual(['Event series']);
    expect(view.text()).toContain('Sign in');
    expect(view.text()).not.toContain('Sign out');
  });

  it('names the person at the top once there is a session', () => {
    const view = render();
    session.participant.set(account);
    session.isLoggedIn.set(true);
    view.open();

    // Both, and in this order: the mockup puts the picture, the name and the
    // address above the entries, because a drawer is also where somebody
    // checks which account this browser is signed in as.
    expect(view.text()).toContain('Jerry Mattedi');
    expect(view.text()).toContain('jerry.mattedi@example.org');
    // No picture on this account, so the initials stand in for it (F138).
    expect(
      view.fixture.nativeElement.querySelector('.me__avatar')?.textContent,
    ).toContain('JM');
  });

  it('carries the entries of a signed-in participant, module by module', () => {
    const view = render();
    session.participant.set(account);
    session.isLoggedIn.set(true);
    view.open();

    expect(view.entries()).toEqual([
      'Event series',
      'My registrations',
      'Find participants',
      'Messages',
      'Your profile',
    ]);
  });

  it('leaves out what an instance has switched off (E42)', () => {
    const view = render();
    session.participant.set(account);
    session.isLoggedIn.set(true);
    config.enabled.delete('chat');
    config.enabled.delete('profile-search');
    view.open();

    expect(view.entries()).toEqual([
      'Event series',
      'My registrations',
      'Your profile',
    ]);
  });

  it('draws no navigation at all on an instance without accounts (F53)', () => {
    const view = render();
    session.accountsEnabled.set(false);
    view.open();

    expect(view.entries()).toEqual(['Event series']);
    expect(view.text()).not.toContain('Sign in');
  });

  it('opens onto its own close button and gives the focus back', () => {
    const view = render();
    view.open();

    const element = view.fixture.nativeElement as HTMLElement;
    expect(document.activeElement).toBe(element.querySelector('.close'));

    element.querySelector<HTMLButtonElement>('.close')?.click();
    view.fixture.detectChanges();

    expect(view.drawer()).toBeNull();
    expect(document.activeElement).toBe(view.toggle());
  });

  it('ends the session through the service and closes behind itself', async () => {
    const view = render();
    session.participant.set(account);
    session.isLoggedIn.set(true);
    view.open();

    const element = view.fixture.nativeElement as HTMLElement;
    const signOut = [
      ...element.querySelectorAll<HTMLButtonElement>('.foot__action'),
    ][0];
    signOut.click();
    await view.fixture.whenStable();
    view.fixture.detectChanges();

    expect(session.logOutCalls).toBe(1);
    expect(view.drawer()).toBeNull();
  });
});
