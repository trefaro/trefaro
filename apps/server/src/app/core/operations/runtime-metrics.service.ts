import { Injectable, Optional } from '@nestjs/common';

/** What the answers of this instance have been saying since it came up. */
export interface RequestTally {
  readonly succeeded: number;
  /** Everything from 400 to 499 except a 429, which has its own number. */
  readonly clientErrors: number;
  readonly throttled: number;
  readonly serverErrors: number;
}

/** The last fault, by the mark that also stands in the log line and the answer. */
export interface IncidentNote {
  readonly incident: string;
  readonly at: string;
  readonly status: number;
  /** Already redacted — see `all-exceptions.filter.ts`. */
  readonly path: string;
}

export interface MailTally {
  readonly sent: number;
  readonly failed: number;
  readonly lastFailureAt: string | null;
}

export interface RuntimeSnapshot {
  readonly startedAt: string;
  readonly uptimeSeconds: number;
  readonly requests: RequestTally;
  readonly lastIncident: IncidentNote | null;
  readonly mail: MailTally;
}

/**
 * The few numbers an operator needs when an instance behaves strangely (NFR 10,
 * NFR 11).
 *
 * Counters in memory and nothing else: no series, no storage, no second
 * process. One organization runs one instance (a decision of the thesis), and
 * for that the question is not "what did the graph look like at four" but "is
 * this thing answering, and if not, where do I look". The answer to the second
 * half is {@link IncidentNote}: the mark it carries is the same mark the log
 * line carries and the same one the failing answer carried back to whoever was
 * looking at the screen.
 *
 * They reset when the process does, and that is honest rather than a
 * limitation: a restart is the event an operator is usually asking about, and a
 * counter that survived one would hide it.
 */
@Injectable()
export class RuntimeMetricsService {
  private readonly startedAtMs: number;
  private succeeded = 0;
  private clientErrors = 0;
  private throttled = 0;
  private serverErrors = 0;
  private lastIncident: IncidentNote | null = null;
  private mailsSent = 0;
  private mailsFailed = 0;
  private lastMailFailureAt: string | null = null;

  /**
   * The clock, so a test can move it.
   *
   * `@Optional()` and not just a default value: Nest reads the emitted
   * parameter type, finds `Function`, and refuses to build the container —
   * a default value means nothing to it. Without the decorator this class
   * constructs perfectly in every unit test and the server does not start
   * (`operations.module.spec.ts`).
   */
  constructor(@Optional() private readonly now: () => number = Date.now) {
    this.startedAtMs = now();
  }

  recordSuccess(): void {
    this.succeeded += 1;
  }

  /**
   * @param path already redacted; this object is read by an endpoint, and an
   * endpoint that answered with a search term in it would undo the redaction.
   */
  recordFailure(status: number, path: string, incident?: string): void {
    if (status >= 500) this.serverErrors += 1;
    else if (status === 429) this.throttled += 1;
    else if (status >= 400) this.clientErrors += 1;
    else {
      // Below 400 never reaches the filter, and counting it as a failure here
      // would make the tally disagree with itself.
      this.succeeded += 1;
      return;
    }

    if (incident !== undefined) {
      this.lastIncident = {
        incident,
        at: new Date(this.now()).toISOString(),
        status,
        path,
      };
    }
  }

  recordMailSent(): void {
    this.mailsSent += 1;
  }

  recordMailFailure(): void {
    this.mailsFailed += 1;
    this.lastMailFailureAt = new Date(this.now()).toISOString();
  }

  snapshot(): RuntimeSnapshot {
    return {
      startedAt: new Date(this.startedAtMs).toISOString(),
      uptimeSeconds: Math.floor((this.now() - this.startedAtMs) / 1000),
      requests: {
        succeeded: this.succeeded,
        clientErrors: this.clientErrors,
        throttled: this.throttled,
        serverErrors: this.serverErrors,
      },
      lastIncident: this.lastIncident,
      mail: {
        sent: this.mailsSent,
        failed: this.mailsFailed,
        lastFailureAt: this.lastMailFailureAt,
      },
    };
  }
}
