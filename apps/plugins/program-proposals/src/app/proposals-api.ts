import { Injectable } from '@angular/core';
import {
  PROGRAM_PROPOSALS_MODULE_KEY,
  type NewProgramProposal,
  type ProgramProposal,
  type ProposalPage,
  type ProposalSummary,
} from '@trefaro/shared-models';

/**
 * Raised when the instance says there is no session (401).
 *
 * Its own error class because it is not a failure: proposals are interactions
 * and sit behind the login (E58), while the element is mounted for everybody —
 * so "no session" is a **state this plug-in renders**, an invitation to log in,
 * and not something to report as broken.
 */
export class NotSignedInError extends Error {
  constructor() {
    super('No participant session');
    this.name = 'NotSignedInError';
  }
}

/** Anything else the server said no to, with the status for the console. */
export class ProposalsRequestError extends Error {
  constructor(readonly status: number) {
    super(`The proposals endpoint answered ${status}`);
    this.name = 'ProposalsRequestError';
  }
}

/**
 * This plug-in's own routes, over `fetch` (FR 3.13, FR 3.14).
 *
 * **Not** the clients' `ApiClient`: what a client shares with a plug-in bundle
 * are the *models*, never the implementation. Angular's `HttpClient` would mean
 * a second HTTP stack inside a bundle that is fetched at runtime, for four
 * calls whose only special need is to read a status code — and `fetch` reads
 * one. The models are the shared part, and they are imported from
 * `@trefaro/shared-models`, where the plug-in's server DTOs implement the same
 * interfaces.
 *
 * The `/api` prefix is not guessed: a plug-in's access level is part of its
 * path (E57), so `/api/participant/plugins/<key>/…` and
 * `/api/admin/plugins/<key>/…` are contract, not deployment. Both clients are
 * served from the same origin as the API — in production through the reverse
 * proxy, in development through each client's dev-server proxy — which is why
 * the cookie travels and no address of a foreign host appears anywhere in this
 * bundle (NFR 9).
 */
@Injectable({ providedIn: 'root' })
export class ProposalsApi {
  private readonly participantBase = `/api/participant/plugins/${PROGRAM_PROPOSALS_MODULE_KEY}`;
  private readonly adminBase = `/api/admin/plugins/${PROGRAM_PROPOSALS_MODULE_KEY}`;

  /** Approved proposals of everyone plus the reader's own, newest first (E51). */
  listForParticipant(eventId: string, page: number): Promise<ProposalPage> {
    return this.read<ProposalPage>(
      `${this.participantBase}/events/${eventId}/proposals?page=${page}`,
    );
  }

  submit(eventId: string, input: NewProgramProposal): Promise<ProgramProposal> {
    return this.write<ProgramProposal>(
      `${this.participantBase}/events/${eventId}/proposals`,
      input,
    );
  }

  /** The moderation queue of one event: what is waiting for a decision. */
  listQueue(eventId: string, page: number): Promise<ProposalPage> {
    return this.read<ProposalPage>(
      `${this.adminBase}/events/${eventId}/proposals?status=pending&page=${page}`,
    );
  }

  /** The three counts above that queue (E59). */
  summary(eventId: string): Promise<ProposalSummary> {
    return this.read<ProposalSummary>(
      `${this.adminBase}/events/${eventId}/summary`,
    );
  }

  approve(proposalId: string): Promise<ProgramProposal> {
    return this.write<ProgramProposal>(
      `${this.adminBase}/proposals/${proposalId}/approval`,
      {},
    );
  }

  reject(proposalId: string): Promise<ProgramProposal> {
    return this.write<ProgramProposal>(
      `${this.adminBase}/proposals/${proposalId}/rejection`,
      {},
    );
  }

  private read<T>(path: string): Promise<T> {
    return this.send<T>(path, { method: 'GET' });
  }

  private write<T>(path: string, body: unknown): Promise<T> {
    return this.send<T>(path, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  private async send<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(path, {
      ...init,
      // The session is a cookie on `/api`, and the request is same-origin —
      // spelled out rather than left to the default, because this is the line
      // that decides whether the server knows who is asking.
      credentials: 'same-origin',
      // Last, so a caller's content type is kept and neither of these can be
      // dropped by one.
      headers: { accept: 'application/json', ...(init.headers ?? {}) },
    });

    if (response.status === 401) throw new NotSignedInError();
    if (!response.ok) throw new ProposalsRequestError(response.status);
    return (await response.json()) as T;
  }
}
