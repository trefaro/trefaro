/**
 * A notification as the business layer describes it.
 *
 * Deliberately small: participants get told that something they registered for
 * changed, with a link into the app — not a copy of the change itself. Push
 * payloads travel through a browser vendor's push service, so they carry as
 * little personal data as possible (NFR 7).
 */
export interface PushNotification {
  readonly title: string;
  readonly body: string;
  /** In-app path to open on click, e.g. `/events/42`. */
  readonly url?: string;
}

/** Outcome of one delivery attempt to all stored subscriptions. */
export interface PushDeliveryReport {
  readonly delivered: number;
  readonly failed: number;
  /** Endpoints the push service reported as gone; removed from storage. */
  readonly expired: number;
}
