import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ConfigurationModule } from '../config';
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
 * What it does not import is `ProfilesModule`, although it reads `user_profile`
 * through two ports. The reasons are the ones `ProfileSearchModule` gives:
 * `UserProfileRepository` can read a whole account and write to it, which
 * belongs to the module the accounts belong to (E33). So contactability comes
 * from `SearchableProfileRepository` — the port whose statements cannot answer
 * with a hidden profile, now in `business/common/ports/` because two modules
 * read it (F100) — and the members of a conversation come from this module's
 * own port. From `profiles` it takes only what needs no injector: the
 * `@CurrentParticipant()` decorator, `@RequiresParticipant()` and `avatarUrl`,
 * a pure function whose second construction is exactly the drift F113 exists
 * to prevent.
 *
 * `CommonModule` for `ImageFileService`, which checks and stores the pictures;
 * `ConfigurationModule` for the module guard. {@link ChatGateway} still carries
 * only the connectivity probe of spike 4 — the handshake becomes real in AP 7,
 * which is also where the probe goes.
 */
@Module({
  imports: [CommonModule, ConfigurationModule],
  controllers: [
    ParticipantConversationsController,
    MessageImageMediaController,
  ],
  providers: [ConversationsService, MessagesService, ChatGateway],
  exports: [ConversationsService, MessagesService],
})
export class ChatModule {}
