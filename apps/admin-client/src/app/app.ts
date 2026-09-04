import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { NEWSLETTER_MODULE_KEY } from '@trefaro/shared-models';
import { LanguageSwitcher } from '@trefaro/shared-i18n';
import { PluginSlot } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';
import { AuthService } from './features/auth/auth.service';

/**
 * Shell of the organizer client.
 *
 * A side menu with context-dependent entries, as the mockups show. It carries
 * the navigation hook point, so a plug-in registers itself here — the same
 * mechanism and the same bundles as in the participant client.
 *
 * The menu appears only once someone is logged in: the login form is a page
 * without a workspace around it.
 */
@Component({
  selector: 'trefaro-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    PluginSlot,
    LanguageSwitcher,
    TranslocoPipe,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);
  protected readonly config = inject(AppConfigService);
  protected readonly auth = inject(AuthService);
  /**
   * For the one menu entry that is only there when its module is (FR 4.8).
   *
   * A field and not a string in the template: the key is a constant the server
   * reads as well, and a template cannot import one.
   */
  protected readonly newsletterModuleKey = NEWSLETTER_MODULE_KEY;
  private readonly router = inject(Router);

  protected async signOut(): Promise<void> {
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
