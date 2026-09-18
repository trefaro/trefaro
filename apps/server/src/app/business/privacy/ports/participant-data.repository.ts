import type {
  CustomFieldValue,
  RegistrationStatus,
} from '@trefaro/shared-models';

/**
 * Port for the two questions the GDPR asks of a schema (E65): what is stored
 * about one person, and what is left when that person is gone.
 *
 * **Why one port instead of a read on each module's repository.** Every other
 * port in this application answers a question about a thing — an event's
 * registrations, a conversation's messages. The two questions here are about a
 * *person*, cut across nine tables, and are worth nothing unless they are
 * complete: an export that quietly misses a table and an erasure that quietly
 * leaves one are the same defect, and they are the defect that follows from
 * asking nine places. Written as one port, "the list is complete" is a property
 * of a single interface, a single implementation and a single test.
 *
 * **The address is a key here, not only an identity.** A registration carries no
 * foreign key to an account (E31) — the two belong together because they carry
 * the same address, and the address was confirmed on both sides by a double opt
 * in. The implementation therefore reads the address from the profile row and
 * matches case-insensitively, exactly as every other lookup of an address does.
 *
 * **What is deliberately not reached by either question**: a contact request
 * somebody sent without an account. Nothing authenticated that address (F133),
 * so treating it as this person's would be this application claiming that two
 * strangers are one — which is the very thing F133 refused to do when it gave
 * every request its own conversation.
 */

/** The account itself, as it is stored. */
export interface ExportedProfile {
  readonly id: string;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly preferredLocale: string;
  readonly activityAreas: string | null;
  readonly customFields: Record<string, string | boolean>;
  readonly searchable: boolean;
  readonly avatarPath: string | null;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * A session, without the one thing that would make it usable.
 *
 * `token_hash` stays out: it is the credential of a browser, and an archive
 * that travels by e-mail is the wrong place for one. What a person may want to
 * know is which devices are logged in and since when, and that is these three.
 */
export interface ExportedSession {
  readonly createdAt: Date;
  readonly lastSeenAt: Date;
  readonly expiresAt: Date;
}

/** A push subscription — the endpoint's keys are a device secret and stay out. */
export interface ExportedPushSubscription {
  readonly userAgent: string | null;
  readonly createdAt: Date;
}

/** A file somebody uploaded, by reference; the bytes are read separately. */
export interface ExportedFile {
  readonly path: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  /** The form field that asked for it; `null` for a picture sent in a chat. */
  readonly fieldKey: string | null;
}

export interface ExportedRegistration {
  readonly id: string;
  readonly eventTitle: string;
  readonly eventSlug: string;
  readonly seriesTitle: string;
  readonly seriesSlug: string;
  readonly eventStartsAt: Date;
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly phone: string | null;
  readonly origin: string | null;
  readonly customFields: Record<string, CustomFieldValue>;
  readonly status: RegistrationStatus;
  readonly newsletterOptIn: boolean;
  readonly contactOptOut: boolean;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
  readonly files: readonly ExportedFile[];
}

/** A programme item this person put their name down for (FR 3.10). */
export interface ExportedProgramSignup {
  readonly eventTitle: string;
  readonly itemTitle: string;
  readonly startsAt: Date;
  readonly createdAt: Date;
}

export interface ExportedNewsletterSubscription {
  readonly email: string;
  /** `null` is the instance-wide list, a title is one series (F181). */
  readonly seriesTitle: string | null;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
}

export interface ExportedMessage {
  readonly id: string;
  /** Whether this person wrote it, or the other side did. */
  readonly mine: boolean;
  readonly body: string | null;
  readonly file: ExportedFile | null;
  readonly sentAt: Date;
}

/**
 * One conversation this person is a member of, with all of it.
 *
 * Both sides of it, not only the lines this person wrote: half a conversation
 * is not a conversation, and this is the same history the app shows them while
 * they are logged in. The **files** follow the other rule — only the ones this
 * person uploaded — because a picture is a document with an owner, and copying
 * somebody else's into an archive that leaves the instance is a step further
 * than showing it on a screen.
 */
export interface ExportedConversation {
  readonly id: string;
  readonly type: string;
  readonly topic: string | null;
  readonly counterparts: readonly string[];
  readonly joinedAt: Date;
  readonly messages: readonly ExportedMessage[];
}

/** Everything one instance holds about one account holder. */
export interface ParticipantDataRecord {
  readonly profile: ExportedProfile;
  readonly sessions: readonly ExportedSession[];
  readonly pushSubscriptions: readonly ExportedPushSubscription[];
  readonly registrations: readonly ExportedRegistration[];
  readonly programSignups: readonly ExportedProgramSignup[];
  readonly newsletterSubscriptions: readonly ExportedNewsletterSubscription[];
  readonly conversations: readonly ExportedConversation[];
}

/**
 * What an erasure did, for the log line and for the files still to remove.
 *
 * The bytes are not this port's to delete: rows and files live in two places
 * (E19), and the rule this application already follows is that whoever removed
 * the rows hands the now-unowned paths to {@link FileStore}. The counts are for
 * the operator's log — an erasure leaves nothing to look at afterwards, so the
 * line it writes is the only record that it ran.
 */
export interface ErasureRecord {
  readonly files: readonly string[];
  readonly registrationsRemoved: number;
  readonly conversationsLeftStanding: number;
  readonly newsletterSubscriptionsRemoved: number;
}

export interface ParticipantDataRepository {
  /** `null` when no such account exists — the session outlived its profile. */
  collect(profileId: string): Promise<ParticipantDataRecord | null>;
  /**
   * Erases one account in one transaction (E65).
   *
   * Everything it does is in one place on purpose: an erasure that half ran is
   * worse than one that did not, because nobody is left to ask.
   */
  erase(profileId: string): Promise<ErasureRecord>;
}

export const PARTICIPANT_DATA_REPOSITORY = Symbol(
  'TREFARO_PARTICIPANT_DATA_REPOSITORY',
);
