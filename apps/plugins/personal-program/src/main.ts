import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { PersonalProgramPlugin } from './app/personal-program-plugin';

/**
 * Entry point of the personal programme plug-in bundle.
 *
 * Registers the component as a custom element instead of bootstrapping an
 * application: the clients' plug-in manager loads this bundle at runtime and
 * mounts `<trefaro-plugin-personal-program>` at the event detail hook point of
 * the participant client — the only hook point this plug-in declares.
 *
 * The element name must match the descriptor in
 * `apps/server/src/plugins/personal-program/personal-program.plugin.ts` — the
 * plug-in manager waits for exactly this name to be defined before it mounts
 * anything.
 */
const ELEMENT_NAME = 'trefaro-plugin-personal-program';

async function register(): Promise<void> {
  const app = await createApplication();
  const element = createCustomElement(PersonalProgramPlugin, {
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
