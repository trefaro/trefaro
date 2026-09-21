import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  PluginDescriptor,
  PluginMountPoint,
} from '@trefaro/shared-models';
import { PluginLoaderService } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { App } from './app';
import { AuthService } from './features/auth/auth.service';

/**
 * The shell of the organizer client, and the one thing about it that is
 * behaviour rather than layout: the menu can be closed (AP 8 of phase 5, E67).
 *
 * Which of the two shapes the menu has — a column beside the content or a
 * drawer over it — is a stylesheet's answer and is asserted at 768 pixels in
 * `apps/admin-client-e2e/src/layout.spec.ts`, because a unit test in jsdom has
 * no layout and would only be asserting that a class name is spelled the way
 * the test spells it. What is decided here is what the class name *means*:
 * that the button says which state it is in, that Escape brings focus back,
 * and that choosing a destination does not leave the menu lying over it.
 */
class StubAuth {
  readonly isLoggedIn = signal(true);
  readonly admin = signal<{ name: string } | null>({ name: 'Ada Organizer' });
  logouts = 0;

  async logout(): Promise<void> {
    this.logouts += 1;
  }
}

class StubAppConfig {
  readonly organizationName = signal('Democracy Initiative');
  readonly plugins = signal<readonly PluginDescriptor[]>([]);
  /** What the language switcher's service reads: which languages are offered. */
  readonly config = signal({
    availableLocales: ['en'],
    defaultLocale: 'en',
  });

  isModuleEnabled(): boolean {
    return false;
  }

  pluginsAt(mountPoint: PluginMountPoint): readonly PluginDescriptor[] {
    return this.plugins().filter((plugin) =>
      plugin.mountPoints.includes(mountPoint),
    );
  }
}

class StubPluginLoader {
  readonly ready = signal<readonly string[]>([]);
  readonly loadResults = computed(() => this.ready());

  isReady(key: string): boolean {
    return this.ready().includes(key);
  }
}

class StubTheme {
  readonly hasLogo = signal(false);
}

interface ShellInternals {
  menuOpen: () => boolean;
}

function render() {
  const auth = new StubAuth();
  TestBed.configureTestingModule({
    providers: [
      provideTranslationsForTest({
        'admin.nav.open': 'Menu',
        'admin.nav.close': 'Close menu',
        'admin.nav.label': 'Main navigation',
        'admin.nav.signOut': 'Sign out',
        'admin.series.title': 'Event series',
        'admin.messages.title': 'Messages',
        'admin.admins.title': 'Administrators',
        'admin.design.title': 'Design',
        'admin.modules.title': 'Modules',
        'admin.profileFields.title': 'Profile form',
        'admin.languages.title': 'Languages',
      }),
      // The entries navigate, and so does signing out: a router without these
      // routes rejects in the background rather than in the test.
      provideRouter([
        { path: '', children: [] },
        { path: 'messages', children: [] },
        { path: 'login', children: [] },
      ]),
      { provide: AuthService, useValue: auth },
      { provide: AppConfigService, useValue: new StubAppConfig() },
      { provide: PluginLoaderService, useValue: new StubPluginLoader() },
      { provide: ThemeService, useValue: new StubTheme() },
    ],
  });

  const fixture = TestBed.createComponent(App);
  fixture.detectChanges();
  const host = fixture.nativeElement as HTMLElement;

  return {
    auth,
    fixture,
    shell: fixture.componentInstance as unknown as ShellInternals,
    host,
    toggle: () =>
      host.querySelector('.bar__toggle') as HTMLButtonElement | null,
    layout: () => host.querySelector('.layout') as HTMLElement | null,
    settle: () => fixture.detectChanges(),
  };
}

describe('the organizer shell', () => {
  it('starts with the menu closed and says so on the button', () => {
    const { toggle, layout, shell } = render();

    expect(shell.menuOpen()).toBe(false);
    expect(layout()?.classList.contains('layout--menu-open')).toBe(false);
    expect(toggle()?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle()?.getAttribute('aria-controls')).toBe('admin-menu');
    expect(toggle()?.textContent?.trim()).toBe('Menu');
  });

  it('opens on the button, and the button becomes the way back', () => {
    const { toggle, layout, settle } = render();

    toggle()?.click();
    settle();

    expect(layout()?.classList.contains('layout--menu-open')).toBe(true);
    expect(toggle()?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle()?.textContent?.trim()).toBe('Close menu');

    toggle()?.click();
    settle();
    expect(layout()?.classList.contains('layout--menu-open')).toBe(false);
  });

  it('closes when a destination is reached', async () => {
    // The drawer lies over the page it just navigated to, so an entry that
    // left it open would hide the answer behind the question. The trigger is
    // the navigation and not the click: a plug-in contributes entries this
    // component never sees.
    const { host, toggle, layout, settle, fixture } = render();

    toggle()?.click();
    settle();

    const entries = host.querySelectorAll<HTMLAnchorElement>('.sidebar__nav a');
    entries[1].click();
    await fixture.whenStable();
    settle();

    expect(layout()?.classList.contains('layout--menu-open')).toBe(false);
  });

  it('closes on Escape and gives focus back to the button', () => {
    const { host, toggle, layout, settle } = render();

    toggle()?.click();
    settle();
    (host.querySelector('.sidebar__nav a') as HTMLAnchorElement).focus();

    (host.querySelector('.sidebar__nav a') as HTMLAnchorElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    settle();

    expect(layout()?.classList.contains('layout--menu-open')).toBe(false);
    expect(document.activeElement).toBe(toggle());
  });

  it('signs out through the service and closes the menu with it', async () => {
    const { host, auth, layout, toggle, settle } = render();

    toggle()?.click();
    settle();
    (host.querySelector('.sidebar__signout') as HTMLButtonElement).click();
    await Promise.resolve();
    settle();

    expect(auth.logouts).toBe(1);
    expect(layout()?.classList.contains('layout--menu-open')).toBe(false);
  });

  it('shows no shell at all before somebody is signed in', () => {
    const { auth, host, settle } = render();

    auth.isLoggedIn.set(false);
    settle();

    expect(host.querySelector('.layout')).toBeNull();
    expect(host.querySelector('.bar__toggle')).toBeNull();
  });
});
