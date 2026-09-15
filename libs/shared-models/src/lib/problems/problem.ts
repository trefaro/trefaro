/**
 * The reasons the business layer gives for refusing a request (E64, AP 5 of
 * phase 5).
 *
 * Until this package a refusal travelled as an English sentence, and F77 split
 * a message into two halves because of it: the client said *what* had gone
 * wrong in the reader's language, and the server's *why* stood beside it in
 * English. The composition was right; the language of the second half was not.
 *
 * So a refusal now travels as a **code and its placeholder values**, and the
 * code is a catalogue key: the client looks it up in the reader's language and
 * fills the placeholders in. Nothing in the business layer holds a sentence any
 * more, and nothing on the wire is in a language at all.
 *
 * The list is closed on purpose. A code that is not in it does not compile, and
 * a code in it without a sentence in every shipped catalogue fails the
 * catalogue test (`libs/shared-i18n`) — which is what keeps a raw key off a
 * screen. Adding a refusal is therefore two edits, here and in the catalogues,
 * and the build says so if only one of them happens.
 *
 * Here rather than in the server for two reasons: the codes are a contract
 * between the server and both clients, and the catalogue test needs to read
 * them without importing an application. `shared-models` already owns
 * catalogue **keys** for the same reason (`registrationStatusKey` and its
 * kin) — it owns no sentences, and neither does this file.
 */
export const PROBLEM_CODES = [
  /* An account in the administration (`business/login`). */
  'problem.admin.emailTaken',
  'problem.admin.lastOwnAccount',

  /* Logo, app icon and the multipart part they arrive in (`business/config`). */
  'problem.branding.imagePartMissing',
  'problem.branding.tooLarge',
  'problem.branding.type',

  /* Messages, groups and the contact form (`business/chat`). */
  'problem.chat.answerEmpty',
  'problem.chat.contactMessageEmpty',
  'problem.chat.groupMembersMissing',
  'problem.chat.groupNotConfirmed',
  'problem.chat.groupSubjectMissing',
  'problem.chat.groupSubjectTooLong',
  'problem.chat.groupTooLarge',
  'problem.chat.messageEmpty',
  'problem.chat.messageTooLong',
  'problem.chat.senderMissing',
  'problem.chat.withOneself',

  /* Writing to the people of an event (`business/registration/contacts`). */
  'problem.contacts.noneSelected',
  'problem.contacts.someGone',

  /* The instance configuration and the module switches (`business/config`). */
  'problem.config.colour',
  'problem.config.defaultLocaleInactive',
  'problem.config.fontFamily',
  'problem.config.moduleDependants.one',
  'problem.config.moduleDependants.many',
  'problem.config.moduleRequires.one',
  'problem.config.moduleRequires.many',
  'problem.config.organizationName',
  'problem.config.tooManyLocales',

  /* An event and its public address (`business/events`). */
  'problem.event.endsBeforeStart',
  'problem.event.hasRegistrations.one',
  'problem.event.hasRegistrations.many',
  'problem.event.languagesMissing',
  'problem.event.linkNeeded.hybrid',
  'problem.event.linkNeeded.online',
  'problem.event.noFreeSlug',
  'problem.event.slugShape',
  'problem.event.slugTaken',
  'problem.event.timeZone',
  'problem.event.unparsableDates',
  'problem.event.venueNeeded.hybrid',
  'problem.event.venueNeeded.onsite',

  /* What both field kits agree on (`business/common/field-kit`). */
  'problem.field.checkbox',
  'problem.field.keyReservedByProfile',
  'problem.field.keyReservedByRegistration',
  'problem.field.keyShape',
  'problem.field.labelMissing',
  'problem.field.noChoices',
  'problem.field.noFreeKey',
  'problem.field.notAChoice',
  'problem.field.optionsWithoutSelect',
  'problem.field.required',
  'problem.field.takesText',
  'problem.field.tooLong',
  'problem.field.tooManyChoices',

  /* An uploaded image, per area (`business/common/image-file`). */
  'problem.image.empty',
  'problem.image.avatarTooLarge',
  'problem.image.avatarType',
  'problem.image.logoTooLarge',
  'problem.image.logoType',
  'problem.image.messagePictureTooLarge',
  'problem.image.messagePictureType',
  'problem.image.typeMismatch',

  /* Inviting former participants (`business/invitations`). */
  'problem.invitation.bodyMissing',
  'problem.invitation.foreignEvent',
  'problem.invitation.optOutLinkStale',
  'problem.invitation.oneClickBody',
  'problem.invitation.subjectMissing',
  'problem.invitation.tooManyRecipients',

  /* A language tag that is not one. */
  'problem.locale.tag',

  /* Links to recordings and material (`business/media-links`). */
  'problem.mediaLink.foreignSession',
  'problem.mediaLink.scheme',
  'problem.mediaLink.titleMissing',
  'problem.mediaLink.titleTooLong',
  'problem.mediaLink.tooMany',
  'problem.mediaLink.urlTooLong',

  /* The newsletter's double opt-in (`business/newsletter`). */
  'problem.newsletter.staleLink',

  /* The one password rule of this instance (`business/common/password-policy`). */
  'problem.password.policy',

  /* A participant account and its profile (`business/profiles`). */
  'problem.profile.activityAreasTooLong',
  'problem.profile.confirmationStale',
  'problem.profile.firstNameMissing',
  'problem.profile.lastNameMissing',
  'problem.profile.resetLinkStale',

  /* The profile questions of the instance (`business/profiles`). */
  'problem.profileField.keyTaken',
  'problem.profileField.orderIncomplete',
  'problem.profileField.orderTwice',
  'problem.profileField.tooMany',
  'problem.profileField.unknown',

  /* The programme and its sign-ups (`business/program`). */
  'problem.program.capacityShape',
  'problem.program.capacityTooLarge',
  'problem.program.capacityWithoutSignUp',
  'problem.program.endsBeforeStart',
  'problem.program.full',
  'problem.program.outsideEvent',
  'problem.program.past',
  'problem.program.titleMissing',
  'problem.program.tooMany',
  'problem.program.unparsableDates',
  'problem.program.withoutSignUp',

  /* Registering, confirming and coming back to a registration. */
  'problem.registration.cancelled',
  'problem.registration.confirmationStale',
  'problem.registration.eventPast',
  'problem.registration.neverConfirmed',
  'problem.registration.notConfirmed',
  'problem.registration.notPendable',
  'problem.registration.payloadNotJson',
  'problem.registration.strayParts',

  /* The registration form of an event (`business/registration`). */
  'problem.registrationField.acceptWithoutFile',
  'problem.registrationField.keyTaken',
  'problem.registrationField.limitWithoutFile',
  'problem.registrationField.noAcceptedTypes',
  'problem.registrationField.orderIncomplete',
  'problem.registrationField.orderTwice',
  'problem.registrationField.sizeRange',
  'problem.registrationField.tooMany',
  'problem.registrationField.tooManyFiles',
  'problem.registrationField.unknown',
  'problem.registrationField.unsupportedTypes',

  /* An event series and its public address (`business/event-series`). */
  'problem.series.hasRegistrations.one',
  'problem.series.hasRegistrations.many',
  'problem.series.noFreeSlug',
  'problem.series.slugShape',
  'problem.series.slugTaken',

  /* The first run of a fresh instance (`business/setup`). */
  'problem.setup.defaultLocaleUnsendable',

  /* Cancelling and signing up through a mailed link (`business/self-service`). */
  'problem.selfService.staleLink',
  'problem.selfService.tokenMissing',

  /* The translation administration (`business/i18n`). */
  'problem.translation.entriesEmpty',
  'problem.translation.entriesTooMany',
  'problem.translation.valueNotAString',
  'problem.translation.valueTooLong',

  /* A file answering a registration question (`business/registration`). */
  'problem.upload.empty',
  'problem.upload.notAFileField',
  'problem.upload.notAValueField',
  'problem.upload.submissionTooLarge',
  'problem.upload.tooLarge',
  'problem.upload.tooMany',
  'problem.upload.type',
  'problem.upload.typeMismatch',
  'problem.upload.typeUnknown',
  'problem.upload.unknownField',
] as const;

/** One of the reasons the business layer can give — and a catalogue key. */
export type ProblemCode = (typeof PROBLEM_CODES)[number];

/**
 * The values a refusal's sentence has gaps for.
 *
 * Strings and numbers only: these end up in a `{{ }}` placeholder, and anything
 * that needs a unit (a file size, a period) is rendered before it travels —
 * the alternative would be a catalogue sentence that has to know how to format.
 */
export type ProblemParams = Readonly<Record<string, string | number>>;

const CODES: ReadonlySet<string> = new Set(PROBLEM_CODES);

/** Whether a value is a code this build knows — used where one arrives. */
export function isProblemCode(value: unknown): value is ProblemCode {
  return typeof value === 'string' && CODES.has(value);
}

/**
 * What the server said when it refused, once it is read off a body.
 *
 * Not to be confused with `Problem` in `shared-http`: this is the server's
 * half, and that one is what a screen shows — the client's own sentence with
 * this one beside it (F77).
 */
export interface Refusal {
  readonly code: ProblemCode;
  readonly params?: ProblemParams;
}

/**
 * The refusal in a response body, or `null` for a body without one.
 *
 * One reader for all three places a refusal is unpacked — the exception filter
 * on its way out, the server's own specs, and the HTTP library of both clients
 * on the way in. A code this build does not know reads as no refusal at all:
 * it has no sentence in this catalogue, and a raw key on a screen is worse than
 * the client's own sentence standing by itself.
 */
export function readRefusal(body: unknown): Refusal | null {
  if (typeof body !== 'object' || body === null) return null;

  const { code, params } = body as { code?: unknown; params?: unknown };
  if (!isProblemCode(code)) return null;
  if (typeof params !== 'object' || params === null) return { code };

  const values: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(params)) {
    if (typeof value === 'string' || typeof value === 'number') {
      values[name] = value;
    }
  }
  return { code, params: values };
}
