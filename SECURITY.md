# Security Policy

Trefaro is built for organizations whose participant lists are sensitive —
activists, campaigners, people whose attendance at an event is not something
they want published. That is why there is no multi-tenancy, no analytics and no
third-party CDN in it, and it is why a report about this application matters
more than the size of the project suggests.

## Reporting a vulnerability

Use **GitHub's private vulnerability reporting** on this repository:
_Security_ → _Report a vulnerability_. It reaches the maintainer without
publishing anything, and it needs no address in a public file.

**Please do not open a public issue for a security problem**, and please do not
post one in a discussion or a pull request.

Helpful in a report: what you did, what happened, and what you expected. A
working exploit is neither needed nor wanted — a description of the path is
enough to reproduce it, and an exploit in a report is a thing that has to be
stored somewhere.

**What to expect.** There is one maintainer, so there is no response-time
guarantee and it would be dishonest to print one. You will get an
acknowledgement when the report is read, a say in when it becomes public, and
credit in the advisory unless you ask otherwise. There is no bug bounty.

## Supported versions

| Version                | Supported                                   |
| ---------------------- | ------------------------------------------- |
| `main`                 | ✅ Yes — this is the only supported version |
| Anything before `main` | ❌ No                                       |

v1.0 has not been tagged yet, so there are no releases to fix a hole in: the
current `main` is the whole supported surface. Once v1.0 exists, the latest
tagged release takes that place, and this table says so instead.

## What counts as a vulnerability here

Anything that lets somebody reach data or actions an instance does not mean to
give them. Concretely, the areas this project already treats as security
surface:

- **Authentication and sessions** — the organizer login, the participant login,
  the WebSocket handshake, and the signed links. There are six kinds of those,
  and each carries its purpose inside the signature so that one can never be
  replayed as another: confirming a registration, speaking for a registration
  without an account, opting out of invitations, confirming an account,
  confirming a newsletter sign-up, and setting a forgotten password.
- **Uploads** — the registration form's file fields, profile pictures, chat
  pictures, branding and logos: what is accepted, where it is stored, and who
  can read it back.
- **Plug-in isolation** — a plug-in owns its own tables and reads core data only
  through a narrow, versioned port. Anything that lets a plug-in reach past that
  is a finding, even in a plug-in shipped with the image.
- **The reverse proxy and the response headers** — the content security policy,
  what a page is allowed to load, and what the proxy forwards.
- **Anything that puts a participant's address, name or attendance where it does
  not belong** — including a log line. Operational logs in this application are
  deliberately free of personal data.

What is **not** a vulnerability in this repository, although it may well be a
problem in an installation: a missing TLS certificate, an open SMTP relay, a
database port published to the internet, or a weak administrator password. Those
are the operator's, and [`docs/INSTALL.md`](docs/INSTALL.md) says what the
operator has to do. A report about them is still welcome — it usually means the
installation guide is not clear enough, which _is_ this project's problem.

## If you run an instance

Every organization runs its own copy, so a fix in this repository reaches nobody
until an operator pulls a new image and restarts the stack. Two consequences:

- **Watch this repository for releases** if you run Trefaro in production. There
  is no auto-update and there is deliberately no phone-home.
- When a hole is fixed, the advisory will say what an operator has to do beyond
  updating — whether sessions have to be invalidated, whether a secret has to be
  rotated, whether anything in the data needs looking at.

## What has already been looked at

A security review of the four areas above was carried out and written down:
[`docs/SECURITY-REVIEW.md`](docs/SECURITY-REVIEW.md) — twenty-six points, every
one carrying a decision, including the ones that turned out to be no finding. It
is in German, like the rest of `docs/`; the summary table near the end is
readable without much of it.

That review is not a guarantee. It is one pair of eyes, reading on purpose, once.
That is exactly why this file exists.
