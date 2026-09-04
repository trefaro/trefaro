import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { NewsletterSignup } from './newsletter-signup';
import { NewsletterService } from './newsletter.service';

const CATALOGUE = {
  'newsletter.title': 'Newsletter',
  'newsletter.lead': 'Would you like to hear from us by e-mail?',
  'newsletter.leadSeries': 'Would you like to hear about {{series}}?',
  'newsletter.email': 'E-mail address',
  'newsletter.submit': 'Sign up',
  'newsletter.done': 'Almost done: please open the link in the e-mail.',
  'newsletter.invalidEmail': 'Please enter an e-mail address.',
  'newsletter.failed': 'That did not work.',
};

/** The service's decisions, stated — its own calls are what matter here. */
class FakeNewsletter {
  readonly signups: { email: string; seriesSlug?: string }[] = [];
  enabled = true;
  fail = false;

  offered(): boolean {
    return this.enabled;
  }

  async signUp(email: string, seriesSlug?: string): Promise<{ email: string }> {
    if (this.fail) throw new Error('nope');
    this.signups.push({ email, seriesSlug });
    return { email };
  }
}

/**
 * The sign-up form (FR 4.8, E45) — the decisions this component makes alone.
 *
 * Which are: whether it appears at all, what it sends, and what it says
 * afterwards. The last one is the interesting assertion: the server answers
 * identically whatever the state of an address is (E32), so this screen has
 * exactly one sentence for every outcome, and a test that pinned two would be
 * pinning an answer the client was deliberately not given.
 */
describe('NewsletterSignup', () => {
  let newsletter: FakeNewsletter;

  function render(
    inputs: {
      seriesSlug?: string;
      seriesName?: string;
      /** Set before the first render: an `OnPush` view is not re-checked for a
       * value that is not a signal, and this one is a fact about the instance
       * rather than something that changes while somebody is looking. */
      enabled?: boolean;
    } = {},
  ) {
    newsletter = new FakeNewsletter();
    newsletter.enabled = inputs.enabled ?? true;
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest(CATALOGUE),
        { provide: NewsletterService, useValue: newsletter },
      ],
    });

    const fixture = TestBed.createComponent(NewsletterSignup);
    if (inputs.seriesSlug !== undefined) {
      fixture.componentRef.setInput('seriesSlug', inputs.seriesSlug);
    }
    if (inputs.seriesName !== undefined) {
      fixture.componentRef.setInput('seriesName', inputs.seriesName);
    }
    fixture.detectChanges();

    const type = (email: string) => {
      const input: HTMLInputElement =
        fixture.nativeElement.querySelector('input');
      input.value = email;
      input.dispatchEvent(new Event('input'));
    };
    const submit = async () => {
      fixture.nativeElement
        .querySelector('form')
        .dispatchEvent(new Event('submit'));
      await Promise.resolve();
      fixture.detectChanges();
    };

    return {
      fixture,
      type,
      submit,
      text: () => String(fixture.nativeElement.textContent),
    };
  }

  it('draws nothing while the module is off (F142)', () => {
    const { fixture, text } = render({ enabled: false });

    // A form that promises news nobody sends is worse than no form.
    expect(text()).not.toContain('Newsletter');
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
  });

  it('signs up for the whole instance where there is no series', async () => {
    const { type, submit, text } = render();

    type('amina@example.org');
    await submit();

    expect(newsletter.signups).toEqual([
      { email: 'amina@example.org', seriesSlug: undefined },
    ]);
    expect(text()).toContain('please open the link in the e-mail');
  });

  it('signs up for the series it is placed on, and names it', async () => {
    const { type, submit, text } = render({
      seriesSlug: 'buergerraete',
      seriesName: 'Bürgerräte',
    });

    expect(text()).toContain('Would you like to hear about Bürgerräte?');

    type('amina@example.org');
    await submit();

    expect(newsletter.signups).toEqual([
      { email: 'amina@example.org', seriesSlug: 'buergerraete' },
    ]);
  });

  it('says the same sentence whatever the address already was (E45, E32)', async () => {
    const { type, submit, text } = render();

    type('  Amina@Example.ORG  ');
    await submit();

    // Trimmed here, lower-cased by the server: what is asserted is that the
    // screen has one answer, because the server gives one.
    expect(newsletter.signups).toEqual([
      { email: 'Amina@Example.ORG', seriesSlug: undefined },
    ]);
    expect(text()).toContain('Almost done');
  });

  it('sends nothing for something that is not an address', async () => {
    const { type, submit, text } = render();

    type('not-an-address');
    await submit();

    // A form error, said by the form: the server's answer must not vary with
    // the address, so it cannot be the one to complain.
    expect(newsletter.signups).toEqual([]);
    expect(text()).toContain('Please enter an e-mail address.');
  });

  it('keeps the form when the request fails', async () => {
    const { fixture, type, submit, text } = render();
    newsletter.fail = true;

    type('amina@example.org');
    await submit();

    expect(text()).toContain('That did not work.');
    // Still there to try again — the address is not lost with the error.
    expect(fixture.nativeElement.querySelector('form')).not.toBeNull();
  });
});
