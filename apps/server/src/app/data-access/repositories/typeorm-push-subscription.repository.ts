import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  PushSubscriptionInput,
  PushSubscriptionRecord,
  PushSubscriptionRepository,
} from '../../business/push/ports/push-subscription.repository';
import { PushSubscriptionEntity } from '../entities';

/** PostgreSQL implementation of {@link PushSubscriptionRepository}. */
@Injectable()
export class TypeormPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(
    @InjectRepository(PushSubscriptionEntity)
    private readonly repository: Repository<PushSubscriptionEntity>,
  ) {}

  async save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord> {
    // A browser may re-subscribe with the same endpoint and fresh keys, so the
    // endpoint is the conflict target rather than a reason to reject.
    await this.repository.upsert(
      {
        endpoint: input.endpoint,
        p256dhKey: input.p256dhKey,
        authKey: input.authKey,
        userAgent: input.userAgent,
      },
      { conflictPaths: ['endpoint'] },
    );

    const row = await this.repository.findOneByOrFail({
      endpoint: input.endpoint,
    });
    return toRecord(row);
  }

  async findAll(): Promise<readonly PushSubscriptionRecord[]> {
    const rows = await this.repository.find();
    return rows.map(toRecord);
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
