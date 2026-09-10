# Personal programme plug-in (FR 3.17, P3)

What one person means to attend, ticked on the programme of an event — and
**nothing reserved by ticking it** (E55).

Built in **AP 9 of phase 4**, server and bundle in one package: this is the
smallest of the five plug-ins, and splitting it would have produced a route
nobody called for the length of a package. The bundle is
`apps/plugins/personal-program`, mounted at `event-detail` and nowhere else.

## Shape

`api/` (one controller), `business/` (service and its repository port),
`data-access/` (one entity, one repository, one migration), one `ServerPlugin`
descriptor and `enabledByDefault: false` — a personal plan is a decision about
how an event is read, not a default.

It owns exactly one table, `plugin_personal_program_entry`, and touches no core
table (F21). The pair `(user_id, program_item_id)` is the primary key: a
selection exists or it does not.

**One controller and one audience**, where the check-in has three. There is no
organizer's half, and that is a decision rather than an omission: who _means_ to
attend what is not an attendance list, and turning a plan into one would be a
product decision taken inside a plug-in. Who holds a seat is the programme's
answer (FR 3.10); who came through the door is the check-in's.

| Path                                         | Who         | Authorized by     |
| -------------------------------------------- | ----------- | ----------------- |
| `participant/plugins/personal-program/plan`  | the account | the session (E33) |
| `participant/plugins/personal-program/items` | the account | the session (E33) |

## What it uses of plug-in API 1.2.0

| Needed                               | Reached through                                |
| ------------------------------------ | ---------------------------------------------- |
| Every session of one event, in order | `PluginProgramReads.listForEvent(eventId, …)`  |
| The titles in the reader's language  | the same call's `locale` (E56, F95)            |
| Whether a session books seats        | `PluginProgramItem.registrationEnabled` (AP 9) |
| That a session exists at all         | `PluginProgramReads.findItem`                  |
| Who is asking                        | `CurrentPluginParticipant`                     |
| The reading of `?locale=`            | `LocaleQueryPipe`, `ApiLocaleQuery` (F94)      |

`countSignups` is on the same port and this plug-in never calls it. How full a
session is belongs to the programme itself and to the organizer's room plan
(E50); a personal plan that showed it would be a second occupancy screen, and
the first one is already public.

## Decisions that are not obvious from the code

- **A selection is not a sign-up** (E55, F201). Nothing here reserves anything,
  compares anything against a capacity or refuses because a session is full —
  there is no capacity in this plug-in's table to compare against. Two people
  may have the same one-seat workshop in their plans, and both are right: the
  seat is taken in the event's programme, by FR 3.10.
- **Which is why `registrationEnabled` travels.** Without it, "in my plan ✓" on
  a workshop with twenty seats reads like a booking — exactly the confusion E55
  exists to prevent. `capacity` alone could not carry the mark: a session may
  ask who is coming without limiting how many (F42), and such a session would
  look like one that asks nothing. This is the one thing AP 9 added to the
  contract that the plan's table did not name.
- **The whole programme travels, not the selection.** A plan one can only read
  is a plan one cannot change: the screen that ticks a session is the screen
  that shows the ones not yet ticked, and one request draws it (F49).
- **`PUT` and `DELETE` on the session's own address, both 204.** They state a
  fact rather than adding to a collection, so doing either twice is the same
  answer as doing it once — and a retry after a lost connection does not look
  like a mistake. There is no request body anywhere in this plug-in: the address
  is the whole request.
- **Taking a session out is not a 404 when it was never in.** The caller asked
  for a state, and that state is what they get. `add` is the asymmetric one: a
  session that does not exist is a 404, from the check _and_ from the foreign
  key, because the check alone cannot close the race with a deletion.
- **An unknown event is an empty list, not a 404.** The contract publishes no
  port for an event's existence, and inventing the answer inside a plug-in would
  be a claim about something it cannot see. What somebody who guesses an id
  learns is that there is nothing there.
- **`requires: ['profiles']`** (E47). A plan belongs to an account.
- **No `summary` route and no dashboard tile.** Both would need an organizer's
  half, and there is none — see above.
