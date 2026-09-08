# Room planning plug-in (FR 3.11, FR 3.6, F14)

Rooms of an event's venue with their seats, the sessions in them, and two
warnings the plan computes when it is read — more sign-ups than chairs, two
sessions at the same time in one room. **The plan shows; it refuses nothing**
(E50).

The reference implementation of the plug-in contract: phase 0 created it as
the spike, AP 9 of phase 1 gave it the link between a session and a room (F21)
and the read port for the sign-ups (E12, F45), AP 1 of phase 4 its words from
the catalogue (E48), and **AP 6 of phase 4 made it real** — the server here, the
web component in `apps/plugins/room-planning`. **One bundle, two audiences**:
the plan a participant reads at `event-detail`, the editor an organizer works
in at `event-dashboard`, told apart by the `mountPoint` the slot hands over
(F202).

## Shape

`api/` (two controllers, one per access level), `business/` (service plus its
two repository ports), `data-access/` (two entities, two repositories, two
migrations), one `ServerPlugin` descriptor and `enabledByDefault: false` — a
room plan only makes sense for events on site.

It owns exactly two tables, `plugin_room_planning_room` and
`plugin_room_planning_program_item_room`, and touches no core table (F21). The
join table is what the schema draft's `program_item.room_id` became: the link
lives on the plug-in's side, so a programme knows nothing about rooms and
switching the plug-in on later adds a table instead of migrating a column.

## What it uses of plug-in API 1.2.0

| Needed                                  | Reached through                                            |
| --------------------------------------- | ---------------------------------------------------------- |
| When a session runs, and its own limit  | `PluginProgramReads.findItem` (1.1.0)                      |
| How many signed up — never who          | `PluginProgramReads.countSignups`, one query for all (F45) |
| Every session of an event, with a title | `PluginProgramReads.listForEvent(eventId, locale?)` (E56)  |
| The reading of `?locale=`               | `LocaleQueryPipe`, `ApiLocaleQuery`, re-exported (F94)     |
| Which screen is being drawn             | `PluginSlotContext.mountPoint` (client side, F202)         |
| Its words and its language              | `PluginSlotContext.strings` and `locale` (E48)             |

The third row is the one this plug-in added to the contract: an editor that
fills a room has to list the event's sessions, and a plan that names its slots
needs a title — neither can be had by id alone. E56 had reserved the addition
for the personal programme (AP 9); the room plan turned out to need it first.
The `locale` on `findItem` that E56 also names is still AP 9's.

## Decisions that are not obvious from the code

- **Both warnings are computed on read and stored nowhere** (E50). Overbooked
  means more sign-ups than the chairs of **every** room a session uses, added
  up — a plenary that spreads into a second room is not overbooked in either.
  Double-booked means another session in the same room whose time overlaps;
  two that merely touch (one ends the minute the other begins) do not. A room
  carries each warning once, whichever of its sessions carry it.
- **Nothing is refused because of a warning.** `PUT …/program-items/:id/rooms/:id`
  has two rules — the session exists, and it belongs to the room's event — and
  no third. F41's precedent: a tool that refuses a room gets a second room
  named "Saal A (2)", and then the truth is no longer in the plan. Whether an
  organizer wants a hard limit is the pilot partner's question (`todo.md`).
- **The participant's plan is public** (E58, FR 3.6) — the reasoned
  counter-example to the proposals and the forum (F192): a room name is not a
  person. It carries **no number about people**: no sign-up counts and no
  warnings. Titles come translated for `?locale=` and original without it,
  with the core's field-by-field fallback (F95).
- **Whether an event is published is not checked.** The contract publishes no
  port for an event's state, and inventing the rule inside a plug-in would be a
  product decision taken in the wrong place. What a visitor who guesses an id
  learns is a list of room names.
- **`GET events/:id/schedule` carries every session of the event**, placed or
  not, so the editor can offer the ones without a room — one request for the
  screen (F49). `GET rooms/:id/schedule` from phase 1 stays, and is now a slice
  of that plan, so a session in two rooms is judged against both.
- **Deleting a room takes its assignments, not its sessions** — the cascade on
  the join table's `room_id` (F21). A room that is gone is a room, not a
  programme. A second `DELETE` is a 404, like a session's.
- **The host module publishes ports and imports no feature module.** The first
  attempt at `listForEvent` reached `ProgramService` for its translation
  fallback, and `PluginHostModule → ProgramModule → EventsModule → PushModule`
  closed a cycle the server did not boot through. The adapter reads the
  translation port itself and applies the one-line fallback a second time
  (F138).
