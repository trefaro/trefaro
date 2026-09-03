import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigurationModule } from '../config';
import { ProfilesModule } from '../profiles';
import { ChatRealtimeService } from './chat-realtime.service';
import { ChatGateway } from './chat.gateway';
import { ConversationsService } from './conversations.service';
import { MessageImageMediaController } from './message-image-media.controller';
import { MessagesService } from './messages.service';
import { ParticipantConversationsController } from './participant-conversations.controller';

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
 */
@Module({
  imports: [CommonModule, ConfigurationModule, ProfilesModule],
  controllers: [
    ParticipantConversationsController,
    MessageImageMediaController,
  ],
  providers: [
    ChatRealtimeService,
    ConversationsService,
    MessagesService,
    ChatGateway,
  ],
  exports: [ConversationsService, MessagesService],
})
export class ChatModule {}
