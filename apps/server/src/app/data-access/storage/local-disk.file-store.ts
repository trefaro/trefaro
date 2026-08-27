import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve, sep } from 'node:path';
import type { FileStore } from '../../business/attachments/ports/file-store';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';

/** Everything this store writes lives under one directory of the volume. */
const ATTACHMENT_DIR = 'attachments';

/**
 * The upload volume, as a file store (E9).
 *
 * Part of the data access layer for the same reason the repositories are: the
 * business layer decides *that* a file is kept, never *where*. An instance that
 * one day keeps its files in object storage replaces this class and nothing
 * else.
 *
 * Three properties of the naming are deliberate:
 *
 * - **The name is generated, and carries no extension.** Nothing about a stored
 *   file invites guessing another name, and a file whose name says nothing about
 *   its type cannot be served as that type by accident.
 * - **Files are spread over subdirectories** by the first two characters of the
 *   name. A single directory with a hundred thousand entries is slow to list on
 *   every filesystem an organization is likely to run this on.
 * - **The path that is returned is relative.** It is stored in a row that has to
 *   survive the volume being mounted somewhere else.
 */
@Injectable()
export class LocalDiskFileStore implements FileStore {
  private readonly logger = new Logger(LocalDiskFileStore.name);
  private readonly root: string;

  constructor(@Inject(ENV) env: TrefaroEnv) {
    this.root = resolve(env.uploadDir);
  }

  async save(bytes: Buffer): Promise<string> {
    const name = randomUUID();
    const relative = join(ATTACHMENT_DIR, name.slice(0, 2), name);
    const absolute = this.absolute(relative);

    await mkdir(dirname(absolute), { recursive: true });
    // Exclusive: a generated name cannot collide, and if it somehow does this
    // fails instead of overwriting somebody else's document.
    await writeFile(absolute, bytes, { flag: 'wx' });
    return relative;
  }

  async read(path: string): Promise<Buffer | null> {
    try {
      return await readFile(this.absolute(path));
    } catch (error: unknown) {
      if (isMissing(error)) return null;
      throw error;
    }
  }

  async remove(paths: readonly string[]): Promise<void> {
    for (const path of paths) {
      try {
        await unlink(this.absolute(path));
      } catch (error: unknown) {
        // A file that is already gone is the outcome that was wanted.
        if (isMissing(error)) continue;
        // The rows are gone by now, so failing here would only turn a leftover
        // byte range into a failed request. It is logged instead, because a
        // volume that cannot be written to is an operator's problem.
        this.logger.warn(
          `Could not remove "${path}" from the upload volume: ${message(error)}`,
        );
      }
    }
  }

  /**
   * The absolute path of a stored file, refusing anything that leaves the root.
   *
   * The paths come out of this application's own rows, so this is not the first
   * line of defence — it is the one that still holds if a row is ever written by
   * something other than {@link save}.
   */
  private absolute(path: string): string {
    const absolute = resolve(this.root, path);
    if (absolute !== this.root && !absolute.startsWith(this.root + sep)) {
      throw new Error(`"${path}" is not inside the upload volume`);
    }
    return absolute;
  }
}

function isMissing(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'ENOENT';
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
