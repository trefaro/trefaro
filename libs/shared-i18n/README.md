# shared-i18n

The language of both clients: the catalogues this image ships, and the Angular
plumbing that fetches and switches them.

## What is here

- `catalogues/en.json`, `catalogues/de.json` — the **shipped** catalogues. Flat
  JSON, dotted keys, one string per key. English is the key list (E23): a key
  that is not in `en.json` does not exist.
- `src/lib/` — the client side: the Transloco loader that reads
  `GET /api/i18n/:locale`, the service that owns the active language, and the
  switcher both shells embed.

## Why the catalogues are not imported anywhere

"New languages must be maintainable by the organization" (chapter 4) rules out
compile-time i18n, and JSON inside a client image just as much — that is changed
only by rebuilding. So the server answers `GET /api/i18n/:locale` with the
shipped catalogue of that locale, overlaid with the instance's own changes from
`translation_override` (E22), and the clients never read these files.

The server does not import them either: it reads them from disk at runtime, out
of the directory `I18N_CATALOGUE_DIR` names. `apps/server` depends on
`@trefaro/shared-models` and nothing else shared — a TypeScript import of client
text would raise the question of whether client text is a contract layer, and a
copied file does not.

That leaves this library's own tests as the only readers, and that is the point:
`catalogues.spec.ts` is where E23 is enforced.

## Adding a key

1. Add it to `en.json`. That is what makes it exist.
2. Add it to `de.json`. `catalogues.spec.ts` fails while it is missing — a
   shipped language is complete by definition; an organization's own language
   may be partial and is measured (AP 7).
3. Use it. `{{ 'some.key' | transloco }}` in a template, `translateSignal` or
   `TranslationService.translate()` in a class.

Keys follow one convention, checked by `isTranslationKey` in
`@trefaro/shared-models`: dot-separated `lowerCamelCase` segments, general to
specific — `modules.mediaLinks.title`, `plugins.roomPlanning.label`.
