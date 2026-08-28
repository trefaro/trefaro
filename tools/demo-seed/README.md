# Demo seed

Fills an instance with data worth looking at: two published series and a draft
one, five events, a registration form with all four field types, forty
registrations in all three states, a programme with parallel sessions of which
one is full, media links, a real file attachment, and one invitation that was
genuinely sent.

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

| File            | Contains                                                     |
| --------------- | ------------------------------------------------------------ |
| `seed.mjs`      | the run: order, reset, summary                               |
| `demo-data.mjs` | the content — series, events, form, programme, people, dates |
| `api.mjs`       | the API client, the mailbox reader, and a generated demo PDF |

Two runs a day apart produce the same shape with shifted dates: `demo-data.mjs`
derives every date from the day it runs, so the past event stays past and the
main event stays about seven weeks out.
