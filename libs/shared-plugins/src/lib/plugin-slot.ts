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
import type {
  PluginDescriptor,
  PluginMountPoint,
} from '@trefaro/shared-models';
import { pluginElementId } from '@trefaro/shared-models';
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
   */
  readonly context = input<Readonly<Record<string, unknown>>>({});

  private readonly config = inject(AppConfigService);
  private readonly loader = inject(PluginLoaderService);
  private readonly document = inject(DOCUMENT);
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  /** Enabled plug-ins for this hook point whose element is defined. */
  private readonly mountable = computed<readonly PluginDescriptor[]>(() => {
    // Read the load results so this recomputes as plug-ins finish loading.
    this.loader.loadResults();
    return this.config
      .pluginsAt(this.mountPoint())
      .filter((plugin) => this.loader.isReady(plugin.key));
  });

  constructor() {
    effect(() => this.render(this.mountable(), this.context()));
  }

  private render(
    plugins: readonly PluginDescriptor[],
    context: Readonly<Record<string, unknown>>,
  ): void {
    const host = this.host().nativeElement;
    host.replaceChildren();

    for (const plugin of plugins) {
      const element = this.document.createElement(plugin.elementName);
      element.setAttribute('data-plugin', plugin.key);
      // The link target of this plug-in's tile. Assigned here rather than by the
      // plug-in, because a bundle that forgot it would break a link in the host.
      element.id = pluginElementId(plugin.key);
      Object.assign(element, context);
      host.appendChild(element);
    }
  }
}
