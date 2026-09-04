export { NewsletterModule } from './newsletter.module';
export { NewsletterService } from './newsletter.service';
export { NEWSLETTER_SIGNUPS_PER_WINDOW } from './public-newsletter.controller';
export {
  NEWSLETTER_REPOSITORY,
  type NewsletterConsentCounts,
  type NewsletterConsentRow,
  type NewsletterRepository,
  type NewsletterSubscriptionInput,
  type NewsletterSubscriptionRecord,
} from './ports/newsletter.repository';
