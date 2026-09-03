import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigurationModule } from '../config';
import { EventSeriesModule } from '../event-series';
import { EventsModule } from '../events';
import { MailModule } from '../mail';
import { ProfilesModule } from '../profiles';
import { AdminConversationsController } from './admin-conversations.controller';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatGateway } from './chat.gateway';
import { ConversationsService } from './conversations.service';
import { MessageImageMediaController } from './message-image-media.controller';
import { MessagesService } from './messages.service';
import { OrganizerContactService } from './organizer-contact.service';
import { OrganizerConversationsService } from './organizer-conversations.service';
import { ParticipantConversationsController } from './participant-conversations.controller';
import { PublicContactController } from './public-contact.controller';

/**
 * Conversations, messages and the pictures in them (FR 4.5) — AP 6 of phase 3.
 *
 * An optional core module of its own (E42, F53): `profiles` decides whether
 * there are accounts, `profile-search` whether the people in an instance may
 * find each other, `chat` whether they may write to each other. It **requires**
 * `profiles`, declared in the descriptor and enforced by the module
 * administration in both directions — which is what lets the endpoints here
 * check one flag instead of two.
 *
 * What it does **not** require is `profile-search`, and that is deliberate
 * rather than an oversight. Switching the directory off stops new
 * conversations from being opened, because the only way to open one is a
 * profile the search shows; the conversations that exist stay readable and
 * answerable (E14, E37). A prerequisite would have said something stronger and
 * wrong: that messaging is meaningless without a directory.
 *
 * What it does **not** take from `ProfilesModule` is the accounts, although it
 * reads `user_profile` through two ports. The reason is the one
 * `ProfileSearchModule` gives: `UserProfileRepository` can read a whole
 * account and write to it, which belongs to the module the accounts belong to
 * (E33). So contactability comes from `SearchableProfileRepository` — the port
 * whose statements cannot answer with a hidden profile, in
 * `business/common/ports/` because two modules read it (F100) — and the
 * members of a conversation come from this module's own port. Beyond that it
 * uses what needs no injector: the `@CurrentParticipant()` decorator,
 * `@RequiresParticipant()` and `avatarUrl`, a pure function whose second
 * construction is exactly the drift F113 exists to prevent.
 *
 * What it **does** import `ProfilesModule` for, since AP 7, is
 * `UserSessionService`: the WebSocket handshake authenticates against the
 * participant cookie (E41), and that is the same authentication the global
 * participant guard performs. There is one kind of participant session in this
 * application and it must have one implementation — a second reading of that
 * cookie is how one of the two ends up honouring a session the other revoked.
 * Nothing else of that module is injected here.
 *
 * `CommonModule` for `ImageFileService`, which checks and stores the pictures;
 * `ConfigurationModule` for the module guard and for the registry the
 * handshake asks about the `chat` flag.
 *
 * **AP 10 adds the organization's own side of all of this** (FR 3.4): the
 * message overview, its history, the answer that goes out as mail (F11), and
 * the groups an organizer assembles around an event (E39). It reads through a
 * port of its own, because the organization has no membership row to be
 * identified by (F133) and the participants' port is built so that membership
 * is the only credential it knows (F152, F173). Its controller carries the
 * `chat` switch on **two routes** rather than on the class (F175) — reading
 * and answering are P1 and must work with the chat switched off, assembling a
 * group is not.
 *
 * **AP 9 adds a controller that the switch does not cover** — the contact form
 * of an event landing page (FR 3.4, UC 14, F11). That is the reason this
 * module reaches for three more: `EventsModule` and `EventSeriesModule`,
 * because a contact request names the event it is about and lands in the
 * mailbox that series advertises, and `MailModule`, because the organization
 * has to learn about it without watching a screen. The switch stays where it
 * belongs — on the controllers a *participant* uses. FR 3.4 is P1 and `chat`
 * is an optional P2 module that requires `profiles` (E42): an instance with no
 * participant accounts must still be reachable, and a switch that could turn
 * off the organization's own inbox would say more than it means.
 */
@Module({
  imports: [
    CommonModule,
    ConfigurationModule,
    ProfilesModule,
    EventsModule,
    EventSeriesModule,
    MailModule,
  ],
  controllers: [
    ParticipantConversationsController,
    MessageImageMediaController,
    PublicContactController,
    AdminConversationsController,
  ],
  providers: [
    ChatRealtimeService,
    ConversationsService,
    MessagesService,
    OrganizerContactService,
    OrganizerConversationsService,
    ChatGateway,
  ],
  exports: [
    ConversationsService,
    MessagesService,
    OrganizerContactService,
    OrganizerConversationsService,
  ],
})
export class ChatModule {}
