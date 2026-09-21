import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  NavigationSkipped,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';
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
 *
 * Below the one breakpoint this client has (AP 8 of phase 5, E67) the same
 * menu is a drawer: {@link menuOpen} drives a class, the stylesheet does the
 * rest, and nothing here knows how wide the window is. That is on purpose —
 * a `matchMedia` in TypeScript would put the breakpoint in a second place, and
 * the two would disagree the first time one of them moved. It also settles
 * what the drawer is *not*: `role="dialog"` would be a lie above the
 * breakpoint, where the same element is a permanent column, so this is a
 * disclosure — the button carries `aria-expanded`, Escape closes it, and the
 * page behind it stays a page.
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
  // On the host rather than on the layout element: Escape has to work wherever
  // focus is when the drawer is open, including on an entry inside it.
  host: { '(keydown.escape)': 'dismissMenu()' },
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

  /**
   * Whether the drawer is showing.
   *
   * Only ever true below the breakpoint, because the button that sets it is
   * not rendered above one — and if a window is widened while it is true,
   * nothing is wrong: the menu is the column it always was, and the scrim and
   * the bar are display:none again.
   */
  protected readonly menuOpen = signal(false);

  private readonly menuToggle =
    viewChild<ElementRef<HTMLButtonElement>>('menuToggle');

  constructor() {
    // Arriving somewhere closes the drawer, because below the breakpoint it
    // lies over the page it just navigated to. The router rather than a click
    // handler on the menu: a plug-in contributes entries this component never
    // sees, and a navigation that was skipped (the entry for the page one is
    // already on) still has to put the page back in view.
    this.router.events
      .pipe(
        filter(
          (event) =>
            event instanceof NavigationEnd ||
            event instanceof NavigationSkipped,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.closeMenu());
  }

  protected toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  /** For a pointer and for a finished navigation: focus stays where it is. */
  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  /**
   * For Escape, which may be pressed from inside the drawer.
   *
   * Focus has to come back to something, and the button that opened it is the
   * only sensible place — the alternative is a focus ring on an element that
   * has just become invisible.
   */
  protected dismissMenu(): void {
    if (!this.menuOpen()) return;
    this.menuOpen.set(false);
    this.menuToggle()?.nativeElement.focus();
  }

  protected async signOut(): Promise<void> {
    this.closeMenu();
    await this.auth.logout();
    await this.router.navigate(['/login']);
  }
}
