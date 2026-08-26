import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { RoomPlanningPlugin } from './app/room-planning-plugin';

/**
 * Entry point of the room planning plug-in bundle.
 *
 * Registers the component as a custom element instead of bootstrapping an
 * application: the clients' plug-in manager loads this bundle at runtime and
 * mounts `<trefaro-plugin-room-planning>` at the event detail hook point.
 *
 * The element name must match the descriptor in
 * `apps/server/src/plugins/room-planning/room-planning.plugin.ts` — the plug-in
 * manager waits for exactly this name to be defined before it mounts anything.
 */
const ELEMENT_NAME = 'trefaro-plugin-room-planning';

async function register(): Promise<void> {
  const app = await createApplication();
  const element = createCustomElement(RoomPlanningPlugin, {
    injector: app.injector,
  });

  // Defining the same name twice throws. That happens when two clients share a
  // page, or on a hot reload during development.
  if (!customElements.get(ELEMENT_NAME)) {
    customElements.define(ELEMENT_NAME, element);
  }
}

register().catch((error: unknown) => {
  // The plug-in manager notices the element was never defined and skips this
  // plug-in; logging here is what tells an operator why.
  console.error(`Trefaro plug-in ${ELEMENT_NAME} failed to register`, error);
});
