# Demo seed

Fills an instance with data worth looking at: two published series and a draft
one, five events, a registration form with all four field types, forty
registrations in all three states, a programme with parallel sessions of which
one is full, media links, a real file attachment, and one invitation that was
genuinely sent.

Since AP 13 of phase 2 it also gives the instance a **brand and a second
language**: a name, two colours, a font, a logo and a square app icon, and the
English translation of part of the German content. Both were added for the same
reason the rest of the data exists — a whitelabel application demonstrated under
the product's own name and in one language demonstrates the opposite of what it
is for.

For demonstrating and for looking at a feature by hand. **Not** test data — the
suites in `apps/*-e2e` seed their own fixtures and tear them down; this is for a
human.

```bash
# against the container stack (infra/docker-compose.yml, port 8080)
ADMIN_BOOTSTRAP_EMAIL=… ADMIN_BOOTSTRAP_PASSWORD=… node tools/demo-seed/seed.mjs

# against a development server (nx run server:serve)
node tools/demo-seed/seed.mjs --base http://localhost:3000

# replace data from an earlier run
node tools/demo-seed/seed.mjs --reset
```

| Option / variable                          | Meaning                                       |
| ------------------------------------------ | --------------------------------------------- |
| `--base` / `SEED_BASE`                     | API origin, default `http://localhost:8080`   |
| `--mailpit` / `SEED_MAILPIT`               | mailbox, default `http://localhost:8025`      |
| `--reset`                                  | delete the demo series first, then seed       |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | credentials; fall back to `ADMIN_BOOTSTRAP_*` |

## It brands the instance, and `--reset` does not undo that

`--reset` deletes the demo series with everything below them. It does **not**
put the configuration back: there is nothing to put it back to — the values it
replaced were the defaults of a fresh instance, and an instance being
demonstrated is one that has a brand. Change it on `/admin/design`, or start
from an empty database volume.

The two images are drawn in `demo-data.mjs` pixel by pixel rather than committed
as files. A binary in the repository is a thing that has to be explained, the
server decides what a file is from its first bytes (F38), and since AP 12 it
reads the app icon's size out of the same header (F106) — so a generated PNG has
to be a real one, which it is. The icon is 512×512 on purpose: square and at
least 144 pixels is what makes a browser install from it, and anything less would
leave the demo instance installing under Trefaro's icons (F105).

## Some of it is translated, and some is not

The content is German; the seed writes English for the two published series, two
of the events and five of the main event's sessions — and leaves the rest alone.
That is not laziness: "part of it is translated" is the state a real organization
is in for a long while, and what a visitor then sees is the original showing
through (F94), which is the behaviour worth looking at.

## It goes through the API, never through the database

No SQL, no `docker exec`, no writing into the upload volume. That costs a few
seconds and buys three things:

- The seed **cannot create a state the application would refuse.** A confirmed
  registration is confirmed because somebody clicked the mailed link; a full
  session is full because the last seat was taken through the endpoint that
  decides seats under a row lock.
- It works **unchanged against a development server and against the container
  stack** — the only difference is `--base`.
- A run that succeeds is also a **smoke test of the deployment** it ran against.
  Registration, double opt-in, mail, upload, self-service, invitation and
  objection all have to work for it to finish.

## It needs the mailbox

Mailpit is not decoration here. Three states exist only inside sent mail:

- a **confirmation** is a signed token in the double opt-in link (E5b),
- a participant reaches **their own page** through the token in their receipt (E11),
- an **objection** is the token in an invitation (E15, F58).

So the seed reads the mail the server sent, exactly as a person would. Without a
reachable mailbox it still creates everything else and says which parts it left
out — the registrations then stay pending, which is honest rather than convenient.

```bash
docker compose -f infra/docker-compose.dev.yml up -d mailpit   # http://localhost:8025
```

For the container stack, Mailpit has to be reachable **from the server
container**: join it to the stack network and point `SMTP_HOST` at it.

```bash
docker network connect trefaro_default trefaro-mailpit
# then in the stack's env file: SMTP_HOST=trefaro-mailpit, SMTP_PORT=1025, SMTP_SECURE=false
```

On Docker Desktop the shorter way is `SMTP_HOST=host.docker.internal` with
`SMTP_PORT=1025` — the mailbox is then reached through its published port on the
host, and nothing has to join a second network. That is how the AP 13 run of the
whole stack was done.

## What it deliberately does not create

- **An invitation in the `partial` state.** That needs a delivery to fail, and
  faking a failure would mean writing a row the application would never write.
  To see it, point `SMTP_HOST` at a server that rejects one address.
- **Two thousand registrations.** Forty, because the public form allows sixty
  submissions per five minutes per client address (deliberately — it sends mail to
  an address the caller picks), and a seed that spends the whole budget leaves the
  instance unusable for the next few minutes. Forty is still two pages of the
  participant overview. The measurement at two thousand rows lives in the API
  contract suite, where a load figure belongs.
- **Anything that looks real.** Every name and organization is invented and every
  address is under `example.org`, which cannot receive mail.

## Files

| File            | Contains                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------- |
| `seed.mjs`      | the run: order, reset, summary                                                            |
| `demo-data.mjs` | the content — brand, images, series, events, form, programme, people, dates, translations |
| `api.mjs`       | the API client, the mailbox reader, a PNG encoder and a PDF                               |

Two runs a day apart produce the same shape with shifted dates: `demo-data.mjs`
derives every date from the day it runs, so the past event stays past and the
main event stays about seven weeks out.
