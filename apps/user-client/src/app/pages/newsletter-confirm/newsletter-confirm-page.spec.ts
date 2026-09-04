import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type { NewsletterConfirmation } from '@trefaro/shared-models';
import { NewsletterService } from '../../features/newsletter/newsletter.service';
import { NewsletterConfirmPage } from './newsletter-confirm-page';

const CATALOGUE = {
  'newsletter.confirm.title': 'Confirm your address',
  'newsletter.confirm.lead': 'One click and this address is on our list.',
  'newsletter.confirm.submit': 'Confirm now',
  'newsletter.confirm.done': 'Thank you — your address is confirmed.',
  'newsletter.confirm.alreadyDone': 'This address was already confirmed.',
  'newsletter.confirm.noToken': 'This address is missing its token.',
  'newsletter.confirm.error': 'This link is not valid any more.',
  'newsletter.confirm.home': 'To the start page',
};

class FakeNewsletter {
  readonly confirmed: string[] = [];
  answer: NewsletterConfirmation = { state: 'confirmed' };
  fail = false;

  async confirm(token: string): Promise<NewsletterConfirmation> {
    this.confirmed.push(token);
    if (this.fail) throw new Error('gone');
    return this.answer;
  }
}

/**
 * The page the confirmation link opens (E5b).
 *
 * The one property worth a test of its own: **rendering confirms nothing.** A
 * mail scanner that fetches every URL in a message would otherwise give a
 * consent on somebody's behalf, which is the one thing a double opt-in exists
 * to rule out.
 */
describe('NewsletterConfirmPage', () => {
  let newsletter: FakeNewsletter;

  function render(token?: string) {
    newsletter = new FakeNewsletter();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslationsForTest(CATALOGUE),
        { provide: NewsletterService, useValue: newsletter },
      ],
    });

    const fixture = TestBed.createComponent(NewsletterConfirmPage);
    if (token !== undefined) {
      fixture.componentRef.setInput('token', token);
    }
    fixture.detectChanges();

    return {
      fixture,
      click: async () => {
        fixture.nativeElement.querySelector('button').click();
        await Promise.resolve();
        fixture.detectChanges();
      },
      text: () => String(fixture.nativeElement.textContent),
    };
  }

  it('confirms nothing until the button is pressed (E5b)', () => {
    const { text } = render('signed.token');

    expect(newsletter.confirmed).toEqual([]);
    expect(text()).toContain('One click and this address is on our list.');
  });

  it('confirms with the token from the link', async () => {
    const { click, text } = render('signed.token');

    await click();

    expect(newsletter.confirmed).toEqual(['signed.token']);
    expect(text()).toContain('your address is confirmed');
  });

  it('reports what is already true on a second click', async () => {
    const { click, text } = render('signed.token');
    newsletter.answer = { state: 'already-confirmed' };

    await click();

    expect(text()).toContain('was already confirmed');
  });

  it('says a broken link is broken, and offers no button to press again', () => {
    const { fixture, text } = render();

    // A mail client that wrapped the link across two lines is the usual cause,
    // and "invalid link" would send the reader looking for the wrong problem.
    expect(text()).toContain('missing its token');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('says what happened when the token is not honoured', async () => {
    const { click, text } = render('signed.token');
    newsletter.fail = true;

    await click();

    expect(text()).toContain('not valid any more');
  });
});
