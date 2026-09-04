import { BadRequestException, NotFoundException } from '@nestjs/common';
import type { EventSeriesService } from '../event-series';
import { MailDeliveryError, type MailService, type PublicLinks } from '../mail';
import type { TokenSigner } from '../security';
import { NewsletterService } from './newsletter.service';
import type {
  NewsletterConsentCounts,
  NewsletterConsentRow,
  NewsletterRepository,
  NewsletterSubscriptionInput,
  NewsletterSubscriptionRecord,
} from './ports/newsletter.repository';

/**
 * An in-memory stand-in for the one rule this port keeps in SQL: one row per
 * address and series, `NULL` included.
 *
 * Only that rule is imitated — the audience query is not, and must not be. What
 * it promises (only confirmed consents, no objected address, one row per source)
 * is a property of its statement, so it is asserted against a real database in
 * `apps/server-e2e/src/api/newsletter.spec.ts`. Imitating it here would be
 * asserting that this fake works.
 */
class FakeNewsletterRepository implements NewsletterRepository {
  readonly rows: NewsletterSubscriptionRecord[] = [];
  readonly listed: { offset: number; limit: number }[] = [];
  consents: readonly NewsletterConsentRow[] = [];
  counts: NewsletterConsentCounts = {
    total: 0,
    fromForm: 0,
    fromApp: 0,
    addresses: 0,
  };
  private next = 1;

  async save(
    input: NewsletterSubscriptionInput,
  ): Promise<NewsletterSubscriptionRecord> {
    const existing = this.rows.find(
      (row) =>
        row.email === input.email.toLowerCase() &&
        row.seriesId === input.seriesId,
    );
    if (existing) return existing;

    const created: NewsletterSubscriptionRecord = {
      id: `subscription-${this.next++}`,
      email: input.email,
      seriesId: input.seriesId,
      confirmedAt: null,
      createdAt: new Date('2026-09-04T08:00:00.000Z'),
    };
    this.rows.push(created);
    return created;
  }

  async findById(id: string): Promise<NewsletterSubscriptionRecord | null> {
    return this.rows.find((row) => row.id === id) ?? null;
  }

  async confirm(id: string): Promise<NewsletterSubscriptionRecord | null> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return null;
    const confirmed = {
      ...this.rows[index],
      confirmedAt: this.rows[index].confirmedAt ?? new Date(),
    };
    this.rows[index] = confirmed;
    return confirmed;
  }

  async remove(id: string): Promise<boolean> {
    const index = this.rows.findIndex((row) => row.id === id);
    if (index < 0) return false;
    this.rows.splice(index, 1);
    return true;
  }

  async listConsents(query: {
    readonly offset: number;
    readonly limit: number;
  }): Promise<readonly NewsletterConsentRow[]> {
    this.listed.push({ offset: query.offset, limit: query.limit });
    return this.consents;
  }

  async countConsents(): Promise<NewsletterConsentCounts> {
    return this.counts;
  }
}

const consent = (
  over: Partial<NewsletterConsentRow> = {},
): NewsletterConsentRow => ({
  email: 'amina@example.org',
  source: 'app',
  confirmedAt: new Date('2026-09-03T10:00:00.000Z'),
  seriesId: null,
  subscriptionId: 'subscription-1',
  ...over,
});

/**
 * The newsletter (FR 4.8, E45) — what this service decides on its own.
 *
 * Which is: what a repeated sign-up sends, that the answer never varies, what a
 * confirmation link is worth, and that the overview names its series in one
 * lookup. The list's *contents* are the port's promise and are asserted against
 * a real database.
 */
describe('NewsletterService', () => {
  let repository: FakeNewsletterRepository;
  let service: NewsletterService;
  let sent: { to: string; context: unknown }[];
  let signed: { purpose: string; subject: string }[];
  let failMail: boolean;
  let namesAskedFor: string[][];

  beforeEach(() => {
    repository = new FakeNewsletterRepository();
    sent = [];
    signed = [];
    failMail = false;
    namesAskedFor = [];

    const mail = {
      sendNewsletterConfirmation: async (to: string, content: unknown) => {
        if (failMail) throw new MailDeliveryError('smtp down');
        // Resolved the way `MailService` resolves it, so a context built in the
        // final language is what the assertions see (F125).
        const context =
          typeof content === 'function' ? await content('de') : content;
        sent.push({ to, context });
      },
    } as unknown as MailService;

    const tokens = {
      sign: (purpose: string, subject: string) => {
        signed.push({ purpose, subject });
        return `token-for-${subject}`;
      },
      verify: (purpose: string, token: string) =>
        purpose === 'newsletter-confirmation' && token.startsWith('token-for-')
          ? token.slice('token-for-'.length)
          : null,
    } as unknown as TokenSigner;

    const links = {
      token: (path: string, token: string) =>
        `https://events.example.org${path}?token=${token}`,
    } as unknown as PublicLinks;

    const series = {
      getPublicBySlug: async (slug: string) => {
        if (slug !== 'buergerraete') {
          throw new NotFoundException(`No event series at "${slug}"`);
        }
        return { id: 'series-1', slug };
      },
      nameOf: async (id: string, locale?: string) =>
        `${id} in ${locale ?? 'default'}`,
      namesOf: async (ids: readonly string[], locale?: string) => {
        namesAskedFor.push([...ids]);
        return new Map(
          ids.map((id) => [id, `${id} in ${locale ?? 'default'}`]),
        );
      },
    } as unknown as EventSeriesService;

    service = new NewsletterService(repository, mail, tokens, links, series);
  });

  describe('subscribe', () => {
    it('stores the address in one case and sends the confirmation', async () => {
      const answer = await service.subscribe({ email: ' Amina@Example.ORG ' });

      expect(answer).toEqual({ email: 'amina@example.org' });
      expect(repository.rows).toEqual([
        expect.objectContaining({
          email: 'amina@example.org',
          seriesId: null,
          confirmedAt: null,
        }),
      ]);
      expect(signed).toEqual([
        { purpose: 'newsletter-confirmation', subject: 'subscription-1' },
      ]);
      expect(sent).toEqual([
        {
          to: 'amina@example.org',
          context: {
            confirmUrl:
              'https://events.example.org/newsletter/confirm?token=token-for-subscription-1',
            seriesName: null,
          },
        },
      ]);
    });

    it('resolves a series by its slug and names it in the mail', async () => {
      await service.subscribe({
        email: 'amina@example.org',
        seriesSlug: 'buergerraete',
      });

      expect(repository.rows[0].seriesId).toBe('series-1');
      // Read inside the content function, so the name is in the language the
      // letter turned out to be written in (F125) — 'de' here.
      expect(sent[0].context).toEqual(
        expect.objectContaining({ seriesName: 'series-1 in de' }),
      );
    });

    it('refuses a slug no published series has', async () => {
      // About a series and not about an address: series are public, so this 404
      // discloses nothing the start page does not.
      await expect(
        service.subscribe({ email: 'amina@example.org', seriesSlug: 'ghost' }),
      ).rejects.toThrow(NotFoundException);

      expect(repository.rows).toEqual([]);
      expect(sent).toEqual([]);
    });

    it('sends the link again for an address that never confirmed', async () => {
      await service.subscribe({ email: 'amina@example.org' });
      const answer = await service.subscribe({ email: 'amina@example.org' });

      // One row, two letters: the unique index decides the first, and somebody
      // who did not get the mail has to be able to ask for it again.
      expect(repository.rows).toHaveLength(1);
      expect(sent).toHaveLength(2);
      expect(answer).toEqual({ email: 'amina@example.org' });
    });

    it('sends nothing to an address that is already on the list', async () => {
      await service.subscribe({ email: 'amina@example.org' });
      await service.confirm('token-for-subscription-1');
      sent = [];

      const answer = await service.subscribe({ email: 'amina@example.org' });

      // The same answer, and no letter: there would be nothing in it to do.
      expect(answer).toEqual({ email: 'amina@example.org' });
      expect(sent).toEqual([]);
      expect(repository.rows).toHaveLength(1);
    });

    it('answers the same way when the mail cannot be sent (E45, E32)', async () => {
      failMail = true;

      const answer = await service.subscribe({ email: 'amina@example.org' });

      // A 503 for one address and a 200 for the next would tell a stranger
      // which addresses this instance knows — from a form anybody may post to.
      expect(answer).toEqual({ email: 'amina@example.org' });
      expect(repository.rows).toHaveLength(1);
      expect(repository.rows[0].confirmedAt).toBeNull();
    });
  });

  describe('confirm', () => {
    beforeEach(async () => {
      await service.subscribe({ email: 'amina@example.org' });
    });

    it('turns the sign-up into a consent', async () => {
      const result = await service.confirm('token-for-subscription-1');

      expect(result).toEqual({ state: 'confirmed' });
      expect(repository.rows[0].confirmedAt).toBeInstanceOf(Date);
    });

    it('reports what is already true on a second click (E5b)', async () => {
      await service.confirm('token-for-subscription-1');
      const again = await service.confirm('token-for-subscription-1');

      expect(again).toEqual({ state: 'already-confirmed' });
    });

    it('refuses a token signed for something else', async () => {
      // The purpose is inside the signature, so a confirmation link for an
      // account cannot add an address to this list.
      await expect(service.confirm('profile-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('says the same thing for a sign-up that is gone', async () => {
      await repository.remove('subscription-1');

      await expect(service.confirm('token-for-subscription-1')).rejects.toThrow(
        /not valid any more/i,
      );
    });
  });

  describe('audience', () => {
    it('names every series of the page in one lookup (F49)', async () => {
      repository.consents = [
        consent({ seriesId: 'series-1' }),
        consent({ email: 'ben@example.org', seriesId: 'series-1' }),
        consent({ email: 'chi@example.org', source: 'form', seriesId: null }),
      ];
      repository.counts = {
        total: 3,
        fromForm: 1,
        fromApp: 2,
        addresses: 3,
      };

      const page = await service.audience({}, 'de');

      expect(namesAskedFor).toEqual([['series-1', 'series-1']]);
      expect(page.rows.map((row) => row.seriesName)).toEqual([
        'series-1 in de',
        'series-1 in de',
        // `null` and not "instance": what an instance-wide consent is called is
        // the reader's word, not the server's.
        null,
      ]);
      expect(page.counts).toEqual(repository.counts);
      expect(page.total).toBe(3);
    });

    it('asks for no names at all when no row has a series', async () => {
      repository.consents = [consent()];

      await service.audience({});

      expect(namesAskedFor).toEqual([[]]);
    });

    it('turns the page number into an offset and caps the size', async () => {
      await service.audience({ page: 3, pageSize: 5000 });

      expect(repository.listed).toEqual([{ offset: 400, limit: 200 }]);
    });

    it('reports the total the pages divide, not the size of this page', async () => {
      repository.consents = [consent()];
      repository.counts = {
        total: 412,
        fromForm: 400,
        fromApp: 12,
        addresses: 405,
      };

      const page = await service.audience({});

      expect(page.total).toBe(412);
      expect(page.rows).toHaveLength(1);
    });
  });

  describe('remove', () => {
    it('takes one sign-up back, and a second attempt is not an error', async () => {
      await service.subscribe({ email: 'amina@example.org' });

      await service.remove('subscription-1');
      await service.remove('subscription-1');

      expect(repository.rows).toEqual([]);
    });
  });
});
