import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { ForumPlugin } from './app/forum-plugin';

/**
 * Entry point of the discussion forum plug-in bundle (FR 4.6).
 *
 * Registers the component as a custom element instead of bootstrapping an
 * application: the clients' plug-in manager loads this bundle at runtime and
 * mounts `<trefaro-plugin-forum>` — at the event detail hook point in the
 * participant client, and at the event dashboard hook point in the organizer
 * client. **One bundle, two audiences**: which of the two it is drawing arrives
 * as the `mountPoint` property the slot hands over, because only the host knows.
 *
 * The element name must match the descriptor in
 * `apps/server/src/plugins/forum/forum.plugin.ts` — the plug-in manager waits
 * for exactly this name to be defined before it mounts anything.
 *
 * No `provideHttpClient` and no application-wide providers: this bundle talks to
 * its own routes with `fetch` (see `app/forum-api.ts`). What it shares with the
 * client that loads it are the **models**, not the implementation.
 */
const ELEMENT_NAME = 'trefaro-plugin-forum';

async function register(): Promise<void> {
  const app = await createApplication();
  const element = createCustomElement(ForumPlugin, {
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
