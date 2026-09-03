import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  PushSubscriptionInput,
  PushSubscriptionRecord,
  PushSubscriptionRepository,
  PushTarget,
} from '../../business/push/ports/push-subscription.repository';
import { PushSubscriptionEntity } from '../entities';

/**
 * The columns of a device, in one place.
 *
 * Without the language: the two halves of the audience below answer that
 * question differently, and one of them answers it with "nobody has said"
 * (F125). Spelling it out per branch is what keeps that visible.
 */
const DEVICE_COLUMNS = `
  ps."id",
  ps."endpoint",
  ps."p256dh_key" AS "p256dhKey",
  ps."auth_key"   AS "authKey"
`;

/**
 * The devices a change to one event goes to (E43) — as one statement.
 *
 * A `UNION` of the two groups E43 names, and that it is one statement is the
 * point: the audience is what this SQL says, not what a service filters
 * afterwards (F152, F173). The halves cannot be asked for separately, so no
 * caller can reach the second one alone — which would be every browser this
 * instance has ever seen.
 *
 * The **registrants**: a confirmed registration, joined to an account by
 * address, because a registration has no `user_id` and is not going to get one
 * (E31, F118). `status = 'confirmed'` and nothing else — a pending
 * registration is an address that never answered its double opt-in, and a
 * cancelled one is somebody who said they are not coming.
 *
 * The **devices without an account**: `user_id IS NULL`, no join, no language
 * of their own. They cannot be narrowed to one event — a browser has no
 * address and has said nothing about what interests it — and E43 accepts
 * exactly that: what reaches them is what the landing page shows anyway.
 *
 * The two halves cannot overlap, since one has an account and the other does
 * not. `UNION` all the same, for the row within the first half: an address
 * holding two confirmed registrations for one event is one device, and being
 * told twice about one change is how a person learns to switch notifications
 * off.
 */
const FOR_EVENT_CHANGE = `
  SELECT ${DEVICE_COLUMNS}, p."preferred_locale" AS "locale"
    FROM "push_subscription" ps
    JOIN "user_profile" p ON p."id" = ps."user_id"
    JOIN "registration" r ON lower(r."email") = lower(p."email")
   WHERE r."event_id" = $1
     AND r."status" = 'confirmed'
  UNION
  SELECT ${DEVICE_COLUMNS}, NULL::text AS "locale"
    FROM "push_subscription" ps
   WHERE ps."user_id" IS NULL
`;

/** The devices of one account — the audience of anything personal (E43). */
const FOR_PARTICIPANT = `
  SELECT ${DEVICE_COLUMNS}, p."preferred_locale" AS "locale"
    FROM "push_subscription" ps
    JOIN "user_profile" p ON p."id" = ps."user_id"
   WHERE ps."user_id" = $1
`;

interface RawTarget {
  readonly id: string;
  readonly endpoint: string;
  readonly p256dhKey: string;
  readonly authKey: string;
  readonly locale: string | null;
}

/** PostgreSQL implementation of {@link PushSubscriptionRepository}. */
@Injectable()
export class TypeormPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repository: Repository<PushSubscriptionEntity>,
  ) {}

  async save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    // A browser may re-subscribe with the same endpoint and fresh keys, so the
    // endpoint is the conflict target rather than a reason to reject. `userId`
    // travels with it — including as `null`, which is how a device that signed
    // out stops being anybody's (E43).
    await this.repository.upsert(
      {
        endpoint: input.endpoint,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        userAgent: input.userAgent,
        userId: input.userId,
      },
      { conflictPaths: ['endpoint'] },
    );

    const row = await this.repository.findOneByOrFail({
      endpoint: input.endpoint,
    });
    return toRecord(row);
  }

  async findForEventChange(eventId: string): Promise<readonly PushTarget[]> {
    const rows = await this.repository.manager.query<readonly RawTarget[]>(
      FOR_EVENT_CHANGE,
      [eventId],
    );
    return rows.map(toTarget);
  }

  async findForParticipant(userId: string): Promise<readonly PushTarget[]> {
    const rows = await this.repository.manager.query<readonly RawTarget[]>(
      FOR_PARTICIPANT,
      [userId],
    );
    return rows.map(toTarget);
  }

  async deleteByEndpoint(endpoint: string): Promise<void> {
    await this.repository.delete({ endpoint });
  }
}

function toRecord(row: PushSubscriptionEntity): PushSubscriptionRecord {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dhKey: row.p256dhKey,
    authKey: row.authKey,
  };
}

function toTarget(row: RawTarget): PushTarget {
  return {
    id: row.id,
    endpoint: row.endpoint,
    p256dhKey: row.p256dhKey,
    authKey: row.authKey,
    locale: row.locale,
  };
}
