# Spike 1 — Client plug-in as a web component

**Question.** Can a plug-in be built as a framework-independent web component,
loaded at runtime by a plug-in manager, mounted at the navigation bar and the
event detail view, and themed without shipping any CSS of its own?

**Verdict: works.**

## What was built

| Piece                             | Where                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------ |
| Plug-in bundle (Angular Elements) | `apps/plugins/room-planning` → `dist/apps/plugins/room-planning/main.js`       |
| Client plug-in manager            | `libs/shared-plugins/src/lib/plugin-loader.service.ts`                         |
| Mount point component             | `libs/shared-plugins/src/lib/plugin-slot.ts`                                   |
| Theme derivation                  | `libs/shared-theming/src/lib/theme-variables.ts`                               |
| Hook points                       | `apps/user-client` navigation and event detail, `apps/admin-client` navigation |

The bundle is **112 kB raw, 34 kB transferred**, contains no stylesheet and no
`index.html`, and registers `<trefaro-plugin-room-planning>`.

## Findings

**Angular 22 generates zoneless applications.** `zone.js` is not a dependency at
all. That removes what would have been the awkward part of this spike: a plug-in
bundle needs no zone polyfill, and nothing has to be shared between host and
plug-in for change detection to work. It also matches the project's decision to
build on signals.

**The bundle must not be an application.** Three build settings turn an Angular
app project into a loadable plug-in bundle:

- `index: false` — no HTML shell,
- no `styles` entry — a global stylesheet would be a second file to load, and a
  plug-in must not bring its own design anyway,
- `outputHashing: none` plus `outputPath.browser: ''` — the bundle URL is
  declared in the server-side descriptor and must not change per build.

**CSS custom properties are the right seam, and they are enough.** Properties set
on the document root cross the shadow DOM boundary, so the plug-in inherits
`--trefaro-color-primary` and friends without any handover code. Recolouring the
instance recolours the plug-in with no rebuild. The plug-in still styles its own
_layout_ — that is its business; what it must not do is hard-code the _theme_,
and every colour in it reads a `--trefaro-*` variable.

**Two brand colours are enough to derive a palette.** The shades are emitted as
`color-mix(in oklab, var(--trefaro-color-primary) 12%, white)` rather than
computed in JavaScript. The browser mixes perceptually, any CSS colour notation
an organization pastes in works, and the shades stay derived rather than
snapshotted. Only the text colour needs real computation, because contrast cannot
be expressed this way: `readableTextColor` picks black or white by WCAG relative
luminance, which is what keeps a bright yellow brand colour usable.

**A script element, not a dynamic `import()`.** The bundle URL comes from the
configuration at runtime, and the application's own bundler would try to resolve
an `import()` at build time. A module script sidesteps that — but its `load`
event fires even when the module throws while evaluating, so the manager waits on
`customElements.whenDefined()` with a timeout instead. That is the only signal
that actually means "the plug-in is usable".

**Isolation had to be explicit.** Each plug-in is loaded in its own `try`/`catch`
and recorded as `loading`, `ready` or `failed`. A plug-in that 404s, throws, or
never defines its element is skipped and the application starts without it
(NFR 10). This is covered by tests, including "a working plug-in survives a
broken sibling". The failure also has to be _visible_: an organizer who enabled
the forum and does not see it is shown why on the modules page, rather than
concluding the product is broken.

## Decisions taken here

- **A fifth shared library.** `docs/BOOTSTRAP.md` lists four shared client
  libraries. The plug-in manager and its mount-point component fit none of them,
  so `libs/shared-plugins` was added.
- **The socket.io client lives in `shared-http`.** From a client's point of view
  HTTP and WebSocket are one concern: how it talks to its server.
- **Mount points stay a closed set.** `navigation` and `event-detail`, as the
  thesis specifies. Adding a third is a versioned change to the plug-in
  contract, not an ad-hoc extension.

## Open items

- Plug-in bundles are loaded from the same origin. A third-party plug-in would
  run with full access to the page, so plug-in review stays a human step — worth
  restating in the plug-in developer documentation (phase 5).
- Angular Elements does not project inputs typed as objects through attributes,
  only through properties. The mount-point component therefore assigns
  properties, which a non-Angular plug-in reads the same way. Worth stating
  explicitly in the plug-in SDK documentation.
