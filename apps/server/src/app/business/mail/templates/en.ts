import { formatEventPeriod } from '@trefaro/shared-models';
import { escapeHtml, htmlAction, htmlBody, htmlLink } from './html';
import type {
  ConfirmationMailContext,
  InvitationMailContext,
  MailTemplates,
  ReceiptMailContext,
  RegistrationMailContext,
  RenderedMail,
} from './types';

/**
 * English mail templates — the language every instance has (NFR 4).
 *
 * Written to be read by someone who registered five minutes ago and by someone
 * who has forgotten they did: each mail says which event it is about before it
 * asks for anything.
 */
const LOCALE = 'en';

const period = (context: RegistrationMailContext): string =>
  formatEventPeriod(context.event, LOCALE);

export const englishMailTemplates: MailTemplates = {
  locale: LOCALE,

  registrationConfirmation(context: ConfirmationMailContext): RenderedMail {
    const { event, firstName, confirmUrl } = context;
    return {
      subject: `Please confirm your registration for ${event.name}`,
      text: [
        `Hello ${firstName},`,
        '',
        `you registered for ${event.name} (${period(context)}).`,
        '',
        'One step is left: open the link below and confirm your registration.',
        '',
        confirmUrl,
        '',
        'The link is valid for 14 days. If you did not register, simply ignore ' +
          'this message — nothing happens without that confirmation.',
      ].join('\n'),
      html: htmlBody(
        `Hello ${escapeHtml(firstName)},`,
        `you registered for <strong>${escapeHtml(event.name)}</strong> ` +
          `(${escapeHtml(period(context))}).`,
        'One step is left: confirm your registration.',
        htmlAction(confirmUrl, 'Confirm my registration'),
        'The link is valid for 14 days. If you did not register, simply ignore ' +
          'this message — nothing happens without that confirmation.',
      ),
    };
  },

  registrationConfirmed(context: ReceiptMailContext): RenderedMail {
    const { event, firstName, selfServiceUrl } = context;
    return {
      subject: `Your registration for ${event.name} is confirmed`,
      text: [
        `Hello ${firstName},`,
        '',
        `your registration for ${event.name} is confirmed.`,
        '',
        `When: ${period(context)}`,
        `Details: ${event.url}`,
        '',
        'Your personal page — sign up for individual sessions, check what you ' +
          'entered, or cancel:',
        '',
        selfServiceUrl,
        '',
        'Keep this link to yourself: anyone who has it can change your ' +
          'registration.',
        '',
        'See you there.',
      ].join('\n'),
      html: htmlBody(
        `Hello ${escapeHtml(firstName)},`,
        `your registration for <strong>${escapeHtml(event.name)}</strong> is confirmed.`,
        `When: ${escapeHtml(period(context))}<br />` +
          `Details: ${htmlLink(event.url, event.url)}`,
        'On your personal page you can sign up for individual sessions, check ' +
          'what you entered, or cancel.',
        htmlAction(selfServiceUrl, 'Open my registration'),
        'Keep this link to yourself: anyone who has it can change your ' +
          'registration.',
        'See you there.',
      ),
    };
  },

  registrationCancelled(context: RegistrationMailContext): RenderedMail {
    const { event, firstName } = context;
    return {
      subject: `Your registration for ${event.name} was cancelled`,
      text: [
        `Hello ${firstName},`,
        '',
        `your registration for ${event.name} (${period(context)}) has been ` +
          'cancelled by the organizers. You are not expected there any more, ' +
          'and any sessions you had signed up for are free again.',
        '',
        'If that is not what you wanted, you can register again:',
        '',
        event.url,
      ].join('\n'),
      html: htmlBody(
        `Hello ${escapeHtml(firstName)},`,
        `your registration for <strong>${escapeHtml(event.name)}</strong> ` +
          `(${escapeHtml(period(context))}) has been cancelled by the ` +
          'organizers. You are not expected there any more, and any sessions ' +
          'you had signed up for are free again.',
        'If that is not what you wanted, you can register again.',
        htmlAction(event.url, 'Back to the event'),
      ),
    };
  },

  invitation(context: InvitationMailContext): RenderedMail {
    const { event, firstName, paragraphs, seriesName, subject, optOutUrl } =
      context;
    // Why this arrived and how to stop the next one. Not the organizer's words
    // and not optional: it is what makes writing to former participants
    // legitimate at all (E15).
    const footer =
      `You are receiving this message because you registered for an event of ` +
      `${seriesName}. If you would rather not be invited again, say so here — ` +
      'one click, no reply needed:';

    return {
      subject,
      text: [
        `Hello ${firstName},`,
        '',
        ...paragraphs.flatMap((paragraph) => [paragraph, '']),
        ...(event
          ? [
              `${event.name}`,
              `When: ${formatEventPeriod(event, LOCALE)}`,
              `Details: ${event.url}`,
              '',
            ]
          : []),
        footer,
        '',
        optOutUrl,
      ].join('\n'),
      html: htmlBody(
        `Hello ${escapeHtml(firstName)},`,
        ...paragraphs.map((paragraph) => escapeHtml(paragraph)),
        ...(event
          ? [
              `<strong>${escapeHtml(event.name)}</strong><br />` +
                `When: ${escapeHtml(formatEventPeriod(event, LOCALE))}<br />` +
                `Details: ${htmlLink(event.url, event.url)}`,
            ]
          : []),
        footer,
        htmlAction(optOutUrl, 'Do not invite me again'),
      ),
    };
  },
};
