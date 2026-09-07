import { TestBed } from '@angular/core/testing';
import { RoomPlanningPlugin } from './room-planning-plugin';

/** What the host hands over under `plugins.roomPlanning.`, prefix stripped. */
const STRINGS: Record<string, string> = {
  title: 'Raumplanung',
  event: 'Veranstaltung',
  language: 'Sprache',
  note: 'Dieser Abschnitt kommt vom Raumplanungs-Plug-in.',
  action: 'Interesse an einem Raum',
  noEvent: 'nicht übergeben',
};

describe('RoomPlanningPlugin', () => {
  function render(
    inputs: Partial<{
      eventId: string | null;
      locale: string;
      strings: Record<string, string>;
    }> = {},
  ) {
    const fixture = TestBed.createComponent(RoomPlanningPlugin);
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value);
    }
    fixture.detectChanges();
    return fixture;
  }

  const text = (fixture: ReturnType<typeof render>): string =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  it('renders the context the host handed over', () => {
    const fixture = render({ eventId: 'event-42', locale: 'de' });

    expect(text(fixture)).toContain('event-42');
    expect(text(fixture)).toContain('de');
  });

  it('has no text of its own, only the words it was given (E48)', () => {
    const fixture = render({ eventId: 'event-42', strings: STRINGS });

    expect(text(fixture)).toContain('Raumplanung');
    expect(text(fixture)).toContain('Veranstaltung');
    expect(text(fixture)).toContain('Interesse an einem Raum');
    // The English that stood in this template from phase 0 until AP 1 of
    // phase 4 — the E22 violation this bundle was carrying.
    expect(text(fixture)).not.toContain('Room planning');
    expect(text(fixture)).not.toContain('Interested in a room');
  });

  it('follows a language switch without being remounted', () => {
    const fixture = render({ eventId: 'event-42', strings: STRINGS });
    fixture.componentRef.setInput('strings', {
      ...STRINGS,
      title: 'Room planning',
    });
    fixture.detectChanges();

    // The host reassigns the property rather than replacing the element, which
    // is what lets this component keep what a visitor did to it.
    expect(text(fixture)).toContain('Room planning');
  });

  it('shows the key when the host has no word for it', () => {
    const fixture = render({ eventId: 'event-42' });

    // What a missing translation looks like everywhere else in this
    // application — and what a host older than plug-in API 1.2.0 produces.
    expect(text(fixture)).toContain('plugins.roomPlanning.title');
  });

  it('says so when the host supplied no event', () => {
    const fixture = render({ strings: STRINGS });

    expect(text(fixture)).toContain('nicht übergeben');
  });

  it('updates on interaction, which proves change detection works inside the element', () => {
    const fixture = render({ eventId: 'event-42', strings: STRINGS });
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );

    button?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(fixture.componentInstance.interest()).toBe(1);
    expect(text(fixture)).toContain('(1)');
  });
});
