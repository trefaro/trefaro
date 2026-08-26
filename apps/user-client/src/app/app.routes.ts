import { Route } from '@angular/router';

/**
 * Routes of the participant client.
 *
 * `/` and `/events/:eventId` are reachable without a login — the low entry
 * barrier the thesis asks for. Everything about participants comes later and
 * behind authentication.
 */
export const appRoutes: Route[] = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () =>
      import('./pages/start/start-page').then((m) => m.StartPage),
    title: 'Trefaro',
  },
  {
    // Phase 0 diagnostics: makes the architecture spikes verifiable in a browser.
    // Kept out of the navigation; phase 5 decides whether it stays as an
    // operator tool or goes.
    path: 'spikes',
    loadComponent: () =>
      import('./pages/spike-console/spike-console-page').then(
        (m) => m.SpikeConsolePage,
      ),
    title: 'Architecture spikes',
  },
  {
    path: 'events/:eventId',
    loadComponent: () =>
      import('./pages/event-detail/event-detail-page').then(
        (m) => m.EventDetailPage,
      ),
  },
  { path: '**', redirectTo: '' },
];
