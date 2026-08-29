import { TestBed } from '@angular/core/testing';
import { ConnectivityService } from './connectivity.service';

/**
 * The offline state (F20, NFR 10).
 *
 * `navigator.onLine` is read-only, so the flag is stubbed rather than assigned:
 * what the service is meant to do is trust `false` and follow the two events,
 * and that is exactly what is exercised here.
 */
describe('ConnectivityService', () => {
  let online: boolean;

  beforeEach(() => {
    online = true;
    vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
    TestBed.configureTestingModule({});
  });

  afterEach(() => vi.restoreAllMocks());

  it('starts from what the browser says', () => {
    online = false;
    expect(TestBed.inject(ConnectivityService).online()).toBe(false);
  });

  it('follows the browser into and out of an outage', () => {
    const service = TestBed.inject(ConnectivityService);
    expect(service.online()).toBe(true);

    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBe(false);

    window.dispatchEvent(new Event('online'));
    expect(service.online()).toBe(true);
  });

  it('stops listening when the application is torn down', () => {
    const service = TestBed.inject(ConnectivityService);
    TestBed.resetTestingModule();

    // A listener left behind would write into a signal whose injector is gone —
    // invisible in production, where a root service outlives everything, and
    // noisy between two test cases.
    window.dispatchEvent(new Event('offline'));
    expect(service.online()).toBe(true);
  });
});
