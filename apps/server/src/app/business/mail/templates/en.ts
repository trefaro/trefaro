import { formatEventPeriod } from '@trefaro/shared-models';
import { escapeHtml, htmlAction, htmlBody, htmlLink } from './html';
import type {
  ConfirmationMailContext,
  MailTemplates,
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

  registrationConfirmed(context: RegistrationMailContext): RenderedMail {
    const { event, firstName } = context;
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
        'See you there.',
      ].join('\n'),
      html: htmlBody(
        `Hello ${escapeHtml(firstName)},`,
        `your registration for <strong>${escapeHtml(event.name)}</strong> is confirmed.`,
        `When: ${escapeHtml(period(context))}<br />` +
          `Details: ${htmlLink(event.url, event.url)}`,
        'See you there.',
      ),
    };
  },
};
