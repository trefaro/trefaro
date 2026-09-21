import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from '@trefaro/shared-i18n';
import {
  CHAT_MODULE_KEY,
  PROFILE_SEARCH_MODULE_KEY,
  type IconName,
} from '@trefaro/shared-models';
import { PluginSlot } from '@trefaro/shared-plugins';
import { TrefaroIcon } from '@trefaro/shared-theming';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { initialsOf } from '../profiles/initials';

/** One row of the drawer: where it leads, what it is called, its glyph. */
interface DrawerEntry {
  readonly path: string;
  readonly labelKey: string;
  readonly icon: IconName;
  /** Whether the row is the current one only on exactly this address. */
  readonly exact: boolean;
}

/**
 * The navigation of the participant client (E66, E67) — AP 7 of phase 5.
 *
 * The mockups draw it as a drawer that slides in over the page: a hamburger in
 * the top left corner, the person's picture, name and address at the top, the
 * places below it as rows with an icon and a chevron, and one entry pinned at
 * the bottom. Until this package the client had a bar instead — fixed to the
 * bottom edge of a phone, static from 48rem upwards — and that is structure
 * rather than spacing, which is why it is a package and not a touch-up.
 *
 * Three decisions in it are worth writing down:
 *
 * 1. **A drawer at every width.** The bar had a media query that turned it into
 *    a top strip on a desktop; the drawer has none. What the mockups show is
 *    the navigation of this client, and one implementation that works from 390
 *    to 1280 pixels is worth more than two that drift apart — NFR 6 asks for
 *    usable on a desktop, not for a second design.
 * 2. **What is pinned at the bottom is the session, not "settings".** The
 *    mockup pins an entry called *Einstellungen* there. This build has no
 *    settings page to lead to: the language is chosen in the header, and
 *    everything else an account can set — notifications, being findable, the
 *    password, the export — is on the profile page, which already has a row of
 *    its own. A second door to the same page would be the drift this package
 *    exists to remove, so the pinned place carries the thing that is not a
 *    place: signing out, or signing in.
 * 3. **Signing out is a button.** It changes something, and a link previewer
 *    must not be able to end somebody's session (F44 in miniature).
 *
 * The entries are the ones the bar carried, under the same conditions (E42,
 * F53): an instance without accounts offers nothing but the start page, and
 * the directory and the messages appear only where their module is on.
 */
@Component({
  selector: 'trefaro-nav-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    RouterLinkActive,
    TranslocoPipe,
    TrefaroIcon,
    PluginSlot,
  ],
  template: `
    <button
      type="button"
      class="toggle"
      aria-haspopup="dialog"
      aria-controls="app-drawer"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="'app.nav.open' | transloco"
      (click)="show()"
      #toggle
    >
      <trefaro-icon name="menu" />
    </button>

    @if (open()) {
      <!-- Decorative: closing is also on the button below and on Escape, and a
           screen reader is inside the dialog rather than out here. -->
      <div class="scrim" aria-hidden="true" (click)="hide()"></div>

      <div
        id="app-drawer"
        class="drawer"
        role="dialog"
        aria-modal="true"
        [attr.aria-label]="'app.nav.label' | transloco"
        (keydown.escape)="hide()"
        (keydown.tab)="keepFocusInside($any($event))"
      >
        <button
          type="button"
          class="close"
          [attr.aria-label]="'app.nav.close' | transloco"
          (click)="hide()"
          #closer
        >
          <trefaro-icon name="close" />
        </button>

        @if (session.participant(); as me) {
          <div class="me">
            @if (me.avatarUrl; as url) {
              <!-- Decorative: the name is right underneath it. -->
              <img class="me__avatar" [src]="url" alt="" />
            } @else {
              <span class="me__avatar me__avatar--empty" aria-hidden="true">
                {{ initials(me.firstName, me.lastName) }}
              </span>
            }
            <p class="me__name">{{ me.firstName }} {{ me.lastName }}</p>
            <p class="me__address">{{ me.email }}</p>
          </div>
        }

        <!-- A dialog around a navigation, not a navigation that claims to be a
             dialog: the modal behaviour belongs to the drawer, and the list of
             places is still a landmark somebody can jump to. -->
        <nav [attr.aria-label]="'app.nav.label' | transloco">
          <ul class="entries">
            @for (entry of entries(); track entry.path) {
              <li>
                <a
                  class="entry"
                  [routerLink]="entry.path"
                  routerLinkActive="entry--current"
                  [routerLinkActiveOptions]="{ exact: entry.exact }"
                  (click)="hide()"
                >
                  <trefaro-icon class="entry__icon" [name]="entry.icon" />
                  <span class="entry__label">{{
                    entry.labelKey | transloco
                  }}</span>
                  <trefaro-icon class="entry__chevron" name="chevron_right" />
                </a>
              </li>
            }
          </ul>

          <!-- Plug-in hook point one: the navigation bar. -->
          <trefaro-plugin-slot mountPoint="navigation" />

          <!-- Inside the landmark, pinned to its bottom edge: the way in and
               the way out are part of the navigation, and the mockup pins its
               last entry exactly here. -->
          <div class="foot">
            @if (session.accountsEnabled()) {
              @if (session.isLoggedIn()) {
                <button type="button" class="foot__action" (click)="signOut()">
                  <trefaro-icon name="logout" />
                  <span>{{ 'app.nav.signOut' | transloco }}</span>
                </button>
              } @else {
                <a
                  class="foot__action"
                  routerLink="/profile/login"
                  (click)="hide()"
                >
                  <trefaro-icon name="login" />
                  <span>{{ 'profile.login.title' | transloco }}</span>
                </a>
              }
            }
          </div>
        </nav>
      </div>
    }
  `,
  styles: `
    .toggle,
    .close {
      display: grid;
      place-items: center;
      /* 44 pixels: what a thumb needs (WCAG 2.2 SC 2.5.5). */
      inline-size: 2.75rem;
      block-size: 2.75rem;
      flex: none;
      padding: 0;
      border: 0;
      border-radius: 0.4rem;
      background: transparent;
      color: inherit;
      cursor: pointer;
      --trefaro-icon-size: 1.5rem;
    }

    .scrim {
      position: fixed;
      inset: 0;
      z-index: 20;
      background: rgb(0 0 0 / 40%);
    }

    .drawer {
      position: fixed;
      inset-block: 0;
      inset-inline-start: 0;
      z-index: 21;
      display: flex;
      flex-direction: column;
      /* Never the whole width: the strip of page beside it is what says this
         is a layer over the page rather than a page of its own. */
      inline-size: min(20rem, 85vw);
      padding-block: 0.5rem calc(1rem + env(safe-area-inset-bottom));
      overflow-y: auto;
      background: var(--trefaro-color-surface);
      /* Said, not inherited: the drawer is drawn inside the header, and the
         header is painted in the brand colour with light text on it. Without
         this line the whole drawer was white on white — and no unit test can
         see that. */
      color: var(--trefaro-color-on-surface);
      box-shadow: 0 0 1.5rem rgb(0 0 0 / 25%);
      animation: drawer-in 160ms ease-out;
    }

    @keyframes drawer-in {
      from {
        transform: translateX(-100%);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .drawer {
        animation: none;
      }
    }

    .close {
      margin-inline-start: 0.5rem;
    }

    .me {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.15rem;
      padding: 0.5rem 1rem 1.25rem;
      text-align: center;
    }

    .me__avatar {
      display: grid;
      place-items: center;
      inline-size: 5rem;
      block-size: 5rem;
      margin-block-end: 0.5rem;
      border-radius: 50%;
      object-fit: cover;
      background: var(--trefaro-color-primary-soft);
      color: var(--trefaro-color-primary-strong);
      font-size: 1.5rem;
      font-weight: 600;
    }

    .me__name {
      margin: 0;
      font-weight: 600;
    }

    .me__address {
      margin: 0;
      font-size: 0.9rem;
      color: color-mix(in oklab, currentColor 65%, transparent);
      overflow-wrap: anywhere;
    }

    /* The list grows, the foot sits on the bottom edge of the drawer. */
    nav {
      display: flex;
      flex: 1;
      flex-direction: column;
    }

    .entries {
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .entry,
    .foot__action {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      inline-size: 100%;
      min-block-size: 3rem;
      padding: 0.6rem 1rem;
      border: 0;
      background: transparent;
      color: inherit;
      font: inherit;
      text-align: start;
      text-decoration: none;
      cursor: pointer;
    }

    .entry--current {
      background: var(--trefaro-color-primary-soft);
      font-weight: 600;
    }

    .entry__icon,
    .foot__action trefaro-icon {
      --trefaro-icon-size: 1.4rem;
      color: var(--trefaro-color-primary-strong);
    }

    .entry__label {
      min-inline-size: 0;
      overflow-wrap: anywhere;
    }

    .entry__chevron {
      margin-inline-start: auto;
      --trefaro-icon-size: 1.2rem;
      color: color-mix(in oklab, currentColor 45%, transparent);
    }

    /* Pinned to the bottom edge, where the mockup pins its last entry. */
    .foot {
      margin-block-start: auto;
      padding-block-start: 1rem;
    }

    trefaro-plugin-slot {
      display: block;
    }
  `,
})
export class NavDrawer {
  private readonly router = inject(Router);
  private readonly config = inject(AppConfigService);
  private readonly i18n = inject(TranslationService);
  private readonly toggle =
    viewChild.required<ElementRef<HTMLButtonElement>>('toggle');
  private readonly closer = viewChild<ElementRef<HTMLButtonElement>>('closer');

  protected readonly session = inject(ParticipantSessionService);

  /** Whether the drawer is on screen. Closed is its normal state. */
  protected readonly open = signal(false);

  /**
   * The places this instance offers, in the order the mockup lists them.
   *
   * A computed rather than a template expression: the flags arrive with the
   * configuration, and a list built once at construction would keep an entry
   * an organizer has just switched off (E20, E42).
   */
  protected readonly entries = computed<readonly DrawerEntry[]>(() => {
    const rows: DrawerEntry[] = [
      { path: '/', labelKey: 'app.nav.series', icon: 'home', exact: true },
    ];
    if (!this.session.accountsEnabled() || !this.session.isLoggedIn()) {
      return rows;
    }

    rows.push({
      path: '/registrations',
      labelKey: 'mine.list.title',
      icon: 'event_available',
      exact: false,
    });
    if (this.config.isModuleEnabled(PROFILE_SEARCH_MODULE_KEY)) {
      rows.push({
        path: '/participants',
        labelKey: 'people.title',
        icon: 'group',
        exact: false,
      });
    }
    if (this.config.isModuleEnabled(CHAT_MODULE_KEY)) {
      rows.push({
        path: '/messages',
        labelKey: 'chat.title',
        icon: 'mail',
        exact: false,
      });
    }
    rows.push({
      path: '/profile',
      labelKey: 'profile.title',
      icon: 'person',
      exact: true,
    });
    return rows;
  });

  constructor() {
    // Opening moves the focus into the drawer, because a dialog nobody is in
    // is a dialog a keyboard cannot leave either.
    effect(() => {
      if (this.open()) this.closer()?.nativeElement.focus();
    });
  }

  protected show(): void {
    this.open.set(true);
  }

  protected hide(): void {
    if (!this.open()) return;
    this.open.set(false);
    // Back to where the journey started — otherwise a keyboard lands at the
    // top of a page somebody was already past.
    this.toggle().nativeElement.focus();
  }

  /**
   * The initials that stand in for a missing picture (F138).
   *
   * In the reader's locale, like everywhere else this circle is drawn: a
   * Turkish "i" is not an "I".
   */
  protected initials(firstName: string, lastName: string): string {
    return initialsOf([firstName, lastName], this.i18n.locale());
  }

  /**
   * Keeps Tab inside the open drawer.
   *
   * `aria-modal` tells a screen reader that the rest of the page is out of
   * scope; it does nothing for the Tab key, and a focus ring that wanders
   * behind the scrim is a focus ring nobody can see.
   */
  protected keepFocusInside(event: KeyboardEvent): void {
    const panel = event.currentTarget as HTMLElement | null;
    if (!panel) return;

    const stops = [
      ...panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
    ];
    if (stops.length === 0) return;

    const first = stops[0];
    const last = stops[stops.length - 1];
    const here = panel.ownerDocument.activeElement;
    if (event.shiftKey && here === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && here === last) {
      event.preventDefault();
      first.focus();
    }
  }

  /**
   * Ends the session and goes back to the start page.
   *
   * Home rather than staying put: the only pages that need a session are the
   * account's own, and being left on one after signing out would mean the
   * guard bouncing somebody to a login form they just left.
   */
  protected async signOut(): Promise<void> {
    this.hide();
    await this.session.logOut();
    await this.router.navigateByUrl('/');
  }
}
