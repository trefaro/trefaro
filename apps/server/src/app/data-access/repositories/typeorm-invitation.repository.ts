import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { InvitationCounts } from '@trefaro/shared-models';
import { Repository } from 'typeorm';
import type {
  InvitationRecord,
  InvitationRepository,
  InvitationSlice,
  NewInvitation,
  PendingRecipient,
} from '../../business/invitations/ports/invitation.repository';
import { InvitationRecipientEntity, InvitationEntity } from '../entities';

/**
 * PostgreSQL implementation of the invitation port (FR 2.4, F24).
 *
 * Two queries here read the `registration` table, which another module's port
 * owns: {@link nextPending} joins it for the address and the first name, and
 * that is the whole reason no address is stored in `invitation_recipient`. It is
 * a join inside the data access layer between two core tables that a foreign key
 * already ties together — not a business-layer shortcut. The alternative would
 * be the business layer asking another service for one registration at a time,
 * two hundred times, to compose two hundred mails.
 */
@Injectable()
export class TypeormInvitationRepository implements InvitationRepository {
  constructor(
    @InjectRepository(InvitationEntity)
    private readonly repository: Repository<InvitationEntity>,
    @InjectRepository(InvitationRecipientEntity)
    private readonly recipients: Repository<InvitationRecipientEntity>,
  ) {}

  /**
   * The invitation and its recipients together, or neither (F56).
   *
   * In one transaction because an invitation without recipients would be a
   * message that never goes anywhere, and recipients without an invitation
   * would be rows the sender picks up and cannot compose a mail for.
   *
   * `orIgnore` on the recipients: the selection has already been deduplicated
   * by address in the business layer, and the unique constraint is the second
   * line — two ids of the same address must not make the whole send fail.
   */
  async create(invitation: NewInvitation): Promise<InvitationRecord> {
    return this.repository.manager.transaction(
      async (manager): Promise<InvitationRecord> => {
        const row = await manager.getRepository(InvitationEntity).save(
          manager.getRepository(InvitationEntity).create({
            seriesId: invitation.seriesId,
            eventId: invitation.eventId,
            subject: invitation.subject,
            body: invitation.body,
          }),
        );

        await manager
          .createQueryBuilder()
          .insert()
          .into(InvitationRecipientEntity)
          .values(
            invitation.registrationIds.map((registrationId) => ({
              invitationId: row.id,
              registrationId,
              status: 'pending' as const,
            })),
          )
          .orIgnore()
          .execute();

        return toRecord(row);
      },
    );
  }

  async findById(id: string): Promise<InvitationRecord | null> {
    const row = await this.repository.findOneBy({ id });
    return row ? toRecord(row) : null;
  }

  async findBySeries(
    seriesId: string,
    offset: number,
    limit: number,
  ): Promise<InvitationSlice> {
    const [rows, total] = await this.repository
      .createQueryBuilder('invitation')
      .where('invitation.series_id = :seriesId', { seriesId })
      // The id last, so two invitations written in the same millisecond keep a
      // stable order across pages.
      .orderBy('invitation.created_at', 'DESC')
      .addOrderBy('invitation.id', 'DESC')
      .skip(offset)
      .take(limit)
      .getManyAndCount();

    return { rows: rows.map(toRecord), total };
  }

  async countsFor(
    invitationIds: readonly string[],
  ): Promise<ReadonlyMap<string, InvitationCounts>> {
    if (invitationIds.length === 0) return new Map();

    const rows = (await this.recipients.query(
      `SELECT invitation_id,
              count(*)::int AS recipients,
              count(*) FILTER (WHERE status = 'sent')::int AS sent,
              count(*) FILTER (WHERE status = 'failed')::int AS failed
         FROM invitation_recipient
        WHERE invitation_id = ANY($1::uuid[])
        GROUP BY invitation_id`,
      [[...invitationIds]],
    )) as CountRow[];

    return new Map(
      rows.map((row) => [
        row.invitation_id,
        {
          recipients: row.recipients,
          sent: row.sent,
          failed: row.failed,
        },
      ]),
    );
  }

  /**
   * The next recipient to write to, with what a mail needs.
   *
   * Ordered by id rather than by insertion: recipients of one invitation are
   * written in a single statement, so there is no meaningful order among them —
   * what matters is that the order is *stable*, or the sender could alternate
   * between two rows forever.
   */
  async nextPending(invitationId: string): Promise<PendingRecipient | null> {
    const rows = (await this.recipients.query(
      `SELECT recipient.id AS id,
              recipient.registration_id AS registration_id,
              registration.email AS email,
              registration.first_name AS first_name
         FROM invitation_recipient recipient
         JOIN registration ON registration.id = recipient.registration_id
        WHERE recipient.invitation_id = $1
          AND recipient.status = 'pending'
        ORDER BY recipient.id
        LIMIT 1`,
      [invitationId],
    )) as PendingRow[];

    const row = rows[0];
    return row
      ? {
          id: row.id,
          registrationId: row.registration_id,
          email: row.email,
          firstName: row.first_name,
        }
      : null;
  }

  async markSent(recipientId: string): Promise<void> {
    await this.recipients.update(
      { id: recipientId },
      { status: 'sent', sentAt: new Date(), failure: null },
    );
  }

  async markFailed(recipientId: string, failure: string): Promise<void> {
    await this.recipients.update(
      { id: recipientId },
      // Truncated, because this is the mail server's own words in a column an
      // organizer reads — a stack trace in a table cell tells nobody anything.
      { status: 'failed', failure: failure.slice(0, 500) },
    );
  }

  /**
   * Stamps the invitation as finished, if and only if nothing is pending.
   *
   * The condition is in the statement rather than in the caller: two senders
   * that somehow ran at once must not be able to declare a send finished while
   * the other is still working through it.
   */
  async finish(invitationId: string): Promise<void> {
    await this.repository.query(
      `UPDATE invitation
          SET finished_at = now()
        WHERE id = $1
          AND finished_at IS NULL
          AND NOT EXISTS (
                SELECT 1 FROM invitation_recipient
                 WHERE invitation_id = $1 AND status = 'pending'
              )`,
      [invitationId],
    );
  }

  async unfinished(): Promise<readonly string[]> {
    const rows = (await this.repository.query(
      `SELECT invitation.id AS id
         FROM invitation
        WHERE EXISTS (
                SELECT 1 FROM invitation_recipient
                 WHERE invitation_id = invitation.id AND status = 'pending'
              )
        ORDER BY invitation.created_at`,
    )) as { id: string }[];
    return rows.map((row) => row.id);
  }
}

/** `count(*)::int` is cast in SQL: PostgreSQL's `count` is a 64-bit integer. */
interface CountRow {
  invitation_id: string;
  recipients: number;
  sent: number;
  failed: number;
}

interface PendingRow {
  id: string;
  registration_id: string;
  email: string;
  first_name: string;
}

function toRecord(row: InvitationEntity): InvitationRecord {
  return {
    id: row.id,
    seriesId: row.seriesId,
    eventId: row.eventId,
    subject: row.subject,
    body: row.body,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}
