import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { LanguageSwitcher } from '@trefaro/shared-i18n';
import { ThemeService } from '@trefaro/shared-theming';
import { ChatConnection } from './features/chat/chat-connection.service';
import { NavDrawer } from './features/navigation/nav-drawer';
import { AppIconService } from './features/pwa/app-icon.service';
import { InstallHint } from './features/pwa/install-hint';
import { OfflineBanner } from './features/pwa/offline-banner';
import { NotificationOffer } from './features/push/notification-offer';
import { PushSubscriptionService } from './features/push/push-subscription.service';

/**
 * Shell of the participant client.
 *
 * Mobile-first: a compact header over the page, themed entirely through the
 * inherited `--trefaro-*` custom properties.
 *
 * Since AP 7 of phase 5 the header carries three things and the navigation is
 * not one of them: the hamburger of {@link NavDrawer}, the organization's
 * logo and name, and the language switch. Everything the old bottom bar knew
 * — which entries an instance offers, who is signed in, signing out, and the
 * navigation hook point — moved into the drawer, where the mockups put it.
 * The language stayed here on purpose: it is chosen before the interface is
 * understood, and behind a hamburger it is not.
 *
 * The shell still holds the chat socket open for the whole session — the
 * reason is written down in `ChatConnection`.
 *
 * The two PWA pieces of AP 12 sit around the outlet rather than inside a page,
 * because neither belongs to one: losing the network and being installable are
 * facts about the client, not about the screen somebody happens to be on. The
 * offer of notifications joined them in AP 11 of phase 3, for the same reason
 * and one more: a browser without an account has no page of its own to be
 * asked on, and E43 says it may subscribe all the same.
 */
@Component({
  selector: 'trefaro-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    NavDrawer,
    LanguageSwitcher,
    OfflineBanner,
    InstallHint,
    NotificationOffer,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly push = inject(PushSubscriptionService);

  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(AppConfigService);

  constructor() {
    // Injected for its effect: it keeps `<link rel="apple-touch-icon">` on the
    // configured app icon, which is the only way the whitelabel reaches an
    // iPhone's home screen (the manifest covers everywhere else).
    inject(AppIconService);

    // Also injected for its effect: the chat socket belongs to the session
    // rather than to a screen, so it is opened here and closed on sign-out
    // (E41, and E44 depends on it — see `ChatConnection`).
    inject(ChatConnection);

    // A notification exists to bring someone back into the app, so a click has
    // to land on the thing that changed.
    this.push.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) void this.router.navigateByUrl(url);
    });
  }
}
