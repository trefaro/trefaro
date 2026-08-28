import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { AppConfigService } from '@trefaro/shared-config';
import { LanguageSwitcher } from '@trefaro/shared-i18n';
import { PluginSlot } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { PushSubscriptionService } from './features/push/push-subscription.service';

/**
 * Shell of the participant client.
 *
 * Mobile-first: a compact header and a bottom-anchored navigation, both themed
 * entirely through the inherited `--trefaro-*` custom properties.
 *
 * The navigation carries one of the two plug-in hook points the architecture
 * defines; the other is on the event detail view.
 */
@Component({
  selector: 'trefaro-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, PluginSlot, LanguageSwitcher],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly push = inject(PushSubscriptionService);

  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(AppConfigService);

  constructor() {
    // A notification exists to bring someone back into the app, so a click has
    // to land on the thing that changed.
    this.push.notificationClicks.subscribe(({ notification }) => {
      const url = (notification.data as { url?: string } | undefined)?.url;
      if (url) void this.router.navigateByUrl(url);
    });
  }
}
