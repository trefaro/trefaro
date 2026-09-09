import { TestBed } from '@angular/core/testing';
import { QrCheckinApi } from './qr-checkin-api';
import { QrCheckinPlugin } from './qr-checkin-plugin';
import { FakeApi, STRINGS, page, settle, ticket } from './testing';

/**
 * The switch (F202): which of the two halves the element draws depends on the
 * hook point the slot names — the ticket at `my-registration`, the door at
 * `event-dashboard`.
 */
describe('QrCheckinPlugin', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: QrCheckinApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(QrCheckinPlugin);
    fixture.componentRef.setInput('strings', STRINGS);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    await settle(fixture);
    return fixture;
  }

  const has = (fixture: { nativeElement: unknown }, selector: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(selector) !== null;

  beforeEach(() => {
    api = new FakeApi();
    api.linkAnswer = ticket();
    api.admissionPages = [page([])];
  });

  it('draws the ticket when the slot says my-registration', async () => {
    const fixture = await render({
      mountPoint: 'my-registration',
      token: 'from-the-mail',
    });

    expect(has(fixture, 'trefaro-participant-ticket')).toBe(true);
    expect(has(fixture, 'trefaro-organizer-door')).toBe(false);
  });

  it('draws the door when the slot says event-dashboard', async () => {
    const fixture = await render({
      mountPoint: 'event-dashboard',
      eventId: 'event-1',
    });

    expect(has(fixture, 'trefaro-organizer-door')).toBe(true);
    expect(has(fixture, 'trefaro-participant-ticket')).toBe(false);
  });

  it('draws the ticket for a host that names no hook point', async () => {
    // A host older than plug-in API 1.2.0 assigns nothing, and of these two
    // halves the door is the one that must never appear by accident.
    const fixture = await render({ token: 'from-the-mail' });

    expect(has(fixture, 'trefaro-participant-ticket')).toBe(true);
    expect(has(fixture, 'trefaro-organizer-door')).toBe(false);
  });

  it('hands both credentials down, so the half that draws asks the right way', async () => {
    await render({
      mountPoint: 'my-registration',
      registrationId: 'registration-1',
    });

    expect(api.linkReads).toEqual([]);
    expect(api.ticketReads.length).toBeGreaterThan(0);
  });

  it('hands the event down to the door', async () => {
    await render({ mountPoint: 'event-dashboard', eventId: 'event-7' });

    expect(api.admissionReads).toEqual([{ eventId: 'event-7', page: 1 }]);
  });
});
