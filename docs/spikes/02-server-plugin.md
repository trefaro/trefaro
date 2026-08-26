# Spike 2 — Server plug-in as a NestJS dynamic module

**Question.** Can a server plug-in deliver all three of its parts — API,
business logic, data access — against defined interfaces, bring its own entity
and migration without touching core tables, and be switched on and off through
configuration at runtime?

**Verdict: works,** and verified against a running instance.

## What was built

| Piece                       | Where                                                 |
| --------------------------- | ----------------------------------------------------- |
| Plug-in contract            | `apps/server/src/app/business/plugin-api/`            |
| Plug-in manager             | `apps/server/src/app/business/plugin-manager/`        |
| Data access plug-in manager | `apps/server/src/app/data-access/plugin-data-access/` |
| Reference plug-in           | `apps/server/src/plugins/room-planning/`              |
| Curated list                | `apps/server/src/plugins/index.ts`                    |

The reference plug-in mirrors the server's layering internally — `api/`,
`business/` with its own port, `data-access/` with its own entity, migration and
repository — so phase 4 plug-ins have a shape to copy.

## Verified behaviour

`node tools/spike-verification/verify-plugin-toggle.mjs`, against a running
server and a real PostgreSQL:

```
PASS  the plug-in becomes live without restarting the server — after 7s
PASS  the configuration now announces the plug-in to the clients
PASS  the descriptor names the custom element — trefaro-plugin-room-planning
PASS  the descriptor points at the bundle the server serves
PASS  enabling a plug-in does not add it to the core module list
PASS  listing rooms is 200 once enabled
PASS  a room is created
PASS  a duplicate room name is rejected regardless of case
PASS  a room without seats is rejected
PASS  the plug-in disappears from the configuration again
PASS  its API answers 404 again
PASS  disabling a plug-in keeps the organization's data — 1 row(s)
```

Database state after boot, showing the two migration streams and the plug-in's
own table:

```
tables:      app_config  migrations  module_config
             plugin_room_planning_room  push_subscription
migrations:  InitialCoreSchema1787702400000
             CreateRoomPlanningSchema1787702500000
```

## Findings

**"Runtime activation" needed a decision, not just a flag.** NestJS builds its
module graph at bootstrap; modules cannot be added later. So every curated
plug-in is mounted at boot and its tables always exist, and the `module_config`
flag decides two things instead: whether its API answers, and whether the
clients are told about it. Enabling a forum is then a configuration change, not a
container restart — which is what F6 promised.

**Caching the flag broke the promise, quietly.** The first implementation read
the enabled set once at bootstrap. Everything passed, because the tests set the
flag before boot. The live check failed: flipping the row changed nothing.
Reading the database in the guard on every plug-in request is the wrong fix, so
the registry now re-reads the flags every 15 seconds — and phase 2's admin
endpoint will call `refresh()` directly so its own change is instant. The
periodic refresh also means a flag changed directly in the database, before any
admin UI exists, still takes effect.

**A disabled plug-in answers 404, not 403.** It should look absent rather than
forbidden: that reveals less about the instance, and it matches what a client
sees, since a disabled plug-in is missing from `/api/config` entirely.

**Strict layering forced an honest compromise on entities.** A plug-in genuinely
owns database artifacts, but the business layer must not know the ORM. The
descriptor therefore types its persistence contribution as `readonly unknown[]`
and only forwards it; `data-access/plugin-data-access/` is the single place that
casts to ORM types. The rule is enforced by the linter, not by convention — four
deliberately planted violations were used to confirm the rules actually fire:

- `business/**` importing `typeorm`, `@nestjs/typeorm` or `pg`,
- `business/**` importing anything under `data-access/`,
- `data-access/**` importing a business _service_ rather than a port,
- a plug-in's own `business/**` importing the ORM.

**The bundler does not see TypeORM's driver.** TypeORM loads `pg` through a
dynamic `require`, so it was missing from the dependency list the server build
generates for the container image, and the container would have failed on its
first connection. The driver is now passed explicitly as `driver: pg`, which
makes it a static import. This is the kind of defect that only a container build
surfaces.

**Migrations run on boot.** For an audience installing with one
`docker compose up` (NFR 15), a separate migration step is a step too many. The
data source runs them at startup with `migrationsTransactionMode: 'each'`, and
`synchronize` is refused outright in production, so migrations stay the only
authority over the schema.

## Decisions taken here

- **`module_config.module_key` is the primary key.** The schema draft in the
  requirements document lists a separate `id`; the key is unique anyway, so a
  surrogate would only add a second thing to keep consistent.
- **Plug-in tables are prefixed `plugin_<key>_`.** Ownership is then obvious in
  `psql`, which matters when an organization's own admin looks at the database.
- **Disabling never drops data.** Only `down` removes a plug-in's tables.
  Switching a forum off for a season must not throw away its posts.
- **Curated plug-ins are registered in a list, not discovered.** An accidental
  directory does not become a mounted plug-in.
- **Plug-ins default to off.** An instance offers what the organization asked
  for (NFR 1).

## Open items

Tracked in [`todo.md`](../../todo.md), which records the phase that makes each of
them checkable.

### Who owns the link between a programme item and a room? — decided

**Decision (26.08.2026): option A, the plug-in-owned join table.** Recorded as
F21 in `Anforderungsanalyse_und_Umsetzungsplan.md`, whose §5.3 schema draft has
been corrected accordingly. The table is named `program_item_room` there; the
plug-in creates it as `plugin_room_planning_program_item_room`, following the
`plugin_<key>_` prefix every plug-in table carries. Nothing is implemented yet —
that is phase 1 work.

The question, for the record: §5.3 originally gave the core `program_item` table
a `room_id` referencing the room planning plug-in's `room` table, while
architecture rule 2 says a plug-in never touches core tables. Both could not be
true, and the answer changes the core migration — so it had to be settled before
phase 1 designed the programme schema.

**Option A — a join table owned by the plug-in.**
`plugin_room_planning_program_item_room (program_item_id, room_id)`, with the
plug-in declaring a foreign key to each side. The core schema says nothing about
rooms.

**Option B — an unconstrained `room_id` column in the core table.** As the schema
draft has it: a nullable `uuid` on `program_item` that the core stores but never
interprets, and only the plug-in gives meaning to.

**Option C — a generic `plugin_data JSONB` column on `program_item`.** An
extension point for any plug-in, not just this one.

**Why option A won.**

- It keeps rule 2 literally true, which is what makes the whole plug-in claim
  credible. Option B puts a column in the core that exactly one plug-in
  understands, and every later plug-in will cite it to ask for its own.
- **Referential integrity is the thesis' stated reason for choosing a relational
  database** — every series → event → programme item → registration link is
  meant to be secured by the schema. Option B's column would be an
  unconstrained `uuid`: integrity dropped precisely where the argument was made.
- **The plug-in stays removable.** Disable or drop it and the core schema is
  untouched. Under option B the column survives forever in every instance that
  never enabled room planning.
- A join table also expresses cardinalities the column cannot: one room across
  many programme items today, and a session spanning two rooms later, without
  another core migration.
- Option C trades one leak for a worse one: JSONB on a core table gives up
  integrity _and_ queryability, and it is a much larger commitment than this
  single relationship justifies.

Three consequences to accept deliberately:

1. **The plug-in's table gets a foreign key to `program_item(id)`, with
   `ON DELETE CASCADE`.** That is the plug-in declaring a constraint on _its own_
   table — it alters nothing in the core — and it means deleting a programme item
   cleans up its room assignment for free. It does make the dependency explicit
   and real, which it is: room planning is meaningless without programme items.
2. **A plug-in migration must be timestamped after any core migration it depends
   on.** Both migration streams are ordered together by timestamp, so this is a
   rule for the plug-in contract, not something the code can infer.
3. **The core programme view cannot show a room without asking the plug-in.**
   That is the correct behaviour rather than a cost: with the plug-in off, there
   is no room to show.

The overbooking check needs the same treatment in reverse. It compares sign-ups
per programme item (core, FR 3.10) against room capacity (plug-in), so the
plug-in has to _read_ core data — and it must not query `program_item_signup`
directly. That calls for a read capability in `business/plugin-api`, which is a
versioned addition to the contract and belongs in phase 1, alongside the sign-ups
themselves.

### Remaining

- The overbooking check (FR 3.10 against room capacity) needs programme item
  sign-ups, which arrive in phase 1. The capacity it will read is already stored.
- **`plugin_room_planning_room.event_id` carries no foreign key yet.** The core
  `event` table does not exist, so the column is a bare `uuid` — which is the
  same integrity gap that decided F21 against a core `room_id` column, only on
  the plug-in's side of the line. The constraint is added by a plug-in migration
  in phase 1, timestamped after the core migration that creates `event`. Until
  then a room can reference an event that never existed.
- `apps/server/src/plugins/{forum,program-proposals,qr-checkin}` hold only a
  README. They are deliberately not registered as no-op plug-ins — an empty
  plug-in offered in the administration would be a lie.
