# QR code check-in plug-in (FR 3.16, P3)

A code somebody brings from their inbox, read at a door with a camera — or
typed in, because a door may not depend on a camera driver (F199).

Built in **AP 7 of phase 4** (the server, here) and **AP 8** (the two screens,
in `apps/plugins/qr-checkin`). The bundle draws at two hook points: the ticket
at `my-registration`, the hook point this plug-in brought with it (E54, F198),
and the door at `event-dashboard`.

## Shape

`api/` (three controllers, one per access level), `business/` (service, its
repository port, and the code generator), `data-access/` (one entity, one
repository, one migration), one `ServerPlugin` descriptor and
`enabledByDefault: false` — a door with a scanner at it is a decision about how
an event is run, not a default.

It owns exactly one table, `plugin_qr_checkin_ticket`, and touches no core
table (F21). The registration is its primary key: one registration, one code,
one state. A surrogate id would allow two tickets for one person at one door
and no way to say which is current.

**Three controllers is one more than any other plug-in of this phase**, and
that is what makes this one worth reading as an example of E57: a plug-in's
access level comes from the path it declares, and this plug-in genuinely has
three audiences — a stranger holding a signed link, a logged-in participant,
and an organizer at the door.

| Path                                     | Who                    | Authorized by           |
| ---------------------------------------- | ---------------------- | ----------------------- |
| `user/plugins/qr-checkin/ticket`         | whoever holds the link | the signed token (E11)  |
| `participant/plugins/qr-checkin/tickets` | the account            | the session (F148)      |
| `admin/plugins/qr-checkin/…`             | the organization       | the admin session (E16) |

## What it uses of plug-in API 1.2.0

| Needed                                    | Reached through                                      |
| ----------------------------------------- | ---------------------------------------------------- |
| The registration a mailed link speaks for | `PluginRegistrationReads.resolveClaim` (link)        |
| Every registration of an account          | `PluginRegistrationReads.resolveClaim` (account)     |
| Who is expected at one event              | `PluginRegistrationReads.findForEvent`               |
| The name behind a scanned code            | `PluginRegistrationReads.findRegistration`           |
| Who is asking                             | `CurrentPluginParticipant`, `CurrentPluginOrganizer` |
| The window of a paginated list            | `pageWindow`, re-exported by the contract (F138)     |

`PluginRegistrationReads` is the port AP 7 adds, and it is the whole of what
this plug-in knows about registrations: a claim, one event's list, and an id it
already stored. It hands over first and last name, the event, and the moment of
the double opt-in — **never an address** (F55) and never the answers to a
registration form (F12).

## Decisions that are not obvious from the code

- **The code is the plug-in's own, never the self-service token** (E53). That
  token can cancel a registration (F44, F148); a QR code is photographed, held
  up at a door and mirrored on screens. This one is opaque, random, and proves
  only that the registration exists. It is **stored**, which is no contradiction
  of F23 — there the subject is the record of a consent, here it is an
  admission ticket, and a derived code would die with a rotated `AUTH_SECRET`
  while people are standing at the door with it.
- **Crockford's base32**, so the half of FR 3.16 without a camera works: no
  `I`, no `L`, no `O`, no `U`, and 26 characters is 130 bits.
- **A code is created on first read**, and "first read" is as true of the
  admission list as it is of a ticket page: the button beside a row has to send
  the same code the camera would read (F199), so a row without one would be a
  row the door cannot use. Issuing is `INSERT … ON CONFLICT DO NOTHING`, so two
  tabs get one code and the loser of the race is not an error.
- **A second scan is a 200, not a 409** (E53). It answers with the **first**
  instant and says `alreadyCheckedIn` — "already here, since 09:12" is the
  sentence somebody at a door needs, and an error would send them looking for a
  fault that is not there. The write is conditional (`WHERE checked_in_at IS
NULL`) and reports whether it touched a row, so two phones scanning at once
  cannot both be told they were first.
- **An unconfirmed registration has no ticket**, and neither does a cancelled
  one. The rule is in the host adapter's statements (F152), so this plug-in has
  no way to ask for anything else — and a ticket that was already issued stops
  resolving the moment its registration is cancelled, which is how a door
  closes behind somebody who gave their place up.
- **The scan is a `POST` with the code in the body.** It changes something, and
  a code in a URL ends up in a log and in a browser's history — on a shared
  screen at a door.
- **Every failure of the ticket route is the same 404**: forged, expired,
  deleted, never confirmed. The difference is not the holder's to learn, and it
  does not change what they can do about it — the reading `SelfServiceService`
  has given its one message since phase 1.
- **An unknown code is a 404 that says nothing about registrations.** Whoever
  holds it learns that it does not open this door, and nothing about who is
  expected behind it.
- **No `requires`** (E47). Three of the five curated plug-ins need `profiles`
  because they attribute something to a person; a check-in reads a
  registration, and the whole point of E11 is that somebody who never made an
  account still reaches their own page.
- **No `summary` route, and AP 8 did not add one.** The counts above a section
  are built when a section reads them (E21) — and the admission list already
  carries every row's state, so a second route would have been a second answer
  to a question one read answers.
- **The tile carries no number.** For the same reason: the list is the
  section's, and a count on a tile would be a second read of the same table
  (E59, F193).

## The two screens (AP 8)

The bundle is `apps/plugins/qr-checkin`, one custom element
(`trefaro-plugin-qr-checkin`) told which half to draw by the `mountPoint` the
slot hands over (F202). Its default is the **ticket**: a host older than
plug-in API 1.2.0 names no hook point, and of these two halves the one that
must never appear by accident is the door.

- **The ticket** renders the code as an SVG in the browser, black on white —
  the one component of this application that does not follow the instance's
  colours, because a tinted code is one a scanner argues with. The characters
  are printed underneath in groups of four, and the groups are separate
  elements with a margin rather than spaces: the text of that line is exactly
  the code, so whoever copies it copies something the door accepts.
- **The door** has three ways to the same route (F199): the camera where the
  browser offers one, the field beside it, and a button in every row. The
  decoder (`jsqr`, Apache-2.0, no dependencies) is loaded when the camera is
  switched on — it is a third of the bundle's weight, and the ticket half
  draws codes rather than reading them.
- **Two libraries, both in the bundle and neither from a network** (NFR 9):
  `qrcode` (MIT) draws, `jsqr` (Apache-2.0) reads. Both licences are compatible
  with AGPL-3.0-or-later, which was one of the two criteria the plan set; the
  other was that they ship here rather than being fetched.
