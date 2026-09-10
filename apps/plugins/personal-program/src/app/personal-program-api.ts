import { Injectable } from '@angular/core';
import {
  PERSONAL_PROGRAM_MODULE_KEY,
  type PersonalProgramItem,
} from '@trefaro/shared-models';
import { readJson, sendJson } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's own routes (FR 3.17).
 *
 * The routes are this plug-in's; the request itself — `fetch`, same-origin,
 * every refusal with its status — is the kit's (F138). The models are imported
 * from `@trefaro/shared-models`, where the plug-in's server DTOs implement the
 * same interfaces.
 *
 * **One prefix**, where the check-in has three: a plan belongs to the person
 * who made it, so every call here is a participant's (E57, E58).
 */
@Injectable({ providedIn: 'root' })
export class PersonalProgramApi {
  private readonly base = `/api/participant/plugins/${PERSONAL_PROGRAM_MODULE_KEY}`;

  /**
   * One event's programme with the reader's marks on it (E56).
   *
   * The language travels as `?locale=` (F94): the server translates and falls
   * back field by field, so a switch of language is a new request here rather
   * than a redraw.
   */
  plan(eventId: string, locale: string): Promise<PersonalProgramItem[]> {
    return readJson<PersonalProgramItem[]>(
      `${this.base}/events/${eventId}/plan?locale=${encodeURIComponent(locale)}`,
    );
  }

  /** Puts a session in the plan — idempotent, and it books no seat (E55). */
  add(programItemId: string): Promise<void> {
    return sendJson('PUT', `${this.base}/program-items/${programItemId}`);
  }

  /** Takes it out. A session that was never in is the same answer. */
  remove(programItemId: string): Promise<void> {
    return sendJson('DELETE', `${this.base}/program-items/${programItemId}`);
  }
}
