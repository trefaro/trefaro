import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import type {
  SetupResult,
  SetupState,
  SetupSubmission,
} from '@trefaro/shared-models';
import { signal } from '@angular/core';
import { ThemeService } from '@trefaro/shared-theming';
import { SetupService } from '../../features/setup/setup.service';
import { SetupPage } from './setup-page';

const STATE: SetupState = {
  organizationName: 'Trefaro',
  primaryColor: '#1f6f5c',
  accentColor: '#e8a33d',
  defaultLocale: 'de',
  locales: ['en', 'de'],
  warnings: [
    'SMTP_HOST is localhost: registrations need a double opt-in mail, so nobody can complete one.',
  ],
};

class FakeSetupService {
  readonly unlocked = signal<SetupState | null>(null);
  readonly tokens: string[] = [];
  readonly submissions: SetupSubmission[] = [];
  unlockError: unknown = null;
  completeError: unknown = null;

  readonly state = this.unlocked.asReadonly();

  async unlock(token: string): Promise<SetupState> {
    this.tokens.push(token);
    if (this.unlockError) throw this.unlockError;
    this.unlocked.set(STATE);
    return STATE;
  }

  async complete(submission: SetupSubmission): Promise<SetupResult> {
    this.submissions.push(submission);
    if (this.completeError) throw this.completeError;
    this.unlocked.set(null);
    return {
      adminEmail: submission.admin.email,
      organizationName: submission.organizationName,
    };
  }
}

/**
 * First-run setup in the client (FR 1.1) — AP 5.
 *
 * What is asserted is what the wizard is for: that the token is a gate rather
 * than a field on one long form, that the form arrives prefilled with what the
 * instance already stands for, that the deployment findings are shown rather
 * than filed away, and that the last screen sends the operator to the login —
 * which is where a deployment without TLS shows itself (E2).
 */
describe('SetupPage', () => {
  function render() {
    const setup = new FakeSetupService();
    let reloads = 0;
    const applied: string[] = [];

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: SetupService, useValue: setup },
        {
          provide: AppConfigService,
          useValue: {
            reload: async () => {
              reloads += 1;
              return { theme: { primaryColor: '#7b2d8e' } };
            },
          },
        },
        {
          provide: ThemeService,
          useValue: {
            apply: (theme: { primaryColor: string }) =>
              applied.push(theme.primaryColor),
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;

    return {
      fixture,
      setup,
      reloads: () => reloads,
      applied: () => applied,
      text: () => host.textContent ?? '',
      input: (id: string) =>
        host.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement,
      submitButton: () => host.querySelector('button') as HTMLButtonElement,
      settle: async () => {
        await fixture.whenStable();
        fixture.detectChanges();
      },
      type: (id: string, value: string) => {
        const field = host.querySelector(`#${id}`) as HTMLInputElement;
        field.value = value;
        field.dispatchEvent(new Event('input'));
      },
      submit: () => {
        (host.querySelector('form') as HTMLFormElement).dispatchEvent(
          new Event('submit'),
        );
      },
    };
  }

  it('asks for the token first, and says where to find it', async () => {
    const page = render();

    expect(page.text()).toContain('no administrator yet');
    expect(page.text()).toContain('docker compose logs server');
    // Nothing about the organization until the token is accepted: the state is
    // behind it (E28).
    expect(page.input('organization-name')).toBeNull();
  });

  it('exchanges the token and fills the form with what the instance stands for', async () => {
    const page = render();

    page.type('token', '  the-token  ');
    page.submit();
    await page.settle();

    // Trimmed: a token copied out of a terminal brings whitespace with it.
    expect(page.setup.tokens).toEqual(['the-token']);
    expect((page.input('organization-name') as HTMLInputElement).value).toBe(
      'Trefaro',
    );
    expect((page.input('default-locale') as HTMLSelectElement).value).toBe(
      'de',
    );
  });

  it('shows the deployment findings where the operator is still sitting', async () => {
    const page = render();

    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    expect(page.text()).toContain('Worth knowing about this deployment');
    expect(page.text()).toContain('SMTP_HOST');
    // They do not block anything, and the page says so.
    expect(page.text()).toContain('None of these stops the setup');
  });

  it('names the languages in their own language, without a catalogue', async () => {
    const page = render();

    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    // `Intl.DisplayNames` is platform, so this works before AP 6 brings the
    // translations. A raw `de` in a language picker is not a choice anybody can
    // make confidently.
    expect(page.text()).toContain('Deutsch');
    expect(page.text()).toContain('English');
  });

  it('submits the account and the identity together, then re-reads the configuration', async () => {
    const page = render();
    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    page.type('email', 'organizer@example.org');
    page.type('name', 'Alex Weber');
    page.type('password', 'a-long-enough-passphrase');
    page.type('organization-name', 'Democracy International e.V.');
    page.submit();
    await page.settle();

    expect(page.setup.submissions).toEqual([
      {
        admin: {
          email: 'organizer@example.org',
          name: 'Alex Weber',
          password: 'a-long-enough-passphrase',
        },
        organizationName: 'Democracy International e.V.',
        defaultLocale: 'de',
        primaryColor: '#1f6f5c',
        accentColor: '#e8a33d',
      },
    ]);
    // The header of this very page now carries the organization's name.
    expect(page.reloads()).toBe(1);
    // …and its colour. The theme is applied once, in the startup initializer, so
    // a reload alone would leave the document in Trefaro's default green — and
    // the login form this hands over to is a route change, not a fresh load.
    expect(page.applied()).toEqual(['#7b2d8e']);
    expect(page.text()).toContain('is set up');
    expect(page.text()).toContain('organizer@example.org');
  });

  it('sends nothing while the account is incomplete', async () => {
    const page = render();
    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    page.type('email', 'not-an-address');
    page.submit();
    await page.settle();

    expect(page.setup.submissions).toEqual([]);
  });

  it('explains a wrong token instead of showing the message the server sent', async () => {
    const page = render();
    page.setup.unlockError = { status: 401, message: 'Unauthorized' };

    page.type('token', 'wrong');
    page.submit();
    await page.settle();

    expect(page.text()).toContain('changes on every restart');
    expect(page.input('organization-name')).toBeNull();
  });

  it('says so when somebody else claimed the instance in the meantime', async () => {
    const page = render();
    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    page.setup.completeError = { status: 404, message: 'Not Found' };
    page.type('email', 'organizer@example.org');
    page.type('name', 'Alex Weber');
    page.type('password', 'a-long-enough-passphrase');
    page.type('organization-name', 'Democracy International e.V.');
    page.submit();
    await page.settle();

    expect(page.text()).toContain('already has an administrator');
    // The form stays, so nothing typed is lost while the operator reads it.
    expect(page.input('organization-name')).not.toBeNull();
  });

  it('mentions the Secure cookie on the last screen, not before', async () => {
    const page = render();
    page.type('token', 'the-token');
    page.submit();
    await page.settle();

    expect(page.text()).not.toContain('Secure');

    page.type('email', 'organizer@example.org');
    page.type('name', 'Alex Weber');
    page.type('password', 'a-long-enough-passphrase');
    page.type('organization-name', 'Democracy International e.V.');
    page.submit();
    await page.settle();

    // The one place an operator will be looking when the login does not stick.
    expect(page.text()).toContain('Secure');
  });
});
