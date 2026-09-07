import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { TranslationService } from '@trefaro/shared-i18n';
import type {
  PluginDescriptor,
  PluginMountPoint,
  PluginSlotContext,
} from '@trefaro/shared-models';
import { pluginCataloguePrefix, pluginElementId } from '@trefaro/shared-models';
import { PluginLoaderService } from './plugin-loader.service';

/**
 * A hook point where plug-in web components are mounted.
 *
 * The thesis fixes two of them — the navigation bar and the event detail view —
 * and both clients place this component there. Whether anything appears depends
 * entirely on the configuration.
 *
 * The custom elements are created imperatively because their tag names come from
 * the configuration at runtime, so no template can name them. Values from
 * {@link context} are assigned as element properties, which is how Angular
 * Elements surfaces a component's inputs; a plug-in written without Angular
 * reads the same properties.
 *
 * On top of the hook point's own values, every element is handed the two
 * properties of {@link PluginSlotContext} — `locale` and `strings` (E48, plug-in
 * API 1.2.0). The host resolves a plug-in's words against the catalogue it
 * already loaded and passes them on, so a plug-in's text is maintainable by the
 * organization like every other sentence in the application (E22) without a
 * bundle carrying Transloco or fetching `/api/i18n/:locale` a second time. They
 * are assigned last on purpose: a hook point may add anything it likes to the
 * context, but not shadow the two the contract promises.
 *
 * **A language switch reassigns, it does not remount.** The elements are kept
 * and their properties written again, because a plug-in may be holding state
 * that a visitor put there — an open thread, a half-written proposal — and
 * losing it to a click on "Deutsch" would be a strange way to change language.
 * Only a change to *which* plug-ins belong here rebuilds the children.
 *
 * No styling is passed in: the plug-in inherits the whitelabel design through
 * CSS custom properties on the document root, which cross the shadow DOM
 * boundary on their own.
 *
 * Every mounted element carries `id="plugin-<key>"` ({@link pluginElementId}),
 * so something outside can link to it. A plug-in at the event detail hook point
 * renders inside the page it is mounted on, and the tile the participant client
 * shows for it is therefore a jump link rather than a route (FR 1.5, AP 4 of
 * phase 2).
 */
@Component({
  selector: 'trefaro-plugin-slot',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div
    #host
    class="trefaro-plugin-slot"
    [attr.data-mount-point]="mountPoint()"
  ></div>`,
  styles: `
    .trefaro-plugin-slot {
      display: contents;
    }
  `,
})
export class PluginSlot {
  /** Which hook point this slot represents. */
  readonly mountPoint = input.required<PluginMountPoint>();

  /**
   * Values handed to every mounted plug-in as element properties — for the event
   * detail slot, the event's id.
   *
   * The language is *not* one of them: the slot supplies `locale` itself, so a
   * hook point cannot forget it and every plug-in gets it the same way.
   */
  readonly context = input<Readonly<Record<string, unknown>>>({});

  private readonly config = inject(AppConfigService);
  private readonly loader = inject(PluginLoaderService);
  private readonly i18n = inject(TranslationService);
  private readonly document = inject(DOCUMENT);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  /** The elements currently mounted, by plug-in key. */
  private readonly mounted = new Map<string, HTMLElement>();

  /** Enabled plug-ins for this hook point whose element is defined. */
  private readonly mountable = computed<readonly PluginDescriptor[]>(() => {
    // Read the load results so this recomputes as plug-ins finish loading.
    this.loader.loadResults();
    return this.config
      .pluginsAt(this.mountPoint())
      .filter((plugin) => this.loader.isReady(plugin.key));
  });

  constructor() {
    effect(() => {
      const plugins = this.mountable();
      const context = this.context();
      // Read in the effect, not inside `handOver`: this is what makes a language
      // switch reach the mounted elements at all (F72).
      const locale = this.i18n.locale();

      this.reconcile(plugins);
      for (const plugin of plugins) {
        this.handOver(plugin, context, locale);
      }
    });
  }

  /**
   * Brings the children in line with the list of plug-ins.
   *
   * All or nothing rather than moving nodes about: a custom element that is
   * detached and reattached is torn down and rebuilt by Angular Elements, so
   * reordering the survivors would cost exactly what keeping them was for. The
   * list changes when a plug-in is switched on or its bundle finishes loading —
   * rare, and a rebuild then is what one would expect anyway.
   */
  private reconcile(plugins: readonly PluginDescriptor[]): void {
    const keys = plugins.map((plugin) => plugin.key);
    const unchanged =
      keys.length === this.mounted.size &&
      keys.every((key) => this.mounted.has(key));
    if (unchanged) return;

    const host = this.host().nativeElement;
    host.replaceChildren();
    this.mounted.clear();

    for (const plugin of plugins) {
      const element = this.document.createElement(plugin.elementName);
      element.setAttribute('data-plugin', plugin.key);
      // The link target of this plug-in's tile. Assigned here rather than by the
      // plug-in, because a bundle that forgot it would break a link in the host.
      element.id = pluginElementId(plugin.key);
      host.appendChild(element);
      this.mounted.set(plugin.key, element);
    }
  }

  /** Writes the hook point's values and the contract's two onto one element. */
  private handOver(
    plugin: PluginDescriptor,
    context: Readonly<Record<string, unknown>>,
    locale: string,
  ): void {
    const element = this.mounted.get(plugin.key);
    if (!element) return;

    const promised: PluginSlotContext = {
      locale,
      strings: this.i18n.stringsWithPrefix(pluginCataloguePrefix(plugin.key)),
    };
    Object.assign(element, context, promised);
  }
}
