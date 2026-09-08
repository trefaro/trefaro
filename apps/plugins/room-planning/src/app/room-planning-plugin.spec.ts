import { TestBed } from '@angular/core/testing';
import { RoomPlanningApi } from './room-planning-api';
import { RoomPlanningPlugin } from './room-planning-plugin';
import { FakeApi, STRINGS, settle } from './testing';

/**
 * The switch (F202): which of the two halves the element draws depends on the
 * hook point the slot names — the participant's plan at `event-detail`, the
 * organizer's editor at `event-dashboard`.
 */
describe('RoomPlanningPlugin', () => {
  let api: FakeApi;

  async function render(inputs: Record<string, unknown> = {}) {
    TestBed.configureTestingModule({
      providers: [{ provide: RoomPlanningApi, useValue: api }],
    });
    const fixture = TestBed.createComponent(RoomPlanningPlugin);
    fixture.componentRef.setInput('eventId', 'event-1');
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
  });

  it("draws the participant's plan when the slot says event-detail", async () => {
    const fixture = await render({ mountPoint: 'event-detail' });

    expect(has(fixture, 'trefaro-participant-rooms')).toBe(true);
    expect(has(fixture, 'trefaro-organizer-rooms')).toBe(false);
  });

  it("draws the organizer's editor when the slot says event-dashboard", async () => {
    const fixture = await render({ mountPoint: 'event-dashboard' });

    expect(has(fixture, 'trefaro-organizer-rooms')).toBe(true);
    expect(has(fixture, 'trefaro-participant-rooms')).toBe(false);
  });

  it("defaults to the participant's plan for a host that names no hook point", async () => {
    // A host older than plug-in API 1.2.0 assigns nothing — and of the two
    // halves, the public one is what an event page would have wanted.
    const fixture = await render();

    expect(has(fixture, 'trefaro-participant-rooms')).toBe(true);
  });

  it('hands the event and the words down, so the half that draws asks about the right event', async () => {
    api.rooms = [];
    const fixture = await render({ mountPoint: 'event-detail', locale: 'de' });

    expect(api.publicReads).toEqual(['de']);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Raumplan',
    );
  });
});
