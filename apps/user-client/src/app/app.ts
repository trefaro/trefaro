import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { LanguageSwitcher } from '@trefaro/shared-i18n';
import { PluginSlot } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { ParticipantSessionService } from './features/auth/participant-session.service';
import { AppIconService } from './features/pwa/app-icon.service';
import { InstallHint } from './features/pwa/install-hint';
import { OfflineBanner } from './features/pwa/offline-banner';
import { PushSubscriptionService } from './features/push/push-subscription.service';

/**
 * Shell of the participant client.
 *
 * Mobile-first: a compact header and a bottom-anchored navigation, both themed
 * entirely through the inherited `--trefaro-*` custom properties.
 *
 * The navigation carries one of the two plug-in hook points the architecture
 * defines; the other is on the event detail view. Since phase 3 it also carries
 * the logged-in state: the registrations, the profile and signing out, or an
 * invitation to sign in — and none of them on an instance whose `profiles`
 * module is off.
 *
 * The two PWA pieces of AP 12 sit around the outlet rather than inside a page,
 * because neither belongs to one: losing the network and being installable are
 * facts about the client, not about the screen somebody happens to be on.
 */
@Component({
  selector: 'trefaro-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    PluginSlot,
    LanguageSwitcher,
    TranslocoPipe,
    OfflineBanner,
    InstallHint,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly push = inject(PushSubscriptionService);

  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(AppConfigService);
  protected readonly session = inject(ParticipantSessionService);

  constructor() {
    // Injected for its effect: it keeps `<link rel="apple-touch-icon">` on the
    // configured app icon, which is the only way the whitelabel reaches an
    // iPhone's home screen (the manifest covers everywhere else).
    inject(AppIconService);

    // A notification exists to bring someone back into the app, so a click has
    // to land on the thing that changed.
    this.push.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) void this.router.navigateByUrl(url);
    });
  }

  /**
   * Ends the session and goes back to the start page.
   *
   * Home rather than staying put: the only page that needs a session is the
   * profile, and being left on it after signing out would mean the guard
   * bouncing somebody to a login form they just left.
   */
  protected async signOut(): Promise<void> {
    await this.session.logOut();
    await this.router.navigateByUrl('/');
  }
}
