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

- **Who owns `program_item.room_id`?** The requirements document has the core
  `program_item` table referencing a room, while the architecture rules forbid a
  plug-in from touching core tables. Both cannot hold. The options are a
  plug-in-owned join table, or an unconstrained `room_id` column in the core
  table that only the plug-in interprets. **This needs a decision before phase 1
  designs the programme schema.**
- The overbooking check (FR 3.10 against room capacity) needs programme item
  sign-ups, which arrive in phase 1. The capacity it will read is already stored.
- `apps/server/src/plugins/{forum,program-proposals,qr-checkin}` hold only a
  README. They are deliberately not registered as no-op plug-ins — an empty
  plug-in offered in the administration would be a lie.
