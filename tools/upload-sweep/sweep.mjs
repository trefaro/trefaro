/**
 * The sweep over the upload volume (AP 9 of phase 5).
 *
 * `AttachmentsService` keeps the database and the volume in step, and where it
 * cannot — there is no transaction spanning PostgreSQL and a filesystem — it
 * compensates **towards keeping bytes**: a byte range nobody references costs
 * disk and is logged, while a row pointing at a file that was removed costs an
 * organizer the document they were asked to collect. That is the right way
 * round, and it has a consequence nobody was watching: a crash between two
 * steps can leave a file that no row points at, and nothing finds it.
 *
 * This finds it. It lists the volume, joins it against every column of the
 * schema that holds a stored path, and **reports**. It deletes nothing, and it
 * never will: a tool that can delete a participant's visa document because a
 * query was wrong is a worse problem than the one it solves. What an operator
 * does with the list is their decision, taken with the file in front of them.
 *
 * It reports in **both** directions, because the second one is free and is the
 * more serious of the two: a row whose file is gone is a download that answers
 * 404 to an organizer who needs it, and the server only says so when somebody
 * happens to ask for that file.
 *
 * **Run it against a running instance.** Like `spike-verification/` and
 * `demo-seed/`, it starts nothing: the volume is inside the server container
 * and the rows are inside the database container, so it reaches into both by
 * name — and the names come from the environment, never from a literal, or a
 * run against one instance would report about another
 * (`docs/rules/deployment.md`).
 *
 *   SERVER_CONTAINER=trefaro-server-1 POSTGRES_CONTAINER=trefaro-postgres-1 \
 *     node tools/upload-sweep/sweep.mjs
 *
 * Exit codes: 0 when the volume and the database agree, 2 when they do not,
 * and 1 when the sweep could not be taken at all. Three rather than two, so a
 * cron entry can tell "there is something to look at" from "this did not run".
 */
import { execFileSync } from 'node:child_process';

/**
 * Which containers to reach into, and as whom.
 *
 * Both default to the names Docker Compose gives a stack started as `-p
 * trefaro`; a second project has different ones, and a run that guessed would
 * list one instance's volume against another instance's rows.
 */
const SERVER_CONTAINER = process.env.SERVER_CONTAINER ?? 'trefaro-server-1';
const POSTGRES_CONTAINER =
  process.env.POSTGRES_CONTAINER ?? 'trefaro-postgres-1';
const DATABASE_USER = process.env.DATABASE_USER ?? 'trefaro';
const DATABASE_NAME = process.env.DATABASE_NAME ?? 'trefaro';

/** Where the volume is mounted in the server image (`UPLOAD_DIR`). */
const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/app/uploads';

/**
 * How recently written a file may be and still not count as forgotten.
 *
 * The one false positive this sweep could produce, and it would produce it on
 * exactly the instance where it matters most — a busy one. `store()` writes
 * every file first and then every row, so between those two moments a file is
 * legitimately unreferenced. Fifteen minutes is far longer than that window
 * and far shorter than a backup cycle.
 */
const GRACE_MINUTES = Number(process.env.SWEEP_GRACE_MINUTES ?? '15');

/**
 * Every column of the schema that holds a path into the volume.
 *
 * Written out rather than discovered, because what each one means differs —
 * and checked against the schema below, so a column added later cannot be
 * quietly missed. Five tables, six columns, one per subtree of the volume
 * except `attachment`, which holds both `attachments/` and `messages/` (E19).
 */
const PATH_COLUMNS = [
  { table: 'attachment', column: 'file_path' },
  { table: 'app_config', column: 'logo_path' },
  { table: 'app_config', column: 'app_icon_path' },
  { table: 'event_series', column: 'logo_path' },
  { table: 'event', column: 'logo_path' },
  { table: 'user_profile', column: 'avatar_path' },
];

function psql(sql) {
  return execFileSync(
    'docker',
    [
      'exec',
      POSTGRES_CONTAINER,
      'psql',
      '-U',
      DATABASE_USER,
      '-d',
      DATABASE_NAME,
      '-At',
      '-c',
      sql,
    ],
    { encoding: 'utf8' },
  ).trim();
}

function lines(output) {
  return output.length === 0 ? [] : output.split('\n').filter(Boolean);
}

/**
 * The files the volume holds, relative to its root and old enough to judge.
 *
 * `find` rather than a Node script inside the container: the runtime image is
 * Alpine, so `find` is there, and shelling a program into a container is a
 * thing an operator can read and repeat by hand.
 */
function filesInVolume() {
  const output = execFileSync(
    'docker',
    [
      'exec',
      SERVER_CONTAINER,
      'find',
      UPLOAD_DIR,
      '-type',
      'f',
      '-mmin',
      `+${GRACE_MINUTES}`,
    ],
    { encoding: 'utf8' },
  );
  const prefix = UPLOAD_DIR.endsWith('/') ? UPLOAD_DIR : `${UPLOAD_DIR}/`;
  return lines(output.trim()).map((path) =>
    path.startsWith(prefix) ? path.slice(prefix.length) : path,
  );
}

/**
 * Refuses to judge a volume against a schema it does not fully know.
 *
 * The failure this prevents is the one that would make the sweep worse than
 * useless: a plug-in — or a later core module — adds a table with a stored
 * path, and every file it owns is reported as forgotten. Then somebody deletes
 * them. So the sweep asks the schema which columns look like paths, and stops
 * if it finds one that is not in the list above.
 */
function unknownPathColumns() {
  const known = new Set(
    PATH_COLUMNS.map(({ table, column }) => `${table}.${column}`),
  );
  const found = lines(
    psql(
      "SELECT table_name || '.' || column_name FROM information_schema.columns " +
        "WHERE table_schema = 'public' AND column_name LIKE '%path%' ORDER BY 1",
    ),
  );
  return found.filter((column) => !known.has(column));
}

/** Every path any row points at, as one set. */
function referencedPaths() {
  const union = PATH_COLUMNS.map(
    ({ table, column }) =>
      `SELECT "${column}" AS path FROM "${table}" WHERE "${column}" IS NOT NULL`,
  ).join(' UNION ');
  return new Set(lines(psql(`${union} ORDER BY path`)));
}

/** Which row points at a path, so a report can name it. */
function ownerOf(path) {
  const quoted = path.replace(/'/g, "''");
  for (const { table, column } of PATH_COLUMNS) {
    const id = psql(
      `SELECT id FROM "${table}" WHERE "${column}" = '${quoted}' LIMIT 1`,
    );
    if (id) return `${table} ${id}`;
  }
  return 'nothing';
}

function report(title, entries, epilogue) {
  console.log(`\n${title}: ${entries.length}`);
  for (const entry of entries) console.log(`  ${entry}`);
  if (entries.length > 0) console.log(`  → ${epilogue}`);
}

function main() {
  console.log(
    `Sweeping ${UPLOAD_DIR} in ${SERVER_CONTAINER} against ${DATABASE_NAME} in ${POSTGRES_CONTAINER}`,
  );
  console.log(
    `Files written in the last ${GRACE_MINUTES} minutes are left alone — a file is ` +
      'written before its row exists.',
  );

  const unknown = unknownPathColumns();
  if (unknown.length > 0) {
    console.error(
      '\nThis schema has path columns this sweep does not know about:\n' +
        unknown.map((column) => `  ${column}`).join('\n') +
        '\nEvery file they point at would be reported as forgotten, so nothing ' +
        'is reported at all. Add them to PATH_COLUMNS in this file.',
    );
    return 1;
  }

  const onDisk = filesInVolume();
  const referenced = referencedPaths();

  const forgotten = onDisk.filter((path) => !referenced.has(path));
  const missing = [...referenced]
    .filter((path) => !onDisk.includes(path))
    .map((path) => `${path} (${ownerOf(path)})`);

  console.log(
    `\n${onDisk.length} file(s) in the volume, ${referenced.size} path(s) in the database.`,
  );
  report(
    'Files nothing points at',
    forgotten,
    'bytes nobody can reach through this application. Nothing was deleted — ' +
      'check one of them before you remove any.',
  );
  report(
    'Rows pointing at a file that is not there',
    missing,
    'a download that answers 404. Restore the volume from a backup, or clear ' +
      'the column so the page stops promising a file.',
  );

  if (forgotten.length === 0 && missing.length === 0) {
    console.log('\nThe volume and the database agree.');
    return 0;
  }
  return 2;
}

try {
  process.exitCode = main();
} catch (error) {
  console.error(`\nThe sweep could not be taken: ${error.message}`);
  console.error(
    'Both containers have to be running, and SERVER_CONTAINER and ' +
      'POSTGRES_CONTAINER have to name this instance’s.',
  );
  process.exitCode = 1;
}
