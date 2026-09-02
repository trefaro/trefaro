import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { ProfileLoginPage } from './profile-login-page';

class FakeSession {
  failWith: { status: number } | null = null;
  readonly attempts: [string, string][] = [];

  async logIn(email: string, password: string): Promise<void> {
    this.attempts.push([email, password]);
    if (this.failWith) throw this.failWith;
  }
}

interface PageInternals {
  form: { setValue: (value: { email: string; password: string }) => void };
  submit: () => Promise<void>;
}

/**
 * The participant login form (FR 4.2).
 *
 * What is worth asserting is which sentence each refusal gets: 401 must say
 * nothing about which half was wrong (E32), and 403 must not look like the
 * same dead end.
 */
describe('ProfileLoginPage', () => {
  let session: FakeSession;

  async function render(returnTo?: string) {
    session = new FakeSession();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'profile.login.title': 'Sign in',
          'profile.login.errorCredentials':
            'That address and that password do not go together.',
          'profile.login.errorUnconfirmed':
            'This address has not been confirmed yet.',
          'profile.login.errorThrottled': 'Too many attempts.',
          'profile.login.failed': 'Signing in did not work.',
        }),
        { provide: ParticipantSessionService, useValue: session },
      ],
    });

    const fixture = TestBed.createComponent(ProfileLoginPage);
    if (returnTo !== undefined) {
      fixture.componentRef.setInput('returnTo', returnTo);
    }
    fixture.detectChanges();

    const page = fixture.componentInstance as unknown as PageInternals;
    page.form.setValue({
      email: 'amina@example.org',
      password: 'a long enough passphrase',
    });

    return {
      fixture,
      page,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('goes to the profile once the server accepts the credentials', async () => {
    const { page, fixture } = await render();
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    await page.submit();
    fixture.detectChanges();

    expect(session.attempts).toEqual([
      ['amina@example.org', 'a long enough passphrase'],
    ]);
    expect(navigate).toHaveBeenCalledWith('/profile');
  });

  it('goes on to where the guard was heading', async () => {
    const { page } = await render('/profile/registrations');
    const navigate = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);

    await page.submit();

    expect(navigate).toHaveBeenCalledWith('/profile/registrations');
  });

  it('says nothing about which half was wrong on a 401 (E32)', async () => {
    const { page, fixture, text } = await render();
    session.failWith = { status: 401 };

    await page.submit();
    fixture.detectChanges();

    expect(text()).toContain('do not go together');
  });

  it('offers a way forward for an unconfirmed address', async () => {
    const { page, fixture, text } = await render();
    session.failWith = { status: 403 };

    await page.submit();
    fixture.detectChanges();

    expect(text()).toContain('not been confirmed yet');
  });

  it('explains a throttled login in the reader’s language, not the server’s', async () => {
    const { page, fixture, text } = await render();
    session.failWith = { status: 429 };

    await page.submit();
    fixture.detectChanges();

    expect(text()).toContain('Too many attempts.');
  });
});
