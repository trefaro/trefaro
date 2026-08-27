export { MailDeliveryError, MailService } from './mail.service';
export { MailModule } from './mail.module';
export { PublicLinks } from './public-links.service';
export { MAILER, type Mailer, type OutgoingMail } from './ports/mailer';
export {
  FALLBACK_LOCALE,
  MAIL_TEMPLATE_LOCALES,
  mailTemplates,
  type ConfirmationMailContext,
  type InvitationMailContext,
  type MailEvent,
  type MailTemplates,
  type ReceiptMailContext,
  type RegistrationMailContext,
  type RenderedMail,
} from './templates';
