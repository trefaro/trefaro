import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PublicEventSeries } from '@trefaro/shared-models';
import { PublicEventSeriesService } from '../../features/event-series/public-event-series.service';
import { StartPage } from './start-page';

const series: PublicEventSeries = {
  id: 'series-1',
  slug: 'climate-conference-2027',
  name: 'Climate Conference 2027',
  description: 'Three days on citizen participation.',
  logoUrl: null,
  websiteUrl: null,
  contactEmail: null,
};

async function render(
  list: () => Promise<readonly PublicEventSeries[]>,
): Promise<HTMLElement> {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: PublicEventSeriesService, useValue: { list } },
    ],
  });

  const fixture = TestBed.createComponent(StartPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('StartPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lists the published series with a link to each', async () => {
    const element = await render(() => Promise.resolve([series]));

    expect(element.textContent).toContain('Climate Conference 2027');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/series/climate-conference-2027',
    );
  });

  it('says so plainly when the organization has published nothing yet', async () => {
    const element = await render(() => Promise.resolve([]));

    expect(element.textContent).toContain('has not published an event series');
  });

  it('tells a visitor to try again when the server cannot be reached', async () => {
    const element = await render(() =>
      Promise.reject({ status: 0, message: 'nope', retryable: true }),
    );

    // The public start page is the first thing anyone sees; a stack trace or a
    // silently empty list would both be wrong (NFR 10).
    expect(element.textContent).toContain('try again');
  });
});
