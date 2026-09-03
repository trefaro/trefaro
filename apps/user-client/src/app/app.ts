import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import {
  CHAT_MODULE_KEY,
  PROFILE_SEARCH_MODULE_KEY,
} from '@trefaro/shared-models';
import { LanguageSwitcher } from '@trefaro/shared-i18n';
import { PluginSlot } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { ParticipantSessionService } from './features/auth/participant-session.service';
import { ChatConnection } from './features/chat/chat-connection.service';
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
 * module is off. Finding other participants hangs on a second switch of its
 * own (`profile-search`, E42): accounts without a community directory are a
 * combination an organization may want.
 *
 * Messaging hangs on a third switch (`chat`, E42) and the shell holds its
 * socket open for the whole session — the reason is written down in
 * `ChatConnection`.
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

  /**
   * Whether this instance runs a participant directory (FR 4.4, F53).
   *
   * A computed rather than a call in the template: the flag arrives with the
   * configuration, and a navigation that read it once at construction would
   * keep an entry an organizer has just switched off (E20).
   */
  protected readonly peopleEnabled = computed(() =>
    this.config.isModuleEnabled(PROFILE_SEARCH_MODULE_KEY),
  );

  /** Whether the people in this instance may write to each other (E42, F53). */
  protected readonly chatEnabled = computed(() =>
    this.config.isModuleEnabled(CHAT_MODULE_KEY),
  );

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
