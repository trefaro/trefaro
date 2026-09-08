import { Injectable } from '@angular/core';
import {
  PROGRAM_PROPOSALS_MODULE_KEY,
  type NewProgramProposal,
  type ProgramProposal,
  type ProposalPage,
  type ProposalSummary,
} from '@trefaro/shared-models';
import { readJson, sendJson } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's own routes (FR 3.13, FR 3.14).
 *
 * The routes are this plug-in's; the request itself — `fetch` rather than a
 * second HTTP stack, same-origin, the 401 as a state and every other refusal
 * with its status — is the kit's since AP 6 of phase 4, when the third bundle
 * would have copied it (F138). The models are the shared part, imported from
 * `@trefaro/shared-models`, where the plug-in's server DTOs implement the same
 * interfaces.
 *
 * The `/api` prefix is not guessed: a plug-in's access level is part of its
 * path (E57), so `/api/participant/plugins/<key>/…` and
 * `/api/admin/plugins/<key>/…` are contract, not deployment.
 */
@Injectable({ providedIn: 'root' })
export class ProposalsApi {
  private readonly participantBase = `/api/participant/plugins/${PROGRAM_PROPOSALS_MODULE_KEY}`;
  private readonly adminBase = `/api/admin/plugins/${PROGRAM_PROPOSALS_MODULE_KEY}`;

  /** Approved proposals of everyone plus the reader's own, newest first (E51). */
  listForParticipant(eventId: string, page: number): Promise<ProposalPage> {
    return readJson<ProposalPage>(
      `${this.participantBase}/events/${eventId}/proposals?page=${page}`,
    );
  }

  submit(eventId: string, input: NewProgramProposal): Promise<ProgramProposal> {
    return sendJson<ProgramProposal>(
      'POST',
      `${this.participantBase}/events/${eventId}/proposals`,
      input,
    );
  }

  /** The moderation queue of one event: what is waiting for a decision. */
  listQueue(eventId: string, page: number): Promise<ProposalPage> {
    return readJson<ProposalPage>(
      `${this.adminBase}/events/${eventId}/proposals?status=pending&page=${page}`,
    );
  }

  /** The three counts above that queue (E59). */
  summary(eventId: string): Promise<ProposalSummary> {
    return readJson<ProposalSummary>(
      `${this.adminBase}/events/${eventId}/summary`,
    );
  }

  approve(proposalId: string): Promise<ProgramProposal> {
    return sendJson<ProgramProposal>(
      'POST',
      `${this.adminBase}/proposals/${proposalId}/approval`,
      {},
    );
  }

  reject(proposalId: string): Promise<ProgramProposal> {
    return sendJson<ProgramProposal>(
      'POST',
      `${this.adminBase}/proposals/${proposalId}/rejection`,
      {},
    );
  }
}
