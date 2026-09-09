import { TestBed } from '@angular/core/testing';
import { ParticipantTicket } from './participant-ticket';
import { QrCheckinApi } from './qr-checkin-api';
import {
  CODE,
  FakeApi,
  STRINGS,
  noSession,
  one,
  settle,
  textOf,
  ticket,
  unknownCode,
} from './testing';

/**
 * The ticket on the self-service page (FR 3.16, E54, F198).
 *
 * What is proved here is the half a browser suite cannot see twice over: that
 * the code becomes a **picture** in this bundle rather than arriving as one in
 * a mail, that the characters underneath stay exactly the code however they are
 * grouped, and that the two credentials of F148 each take their own route.
 */
describe('ParticipantTicket', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: QrCheckinApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(ParticipantTicket);
    fixture.componentRef.setInput('strings', STRINGS);
    fixture.componentRef.setInput('locale', 'de');
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    // A second turn: the picture is drawn once the code has arrived.
    await settle(fixture);
    return fixture;
  }

  beforeEach(() => {
    api = new FakeApi();
  });

  it('asks the link route with the token from the receipt (E11)', async () => {
    await render({ token: 'from-the-mail' });

    expect(api.linkReads).toEqual(['from-the-mail']);
    expect(api.ticketReads).toEqual([]);
  });

  it('draws the code as an SVG in the browser, never as an image from a mail', async () => {
    const fixture = await render({ token: 'from-the-mail' });

    const svg = one(fixture, '.code svg');
    expect(svg).not.toBeNull();
    // A real symbol, not a placeholder: the renderer emits one path per
    // module, and it says what it is drawn from.
    expect(svg?.getAttribute('viewBox')).toMatch(/^0 0 \d+ \d+$/);
    expect(svg?.querySelector('path')).not.toBeNull();
    // Black on white, the one component that does not follow the instance's
    // colours: a tinted code is a code a scanner argues with.
    expect(svg?.innerHTML).toContain('#ffffff');
    expect(svg?.innerHTML).toContain('#000000');
    // The picture is not what a screen reader should recite.
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('prints the characters in groups whose text is still exactly the code', async () => {
    // The guard for the grouping: whoever copies this line copies something
    // the door accepts, because the gaps are margins and not spaces.
    const fixture = await render({ token: 'from-the-mail' });

    const line = one(fixture, '.characters');
    expect(line?.textContent?.replace(/\s+/g, '')).toBe(CODE);
    expect(line?.textContent).not.toContain(' ');
    expect(line?.querySelectorAll('.characters__group').length).toBe(7);
  });

  it('asks the session route with the registration, and not the link route (F148)', async () => {
    api.ticketPages = [{ rows: [ticket()], total: 1, page: 1, pageSize: 50 }];

    await render({ registrationId: 'registration-1' });

    expect(api.linkReads).toEqual([]);
    expect(api.ticketReads).toEqual([1]);
  });

  it('takes the link when it has both — a link works whether or not somebody is signed in', async () => {
    await render({
      token: 'from-the-mail',
      registrationId: 'registration-1',
    });

    expect(api.linkReads).toEqual(['from-the-mail']);
    expect(api.ticketReads).toEqual([]);
  });

  it('says there is no code for a registration that has none, and draws nothing', async () => {
    // Not confirmed, given up, or a link that was never valid: the server
    // answers all of them the same way, and so does this.
    api.linkAnswer = unknownCode();

    const fixture = await render({ token: 'from-the-mail' });

    expect(textOf(fixture)).toContain(STRINGS['noTicket']);
    expect(one(fixture, '.code svg')).toBeNull();
    expect(textOf(fixture)).not.toContain(STRINGS['error']);
  });

  it('treats an expired session as an invitation to log in, not as a fault (E58)', async () => {
    api.ticketPages = [];
    api.linkAnswer = noSession();

    const fixture = await render({ token: 'from-the-mail' });

    expect(textOf(fixture)).toContain(STRINGS['signIn']);
    expect(textOf(fixture)).not.toContain(STRINGS['error']);
  });

  it('says what it can about anything else that went wrong', async () => {
    api.linkAnswer = new Error('boom');

    const fixture = await render({ token: 'from-the-mail' });

    expect(textOf(fixture)).toContain(STRINGS['error']);
  });

  it('shows when they were let in, once they have been', async () => {
    api.linkAnswer = ticket({ checkedInAt: '2027-06-14T07:12:00.000Z' });

    const fixture = await render({ token: 'from-the-mail' });

    expect(one(fixture, '.arrived')?.textContent).toContain(
      STRINGS['checkedIn'],
    );
    // In the reader's language, which is what the slot handed over.
    expect(one(fixture, '.arrived')?.textContent).toMatch(/\d{1,2}[:.]\d{2}/);
  });

  it('says nothing about arrival before anybody has arrived', async () => {
    const fixture = await render({ token: 'from-the-mail' });

    expect(one(fixture, '.arrived')).toBeNull();
  });

  it('falls back to the full key for a word the host did not hand over', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: QrCheckinApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(ParticipantTicket);
    fixture.componentRef.setInput('token', 'from-the-mail');
    fixture.detectChanges();
    await settle(fixture);

    expect(textOf(fixture)).toContain('plugins.qrCheckin.ticketTitle');
  });
});
