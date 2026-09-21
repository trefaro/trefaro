import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ICON_NAMES } from '@trefaro/shared-models';
import { ICON_PATHS, ICON_VIEW_BOX, iconPath } from './icon-paths';
import { TrefaroIcon } from './icon';

@Component({
  imports: [TrefaroIcon],
  template: `<trefaro-icon [name]="name()" />`,
})
class HostComponent {
  readonly name = signal<string | null>('meeting_room');
}

describe('the icon glyphs', () => {
  it('draws every name the catalogue offers', () => {
    // The compiler already refuses a missing name — `ICON_PATHS` is a complete
    // record over `IconName`. What it cannot see is an entry that is there and
    // says nothing, which would be a name that renders an empty `<path>`.
    // Upper *or* lower case: a path begins with a moveto, and whether it is
    // absolute or relative is the optimizer's business — `close` arrived in
    // AP 7 of phase 5 starting with `m`, and the data is copied unmodified.
    for (const name of ICON_NAMES) {
      expect(ICON_PATHS[name]).toMatch(/^[Mm]/);
      expect(ICON_PATHS[name].length).toBeGreaterThan(20);
    }
  });

  it('answers with nothing for a name this version does not know', () => {
    expect(iconPath('meeting-room')).toBeNull();
    expect(iconPath('a_glyph_we_withdrew')).toBeNull();
    expect(iconPath(null)).toBeNull();
    expect(iconPath(undefined)).toBeNull();
    expect(iconPath('')).toBeNull();
  });

  it('draws every glyph in one box, so sizes are comparable', () => {
    expect(ICON_VIEW_BOX).toBe('0 -960 960 960');
  });
});

describe('TrefaroIcon', () => {
  function render(name: string | null) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.name.set(name);
    fixture.detectChanges();
    return fixture;
  }

  const svg = (fixture: ReturnType<typeof render>): SVGElement | null =>
    (fixture.nativeElement as HTMLElement).querySelector('svg');

  it('draws the glyph the name stands for', () => {
    const fixture = render('meeting_room');

    const path = svg(fixture)?.querySelector('path');
    expect(path?.getAttribute('d')).toBe(ICON_PATHS.meeting_room);
    expect(svg(fixture)?.getAttribute('viewBox')).toBe(ICON_VIEW_BOX);
  });

  it('renders nothing at all for a name it does not know (E49)', () => {
    // Not a placeholder and not a throw: a descriptor may name a glyph a later
    // image withdrew, and a tile that vanished would be the worse answer.
    expect(svg(render('meeting-room'))).toBeNull();
    expect(svg(render(null))).toBeNull();
  });

  it('follows a change of name without being rebuilt', () => {
    const fixture = render('meeting_room');

    fixture.componentInstance.name.set('forum');
    fixture.detectChanges();

    expect(svg(fixture)?.querySelector('path')?.getAttribute('d')).toBe(
      ICON_PATHS.forum,
    );
  });

  it('stays out of the accessibility tree, because the label is beside it', () => {
    // Every caller shows the name next to the glyph; an icon read out as well
    // would say the same thing twice (NFR 4).
    const fixture = render('meeting_room');

    expect(svg(fixture)?.getAttribute('aria-hidden')).toBe('true');
    expect(svg(fixture)?.getAttribute('focusable')).toBe('false');
  });

  it('takes its colour from the text around it', () => {
    // The reason path data beats an image: no theme rule reaches inside an
    // `<img>`, and this is what lets a plug-in ship no CSS.
    const fixture = render('meeting_room');
    const element = svg(fixture) as SVGElement;

    expect(getComputedStyle(element).fill).toBe('currentcolor');
  });
});
