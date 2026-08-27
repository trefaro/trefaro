import { TestBed } from '@angular/core/testing';
import type { ContactOptOutResult } from '@trefaro/shared-models';
import { InvitationOptOutService } from '../../features/invitations/invitation-opt-out.service';
import { InvitationOptOutPage } from './invitation-opt-out-page';

class FakeInvitationOptOutService {
  readonly tokens: string[] = [];
  result: ContactOptOutResult = { state: 'opted-out' };
  failure: { message: string } | null = null;

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
    failure?: { message: string };
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
    providers: [{ provide: InvitationOptOutService, useValue: service }],
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
      failure: { message: 'This link is not valid any more.' },
    });

    await page.optOut();
    await settle();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'not valid any more',
    );
    // And the button stays, so a temporary failure can be retried.
    expect(element.querySelector('button')).not.toBeNull();
  });
});
