import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Problem } from '@trefaro/shared-http';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type { AdminAccount, AdminPasswordChange } from '@trefaro/shared-models';
import { AuthService } from '../../features/auth/auth.service';
import { AccountPage } from './account-page';

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  form: {
    setValue: (value: AdminPasswordChange) => void;
    getRawValue: () => AdminPasswordChange;
  };
  submit: () => Promise<void>;
  busy: () => boolean;
  changed: () => boolean;
  error: () => Problem | null;
}

const ACCOUNT: AdminAccount = {
  id: 'admin-1',
  email: 'organizer@example.org',
  name: 'Alex Weber',
  createdAt: '2026-08-26T09:00:00.000Z',
  lastLoginAt: '2026-09-21T08:00:00.000Z',
};

class FakeAuthService {
  readonly admin = signal<AdminAccount | null>(ACCOUNT).asReadonly();
  readonly changes: AdminPasswordChange[] = [];
  failWith: unknown = null;

  changePassword(change: AdminPasswordChange): Promise<void> {
    this.changes.push(change);
    if (this.failWith) return Promise.reject(this.failWith);
    return Promise.resolve();
  }
}

describe('AccountPage', () => {
  let auth: FakeAuthService;

  function render() {
    auth = new FakeAuthService();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'admin.account.title': 'My account',
          'admin.account.signedInAs': 'Signed in as {{name}}, {{email}}.',
          'admin.account.done':
            'Password changed. Other browsers have been signed out.',
          'admin.account.noReset':
            'There is no reset link for an organizer account.',
        }),
        { provide: AuthService, useValue: auth },
      ],
    });
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    return {
      fixture,
      page: fixture.componentInstance as unknown as PageInternals,
      text: () => fixture.nativeElement.textContent as string,
    };
  }

  it('names who is signed in, so the form cannot be about somebody else', () => {
    const { text } = render();

    expect(text()).toContain('Signed in as Alex Weber, organizer@example.org.');
  });

  it('sends both passwords and empties the form afterwards', async () => {
    const { fixture, page } = render();
    page.form.setValue({
      currentPassword: 'the-old-one-is-long',
      newPassword: 'a-longer-new-secret',
    });

    await page.submit();
    fixture.detectChanges();

    expect(auth.changes).toEqual([
      {
        currentPassword: 'the-old-one-is-long',
        newPassword: 'a-longer-new-secret',
      },
    ]);
    // Two boxes still holding a passphrase are two boxes on a screen somebody
    // walks away from.
    expect(page.form.getRawValue()).toEqual({
      currentPassword: '',
      newPassword: '',
    });
    expect(page.changed()).toBe(true);
  });

  it('sends nothing when the new password is shorter than the policy', async () => {
    const { page } = render();
    page.form.setValue({
      currentPassword: 'the-old-one-is-long',
      newPassword: 'short',
    });

    await page.submit();

    expect(auth.changes).toEqual([]);
    expect(page.changed()).toBe(false);
  });

  it('keeps what was typed when the server refuses, and says so', async () => {
    const { fixture, page } = render();
    auth.failWith = { status: 401, problem: null };
    page.form.setValue({
      currentPassword: 'not-it',
      newPassword: 'a-longer-new-secret',
    });

    await page.submit();
    fixture.detectChanges();

    expect(page.error()?.key).toBe('admin.account.failed');
    expect(page.changed()).toBe(false);
    // The form is not reset on failure: retyping a long passphrase because the
    // *other* box was wrong is the wrong punishment.
    expect(page.form.getRawValue().newPassword).toBe('a-longer-new-secret');
    expect(page.busy()).toBe(false);
  });

  it('says that an organizer account has no reset link', () => {
    const { text } = render();

    // The absence is a decision (`account-page.ts`), so the page states it
    // rather than leaving it to be discovered by somebody locked out.
    expect(text()).toContain('There is no reset link for an organizer account');
  });
});
