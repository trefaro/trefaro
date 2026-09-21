import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

/**
 * What a plug-in may do to the schema (F21, E12) — checked mechanically.
 *
 * The rule is as old as the plug-in pattern: **a plug-in never touches a core
 * table.** It brings its own entities and its own migrations, and the core's
 * tables are not its to widen, rename or index. Until AP 9 of phase 5 the rule
 * lived in three docstrings and in review, which is the arrangement that holds
 * right up until somebody adds one column in a hurry.
 *
 * It reads the migration files as text rather than running them. What is under
 * test is a sentence about SQL — "the table this statement writes to is the
 * plug-in's own" — and the statement is in the file whether or not a database
 * exists. Running them would need one, and a test that needs a database is a
 * test nobody runs while writing a migration.
 *
 * Reading a *foreign key into* a core table is explicitly allowed and is how a
 * plug-in attaches to an event at all (`REFERENCES "event"`). What is refused
 * is the statement whose **subject** is a core table.
 */

/** Every plug-in's migration folder lives at the same depth under here. */
const PLUGINS_ROOT = resolve(__dirname);

/** The prefix every table a plug-in owns has to carry (F21). */
const PLUGIN_TABLE_PREFIX = 'plugin_';

/**
 * The statements whose subject is a table, and where that table stands.
 *
 * `CREATE INDEX` is in here with its own pattern because its subject is the
 * index and its object is the table — an index on a core table is a write to
 * the core's schema just as much as a column would be.
 */
const SUBJECTS: readonly RegExp[] = [
  /\b(?:CREATE|ALTER|DROP)\s+TABLE\s+(?:IF\s+(?:NOT\s+)?EXISTS\s+)?"?([a-z_]+)"?/gi,
  /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"?[a-z_0-9]+"?\s+ON\s+"?([a-z_]+)"?/gi,
  /\bTRUNCATE\s+(?:TABLE\s+)?"?([a-z_]+)"?/gi,
];

function migrationFiles(root: string): readonly string[] {
  const found: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) found.push(...migrationFiles(path));
    else if (root.endsWith('migrations') && entry.name.endsWith('.ts')) {
      found.push(path);
    }
  }
  return found.sort();
}

/** Every table a file writes to, in the order the statements appear. */
function tablesWrittenBy(source: string): readonly string[] {
  const tables: string[] = [];
  for (const pattern of SUBJECTS) {
    for (const match of source.matchAll(pattern)) {
      if (match[1]) tables.push(match[1].toLowerCase());
    }
  }
  return tables;
}

describe("a plug-in's migrations", () => {
  const files = migrationFiles(PLUGINS_ROOT);

  it('exist at all — five plug-ins bring their own schema', () => {
    // Guards the test itself: a scan that found nothing would pass silently.
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('write to no table but the plug-in’s own', () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, 'utf8');
      return tablesWrittenBy(source)
        .filter((table) => !table.startsWith(PLUGIN_TABLE_PREFIX))
        .map((table) => `${relative(PLUGINS_ROOT, file)} writes to "${table}"`);
    });
    expect(offenders).toEqual([]);
  });

  it('touch a table at all — the pattern above still matches SQL', () => {
    // The assertion above is a filter over a list, so an expression that
    // stopped matching would make it pass over nothing. This says the list is
    // not empty.
    const touched = files.flatMap((file) =>
      tablesWrittenBy(readFileSync(file, 'utf8')),
    );
    expect(touched.length).toBeGreaterThanOrEqual(files.length);
    expect(
      touched.every((table) => table.startsWith(PLUGIN_TABLE_PREFIX)),
    ).toBe(true);
  });
});
