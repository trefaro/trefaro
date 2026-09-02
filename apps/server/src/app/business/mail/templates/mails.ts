import { formatEventPeriod } from '@trefaro/shared-models';
import { CONFIRMATION_TOKEN_TTL_MS } from '../../security';
import {
  escapeHtml,
  htmlAction,
  htmlBody,
  htmlLines,
  htmlLink,
  htmlStrong,
  type Html,
} from './html';
import type { MailStrings } from './strings';
import type {
  ConfirmationMailContext,
  InvitationMailContext,
  MailEvent,
  MailTemplate,
  ProfileConfirmationMailContext,
  ProfileExistsMailContext,
  ReceiptMailContext,
  RegistrationMailContext,
  RenderedMail,
} from './types';

/**
 * The six mails, written out of the catalogue (AP 10 of phase 2, E22, E24).
 *
 * Two renderings of the same sentences, never two sets of sentences: the plain
 * text part and the HTML part read the same key and differ only in what they do
 * with the values in it. Where the old per-language files said "open the link
 * below" in text and put a button in HTML, there is now one sentence and one
 * call to action — which is also one thing for a translator to get right instead
 * of two that can drift apart.
 *
 * What is *not* in the catalogue: the `<div>`, the `<p>`, the `<strong>` and the
 * link markup. Structure is code (F86) — an organization edits the words of the
 * confirmation mail, not the shape of the document, and a stray `<` in a
 * translation would otherwise be markup in a stranger's inbox.
 */

/** Shared by more than one mail, so shared as keys. */
const GREETING = 'mail.greeting';
const ACTION_LINE = 'mail.actionLine';
const EVENT_WHEN = 'mail.event.when';
const EVENT_DETAILS = 'mail.event.details';

/** Every mail greets somebody and ends with something to click. */
const COMMON_KEYS = [GREETING, ACTION_LINE] as const;
/** The block that says when and where — the receipt and the invitation carry it. */
const EVENT_KEYS = [EVENT_WHEN, EVENT_DETAILS] as const;

/**
 * How long the confirmation link lasts, in the sentence that says so.
 *
 * Derived from the constant the token signer uses rather than written into the
 * catalogue, for the reason F85 keeps a command out of it: this is not a word,
 * it is a fact about the system. In prose it would sit in every language of
 * every instance, and the day E5's fourteen days become ten, all of them would
 * be wrong with nothing to catch it.
 */
const CONFIRMATION_VALID_DAYS = Math.round(
  CONFIRMATION_TOKEN_TTL_MS / (24 * 60 * 60 * 1000),
);

const registrationConfirmation: MailTemplate<ConfirmationMailContext> = {
  name: 'registration confirmation',
  keys: [
    ...COMMON_KEYS,
    'mail.confirm.subject',
    'mail.confirm.intro',
    'mail.confirm.step',
    'mail.confirm.action',
    'mail.confirm.validity',
  ],

  render(s: MailStrings, context: ConfirmationMailContext): RenderedMail {
    const { event, firstName, confirmUrl } = context;
    const when = period(event, s.locale);
    const label = s.text('mail.confirm.action');
    const validity = s.text('mail.confirm.validity', {
      days: CONFIRMATION_VALID_DAYS,
    });

    return {
      subject: s.text('mail.confirm.subject', { event: event.name }),
      text: textBody(
        greeting(s, firstName),
        s.text('mail.confirm.intro', { event: event.name, period: when }),
        s.text('mail.confirm.step'),
        textAction(s, label, confirmUrl),
        validity,
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        s.html('mail.confirm.intro', {
          event: htmlStrong(escapeHtml(event.name)),
          period: escapeHtml(when),
        }),
        s.html('mail.confirm.step'),
        htmlAction(confirmUrl, label),
        s.html('mail.confirm.validity', {
          days: escapeHtml(String(CONFIRMATION_VALID_DAYS)),
        }),
      ),
    };
  },
};

const registrationConfirmed: MailTemplate<ReceiptMailContext> = {
  name: 'registration receipt',
  keys: [
    ...COMMON_KEYS,
    ...EVENT_KEYS,
    'mail.receipt.subject',
    'mail.receipt.intro',
    'mail.receipt.selfService',
    'mail.receipt.action',
    'mail.receipt.keepPrivate',
    'mail.receipt.closing',
  ],

  render(s: MailStrings, context: ReceiptMailContext): RenderedMail {
    const { event, firstName, selfServiceUrl } = context;
    const label = s.text('mail.receipt.action');

    return {
      subject: s.text('mail.receipt.subject', { event: event.name }),
      text: textBody(
        greeting(s, firstName),
        s.text('mail.receipt.intro', { event: event.name }),
        textEventBlock(s, event).join('\n'),
        s.text('mail.receipt.selfService'),
        textAction(s, label, selfServiceUrl),
        s.text('mail.receipt.keepPrivate'),
        s.text('mail.receipt.closing'),
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        s.html('mail.receipt.intro', {
          event: htmlStrong(escapeHtml(event.name)),
        }),
        htmlEventBlock(s, event, false),
        s.html('mail.receipt.selfService'),
        htmlAction(selfServiceUrl, label),
        s.html('mail.receipt.keepPrivate'),
        s.html('mail.receipt.closing'),
      ),
    };
  },
};

const registrationCancelled: MailTemplate<RegistrationMailContext> = {
  name: 'cancellation notice',
  keys: [
    ...COMMON_KEYS,
    'mail.cancelled.subject',
    'mail.cancelled.intro',
    'mail.cancelled.again',
    'mail.cancelled.action',
  ],

  render(s: MailStrings, context: RegistrationMailContext): RenderedMail {
    const { event, firstName } = context;
    const when = period(event, s.locale);
    const label = s.text('mail.cancelled.action');

    return {
      subject: s.text('mail.cancelled.subject', { event: event.name }),
      text: textBody(
        greeting(s, firstName),
        s.text('mail.cancelled.intro', { event: event.name, period: when }),
        s.text('mail.cancelled.again'),
        textAction(s, label, event.url),
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        s.html('mail.cancelled.intro', {
          event: htmlStrong(escapeHtml(event.name)),
          period: escapeHtml(when),
        }),
        s.html('mail.cancelled.again'),
        htmlAction(event.url, label),
      ),
    };
  },
};

const invitation: MailTemplate<InvitationMailContext> = {
  name: 'invitation',
  keys: [
    ...COMMON_KEYS,
    ...EVENT_KEYS,
    'mail.invitation.footer',
    'mail.invitation.action',
  ],

  render(s: MailStrings, context: InvitationMailContext): RenderedMail {
    const { event, firstName, paragraphs, seriesName, subject, optOutUrl } =
      context;
    // Why this arrived and how to stop the next one. Not the organizer's words
    // and not optional: it is what makes writing to former participants
    // legitimate at all (E15) — which is also why it is a key of ours and not a
    // paragraph the organizer could leave out.
    const label = s.text('mail.invitation.action');

    return {
      // The organizer's own, unchanged and untranslated: this is the one mail
      // whose subject is written by a person rather than by the image.
      subject,
      text: textBody(
        greeting(s, firstName),
        ...paragraphs,
        ...(event
          ? [[event.name, ...textEventBlock(s, event)].join('\n')]
          : []),
        s.text('mail.invitation.footer', { series: seriesName }),
        textAction(s, label, optOutUrl),
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        ...paragraphs.map((paragraph) => escapeHtml(paragraph)),
        ...(event ? [htmlEventBlock(s, event, true)] : []),
        s.html('mail.invitation.footer', { series: escapeHtml(seriesName) }),
        htmlAction(optOutUrl, label),
      ),
    };
  },
};

/**
 * "Confirm your account", the participant registration's double opt-in (FR 4.1).
 *
 * Deliberately close to the registration confirmation and deliberately not the
 * same mail: the two arrive on different days, for different reasons, and one of
 * them names an event while the other cannot. Its validity sentence reads the
 * same constant (F85), because the two links have the same lifetime and would
 * otherwise be able to disagree about it in prose.
 */
const profileConfirmation: MailTemplate<ProfileConfirmationMailContext> = {
  name: 'account confirmation',
  keys: [
    ...COMMON_KEYS,
    'mail.profileConfirm.subject',
    'mail.profileConfirm.intro',
    'mail.profileConfirm.step',
    'mail.profileConfirm.action',
    'mail.profileConfirm.validity',
  ],

  render(
    s: MailStrings,
    context: ProfileConfirmationMailContext,
  ): RenderedMail {
    const { firstName, confirmUrl } = context;
    const label = s.text('mail.profileConfirm.action');

    return {
      subject: s.text('mail.profileConfirm.subject'),
      text: textBody(
        greeting(s, firstName),
        s.text('mail.profileConfirm.intro'),
        s.text('mail.profileConfirm.step'),
        textAction(s, label, confirmUrl),
        s.text('mail.profileConfirm.validity', {
          days: CONFIRMATION_VALID_DAYS,
        }),
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        s.html('mail.profileConfirm.intro'),
        s.html('mail.profileConfirm.step'),
        htmlAction(confirmUrl, label),
        s.html('mail.profileConfirm.validity', {
          days: escapeHtml(String(CONFIRMATION_VALID_DAYS)),
        }),
      ),
    };
  },
};

/**
 * "There is already an account for this address" (E32).
 *
 * The mail that makes an unvarying form answer survivable. Somebody who
 * registers twice — or whose address somebody else typed — gets told what the
 * form is not allowed to say, in the one place where saying it reveals nothing:
 * their own inbox. It changes nothing and grants nothing.
 */
const profileExists: MailTemplate<ProfileExistsMailContext> = {
  name: 'account already exists',
  keys: [
    ...COMMON_KEYS,
    'mail.profileExists.subject',
    'mail.profileExists.intro',
    'mail.profileExists.unchanged',
    'mail.profileExists.action',
  ],

  render(s: MailStrings, context: ProfileExistsMailContext): RenderedMail {
    const { firstName, loginUrl } = context;
    const label = s.text('mail.profileExists.action');

    return {
      subject: s.text('mail.profileExists.subject'),
      text: textBody(
        greeting(s, firstName),
        s.text('mail.profileExists.intro'),
        s.text('mail.profileExists.unchanged'),
        textAction(s, label, loginUrl),
      ),
      html: htmlBody(
        htmlGreeting(s, firstName),
        s.html('mail.profileExists.intro'),
        s.html('mail.profileExists.unchanged'),
        htmlAction(loginUrl, label),
      ),
    };
  },
};

export const MAIL_TEMPLATES = {
  registrationConfirmation,
  registrationConfirmed,
  registrationCancelled,
  invitation,
  profileConfirmation,
  profileExists,
} as const;

/** Every key the six mails between them can ask for — CI checks this list. */
export const ALL_MAIL_KEYS: readonly string[] = [
  ...new Set(
    Object.values(MAIL_TEMPLATES).flatMap((template) => template.keys),
  ),
].sort();

/** The period in the language the mail turned out to be written in (E8, F78). */
function period(event: MailEvent, locale: string): string {
  return formatEventPeriod(event, locale);
}

function greeting(s: MailStrings, firstName: string): string {
  return s.text(GREETING, { name: firstName });
}

function htmlGreeting(s: MailStrings, firstName: string): Html {
  return s.html(GREETING, { name: escapeHtml(firstName) });
}

/**
 * The call to action in a text mail: the label, then the bare address.
 *
 * The same key as the HTML link's label, so the two renderings cannot end up
 * inviting the reader to do different things. The colon is a key of its own
 * rather than a character in the code — French sets it as `Label :`, and a
 * punctuation mark welded on in TypeScript is one a translator cannot reach.
 */
function textAction(s: MailStrings, label: string, url: string): string {
  return `${s.text(ACTION_LINE, { label })}\n${url}`;
}

function textEventBlock(s: MailStrings, event: MailEvent): readonly string[] {
  return [
    s.text(EVENT_WHEN, { period: period(event, s.locale) }),
    s.text(EVENT_DETAILS, { url: event.url }),
  ];
}

function htmlEventBlock(
  s: MailStrings,
  event: MailEvent,
  withName: boolean,
): Html {
  return htmlLines(
    ...(withName ? [htmlStrong(escapeHtml(event.name))] : []),
    s.html(EVENT_WHEN, { period: escapeHtml(period(event, s.locale)) }),
    s.html(EVENT_DETAILS, { url: htmlLink(event.url, event.url) }),
  );
}

/** Paragraphs of a plain-text mail, separated by one blank line. */
function textBody(...paragraphs: readonly string[]): string {
  return paragraphs.join('\n\n');
}
