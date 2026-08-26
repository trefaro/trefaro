import { TestBed } from '@angular/core/testing';
import { RoomPlanningPlugin } from './room-planning-plugin';

describe('RoomPlanningPlugin', () => {
  function render(
    inputs: Partial<{ eventId: string | null; locale: string }> = {},
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

  it('says so when the host supplied no event', () => {
    const fixture = render();

    expect(text(fixture)).toContain('none supplied');
  });

  it('updates on interaction, which proves change detection works inside the element', () => {
    const fixture = render({ eventId: 'event-42' });
    const button = (fixture.nativeElement as HTMLElement).querySelector(
      'button',
    );

    button?.dispatchEvent(new MouseEvent('click'));
    fixture.detectChanges();

    expect(fixture.componentInstance.interest()).toBe(1);
    expect(text(fixture)).toContain('(1)');
  });
});
