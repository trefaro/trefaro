import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type { ProfileFieldPublic, PublicProfile } from '@trefaro/shared-models';
import { ParticipantProfileService } from '../../features/profiles/participant-profile.service';
import { ProfileSearchService } from '../../features/profiles/profile-search.service';
import { PersonPage } from './person-page';

const profile: PublicProfile = {
  id: 'a1',
  firstName: 'Amina',
  lastName: 'Okonkwo',
  avatarUrl: null,
  activityAreas: 'Citizens’ assemblies',
  customFields: { 'local-group': 'Cologne', mentoring: true, quiet: false },
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
    key: 'mentoring',
    label: 'Open to mentoring',
    type: 'checkbox',
    helpText: null,
    options: [],
    required: false,
  },
  {
    key: 'quiet',
    label: 'Prefers written contact',
    type: 'checkbox',
    helpText: null,
    options: [],
    required: false,
  },
  {
    key: 'unanswered',
    label: 'Languages interpreted',
    type: 'text',
    helpText: null,
    options: [],
    required: false,
  },
];

class FakeSearch {
  answer: PublicProfile = profile;
  fails: unknown = null;

  async get(id: string): Promise<PublicProfile> {
    if (this.fails) throw this.fails;
    return { ...this.answer, id };
  }
}

/**
 * Somebody else's profile (FR 4.4).
 *
 * Three decisions of this page are worth a test: an answer is labelled by the
 * question that is still being asked, a tick reads as a word in the reader's
 * language rather than as `true` (F72), and a withdrawn profile is a sentence
 * rather than a broken screen.
 */
describe('PersonPage', () => {
  let people: FakeSearch;

  async function render(options: { id?: string; fails?: unknown } = {}) {
    people = new FakeSearch();
    people.fails = options.fails ?? null;

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest({
          'people.detail.about': 'About this person',
          'people.detail.notFound': 'This profile is not available.',
          'people.detail.error': 'This profile could not be loaded.',
        }),
        { provide: ProfileSearchService, useValue: people },
        {
          provide: ParticipantProfileService,
          useValue: { fields: async () => questions },
        },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            // The non-reactive map a real `translate()` reads (F72).
            translate: (key: string) =>
              key === 'common.yes' ? 'Yes' : key === 'common.no' ? 'No' : key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(PersonPage);
    fixture.componentRef.setInput('id', options.id ?? 'a1');
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return {
      fixture,
      answers: () =>
        (
          fixture.componentInstance as unknown as {
            answers: () => readonly { label: string; value: string }[];
          }
        ).answers(),
      text: () => String(fixture.nativeElement.textContent),
    };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('shows the name and what somebody works on', async () => {
    const { text } = await render();

    expect(text()).toContain('Amina Okonkwo');
    expect(text()).toContain('Citizens’ assemblies');
  });

  it('labels every answered question and leaves the rest out', async () => {
    const { answers } = await render();

    // In the order the form asks, and without "Languages interpreted": a
    // reader is looking at a person, and an empty row says nothing about
    // anybody. A tick reads as a word, in the reader's language.
    expect(answers()).toEqual([
      { label: 'Local group', value: 'Cologne' },
      { label: 'Open to mentoring', value: 'Yes' },
      { label: 'Prefers written contact', value: 'No' },
    ]);
  });

  it('carries no address, because the answer has none', async () => {
    const { text } = await render();

    expect(text()).not.toContain('@');
  });

  it('says a withdrawn profile is not available rather than failing', async () => {
    const { text } = await render({
      fails: {
        status: 404,
        explained: true,
        message: 'No profile of that id is in the participant search.',
      },
    });

    expect(text()).toContain('This profile is not available.');
    // And not the server's sentence beside it: the key already says it, in the
    // reader's language.
    expect(text()).not.toContain('participant search');
  });

  it('reports anything else as a failure of the page', async () => {
    const { text } = await render({ fails: { status: 500, explained: false } });

    expect(text()).toContain('This profile could not be loaded.');
  });
});
