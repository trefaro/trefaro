/** Port for stored Web Push subscriptions (FR 3.15). */

export interface PushSubscriptionRecord {
  readonly id: string;
  readonly endpoint: string;
  readonly p256dhKey: string;
  readonly authKey: string;
}

/**
 * A subscription together with the language to write to it in.
 *
 * The locale comes from the account the device is signed in to, and is `null`
 * for a device that has none — which is the instance's default language, a
 * question this port cannot answer (it is a row in `app_config`). The same two
 * steps a mail takes (F125), for the same reason: a notification cannot be
 * reloaded in another language.
 */
export interface PushTarget extends PushSubscriptionRecord {
  readonly locale: string | null;
}

export interface PushSubscriptionInput {
  readonly endpoint: string;
  readonly p256dhKey: string;
  readonly authKey: string;
  readonly userAgent: string | null;
  /**
   * The account that posted this subscription, or `null` (E43).
   *
   * Written on every save, including as `null`: a device that signs out has to
   * stop carrying somebody's messages, and the only request that says so is
   * the next subscribe without a session.
   */
  readonly userId: string | null;
}

/**
 * Reading subscriptions is reading an **audience**, never a table.
 *
 * There is deliberately no `findAll`. Until AP 11 there was one, because there
 * was one notification — "everybody" — and no way to say anything narrower. Now
 * there are two audiences and each is a promise this port keeps in SQL rather
 * than a filter a service applies afterwards (F152, F173): a caller cannot ask
 * for the devices of somebody who is not concerned, because there is no method
 * that would answer.
 */
export interface PushSubscriptionRepository {
  /** Stores a subscription, replacing any earlier one for the same endpoint. */
  save(input: PushSubscriptionInput): Promise<PushSubscriptionRecord>;

  /**
   * The devices a change to one event goes to (E43).
   *
   * Two groups in one answer, and both belong to it. The devices of the people
   * who **confirmed a place** — they made a plan around this event, and a
   * moved event is a correction to it. And every device **without an account**:
   * that an event was moved is public information, and somebody who subscribed
   * from a landing page may have it without registering for anything (E43).
   *
   * Never the devices of an account that is signed in but not registered for
   * this event: they get what they asked for, and this is not it.
   */
  findForEventChange(eventId: string): Promise<readonly PushTarget[]>;

  /**
   * The devices of one account — for a notification that is personal (E43).
   *
   * A device with no account is not among them, and cannot be: a new message
   * belongs to whoever it was written to, and a browser that never signed in
   * is not a person.
   */
  findForParticipant(userId: string): Promise<readonly PushTarget[]>;

  /** Idempotent: an already removed endpoint is not an error. */
  deleteByEndpoint(endpoint: string): Promise<void>;
}

export const PUSH_SUBSCRIPTION_REPOSITORY = Symbol(
  'TREFARO_PUSH_SUBSCRIPTION_REPOSITORY',
);
