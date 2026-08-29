import { TestBed } from '@angular/core/testing';
import { provideTranslationsForTest } from '@trefaro/shared-i18n';
import { ConnectivityService } from './connectivity.service';
import { OfflineBanner } from './offline-banner';

/**
 * "An offline state instead of a white page" (F20).
 *
 * The catalogue is stubbed with the two keys, so the test names the words a
 * participant reads rather than asserting a key against itself.
 */
describe('OfflineBanner', () => {
  let online: boolean;

  beforeEach(() => {
    online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    TestBed.configureTestingModule({
      providers: [
        provideTranslationsForTest({
          'app.offline.title': 'No connection',
          'app.offline.body': 'You are offline.',
        }),
      ],
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it('says nothing while there is a network', () => {
    const fixture = TestBed.createComponent(OfflineBanner);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('');
  });

  it('explains the outage as soon as the browser reports one', async () => {
    const fixture = TestBed.createComponent(OfflineBanner);
    fixture.detectChanges();

    online = false;
    TestBed.inject(ConnectivityService);
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    const banner: HTMLElement = fixture.nativeElement;
    expect(banner.textContent).toContain('No connection');
    expect(banner.textContent).toContain('You are offline.');
    // Announced once and politely: losing a connection is not worth cutting off
    // whatever a screen reader was in the middle of.
    expect(banner.querySelector('[role="status"]')).not.toBeNull();
  });
});
