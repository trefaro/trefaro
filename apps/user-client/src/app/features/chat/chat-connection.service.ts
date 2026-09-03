import { Injectable, computed, effect, inject } from '@angular/core';
import { AppConfigService } from '@trefaro/shared-config';
import { RealtimeClient } from '@trefaro/shared-http';
import { CHAT_MODULE_KEY } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../auth/participant-session.service';

/**
 * Holds the chat socket open for as long as somebody is signed in (FR 4.5,
 * E41).
 *
 * The socket belongs to the session, not to a screen. Two reasons, and the
 * second is the one that matters:
 *
 * 1. A participant who is reading an event page still wants their conversation
 *    list to move when somebody writes to them — that is what the member room
 *    of F161 is for, and it is joined at the handshake, so being connected is
 *    the whole subscription.
 * 2. **Connecting per page would break E44.** Push goes out only when the
 *    member has no open socket **in that conversation**, and a conversation's
 *    room is entered by the thread screen alone. A connection that came and
 *    went with the messages screen would make "is anybody watching?" mean
 *    "is the chat open?", which is a different and much weaker question.
 *
 * Nothing is opened while the chat is switched off (F53) or while nobody is
 * signed in: the handshake would be refused in both cases, and a client that
 * asks anyway collects a `connect_error` on every public page load.
 */
@Injectable({ providedIn: 'root' })
export class ChatConnection {
  private readonly realtime = inject(RealtimeClient);
  private readonly session = inject(ParticipantSessionService);
  private readonly config = inject(AppConfigService);

  /** Whether this instance lets the people in it write to each other (E42). */
  readonly enabled = computed(() =>
    this.config.isModuleEnabled(CHAT_MODULE_KEY),
  );

  /** Whether a socket should exist right now. */
  readonly wanted = computed(() => this.enabled() && this.session.isLoggedIn());

  constructor() {
    effect(() => {
      if (this.wanted()) this.realtime.connect();
      // Signing out is what closes it: the cookie is gone, so the next
      // handshake would be refused anyway — and a socket that outlived a
      // session would keep delivering to a browser that is done with it.
      else this.realtime.disconnect();
    });
  }
}
