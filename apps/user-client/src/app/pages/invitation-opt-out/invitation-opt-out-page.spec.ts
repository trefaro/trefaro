import { TestBed } from '@angular/core/testing';
import type { ApiError } from '@trefaro/shared-http';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import type { ContactOptOutResult } from '@trefaro/shared-models';
import { InvitationOptOutService } from '../../features/invitations/invitation-opt-out.service';
import { InvitationOptOutPage } from './invitation-opt-out-page';

class FakeInvitationOptOutService {
  readonly tokens: string[] = [];
  result: ContactOptOutResult = { state: 'opted-out' };
  failure: ApiError | null = null;

  optOut(token: string): Promise<ContactOptOutResult> {
    this.tokens.push(token);
    if (this.failure) return Promise.reject(this.failure);
    return Promise.resolve(this.result);
  }
}

/** The template drives the protected click handler; the tests use it too. */
interface PageInternals {
  optOut: () => Promise<void>;
}

async function render(
  seeded: {
    token?: string;
    result?: ContactOptOutResult;
    failure?: ApiError;
  } = {},
): Promise<{
  element: HTMLElement;
  page: PageInternals;
  service: FakeInvitationOptOutService;
  settle: () => Promise<void>;
}> {
  const service = new FakeInvitationOptOutService();
  if (seeded.result) service.result = seeded.result;
  if (seeded.failure) service.failure = seeded.failure;

  TestBed.configureTestingModule({
    providers: [
      // Only the words these tests are about; every other key renders as
      // itself, which is what an assertion about a button wants to see.
      provideTranslationsForTest({
        'optOut.done': 'You will not be invited again',
        'optOut.alreadyDone': 'You had already asked us not to write again',
        'optOut.explanation':
          'This address will not receive further invitations from this ' +
          'organization. Messages about a registration you make yourself — a ' +
          'confirmation, or a cancellation — are not affected.',
        'optOut.noToken':
          'This address is missing its token. Please open the link from the ' +
          'mail again — the whole link, including everything after the ' +
          'question mark.',
        'optOut.error': 'This could not be saved.',
      }),
      { provide: InvitationOptOutService, useValue: service },
    ],
  });

  const fixture = TestBed.createComponent(InvitationOptOutPage);
  if (seeded.token !== undefined) {
    fixture.componentRef.setInput('token', seeded.token);
  }
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();

  return {
    element: fixture.nativeElement as HTMLElement,
    page: fixture.componentInstance as unknown as PageInternals,
    service,
    settle: async () => {
      await fixture.whenStable();
      fixture.detectChanges();
    },
  };
}

describe('InvitationOptOutPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('objects to nothing until the button is pressed (E5b)', async () => {
    const { service } = await render({ token: 'abc.def' });

    // A link previewer that fetched the URL must not decide this for the
    // reader, even though the direction of that mistake is the harmless one.
    expect(service.tokens).toHaveLength(0);
  });

  it('records the objection with the token from the link', async () => {
    const { page, service, settle } = await render({ token: 'abc.def' });

    await page.optOut();
    await settle();

    expect(service.tokens).toEqual(['abc.def']);
  });

  it('confirms afterwards, and says what is not affected (F59)', async () => {
    const { page, element, settle } = await render({ token: 'abc.def' });

    await page.optOut();
    await settle();

    expect(element.textContent).toContain('will not be invited again');
    // Transactional mail keeps working: somebody who does not want invitations
    // still has to learn that their registration was cancelled.
    expect(element.textContent).toMatch(/confirmation, or a cancellation/);
  });

  it('says it plainly when this address had already objected', async () => {
    const { page, element, settle } = await render({
      token: 'abc.def',
      result: { state: 'already-opted-out' },
    });

    await page.optOut();
    await settle();

    // Not an error: a second click on the same link is the likely reason.
    expect(element.textContent).toContain('already asked us');
  });

  it('names no series and no organization in the answer (E15)', async () => {
    const { page, element, settle } = await render({ token: 'abc.def' });

    await page.optOut();
    await settle();

    // Whoever holds this link asked to be left alone; the answer is not a
    // summary of what this instance knows about them.
    expect(element.textContent).not.toMatch(/Democracy|series/i);
  });

  it('asks for the whole link when the token is missing', async () => {
    const { element } = await render();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'missing its token',
    );
    expect(element.querySelector('button')).toBeNull();
  });

  it('reports a link that no longer works instead of failing silently', async () => {
    const { page, element, settle } = await render({
      token: 'abc.def',
      failure: {
        status: 400,
        message: 'This link is not valid any more.',
        retryable: false,
        explained: true,
      },
    });

    await page.optOut();
    await settle();

    // Both halves (F77): this client's sentence in the reader's language, and
    // the server's reason — which is the half that says *why* — beside it.
    const alert = element.querySelector('[role="alert"]')?.textContent;
    expect(alert).toContain('This could not be saved.');
    expect(alert).toContain('not valid any more');
    // And the button stays, so a temporary failure can be retried.
    expect(element.querySelector('button')).not.toBeNull();
  });

  it('does not repeat a reason the server never gave', async () => {
    const { page, element, settle } = await render({
      token: 'abc.def',
      failure: {
        status: 0,
        message: 'The server could not be reached.',
        retryable: true,
        explained: false,
      },
    });

    await page.optOut();
    await settle();

    const alert = element.querySelector('[role="alert"]')?.textContent;
    expect(alert).toContain('This could not be saved.');
    expect(alert).not.toContain('could not be reached');
  });
});
