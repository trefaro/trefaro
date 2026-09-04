import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import {
  provideTranslationsForTest,
  TranslationService,
} from '@trefaro/shared-i18n';
import type {
  NewsletterAudiencePage,
  NewsletterConsent,
} from '@trefaro/shared-models';
import { NewsletterAudienceService } from '../../features/newsletter/newsletter.service';
import { NewsletterPage } from './newsletter-page';

const CATALOGUE = {
  'admin.newsletter.title': 'Newsletter',
  'admin.newsletter.noSending': 'Trefaro does not send newsletters.',
  'admin.newsletter.moduleOff': 'The newsletter sign-up is switched off.',
  'admin.newsletter.addresses': 'Addresses',
  'admin.newsletter.consents': 'Agreements',
  'admin.newsletter.fromForm': 'From the form',
  'admin.newsletter.fromApp': 'From the app',
  'admin.newsletter.sourceForm': 'Registration form',
  'admin.newsletter.sourceApp': 'Sign-up in the app',
  'admin.newsletter.instanceWide': 'Everything',
  'admin.newsletter.inRegistration': 'In the registration',
  'admin.newsletter.empty': 'Nobody has confirmed yet.',
  'admin.common.delete': 'Delete',
};

const consent = (over: Partial<NewsletterConsent> = {}): NewsletterConsent => ({
  email: 'amina@example.org',
  source: 'app',
  confirmedAt: '2026-09-03T10:00:00.000Z',
  seriesId: null,
  seriesName: null,
  subscriptionId: 'subscription-1',
  ...over,
});

class FakeAudience {
  readonly removed: string[] = [];
  readonly pagesAsked: number[] = [];
  answer: NewsletterAudiencePage = {
    rows: [],
    total: 0,
    page: 1,
    pageSize: 50,
    counts: { total: 0, fromForm: 0, fromApp: 0, addresses: 0 },
  };

  async page(_locale: string, page: number): Promise<NewsletterAudiencePage> {
    this.pagesAsked.push(page);
    return { ...this.answer, page };
  }

  async remove(id: string): Promise<void> {
    this.removed.push(id);
  }
}

/**
 * The overview (FR 4.8, E45) — what this page decides for itself.
 *
 * Which source a row is from, what may be taken back, and whether it asks for
 * a list at all. The contents of the list are the port's promise and are
 * asserted against a real database in `apps/server-e2e/src/api/newsletter.spec.ts`.
 */
describe('NewsletterPage', () => {
  let audience: FakeAudience;

  async function render(options: { enabled?: boolean } = {}) {
    audience = new FakeAudience();
    audience.answer = {
      rows: [
        consent({ seriesName: 'Bürgerräte', seriesId: 'series-1' }),
        consent({
          email: 'ben@example.org',
          source: 'form',
          subscriptionId: null,
          seriesId: 'series-1',
          seriesName: 'Bürgerräte',
        }),
      ],
      total: 2,
      page: 1,
      pageSize: 50,
      counts: { total: 2, fromForm: 1, fromApp: 1, addresses: 2 },
    };

    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest(CATALOGUE),
        { provide: NewsletterAudienceService, useValue: audience },
        {
          provide: AppConfigService,
          useValue: { isModuleEnabled: () => options.enabled ?? true },
        },
        {
          provide: TranslationService,
          useValue: {
            locale: signal('en'),
            translate: (key: string) => key,
          },
        },
      ],
    });

    const fixture = TestBed.createComponent(NewsletterPage);
    fixture.detectChanges();
    await Promise.resolve();
    await Promise.resolve();
    fixture.detectChanges();

    return { fixture, text: () => String(fixture.nativeElement.textContent) };
  }

  it('asks for nothing while the module is off, and says why', async () => {
    const { text } = await render({ enabled: false });

    expect(audience.pagesAsked).toEqual([]);
    expect(text()).toContain('switched off');
  });

  it('says that nothing is sent from here (F8)', async () => {
    const { text } = await render();

    // Without this sentence, a list of addresses with no send button reads like
    // a feature that is missing.
    expect(text()).toContain('does not send newsletters');
  });

  it('names both sources and counts them apart (E45)', async () => {
    const { text } = await render();

    expect(text()).toContain('Sign-up in the app');
    expect(text()).toContain('Registration form');
    expect(text()).toContain('Bürgerräte');
    expect(text()).toContain('Addresses');
  });

  it('offers a delete only where there is a row to delete', async () => {
    const { fixture } = await render();

    const buttons = [...fixture.nativeElement.querySelectorAll('tbody button')];
    // One row of two: a checkbox in a registration form is administered in
    // that registration, and this screen says so instead of pretending.
    expect(buttons).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('In the registration');
  });

  it('removes the sign-up the row names, after asking', async () => {
    const { fixture } = await render();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    fixture.nativeElement.querySelector('tbody button').click();
    await Promise.resolve();

    expect(audience.removed).toEqual(['subscription-1']);
  });

  it('removes nothing when the question is declined', async () => {
    const { fixture } = await render();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    fixture.nativeElement.querySelector('tbody button').click();
    await Promise.resolve();

    expect(audience.removed).toEqual([]);
  });
});
