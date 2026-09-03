import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type {
  ContactRequestAcknowledgement,
  ContactRequestInput,
} from '@trefaro/shared-models';
import { ContactService } from '../../features/contact/contact.service';
import { EventContactForm } from './event-contact-form';

/**
 * The contact form of an event landing page (FR 3.4, UC 14, F11) — AP 9.
 *
 * What is worth asserting here is not the request — that is one line — but the
 * three states around it: a form that refuses to send half a question, a form
 * that is closed while it is in flight, and an answer that says where the
 * answer will arrive. The last one is the whole promise of F11, and a client
 * that sent the request and said nothing would have kept none of it.
 */
class RecordingContactService {
  readonly sent: {
    seriesSlug: string;
    eventSlug: string;
    input: ContactRequestInput;
  }[] = [];
  failing = false;
  /** Resolved by the test, so "in flight" is a state that can be looked at. */
  release: (() => void) | null = null;

  async send(
    seriesSlug: string,
    eventSlug: string,
    input: ContactRequestInput,
  ): Promise<ContactRequestAcknowledgement> {
    this.sent.push({ seriesSlug, eventSlug, input });
    if (this.release) {
      await new Promise<void>((resolve) => {
        this.release = resolve;
      });
    }
    if (this.failing) throw new Error('offline');
    return { email: input.email };
  }
}

function fill(
  fixture: ReturnType<typeof TestBed.createComponent<EventContactForm>>,
  values: Partial<Record<'name' | 'email' | 'body', string>>,
): void {
  const form = (
    fixture.componentInstance as unknown as {
      form: { patchValue(v: unknown): void };
    }
  ).form;
  form.patchValue(values);
  fixture.detectChanges();
}

function submit(
  fixture: ReturnType<typeof TestBed.createComponent<EventContactForm>>,
): Promise<void> {
  const element: HTMLElement = fixture.nativeElement;
  element.querySelector('form')?.dispatchEvent(new Event('submit'));
  fixture.detectChanges();
  return Promise.resolve();
}

describe('EventContactForm', () => {
  let contacts: RecordingContactService;

  const setUp = () => {
    const fixture = TestBed.createComponent(EventContactForm);
    fixture.componentRef.setInput('seriesSlug', 'buergerraete');
    fixture.componentRef.setInput('eventSlug', 'kickoff');
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    contacts = new RecordingContactService();
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'contact.title': 'Contact the organizers',
          'contact.lead': 'A question about this event?',
          'contact.name': 'Your name',
          'contact.email': 'Your e-mail address',
          'contact.message': 'Your message',
          'contact.submit': 'Send message',
          'contact.sending': 'Sending…',
          'contact.hint': 'We use your address to answer.',
          'contact.done.sentTo': 'The answer will come to {{address}}.',
          'contact.done.again': 'Write once more.',
          'contact.error': 'Your message could not be sent.',
        }),
        { provide: ContactService, useValue: contacts },
      ],
    });
  });

  it('offers a named region with the three fields', () => {
    const fixture = setUp();
    const element: HTMLElement = fixture.nativeElement;

    // A section without an accessible name is not a region — the heading has
    // an id and the section points at it.
    const section = element.querySelector('section');
    expect(section?.getAttribute('aria-labelledby')).toBe('contact-heading');
    expect(element.querySelector('#contact-heading')?.textContent).toContain(
      'Contact the organizers',
    );
    expect(element.querySelectorAll('input, textarea')).toHaveLength(3);
  });

  it('bounds the fields the way the server does', () => {
    const fixture = setUp();
    const element: HTMLElement = fixture.nativeElement;

    // Read from `shared-models`, so a form cannot be typed past what the
    // column takes: whoever types for five minutes must not lose it to a 400.
    const name = element.querySelector<HTMLInputElement>('input[maxlength]');
    const body = element.querySelector<HTMLTextAreaElement>('textarea');
    expect(name?.maxLength).toBe(200);
    expect(body?.maxLength).toBe(4000);
  });

  it('sends nothing until the question is complete', async () => {
    const fixture = setUp();

    fill(fixture, { name: 'Amina Okonkwo' });
    await submit(fixture);

    expect(contacts.sent).toEqual([]);
  });

  it('sends the question and says where the answer will arrive (F11)', async () => {
    const fixture = setUp();
    fill(fixture, {
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });

    await submit(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(contacts.sent).toEqual([
      {
        seriesSlug: 'buergerraete',
        eventSlug: 'kickoff',
        input: {
          name: 'Amina Okonkwo',
          email: 'amina@example.org',
          body: 'Is the venue accessible?',
        },
      },
    ]);

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain(
      'The answer will come to amina@example.org.',
    );
    // The form is gone, so nobody sends the same question twice by accident.
    expect(element.querySelector('form')).toBeNull();
  });

  it('closes the form while the question is in flight', async () => {
    const fixture = setUp();
    // Any function will do: the fake replaces it with the resolver.
    contacts.release = () => undefined;
    fill(fixture, {
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });

    await submit(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    // Whoever keeps typing would lose it to the reset, so the fieldset is
    // disabled rather than only the button.
    expect(element.querySelector('fieldset')?.disabled).toBe(true);
    expect(element.querySelector('button')?.textContent).toContain('Sending…');

    // Let the request settle: `whenStable` waits for change detection, not for
    // a promise chain somebody else is holding open.
    contacts.release?.();
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    expect(element.textContent).toContain('amina@example.org');
  });

  it('keeps what was typed when it could not be sent', async () => {
    const fixture = setUp();
    contacts.failing = true;
    fill(fixture, {
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });

    await submit(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'could not be sent',
    );
    // Still there to send again: a failed request must not cost somebody the
    // paragraph they wrote.
    expect(
      element.querySelector<HTMLTextAreaElement>('textarea')?.value,
    ).toContain('Is the venue accessible?');
    expect(element.querySelector('fieldset')?.disabled).toBe(false);
  });

  it('offers an empty form for the next question', async () => {
    const fixture = setUp();
    fill(fixture, {
      name: 'Amina Okonkwo',
      email: 'amina@example.org',
      body: 'Is the venue accessible?',
    });
    await submit(fixture);
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    element.querySelector('button')?.click();
    fixture.detectChanges();

    expect(element.querySelector('form')).not.toBeNull();
    expect(element.querySelector<HTMLTextAreaElement>('textarea')?.value).toBe(
      '',
    );
  });
});
