import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type {
  NewsletterAudiencePage,
  NewsletterConfirmation,
  NewsletterConsent,
  NewsletterSignupAcknowledgement,
  NewsletterSignupRequest,
} from '@trefaro/shared-models';
import {
  DEFAULT_NEWSLETTER_PAGE_SIZE,
  MAX_NEWSLETTER_PAGE_SIZE,
  NEWSLETTER_CONFIRMATION_PATH,
} from '@trefaro/shared-models';
import { pageWindow } from '../common/page-window';
import { EventSeriesService } from '../event-series';
import { MailDeliveryError, MailService, PublicLinks } from '../mail';
import { CONFIRMATION_TOKEN_TTL_MS, TokenSigner } from '../security';
import {
  NEWSLETTER_REPOSITORY,
  type NewsletterConsentRow,
  type NewsletterRepository,
} from './ports/newsletter.repository';

/**
 * The newsletter opt-in administration (FR 4.8, E45).
 *
 * Small on purpose, and the reason is F8: **nothing here sends a newsletter.**
 * There is no dispatch in v1 and there will not be one; what this service does
 * is keep the record that somebody said yes, in a way the organization can show
 * and hand to whatever it already sends with. Everything below follows from
 * that one sentence.
 *
 * Four properties are load-bearing:
 *
 * 1. **A sign-up is an address, not a registration** (E45). No name, no event,
 *    no account: somebody who has never registered for anything may want to
 *    hear from the organization, and that is the person FR 4.8 is about.
 * 2. **The answer never varies** (E32 applied word for word). A new address,
 *    one that never confirmed, one that has been on the list for a year: the
 *    caller gets the address back and nothing else. So does a caller whose mail
 *    could not be sent — a 503 for one address and a 200 for the next would be
 *    precisely the disclosure the unvarying answer exists to prevent, and this
 *    form is public.
 * 3. **A consent begins at the click, not at the form** (E45). The row exists
 *    from the moment somebody types an address; it becomes a consent when the
 *    link in the mail is used. The overview reads only consents, and it cannot
 *    read anything else — no method returns an unconfirmed row.
 * 4. **A repeat is never a second row.** The unique index decides that
 *    (`NULLS NOT DISTINCT`, so the instance-wide list is one of its cases), and
 *    this service reacts by sending the letter that fits the state the address
 *    is already in — which for an address that is already on the list means no
 *    letter at all: there would be nothing in it to do, and the form's own
 *    wording says a mail comes only if the address is not on the list yet.
 */
@Injectable()
export class NewsletterService {
  private readonly logger = new Logger(NewsletterService.name);

  constructor(
    @Inject(NEWSLETTER_REPOSITORY)
    private readonly subscriptions: NewsletterRepository,
    private readonly mail: MailService,
    private readonly tokens: TokenSigner,
    // Absolute addresses into the participant client: the confirmation link is
    // read in a mail client, not in the app.
    private readonly links: PublicLinks,
    // Two questions, both about series: which one a slug means (the sign-up),
    // and what a set of them is called (the overview).
    private readonly series: EventSeriesService,
  ) {}

  /**
   * Signs an address up, and sends the letter that fits its state.
   *
   * The series comes in as a slug, because that is what a public page knows
   * (E7), and an unpublished or unknown one is a 404 like everywhere else: a
   * form that offers news about a series nobody can see would be a form on a
   * page that does not exist. That 404 is not a disclosure about an address —
   * it is about a series, and series are public.
   */
  async subscribe(
    input: NewsletterSignupRequest,
  ): Promise<NewsletterSignupAcknowledgement> {
    const email = normalizeEmail(input.email);
    const seriesId = await this.seriesIdFor(input.seriesSlug);

    const subscription = await this.subscriptions.save({ email, seriesId });
    if (!subscription.confirmedAt) {
      await this.requestConfirmation(subscription.id, email, seriesId);
    }

    return { email };
  }

  /**
   * Turns a sign-up into a consent — and nothing else.
   *
   * Idempotent for the reason every confirmation in this application is (E5b):
   * people click links twice, and a mail scanner that prefetched the link
   * cannot have confirmed anything, because the link opens a page and the page
   * posts here.
   *
   * A token whose row is gone is reported like an invalid one. It is not the
   * holder's business which of the two happened, and it does not change what
   * they can do about it: sign up again.
   */
  async confirm(token: string): Promise<NewsletterConfirmation> {
    const id = this.tokens.verify('newsletter-confirmation', token);
    if (!id) throw new BadRequestException(INVALID_LINK);

    const existing = await this.subscriptions.findById(id);
    if (!existing) throw new BadRequestException(INVALID_LINK);
    if (existing.confirmedAt) return { state: 'already-confirmed' };

    const confirmed = await this.subscriptions.confirm(id);
    if (!confirmed) throw new BadRequestException(INVALID_LINK);
    return { state: 'confirmed' };
  }

  /**
   * The overview an organizer reads (FR 4.8, E45).
   *
   * One page of consents plus the numbers under it. The series names are
   * resolved for the whole page in one lookup rather than one per row (F49),
   * and in the reader's language — a series' name is content and content is
   * translated (E7 names the exceptions, and a series' name is not one of
   * them).
   */
  async audience(
    query: { readonly page?: number; readonly pageSize?: number },
    locale?: string,
  ): Promise<NewsletterAudiencePage> {
    const { page, pageSize, offset } = pageWindow(
      query,
      DEFAULT_NEWSLETTER_PAGE_SIZE,
      MAX_NEWSLETTER_PAGE_SIZE,
    );

    const [rows, counts] = await Promise.all([
      this.subscriptions.listConsents({ offset, limit: pageSize }),
      this.subscriptions.countConsents(),
    ]);

    const names = await this.series.namesOf(
      rows.flatMap((row) => (row.seriesId ? [row.seriesId] : [])),
      locale,
    );

    return {
      rows: rows.map((row) => toConsent(row, names)),
      // The page's total is the count of consents, which is the same number the
      // breakdown adds up to — one query answers both rather than two answering
      // one question each and disagreeing under concurrent writes.
      total: counts.total,
      page,
      pageSize,
      counts,
    };
  }

  /**
   * Takes one sign-up back (E45).
   *
   * How an organization honours a withdrawal: somebody who asks to be taken
   * off the list has withdrawn a consent, and a withdrawn consent is not
   * archived — keeping the record of a consent that no longer exists is the
   * opposite of what the person asked for, which is the case E14's rule leaves
   * room for. Only the app source has a row to remove; a checkbox in a
   * registration form is part of that registration.
   *
   * Idempotent: a row that is already gone is not an error, because the
   * organizer's answer to the person is the same either way.
   */
  async remove(id: string): Promise<void> {
    await this.subscriptions.remove(id);
  }

  private async seriesIdFor(slug?: string): Promise<string | null> {
    if (!slug) return null;
    const series = await this.series.getPublicBySlug(slug);
    return series.id;
  }

  /**
   * Sends the confirmation, and lets nothing about it reach the caller.
   *
   * The failure is logged and swallowed on purpose (E45, E32, and the same
   * reasoning as E10's contact form): the row is written either way, the
   * person can sign up again, and an answer that varied with the mail server
   * would tell a stranger whether an address is already on the list.
   */
  private async requestConfirmation(
    id: string,
    email: string,
    seriesId: string | null,
  ): Promise<void> {
    const token = this.tokens.sign(
      'newsletter-confirmation',
      id,
      CONFIRMATION_TOKEN_TTL_MS,
    );

    try {
      await this.mail.sendNewsletterConfirmation(email, async (locale) => ({
        confirmUrl: this.links.token(NEWSLETTER_CONFIRMATION_PATH, token),
        // Resolved inside the content function, so the name is in the language
        // the letter turned out to be written in (F125).
        seriesName: seriesId
          ? await this.series.nameOf(seriesId, locale)
          : null,
      }));
    } catch (error: unknown) {
      if (!(error instanceof MailDeliveryError)) throw error;
      // Named without its recipient: what failed belongs in the log, who it was
      // for does not.
      this.logger.warn(
        'A newsletter confirmation could not be sent; the sign-up is stored ' +
          'and unconfirmed.',
      );
    }
  }
}

const INVALID_LINK =
  'This confirmation link is not valid any more. Please sign up again to ' +
  'receive a new one.';

function toConsent(
  row: NewsletterConsentRow,
  names: ReadonlyMap<string, string>,
): NewsletterConsent {
  return {
    email: row.email,
    source: row.source,
    confirmedAt: row.confirmedAt.toISOString(),
    seriesId: row.seriesId,
    // `null` for the instance-wide list, and also for a series whose name could
    // not be read — a row is not left out of the overview because of its label.
    seriesName: row.seriesId ? (names.get(row.seriesId) ?? null) : null,
    subscriptionId: row.subscriptionId,
  };
}

/** Addresses are compared in one form; the row keeps the spelling as typed. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
