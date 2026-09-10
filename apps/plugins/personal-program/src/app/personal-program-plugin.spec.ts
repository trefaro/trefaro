import { TestBed } from '@angular/core/testing';
import { PersonalProgramApi } from './personal-program-api';
import { PersonalProgramPlugin } from './personal-program-plugin';
import {
  FakeApi,
  STRINGS,
  all,
  buttons,
  item,
  one,
  settle,
  textOf,
} from './testing';

/**
 * The personal programme (FR 3.17) — the section at the event detail hook
 * point, mounted for everybody and behind a session for everything.
 *
 * What these tests hold on to: that the **whole** programme is drawn with a
 * mark rather than the selection alone; that a row goes in and comes out
 * without the page being read again; that the day headings and the rows agree;
 * that a switch of language is a new request whose late answer cannot win; and
 * — the one every other assertion serves — that **nothing here claims a seat**
 * (E55). What a seat is remains the programme's business, and this section says
 * where it is booked without ever saying it booked one.
 */
describe('PersonalProgramPlugin', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: PersonalProgramApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(PersonalProgramPlugin);
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    fixture.componentRef.setInput('eventId', 'event-1');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('draws the whole programme, marking what is already in the plan', async () => {
    api.rows = [
      item({ programItemId: 'a', title: 'Eröffnung', inPlan: true }),
      item({ programItemId: 'b', title: 'Workshop' }),
    ];

    const fixture = await render();

    expect(all(fixture, '.session')).toHaveLength(2);
    expect(textOf(fixture)).toContain('Eröffnung');
    expect(textOf(fixture)).toContain('Workshop');
    // The marked one offers to take it out, the other to put it in.
    expect(buttons(fixture, STRINGS.remove)).toHaveLength(1);
    expect(buttons(fixture, STRINGS.add)).toHaveLength(1);
  });

  it('groups the sessions by the day the reader is in', async () => {
    api.rows = [
      item({ programItemId: 'a', startsAt: '2027-06-14T07:00:00.000Z' }),
      item({ programItemId: 'b', startsAt: '2027-06-14T12:00:00.000Z' }),
      item({ programItemId: 'c', startsAt: '2027-06-15T07:00:00.000Z' }),
    ];

    const fixture = await render();

    const days = all(fixture, '.day');
    expect(days).toHaveLength(2);
    // Two headings, three rows — and the first heading carries two of them.
    expect(
      all(fixture, '.sessions')[0].querySelectorAll('.session'),
    ).toHaveLength(2);
  });

  it('says where a seat is booked, and never that it booked one', async () => {
    api.rows = [
      item({
        programItemId: 'a',
        registrationEnabled: true,
        capacity: 30,
        inPlan: true,
      }),
      item({ programItemId: 'b' }),
    ];

    const fixture = await render();

    const marks = all(fixture, '.session__seats');
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toContain(STRINGS.signupNote);
    expect(marks[0].textContent).toContain(STRINGS.limited);
    // The number of seats stays out: without how many are taken it reads as
    // "still free", which is a promise this plug-in cannot keep.
    expect(textOf(fixture)).not.toContain('30');
  });

  it('marks an unlimited sign-up too, which a capacity alone could not (F42)', async () => {
    api.rows = [
      item({ programItemId: 'a', registrationEnabled: true, capacity: null }),
    ];

    const fixture = await render();

    const mark = one(fixture, '.session__seats');
    expect(mark?.textContent).toContain(STRINGS.signupNote);
    expect(mark?.textContent).not.toContain(STRINGS.limited);
  });

  it('puts a session in the plan and writes the row in place', async () => {
    api.rows = [item({ programItemId: 'a' })];
    const fixture = await render();

    buttons(fixture, STRINGS.add)[0].click();
    await settle(fixture);

    expect(api.added).toEqual(['a']);
    expect(buttons(fixture, STRINGS.remove)).toHaveLength(1);
    // One read, not two: a 204 says the state is what was asked for, and
    // re-reading would move the page under a thumb about to press the next row.
    expect(api.reads).toHaveLength(1);
  });

  it('takes it out again', async () => {
    api.rows = [item({ programItemId: 'a', inPlan: true })];
    const fixture = await render();

    buttons(fixture, STRINGS.remove)[0].click();
    await settle(fixture);

    expect(api.removed).toEqual(['a']);
    expect(buttons(fixture, STRINGS.add)).toHaveLength(1);
  });

  it('leaves the row as it was when the write fails', async () => {
    api.rows = [item({ programItemId: 'a' })];
    const fixture = await render();
    api.failWrite = true;

    buttons(fixture, STRINGS.add)[0].click();
    await settle(fixture);

    expect(buttons(fixture, STRINGS.add)).toHaveLength(1);
    expect(textOf(fixture)).toContain(STRINGS.error);
  });

  it('does not send the same row twice while one write is in flight', async () => {
    api.rows = [item({ programItemId: 'a' })];
    const fixture = await render();

    const button = buttons(fixture, STRINGS.add)[0];
    button.click();
    button.click();
    await settle(fixture);

    expect(api.added).toEqual(['a']);
  });

  it('shows only the plan when asked, and says so when it is empty', async () => {
    api.rows = [item({ programItemId: 'a' }), item({ programItemId: 'b' })];
    const fixture = await render();

    one(fixture, '.filter')?.click();
    fixture.detectChanges();

    expect(all(fixture, '.session')).toHaveLength(0);
    expect(textOf(fixture)).toContain(STRINGS.emptyPlan);
    // A filter, not a second list: nothing was asked of the server.
    expect(api.reads).toHaveLength(1);
  });

  it('keeps the filter when the language changes', async () => {
    api.rows = [item({ programItemId: 'a', inPlan: true })];
    const fixture = await render();
    one(fixture, '.filter')?.click();
    fixture.detectChanges();

    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
    await settle(fixture);

    // The words are reassigned, the element is not replaced — so what the
    // reader set survives a switch.
    expect(all(fixture, '.session')).toHaveLength(1);
    expect(api.reads).toEqual(['de', 'en']);
  });

  it('asks again in the reader’s language, because the titles are the server’s', async () => {
    api.rows = [item()];
    const fixture = await render();

    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
    await settle(fixture);

    expect(api.reads).toEqual(['de', 'en']);
  });

  it('ignores a late answer to the language nobody is reading any more', async () => {
    api.defer = true;
    const fixture = await render();
    fixture.componentRef.setInput('locale', 'en');
    fixture.detectChanges();
    await settle(fixture);

    // Two reads in flight; the first one lands last and must not win.
    api.pending[1]([item({ programItemId: 'new', title: 'Aktuell' })]);
    api.pending[0]([item({ programItemId: 'old', title: 'Veraltet' })]);
    await settle(fixture);

    expect(textOf(fixture)).toContain('Aktuell');
    expect(textOf(fixture)).not.toContain('Veraltet');
  });

  it('invites somebody without a session to log in, rather than failing', async () => {
    api.noSession = true;

    const fixture = await render();

    // Mounted for everybody: a section that appeared only to those already
    // logged in would be a feature nobody hears about (E58).
    expect(textOf(fixture)).toContain(STRINGS.signIn);
    expect(textOf(fixture)).not.toContain(STRINGS.error);
  });

  it('says an event without a programme has none', async () => {
    const fixture = await render();

    expect(textOf(fixture)).toContain(STRINGS.emptyProgram);
    expect(all(fixture, '.session')).toHaveLength(0);
  });

  it('asks nothing at all without an event', async () => {
    const fixture = await render({ eventId: null });

    expect(api.reads).toEqual([]);
    expect(textOf(fixture)).toContain(STRINGS.loading);
  });

  it('reports a read that failed', async () => {
    api.failRead = true;

    const fixture = await render();

    expect(textOf(fixture)).toContain(STRINGS.error);
  });
});
