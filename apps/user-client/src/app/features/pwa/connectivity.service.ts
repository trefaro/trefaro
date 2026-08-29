import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  inject,
  signal,
} from '@angular/core';

/**
 * Whether this client currently has a network at all (F20, F110, NFR 10).
 *
 * The service worker caches the application shell (E27 keeps API answers out of
 * it), so a participant who has the client installed and loses their connection
 * gets the shell back and then a page that cannot load anything. Without this,
 * that reads as "the app is broken"; with it, it reads as "you are offline",
 * which is a state a person can act on.
 *
 * `navigator.onLine` is asymmetric and this service leans on the reliable half:
 * `false` means there is definitely no network, `true` only means there is an
 * interface — a captive portal or a dead uplink still says `true`. So the
 * banner it drives is an explanation for an outage the browser is *sure* of, and
 * every page keeps its own error notice for the case where a request simply
 * fails.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly state = signal(this.view?.navigator.onLine ?? true);

  /** `false` only when the browser is certain there is no connection. */
  readonly online = this.state.asReadonly();

  constructor() {
    const view = this.view;
    if (!view) return;

    const goOnline = () => this.state.set(true);
    const goOffline = () => this.state.set(false);

    view.addEventListener('online', goOnline);
    view.addEventListener('offline', goOffline);

    // A root service outlives every page, so this only ever runs when the
    // application itself is torn down — which is what a test does between two
    // cases, and a listener left behind there writes into a destroyed signal.
    inject(DestroyRef).onDestroy(() => {
      view.removeEventListener('online', goOnline);
      view.removeEventListener('offline', goOffline);
    });
  }
}
