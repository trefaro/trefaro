import { formatEventPeriod } from '@trefaro/shared-models';
import { escapeHtml, htmlAction, htmlBody, htmlLink } from './html';
import type {
  ConfirmationMailContext,
  MailTemplates,
  ReceiptMailContext,
  RegistrationMailContext,
  RenderedMail,
} from './types';

/**
 * German mail templates.
 *
 * The second mandatory language: the pilot partner and the first organizations
 * to run an instance work in German, and a confirmation mail is the one piece
 * of the product a participant cannot avoid reading.
 */
const LOCALE = 'de';

const period = (context: RegistrationMailContext): string =>
  formatEventPeriod(context.event, LOCALE);

export const germanMailTemplates: MailTemplates = {
  locale: LOCALE,

  registrationConfirmation(context: ConfirmationMailContext): RenderedMail {
    const { event, firstName, confirmUrl } = context;
    return {
      subject: `Bitte bestätige deine Anmeldung zu ${event.name}`,
      text: [
        `Hallo ${firstName},`,
        '',
        `du hast dich zu ${event.name} angemeldet (${period(context)}).`,
        '',
        'Es fehlt noch ein Schritt: Öffne den folgenden Link und bestätige deine ' +
          'Anmeldung.',
        '',
        confirmUrl,
        '',
        'Der Link ist 14 Tage gültig. Falls du dich nicht angemeldet hast, ' +
          'ignoriere diese Nachricht einfach — ohne die Bestätigung passiert nichts.',
      ].join('\n'),
      html: htmlBody(
        `Hallo ${escapeHtml(firstName)},`,
        `du hast dich zu <strong>${escapeHtml(event.name)}</strong> angemeldet ` +
          `(${escapeHtml(period(context))}).`,
        'Es fehlt noch ein Schritt: bestätige deine Anmeldung.',
        htmlAction(confirmUrl, 'Anmeldung bestätigen'),
        'Der Link ist 14 Tage gültig. Falls du dich nicht angemeldet hast, ' +
          'ignoriere diese Nachricht einfach — ohne die Bestätigung passiert nichts.',
      ),
    };
  },

  registrationConfirmed(context: ReceiptMailContext): RenderedMail {
    const { event, firstName, selfServiceUrl } = context;
    return {
      subject: `Deine Anmeldung zu ${event.name} ist bestätigt`,
      text: [
        `Hallo ${firstName},`,
        '',
        `deine Anmeldung zu ${event.name} ist bestätigt.`,
        '',
        `Wann: ${period(context)}`,
        `Alle Infos: ${event.url}`,
        '',
        'Deine persönliche Seite — für einzelne Programmpunkte anmelden, deine ' +
          'Angaben ansehen oder absagen:',
        '',
        selfServiceUrl,
        '',
        'Gib diesen Link nicht weiter: wer ihn hat, kann deine Anmeldung ändern.',
        '',
        'Wir freuen uns auf dich.',
      ].join('\n'),
      html: htmlBody(
        `Hallo ${escapeHtml(firstName)},`,
        `deine Anmeldung zu <strong>${escapeHtml(event.name)}</strong> ist bestätigt.`,
        `Wann: ${escapeHtml(period(context))}<br />` +
          `Alle Infos: ${htmlLink(event.url, event.url)}`,
        'Auf deiner persönlichen Seite kannst du dich für einzelne ' +
          'Programmpunkte anmelden, deine Angaben ansehen oder absagen.',
        htmlAction(selfServiceUrl, 'Meine Anmeldung öffnen'),
        'Gib diesen Link nicht weiter: wer ihn hat, kann deine Anmeldung ändern.',
        'Wir freuen uns auf dich.',
      ),
    };
  },
};
