import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PluginSlot } from '@trefaro/shared-plugins';
import { ThemeService } from '@trefaro/shared-theming';

/**
 * Shell of the organizer client.
 *
 * A side menu with context-dependent entries, as the mockups show. It carries
 * the navigation hook point, so a plug-in registers itself here — the same
 * mechanism and the same bundles as in the participant client.
 */
@Component({
  selector: 'trefaro-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PluginSlot],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly theme = inject(ThemeService);
}
