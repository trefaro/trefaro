import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  NewsletterConsentCounts,
  NewsletterConsentRow,
  NewsletterRepository,
  NewsletterSubscriptionInput,
  NewsletterSubscriptionRecord,
} from '../../business/newsletter/ports/newsletter.repository';
import { NewsletterSubscriptionEntity } from '../entities';

/**
 * A sign-up that is stored once, however often it is made.
 *
 * `ON CONFLICT` on the two expressions of `UQ_newsletter_subscription_address`,
 * so a repeat is not a second row and not an error either — it comes back as
 * the row that is already there, and the service decides what to send. Written
 * as one statement rather than read-then-insert: two people can sign up the
 * same address at the same moment, and the unique index is the only thing that
 * can settle that.
 *
 * `updated_at` moves on a repeat and `confirmed_at` is deliberately untouched:
 * asking for the mail again is not a consent, and a row that was confirmed
 * stays confirmed.
 */
const SAVE = `
  INSERT INTO "newsletter_subscription" ("email", "event_series_id")
  VALUES ($1, $2)
  ON CONFLICT (lower("email"), "event_series_id")
  DO UPDATE SET "updated_at" = now()
  RETURNING "id",
            "email",
            "event_series_id" AS "seriesId",
            "confirmed_at"    AS "confirmedAt",
            "created_at"      AS "createdAt"
`;

/**
 * The consents of an instance — both sources, one statement (E45).
 *
 * Three rules live in this SQL instead of in a service above it (F152, F173),
 * and each of them is one line here:
 *
 * - `confirmed_at IS NOT NULL` on **both** halves. An unconfirmed request
 *   cannot be listed, because no method returns one. That is the whole worth
 *   of the double opt-in: an address a stranger typed is on no list.
 * - `NOT EXISTS (… objected …)`. An address that used the objection link of an
 *   invitation (F24) appears in no further list, and this is a further list.
 *   By address, because the objection was about being written to at all.
 * - `GROUP BY` on the form half. Somebody who ticked the box for three events
 *   of one series said one thing about that series; three rows would be three
 *   answers to a question that was asked once. `min(confirmed_at)` is when
 *   they first said it.
 *
 * The two halves stay apart (`UNION ALL`, not `UNION`): an address that ticked
 * the box **and** signed up in the app has said yes twice, in two places, about
 * two different things — and saying which is the one job E45 gives this list.
 */
const CONSENTS = `
  WITH objected AS (
    SELECT DISTINCT lower("email") AS email
      FROM "registration"
     WHERE "contact_opt_out" = true
  ),
  consents AS (
    SELECT lower(r."email")        AS email,
           'form'::text            AS source,
           min(r."confirmed_at")   AS confirmed_at,
           e."series_id"           AS series_id,
           NULL::uuid              AS subscription_id
      FROM "registration" r
      JOIN "event" e ON e."id" = r."event_id"
     WHERE r."newsletter_opt_in" = true
       AND r."confirmed_at" IS NOT NULL
     GROUP BY lower(r."email"), e."series_id"
    UNION ALL
    SELECT lower(ns."email"),
           'app'::text,
           ns."confirmed_at",
           ns."event_series_id",
           ns."id"
      FROM "newsletter_subscription" ns
     WHERE ns."confirmed_at" IS NOT NULL
  )
  SELECT * FROM consents c
   WHERE NOT EXISTS (SELECT 1 FROM objected o WHERE o.email = c.email)
`;

const PAGE = `
  SELECT c."email",
         c."source",
         c."confirmed_at"    AS "confirmedAt",
         c."series_id"       AS "seriesId",
         c."subscription_id" AS "subscriptionId"
    FROM (${CONSENTS}) c
   ORDER BY c."confirmed_at" DESC, c."email" ASC
   LIMIT $1 OFFSET $2
`;

const COUNTS = `
  SELECT count(*)::int                                        AS "total",
         count(*) FILTER (WHERE c."source" = 'form')::int      AS "fromForm",
         count(*) FILTER (WHERE c."source" = 'app')::int       AS "fromApp",
         count(DISTINCT c."email")::int                        AS "addresses"
    FROM (${CONSENTS}) c
`;

interface RawConsent {
  readonly email: string;
  readonly source: string;
  readonly confirmedAt: Date;
  readonly seriesId: string | null;
  readonly subscriptionId: string | null;
}

interface RawSubscription {
  readonly id: string;
  readonly email: string;
  readonly seriesId: string | null;
  readonly confirmedAt: Date | null;
  readonly createdAt: Date;
}

/** PostgreSQL implementation of {@link NewsletterRepository}. */
@Injectable()
export class TypeormNewsletterRepository implements NewsletterRepository {
  constructor(
    @InjectRepository(NewsletterSubscriptionEntity)
    private readonly repository: Repository<NewsletterSubscriptionEntity>,
  ) {}

  async save(
    input: NewsletterSubscriptionInput,
  ): Promise<NewsletterSubscriptionRecord> {
    const [row] = await this.repository.manager.query<
      readonly RawSubscription[]
    >(SAVE, [input.email, input.seriesId]);
    return toRecord(row);
  }

  async findById(id: string): Promise<NewsletterSubscriptionRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? fromEntity(row) : null;
  }

  async confirm(id: string): Promise<NewsletterSubscriptionRecord | null> {
    // `COALESCE`, so a second click keeps the first moment: when somebody
    // consented is not a fact a repeated click may rewrite.
    const [row] = await this.repository.manager.query<
      readonly RawSubscription[]
    >(
      `
        UPDATE "newsletter_subscription"
           SET "confirmed_at" = COALESCE("confirmed_at", now()),
               "updated_at" = now()
         WHERE "id" = $1
        RETURNING "id",
                  "email",
                  "event_series_id" AS "seriesId",
                  "confirmed_at"    AS "confirmedAt",
                  "created_at"      AS "createdAt"
      `,
      [id],
    );
    return row ? toRecord(row) : null;
  }

  async remove(id: string): Promise<boolean> {
    const result = await this.repository.delete({ id });
    return (result.affected ?? 0) > 0;
  }

  async listConsents(query: {
    readonly offset: number;
    readonly limit: number;
  }): Promise<readonly NewsletterConsentRow[]> {
    const rows = await this.repository.manager.query<readonly RawConsent[]>(
      PAGE,
      [query.limit, query.offset],
    );
    return rows.map(toConsent);
  }

  async countConsents(): Promise<NewsletterConsentCounts> {
    const [row] =
      await this.repository.manager.query<readonly NewsletterConsentCounts[]>(
        COUNTS,
      );
    return row;
  }
}

function toConsent(row: RawConsent): NewsletterConsentRow {
  return {
    email: row.email,
    // The two values the `UNION` above can produce, and nothing else can reach
    // this line — the cast is the seam between SQL and the type, not a guess.
    source: row.source === 'app' ? 'app' : 'form',
    confirmedAt: new Date(row.confirmedAt),
    seriesId: row.seriesId,
    subscriptionId: row.subscriptionId,
  };
}

function toRecord(row: RawSubscription): NewsletterSubscriptionRecord {
  return {
    id: row.id,
    email: row.email,
    seriesId: row.seriesId,
    confirmedAt: row.confirmedAt ? new Date(row.confirmedAt) : null,
    createdAt: new Date(row.createdAt),
  };
}

function fromEntity(
  row: NewsletterSubscriptionEntity,
): NewsletterSubscriptionRecord {
  return {
    id: row.id,
    email: row.email,
    seriesId: row.seriesId,
    confirmedAt: row.confirmedAt,
    createdAt: row.createdAt,
  };
}
