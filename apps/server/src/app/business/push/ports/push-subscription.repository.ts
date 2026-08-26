/** Port for stored Web Push subscriptions (FR 3.15). */

export interface PushSubscriptionRecord {
  readonly id: string;
  readonly endpoint: string;
  readonly p256dhKey: string;
  readonly authKey: string;
}

export interface PushSubscriptionInput {
  readonly endpoint: string;
  readonly p256dhKey: string;
  readonly authKey: string;
  readonly userAgent: string | null;
}

export interface PushSubscriptionRepository {
  /** Stores a subscription, replacing any earlier one for the same endpoint. */
  save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord>;
  findAll(): Promise<readonly PushSubscriptionRecord[]>;
  /** Idempotent: an already removed endpoint is not an error. */
  deleteByEndpoint(endpoint: string): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  'TREFARO_PUSH_SUBSCRIPTION_REPOSITORY',
);
