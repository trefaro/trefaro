export { MailDeliveryError, MailService } from './mail.service';
export { MailCatalogue } from './mail-catalogue.service';
export { MailModule } from './mail.module';
export { PublicLinks } from './public-links.service';
export { MAILER, type Mailer, type OutgoingMail } from './ports/mailer';
export {
  ALL_MAIL_KEYS,
  MAIL_TEMPLATES,
  MissingMailTextError,
  mailStrings,
  type ConfirmationMailContext,
  type InvitationMailContext,
  type MailEvent,
  type MailStrings,
  type MailTemplate,
  type ProfileConfirmationMailContext,
  type ProfileExistsMailContext,
  type ReceiptMailContext,
  type RegistrationMailContext,
  type RenderedMail,
} from './templates';
