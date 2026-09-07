import { TestBed } from '@angular/core/testing';
import { ProgramProposalsPlugin } from './program-proposals-plugin';
import { ProposalsApi } from './proposals-api';

/**
 * That the element draws the half the host asked for (plug-in API 1.2.0).
 *
 * One bundle serves two audiences, and the only thing that decides which is the
 * `mountPoint` property the slot hands over. Getting this wrong would show a
 * participant a moderation queue with two buttons behind them — which the
 * server would refuse, but a screen that offers what it cannot do is a bug of
 * its own.
 */
describe('ProgramProposalsPlugin', () => {
  /** Nothing is fetched here: what is under test is which child is created. */
  const silent = {
    listForParticipant: () => new Promise(() => undefined),
    listQueue: () => new Promise(() => undefined),
    summary: () => new Promise(() => undefined),
  } as unknown as ProposalsApi;

  function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: ProposalsApi, useValue: silent }],
    });
    const fixture = TestBed.createComponent(ProgramProposalsPlugin);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  const html = (fixture: ReturnType<typeof render>): string =>
    (fixture.nativeElement as HTMLElement).innerHTML;

  it("draws the organizer's section at the dashboard hook point", () => {
    const fixture = render({
      eventId: 'event-1',
      mountPoint: 'event-dashboard',
    });

    expect(html(fixture)).toContain('trefaro-organizer-proposals');
    expect(html(fixture)).not.toContain('trefaro-participant-proposals');
  });

  it("draws the participant's panel at the event detail hook point", () => {
    const fixture = render({ eventId: 'event-1', mountPoint: 'event-detail' });

    expect(html(fixture)).toContain('trefaro-participant-proposals');
    expect(html(fixture)).not.toContain('trefaro-organizer-proposals');
  });

  it('draws the participant half when no hook point was handed over', () => {
    // A host that predates 1.2.0 assigns nothing. Of the two halves, the
    // public event page is the one it would have wanted.
    const fixture = render({ eventId: 'event-1' });

    expect(html(fixture)).toContain('trefaro-participant-proposals');
  });

  it('passes the context through to the half it draws', () => {
    const fixture = render({
      eventId: 'event-1',
      locale: 'de',
      strings: { title: 'Programmvorschläge' },
      mountPoint: 'event-detail',
    });

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Programmvorschläge',
    );
  });
});
