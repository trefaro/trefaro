import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TableScroll } from './table-scroll';

/**
 * The frame around a table (AP 8 of phase 5).
 *
 * What is decided here is the rule, not the layout: a frame that scrolls is a
 * named region a keyboard can reach, and one that does not is nothing at all.
 * jsdom has no layout, so the widths and the observer are supplied by the
 * test — which is exactly the right split. That the frame really scrolls at
 * 768 pixels and really does not at 1280 is asserted in a browser, in
 * `apps/admin-client-e2e/src/layout.spec.ts`.
 */
type ObserverCallback = () => void;

/** jsdom has no `ResizeObserver`; this one hands the callback to the test. */
class FakeResizeObserver {
  static callbacks: ObserverCallback[] = [];
  static observed = 0;
  static disconnects = 0;

  constructor(private readonly callback: ObserverCallback) {
    FakeResizeObserver.callbacks.push(callback);
  }

  observe(): void {
    FakeResizeObserver.observed += 1;
  }

  disconnect(): void {
    FakeResizeObserver.disconnects += 1;
  }
}

@Component({
  imports: [TableScroll],
  template: `
    <trefaro-table-scroll label="Participants">
      <table>
        <tbody>
          <tr>
            <td>Okonkwo, Amina</td>
          </tr>
        </tbody>
      </table>
    </trefaro-table-scroll>
  `,
})
class Host {}

function widths(frame: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(frame, 'scrollWidth', {
    value: scrollWidth,
    configurable: true,
  });
  Object.defineProperty(frame, 'clientWidth', {
    value: clientWidth,
    configurable: true,
  });
}

async function render() {
  FakeResizeObserver.callbacks = [];
  FakeResizeObserver.observed = 0;
  FakeResizeObserver.disconnects = 0;
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver =
    FakeResizeObserver;

  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  await fixture.whenStable();

  const host = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    host,
    frame: () => host.querySelector('.frame') as HTMLElement,
    resize: () => {
      for (const callback of FakeResizeObserver.callbacks) callback();
      fixture.detectChanges();
    },
  };
}

afterEach(() => {
  delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
});

describe('TableScroll', () => {
  it('shows the table it was given', async () => {
    const { host } = await render();

    expect(host.querySelector('table')).not.toBeNull();
    expect(host.textContent).toContain('Okonkwo, Amina');
  });

  it('is nothing but a box while everything fits', async () => {
    // At the width this client is designed for, ten tables that each announced
    // themselves as a region would be ten tab stops that lead nowhere.
    const { frame, resize } = await render();
    widths(frame(), 900, 900);
    resize();

    expect(frame().getAttribute('role')).toBeNull();
    expect(frame().getAttribute('tabindex')).toBeNull();
    expect(frame().getAttribute('aria-label')).toBeNull();
  });

  it('becomes a region a keyboard can reach once it scrolls', async () => {
    const { frame, resize } = await render();
    widths(frame(), 900, 736);
    resize();

    expect(frame().getAttribute('role')).toBe('region');
    expect(frame().getAttribute('tabindex')).toBe('0');
    // The heading the table sits under, so what is announced is the table and
    // not "region".
    expect(frame().getAttribute('aria-label')).toBe('Participants');
  });

  it('goes back to being nothing when the room comes back', async () => {
    const { frame, resize } = await render();
    widths(frame(), 900, 736);
    resize();
    widths(frame(), 900, 1024);
    resize();

    expect(frame().getAttribute('role')).toBeNull();
  });

  it('watches the frame and the table, and stops when it is gone', async () => {
    // Two boxes for two halves of the question: the window moves the first,
    // the content moves the second.
    const { fixture } = await render();
    expect(FakeResizeObserver.observed).toBe(2);

    fixture.destroy();
    expect(FakeResizeObserver.disconnects).toBe(1);
  });

  it('measures nothing where there is no observer to ask', async () => {
    // A browser older than this client's baseline, and jsdom: no measurement,
    // no tab stop — the direction that adds nothing rather than lying.
    delete (globalThis as { ResizeObserver?: unknown }).ResizeObserver;
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    await fixture.whenStable();

    const frame = (fixture.nativeElement as HTMLElement).querySelector(
      '.frame',
    ) as HTMLElement;
    expect(frame.getAttribute('role')).toBeNull();
  });
});
