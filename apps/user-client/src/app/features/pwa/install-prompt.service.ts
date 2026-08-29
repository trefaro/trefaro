import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  computed,
  inject,
  signal,
} from '@angular/core';

/**
 * The event Chromium fires when it would offer an installation.
 *
 * Not in the DOM typings: it is a Chromium extension to the manifest spec rather
 * than a standard, which is precisely why the hint below only appears where it
 * fires — see the class comment.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ readonly outcome: 'accepted' | 'dismissed' }>;
}

/** Remembers a "not now" across visits, so the hint asks once. */
const STORAGE_KEY = 'trefaro.install.dismissed';

/**
 * Offers the installation, but only where a browser can actually perform it
 * (F20).
 *
 * The participant client is installable from v1, and a client nobody knows is
 * installable is not much of one — so there is a hint. What it deliberately is
 * *not* is an explanation of how to install: a hint that cannot be followed is
 * an advertisement. It therefore hangs entirely on `beforeinstallprompt`, which
 * Chromium fires when it has decided the application qualifies. Where that event
 * does not exist — every browser on iOS, Firefox — nothing is shown, and the
 * platform's own "add to home screen" stays the way in.
 *
 * Three things end the offer, and all three are permanent for that visitor: they
 * install, they say "not now", or the browser reports the application as already
 * installed. The first and third clear themselves; the second is `localStorage`,
 * for the same reason the language is (nothing on the server reads it, and it
 * has to outlive a session).
 */
@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly view = inject(DOCUMENT).defaultView;
  private readonly deferred = signal<BeforeInstallPromptEvent | null>(null);
  private readonly dismissed = signal(this.wasDismissed());

  /** Whether to offer the installation at all. */
  readonly available = computed(
    () => this.deferred() !== null && !this.dismissed(),
  );

  constructor() {
    const view = this.view;
    if (!view) return;

    const capture = (event: Event) => {
      // Without this the browser shows its own bar at its own moment; with it,
      // the offer sits in the page where it can be explained and declined.
      event.preventDefault();
      this.deferred.set(event as BeforeInstallPromptEvent);
    };
    const installed = () => this.deferred.set(null);

    view.addEventListener('beforeinstallprompt', capture);
    view.addEventListener('appinstalled', installed);

    inject(DestroyRef).onDestroy(() => {
      view.removeEventListener('beforeinstallprompt', capture);
      view.removeEventListener('appinstalled', installed);
    });
  }

  /**
   * Hands the visitor to the browser's own installation dialogue.
   *
   * The deferred event is cleared either way: it may be used exactly once, and
   * a second click on a spent event does nothing at all — which would look like
   * a broken button rather than a declined dialogue.
   */
  async install(): Promise<void> {
    const event = this.deferred();
    if (!event) return;

    this.deferred.set(null);
    await event.prompt();
    await event.userChoice;
  }

  /** "Not now", remembered — the offer does not come back on the next visit. */
  dismiss(): void {
    this.dismissed.set(true);
    this.deferred.set(null);
    try {
      this.view?.localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Private mode, or storage switched off. The offer is then declined for
      // this visit only, which is the harmless direction to fail in.
    }
  }

  private wasDismissed(): boolean {
    try {
      return this.view?.localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  }
}
