import { Injectable } from '@angular/core';
import {
  ROOM_PLANNING_MODULE_KEY,
  type NewRoom,
  type PublicRoom,
  type Room,
  type RoomChanges,
  type RoomPlan,
} from '@trefaro/shared-models';
import { readJson, sendJson } from '@trefaro/shared-plugin-kit';

/**
 * This plug-in's own routes (FR 3.11, FR 3.6).
 *
 * The routes are this plug-in's; the request itself — `fetch`, same-origin,
 * every refusal with its status — is the kit's (F138). The models are imported
 * from `@trefaro/shared-models`, where the plug-in's server DTOs implement the
 * same interfaces.
 *
 * Two prefixes for two audiences (E57): `/api/admin/plugins/<key>/…` for the
 * editor on the organizer's dashboard, `/api/user/plugins/<key>/…` for the
 * plan a participant reads without a login (E58). Contract, not deployment.
 */
@Injectable({ providedIn: 'root' })
export class RoomPlanningApi {
  private readonly adminBase = `/api/admin/plugins/${ROOM_PLANNING_MODULE_KEY}`;
  private readonly publicBase = `/api/user/plugins/${ROOM_PLANNING_MODULE_KEY}`;

  /** The whole plan of one event, with both warnings (E50). */
  plan(eventId: string): Promise<RoomPlan> {
    return readJson<RoomPlan>(`${this.adminBase}/events/${eventId}/schedule`);
  }

  /**
   * The plan as a participant reads it, titles in their language (E56).
   *
   * The language travels as `?locale=` (F94): the server translates and falls
   * back field by field, so a switch of language is a new request here rather
   * than a redraw.
   */
  publicRooms(eventId: string, locale: string): Promise<PublicRoom[]> {
    return readJson<PublicRoom[]>(
      `${this.publicBase}/events/${eventId}/rooms?locale=${encodeURIComponent(locale)}`,
    );
  }

  createRoom(eventId: string, input: NewRoom): Promise<Room> {
    return sendJson<Room>(
      'POST',
      `${this.adminBase}/events/${eventId}/rooms`,
      input,
    );
  }

  updateRoom(roomId: string, changes: RoomChanges): Promise<Room> {
    return sendJson<Room>(
      'PATCH',
      `${this.adminBase}/rooms/${roomId}`,
      changes,
    );
  }

  deleteRoom(roomId: string): Promise<void> {
    return sendJson('DELETE', `${this.adminBase}/rooms/${roomId}`);
  }

  /** Puts a session in a room — idempotent, the pair is the key (F21). */
  place(programItemId: string, roomId: string): Promise<void> {
    return sendJson(
      'PUT',
      `${this.adminBase}/program-items/${programItemId}/rooms/${roomId}`,
    );
  }

  remove(programItemId: string, roomId: string): Promise<void> {
    return sendJson(
      'DELETE',
      `${this.adminBase}/program-items/${programItemId}/rooms/${roomId}`,
    );
  }
}
