import { extname } from 'node:path';
import { BRANDING_TYPES } from '@trefaro/shared-models';
import { safeFileName } from '../attachments/file-name';
import { signatureType } from '../attachments/file-signature';
import type { ArchiveEntry } from '../common/zip-archive';
import type {
  ExportedFile,
  ParticipantDataRecord,
} from './ports/participant-data.repository';

/** The one file in the archive that is prose, and the only translated one. */
export const README_ENTRY = 'README.txt';
/** The one file that is data, and the reason the archive is machine-readable. */
export const JSON_ENTRY = 'export.json';

/**
 * Lays one person's data out as the files of an archive (E65).
 *
 * **Two files and a tree, and the split is deliberate.** `export.json` holds
 * data and nothing else — English property names, ISO timestamps, the values as
 * they are stored — because a person who wants their data somewhere else needs
 * something a program can read, and a JSON whose keys change with a language is
 * not that. `README.txt` holds every sentence, in the language this person
 * chose, and it comes from the catalogue like every other sentence in this
 * application (E22, E64). Beside them the files they uploaded, under names a
 * person recognizes rather than under the generated ones the volume uses.
 *
 * **A file is named in both places.** Every entry under `files` in the JSON
 * carries the path of the copy in this archive, and a file whose bytes the
 * store no longer holds carries `null` there instead of disappearing — the row
 * says something was uploaded, and an archive that silently omitted it would be
 * the one place a person could not find that out.
 *
 * Pure, and takes the bytes it needs as a map rather than reading them: what
 * this function decides is a layout, and a layout is worth testing without a
 * filesystem.
 */
export function participantArchive(
  record: ParticipantDataRecord,
  bytes: ReadonlyMap<string, Buffer>,
  readme: string,
  at: Date,
): readonly ArchiveEntry[] {
  const files: ArchiveEntry[] = [];
  const taken = new Set<string>([README_ENTRY, JSON_ENTRY]);

  /** Copies a stored file into the archive; `null` when its bytes are gone. */
  function place(folder: string, file: ExportedFile): string | null {
    const content = bytes.get(file.path);
    if (!content) return null;

    const path = free(`${folder}/${safeFileName(file.fileName)}`, taken);
    taken.add(path);
    files.push({ path, bytes: content });
    return path;
  }

  const avatar = record.profile.avatarPath;
  const avatarBytes = avatar === null ? undefined : bytes.get(avatar);
  const picture =
    avatar && avatarBytes
      ? place('', {
          path: avatar,
          // A stored picture has no name and no type column — what it is gets
          // decided by its own first bytes, the same rule that applies when it
          // is served (F38, `ImageFileService`). A file called
          // `profile-picture` with no extension opens in nothing.
          fileName: `profile-picture${pictureExtension(avatarBytes)}`,
          mimeType: '',
          sizeBytes: avatarBytes.length,
          fieldKey: null,
        })
      : null;

  const registrations = record.registrations.map((registration) => ({
    event: {
      title: registration.eventTitle,
      slug: registration.eventSlug,
      seriesTitle: registration.seriesTitle,
      seriesSlug: registration.seriesSlug,
      startsAt: registration.eventStartsAt.toISOString(),
    },
    email: registration.email,
    firstName: registration.firstName,
    lastName: registration.lastName,
    phone: registration.phone,
    origin: registration.origin,
    customFields: registration.customFields,
    status: registration.status,
    newsletterOptIn: registration.newsletterOptIn,
    contactOptOut: registration.contactOptOut,
    registeredAt: registration.createdAt.toISOString(),
    confirmedAt: iso(registration.confirmedAt),
    files: registration.files.map((file) => ({
      fieldKey: file.fieldKey,
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      inArchive: place(`registrations/${registration.eventSlug}`, file),
    })),
  }));

  const conversations = record.conversations.map((conversation) => ({
    id: conversation.id,
    type: conversation.type,
    topic: conversation.topic,
    counterparts: conversation.counterparts,
    joinedAt: conversation.joinedAt.toISOString(),
    messages: conversation.messages.map((message) => ({
      id: message.id,
      mine: message.mine,
      sentAt: message.sentAt.toISOString(),
      body: message.body,
      file:
        message.file === null
          ? null
          : {
              fileName: message.file.fileName,
              mimeType: message.file.mimeType,
              sizeBytes: message.file.sizeBytes,
              inArchive: message.mine
                ? place(`messages/${conversation.id}`, message.file)
                : null,
            },
    })),
  }));

  const payload = {
    exportedAt: at.toISOString(),
    account: {
      id: record.profile.id,
      email: record.profile.email,
      firstName: record.profile.firstName,
      lastName: record.profile.lastName,
      preferredLocale: record.profile.preferredLocale,
      activityAreas: record.profile.activityAreas,
      customFields: record.profile.customFields,
      searchable: record.profile.searchable,
      profilePicture: picture,
      confirmedAt: iso(record.profile.confirmedAt),
      createdAt: record.profile.createdAt.toISOString(),
      updatedAt: record.profile.updatedAt.toISOString(),
    },
    sessions: record.sessions.map((session) => ({
      createdAt: session.createdAt.toISOString(),
      lastSeenAt: session.lastSeenAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    })),
    pushSubscriptions: record.pushSubscriptions.map((subscription) => ({
      userAgent: subscription.userAgent,
      createdAt: subscription.createdAt.toISOString(),
    })),
    registrations,
    programSignups: record.programSignups.map((signup) => ({
      eventTitle: signup.eventTitle,
      itemTitle: signup.itemTitle,
      startsAt: signup.startsAt.toISOString(),
      signedUpAt: signup.createdAt.toISOString(),
    })),
    newsletterSubscriptions: record.newsletterSubscriptions.map(
      (subscription) => ({
        email: subscription.email,
        seriesTitle: subscription.seriesTitle,
        confirmedAt: iso(subscription.confirmedAt),
        createdAt: subscription.createdAt.toISOString(),
      }),
    ),
    conversations,
  };

  return [
    { path: README_ENTRY, bytes: Buffer.from(readme, 'utf8') },
    {
      path: JSON_ENTRY,
      bytes: Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8'),
    },
    ...files,
  ];
}

/** The extension of a stored picture, read off its bytes. */
function pictureExtension(bytes: Buffer): string {
  const mimeType = signatureType(
    bytes,
    BRANDING_TYPES.map((one) => one.mimeType),
  );
  const type = BRANDING_TYPES.find((one) => one.mimeType === mimeType);
  return type?.extensions[0] ?? '.bin';
}

function iso(at: Date | null): string | null {
  return at === null ? null : at.toISOString();
}

/**
 * A path nothing else in this archive has.
 *
 * Two people can upload `scan.pdf` for two questions of the same form, and an
 * archive with one of them in it would be the quiet kind of loss. The suffix
 * goes before the extension so the file still opens with a double click.
 */
function free(wanted: string, taken: ReadonlySet<string>): string {
  const path = wanted.replace(/^\//, '');
  if (!taken.has(path)) return path;

  const extension = extname(path);
  const stem = path.slice(0, path.length - extension.length);
  for (let n = 2; ; n += 1) {
    const candidate = `${stem} (${n})${extension}`;
    if (!taken.has(candidate)) return candidate;
  }
}
