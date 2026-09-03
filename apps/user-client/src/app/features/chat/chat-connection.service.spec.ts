import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AppConfigService } from '@trefaro/shared-config';
import { RealtimeClient } from '@trefaro/shared-http';
import { CHAT_MODULE_KEY } from '@trefaro/shared-models';
import { ParticipantSessionService } from '../auth/participant-session.service';
import { ChatConnection } from './chat-connection.service';

/** Counts what the real client would do to a socket. */
class FakeRealtime {
  connects = 0;
  disconnects = 0;

  connect(): void {
    this.connects += 1;
  }

  disconnect(): void {
    this.disconnects += 1;
  }
}

/**
 * Who opens the chat socket, and when (E41, E44).
 *
 * The subject is one rule: a socket exists while somebody is signed in and
 * this instance runs a chat, and not otherwise. The screens do not decide it —
 * which is what keeps "is anybody watching?" a question about a conversation's
 * room rather than about whether the chat is open (E44).
 */
describe('ChatConnection', () => {
  let realtime: FakeRealtime;

  function configure(options: { enabled?: boolean; loggedIn?: boolean } = {}) {
    realtime = new FakeRealtime();
    const loggedIn = signal(options.loggedIn ?? true);
    const enabled = signal(options.enabled ?? true);

    TestBed.configureTestingModule({
      providers: [
        { provide: RealtimeClient, useValue: realtime },
        {
          provide: ParticipantSessionService,
          useValue: { isLoggedIn: loggedIn },
        },
        {
          provide: AppConfigService,
          useValue: {
            isModuleEnabled: (key: string) =>
              key === CHAT_MODULE_KEY ? enabled() : true,
          },
        },
      ],
    });

    const connection = TestBed.inject(ChatConnection);
    TestBed.tick();
    return { connection, loggedIn, enabled };
  }

  afterEach(() => TestBed.resetTestingModule());

  it('opens a socket for somebody who is signed in', () => {
    configure();

    expect(realtime.connects).toBe(1);
  });

  it('opens none for a visitor who is not', () => {
    configure({ loggedIn: false });

    // Every public page of this client would otherwise collect a refused
    // handshake: the door asks for the session cookie (E41).
    expect(realtime.connects).toBe(0);
  });

  it('opens none where the chat is switched off', () => {
    configure({ enabled: false });

    expect(realtime.connects).toBe(0);
  });

  it('closes it when the session ends', () => {
    const { loggedIn } = configure();

    loggedIn.set(false);
    TestBed.tick();

    expect(realtime.disconnects).toBeGreaterThan(0);
  });

  it('closes it when an organizer switches the chat off', () => {
    const { enabled } = configure();

    enabled.set(false);
    TestBed.tick();

    expect(realtime.disconnects).toBeGreaterThan(0);
  });
});
