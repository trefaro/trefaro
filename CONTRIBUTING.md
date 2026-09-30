# Contributing to Trefaro

Thank you for looking. This file says what this project accepts today, what it
will accept after v1.0, and what it expects of code either way. It is written in
English, like the [`README`](README.md) and
[`docs/INSTALL.md`](docs/INSTALL.md), because it is addressed outwards. The rest
of the documentation under `docs/` is German: it belongs to the master's thesis
this application was derived from.

## Before v1.0: issues yes, pull requests no

**Pull requests are not merged until v1.0 is tagged.** If you open one it will
be read and answered, and then asked to wait — so please open an issue first and
save yourself the work.

That is not indifference. Three things make a patch expensive to accept right
now:

- The **plug-in contract is closing.** `PLUGIN_API_VERSION` reached `1.3.0` and
  is frozen for v1.0; a change to it now would break the five curated plug-ins
  and the SDK guide in the same commit.
- The **curated set is closed** at five plug-ins, and the criteria for taking in
  a sixth are deliberately unwritten until somebody is actually asking (see
  below).
- There is **one maintainer.** A review is a promise about time, and a project
  that collects pull requests it cannot review has not opened up — it has built
  a queue.

**What helps right now, very much:**

- **Bug reports.** Especially from an instance you actually run. The state of a
  deployment is the one thing no test suite in this repository can see.
- **Installation trouble.** If [`docs/INSTALL.md`](docs/INSTALL.md) left you
  stuck, that is a defect in the document. Say where.
- **Questions that the documentation should have answered.** They become
  documentation.
- **Translations**, as an issue with the file attached — the language files are
  data an instance serves, not strings compiled into a client, so a translation
  never needs a release to reach anybody. See §9 of `docs/INSTALL.md`.
- **Telling us you are running it.** The requirements of this application came
  out of interviews with one kind of organization. A second kind is worth more
  than a patch.

Open an issue at
[github.com/trefaro/trefaro/issues](https://github.com/trefaro/trefaro/issues).

## Security problems do not go in an issue

If you have found something that could expose the data of an instance —
authentication, uploads, plug-in isolation, the reverse proxy — use GitHub's
**private vulnerability reporting** on this repository ("Security" →
"Report a vulnerability"). It reaches the maintainer without publishing
anything.

Please include what you did, what happened, and what you expected; a working
exploit is not needed and is not wanted in the report.

This matters more here than the size of the project suggests. Trefaro is built
for organizations whose participant lists are sensitive — that is the reason
there is no multi-tenancy, no analytics and no third-party CDN in it.

## After v1.0

The gate opens. The rules below are what a contribution will be measured
against, and they are already true of every line in the repository, so nothing
about them will be a surprise later.

### Licence and sign-off

Trefaro is **AGPL-3.0-or-later**. A contribution is licensed under the same
terms; you keep your copyright.

There is **no CLA**. Instead, every commit carries a **Developer Certificate of
Origin** sign-off:

```bash
git commit -s -m "fix: the participant overview loses its email column at 768px"
```

which appends

```
Signed-off-by: Your Name <you@example.org>
```

That line means what [developercertificate.org](https://developercertificate.org)
says it means: you wrote it, or you have the right to submit it, and you are
fine with it being distributed under this project's licence. No account, no
paperwork, no assignment of rights — and deliberately nothing that would let
this project be relicensed out from under the people who contributed to it.

### Who reviews

**Marius Schulze**, alone, as the sole maintainer. That is a statement of fact
rather than a preference: a second maintainer is wanted, and after v1.0 the
fastest way to become one is to be the person who keeps showing up in the
issues.

### What a contribution has to bring

|                          |                                                                                                                                                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Commit messages**      | [Conventional Commits](https://www.conventionalcommits.org): `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`. The subject says what changed for somebody using it, not which files moved.                                                                  |
| **Tests**                | A unit test with every feature and every bug fix; Playwright for anything with a screen. A fix without a test that fails before it is a fix nobody can keep.                                                                                                        |
| **Layers**               | The server is strictly layered and the **linter says so**: business code may not import `typeorm`, `@nestjs/typeorm` or `pg`, and may not reach into `data-access/`. If you hit that rule, introduce a port — never relax the rule.                                 |
| **The plug-in contract** | Changes to `PLUGIN_API_VERSION` and the interfaces behind it only with a version step, and only with a reason that could not be met inside the existing contract.                                                                                                   |
| **Language**             | Code, identifiers, comments and commit messages in **English**. Documentation under `docs/` in **German**; `README.md`, `CONTRIBUTING.md` and `docs/INSTALL.md` in English.                                                                                         |
| **Words on screen**      | Every new or changed screen ships its catalogue keys in **both** English and German. A hard-coded sentence in a template is a sentence an organization cannot correct.                                                                                              |
| **Migrations**           | One migration per package, timestamped; a plug-in's migration must be stamped **after** every core migration it depends on. Migrations are never edited after they have run somewhere.                                                                              |
| **Dependencies**         | A new one needs a reason, a compatible licence (nothing that conflicts with AGPL-3.0-or-later), and it must survive the question "what breaks if this is unmaintained in two years". No Google-hosted fonts, no analytics, no map service other than OpenStreetMap. |

Before you touch an area, read its rules file. **`docs/rules/` is the
distillate: what is written there has already gone wrong once.** Thirteen files,
one per area, indexed in [`docs/rules/README.md`](docs/rules/README.md).

For how the whole thing is cut and why, [`docs/arc42/`](docs/arc42/README.md) is
the entry point — twelve sections, and it refers rather than repeats.

### Running it

```bash
npm ci
cp .env.example .env
docker compose -f infra/docker-compose.dev.yml up -d   # PostgreSQL + Mailpit
npx nx run-many -t build -p 'plugin-*'                 # the plug-in bundles
npx nx run server:serve                                # http://localhost:3000/api
npx nx run user-client:serve                           # http://localhost:4200
npx nx run admin-client:serve                          # http://localhost:4300
```

Before you push anything:

```bash
npx nx run-many -t lint test build
npx nx format:check
```

A change to the **server** does not invalidate the Nx cache of the browser
suites, so run those with `--skip-nx-cache` or you will be reading yesterday's
result.

And the standing rule of this repository, which applies to a contributor exactly
as it applies to the maintainer: **anyone who wants to say "green" has brought
the stack up.** What only happens in a production build or only in a container
is invisible to every test suite here.

## Writing a plug-in

You do not need permission, and you do not need this repository.

A plug-in is a NestJS dynamic module plus a web component bundle, built against
a documented contract. The guide is
[`docs/arc42/08-querschnittliche-konzepte.md`](docs/arc42/08-querschnittliche-konzepte.md)
— section 8 — and it is written so that a plug-in can be built from it without
reading any of the five that ship in the image. It also names, first and
plainly, the thing you have to know before you distribute one: **a bundle is
loaded same-origin and runs with full access to the page**, which is why v1
installs nothing at runtime and why reviewing a plug-in is a human step.

Your plug-in lives in **your** repository, under whatever licence its
dependencies allow. An operator adds it to their image.

**How a plug-in joins the curated set that ships with Trefaro: not before
v1.0.** The five are the set for v1.0, the contract they are built against is
frozen, and writing an admissions process for a queue that is empty would be
inventing a procedure instead of answering a request. When there is a plug-in
asking to come in, the criteria get written with it in hand — and that
conversation starts as an issue.

## How to behave here

Assume the other person is doing their best with less time than they need. Say
what you mean, say what you tried, and keep it about the work.

Harassment, or any behaviour that makes contributing feel unsafe, gets you
removed from the project's spaces. There is no committee; the maintainer
decides, and will say why.
