import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  ParticipantAccount,
  ParticipantPasswordChange,
  ParticipantProfileUpdate,
  ProfileFieldPublic,
} from '@trefaro/shared-models';
import { ParticipantSessionService } from '../../features/auth/participant-session.service';
import { ParticipantProfileService } from '../../features/profiles/participant-profile.service';
import { ProfilePage } from './profile-page';

const account: ParticipantAccount = {
  id: 'profile-1',
  email: 'amina@example.org',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  preferredLocale: 'de',
  avatarUrl: null,
  activityAreas: 'Election observation',
  customFields: { 'local-group': 'Cologne', 'code-of-conduct': true },
  searchable: false,
  confirmedAt: '2026-09-01T10:00:00.000Z',
};

const questions: readonly ProfileFieldPublic[] = [
  {
    key: 'local-group',
    label: 'Local group',
    type: 'text',
    helpText: null,
    options: [],
    required: false,
  },
  {
    key: 'code-of-conduct',
    label: 'I have read the code of conduct',
    type: 'checkbox',
    helpText: null,
    options: [],
    required: true,
  },
];

/** The session, reduced to what this page reads and writes. */
class FakeSession {
  private readonly state = signal<ParticipantAccount | null>(account);
  readonly participant = this.state.asReadonly();

  adopt(next: ParticipantAccount): void {
    this.state.set(next);
  }
}

class FakeProfiles {
  definitions: readonly ProfileFieldPublic[] = questions;
  fieldsFail = false;
  readonly updates: ParticipantProfileUpdate[] = [];
  readonly passwords: ParticipantPasswordChange[] = [];
  passwordFails: unknown = null;

  async fields(): Promise<readonly ProfileFieldPublic[]> {
    if (this.fieldsFail) throw { status: 500, explained: false };
    return this.definitions;
  }

  async update(change: ParticipantProfileUpdate): Promise<ParticipantAccount> {
    this.updates.push(change);
    return {
      ...account,
      firstName: change.firstName ?? account.firstName,
      activityAreas: change.activityAreas ?? null,
    };
  }

  async changePassword(change: ParticipantPasswordChange): Promise<void> {
    this.passwords.push(change);
    if (this.passwordFails) throw this.passwordFails;
  }
}

/** The template drives protected members; the tests reach them the same way. */
interface PageInternals {
  form: {
    getRawValue: () => Record<string, unknown>;
    patchValue: (value: Record<string, unknown>) => void;
  };
  passwordForm: {
    setValue: (value: ParticipantPasswordChange) => void;
    getRawValue: () => ParticipantPasswordChange;
  };
  answers: { getRawValue: () => Record<string, unknown> };
  localeOptions: () => readonly string[];
  save: () => Promise<void>;
  changePassword: () => Promise<void>;
  avatarChanged: (url: string | null) => void;
  saved: () => boolean;
  passwordChanged: () => boolean;
}

/**
 * The profile form (FR 4.3).
 *
 * What is worth a test here is not the markup but the two rules the form has to
 * keep: the answers are sent as a whole or not at all, and the server's answer
 * is what the session then holds.
 */
describe('ProfilePage', () => {
  let session: FakeSession;
  let profiles: FakeProfiles;

  async function render(
    setUp: (profiles: FakeProfiles) => void = () => {
      /* the defaults */
    },
  ) {
    session = new FakeSession();
    profiles = new FakeProfiles();
    setUp(profiles);

    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'profile.title': 'Your profile',
          'profile.firstName': 'First name',
          'profile.saved': 'Saved',
        }),
        { provide: ParticipantSessionService, useValue: session },
        { provide: ParticipantProfileService, useValue: profiles },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            availableLocales: signal(['en', 'fr']),
            languageName: (locale: string) => locale.toUpperCase(),
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(ProfilePage);
    fixture.detectChanges();
    // The questions are read in an effect; one turn of the microtask queue is
    // what the fake service needs to answer.
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return {
      fixture,
      page: fixture.componentInstance as unknown as PageInternals,
      text: () => (fixture.nativeElement as HTMLElement).textContent ?? '',
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('fills the form and the answers from the profile', async () => {
    const { page } = await render();

    expect(page.form.getRawValue()).toMatchObject({
      firstName: 'Amina',
      lastName: 'Okonkwo',
      preferredLocale: 'de',
      activityAreas: 'Election observation',
    });
    expect(page.answers.getRawValue()).toEqual({
      'local-group': 'Cologne',
      'code-of-conduct': true,
    });
  });

  it('keeps a language the instance no longer offers', async () => {
    const { page } = await render();

    // `de` is this profile's language and not in `availableLocales`; a select
    // that dropped it would change the person's mail language the next time
    // they corrected their name.
    expect(page.localeOptions()).toEqual(['en', 'fr', 'de']);
  });

  it('sends the answers as a whole and adopts what came back', async () => {
    const { page } = await render();

    page.form.patchValue({ firstName: 'Amina Chidi' });
    await page.save();

    expect(profiles.updates).toEqual([
      {
        firstName: 'Amina Chidi',
        lastName: 'Okonkwo',
        preferredLocale: 'de',
        activityAreas: 'Election observation',
        customFields: {
          'local-group': 'Cologne',
          'code-of-conduct': true,
        },
      },
    ]);
    expect(session.participant()?.firstName).toBe('Amina Chidi');
    expect(page.saved()).toBe(true);
  });

  it('reads an emptied field of activity as "no longer stated"', async () => {
    const { page } = await render();

    page.form.patchValue({ activityAreas: '   ' });
    await page.save();

    expect(profiles.updates[0].activityAreas).toBeNull();
  });

  it('leaves the answers out entirely when the questions could not be read', async () => {
    const { page } = await render((fake) => {
      fake.fieldsFail = true;
    });

    await page.save();

    // The decisive line of this page: `customFields` is the *complete* set of
    // answers when it is there, so sending `{}` because the definitions never
    // arrived would erase every answer this person has given.
    expect(profiles.updates).toHaveLength(1);
    expect('customFields' in profiles.updates[0]).toBe(false);
  });

  it('takes a new picture into the session without saving the form', async () => {
    const { page } = await render();

    page.avatarChanged('/api/media/profiles/profile-1/avatar?v=7');

    expect(session.participant()?.avatarUrl).toBe(
      '/api/media/profiles/profile-1/avatar?v=7',
    );
    expect(profiles.updates).toEqual([]);
  });

  it('empties the password boxes once the password is changed', async () => {
    const { page } = await render();
    page.passwordForm.setValue({
      currentPassword: 'the old passphrase',
      newPassword: 'a brand new passphrase',
    });

    await page.changePassword();

    expect(profiles.passwords).toEqual([
      {
        currentPassword: 'the old passphrase',
        newPassword: 'a brand new passphrase',
      },
    ]);
    // Two boxes still holding a passphrase are two boxes on a shared screen.
    expect(page.passwordForm.getRawValue()).toEqual({
      currentPassword: '',
      newPassword: '',
    });
    expect(page.passwordChanged()).toBe(true);
  });

  it('keeps what was typed when the password change is refused', async () => {
    const { page } = await render((fake) => {
      fake.passwordFails = { status: 401, explained: false };
    });
    page.passwordForm.setValue({
      currentPassword: 'the wrong one',
      newPassword: 'a brand new passphrase',
    });

    await page.changePassword();

    expect(page.passwordChanged()).toBe(false);
    expect(page.passwordForm.getRawValue().newPassword).toBe(
      'a brand new passphrase',
    );
  });
});
