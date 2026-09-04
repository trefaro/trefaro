import { AdminSessionEntity } from './admin-session.entity';
import { AdminUserEntity } from './admin-user.entity';
import { AppConfigEntity } from './app-config.entity';
import { AttachmentEntity } from './attachment.entity';
import { ConversationMemberEntity } from './conversation-member.entity';
import { ConversationEntity } from './conversation.entity';
import { EventSeriesTranslationEntity } from './event-series-translation.entity';
import { EventSeriesEntity } from './event-series.entity';
import { EventTranslationEntity } from './event-translation.entity';
import { EventEntity } from './event.entity';
import { InvitationRecipientEntity } from './invitation-recipient.entity';
import { InvitationEntity } from './invitation.entity';
import { MediaLinkEntity } from './media-link.entity';
import { MessageEntity } from './message.entity';
import { ModuleConfigEntity } from './module-config.entity';
import { NewsletterSubscriptionEntity } from './newsletter-subscription.entity';
import { ProfileFieldEntity } from './profile-field.entity';
import { ProgramItemSignupEntity } from './program-item-signup.entity';
import { ProgramItemTranslationEntity } from './program-item-translation.entity';
import { ProgramItemEntity } from './program-item.entity';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { RegistrationFieldEntity } from './registration-field.entity';
import { RegistrationEntity } from './registration.entity';
import { TranslationOverrideEntity } from './translation-override.entity';
import { UserProfileEntity } from './user-profile.entity';
import { UserSessionEntity } from './user-session.entity';

export { AdminSessionEntity } from './admin-session.entity';
export { AdminUserEntity } from './admin-user.entity';
export { APP_CONFIG_SINGLETON_ID, AppConfigEntity } from './app-config.entity';
export { AttachmentEntity } from './attachment.entity';
export {
  ConversationMemberEntity,
  type ConversationMemberType,
} from './conversation-member.entity';
export { ConversationEntity } from './conversation.entity';
export { EventSeriesTranslationEntity } from './event-series-translation.entity';
export { EventSeriesEntity } from './event-series.entity';
export { EventTranslationEntity } from './event-translation.entity';
export { EventEntity } from './event.entity';
export {
  InvitationRecipientEntity,
  type InvitationRecipientStatus,
} from './invitation-recipient.entity';
export { InvitationEntity } from './invitation.entity';
export { MediaLinkEntity } from './media-link.entity';
export { MessageEntity } from './message.entity';
export { ModuleConfigEntity } from './module-config.entity';
export { NewsletterSubscriptionEntity } from './newsletter-subscription.entity';
export { ProfileFieldEntity } from './profile-field.entity';
export { ProgramItemSignupEntity } from './program-item-signup.entity';
export { ProgramItemTranslationEntity } from './program-item-translation.entity';
export { ProgramItemEntity } from './program-item.entity';
export { PushSubscriptionEntity } from './push-subscription.entity';
export { RegistrationFieldEntity } from './registration-field.entity';
export { RegistrationEntity } from './registration.entity';
export { TranslationOverrideEntity } from './translation-override.entity';
export { UserProfileEntity } from './user-profile.entity';
export { UserSessionEntity } from './user-session.entity';

/**
 * Core entities. Plug-in entities are added separately by the plug-in data
 * access manager and are never listed here — a plug-in owns its own tables.
 */
export const CORE_ENTITIES = [
  AdminUserEntity,
  AdminSessionEntity,
  AppConfigEntity,
  EventSeriesEntity,
  EventSeriesTranslationEntity,
  EventEntity,
  EventTranslationEntity,
  InvitationEntity,
  InvitationRecipientEntity,
  MediaLinkEntity,
  ModuleConfigEntity,
  NewsletterSubscriptionEntity,
  ProgramItemEntity,
  ProgramItemTranslationEntity,
  ProgramItemSignupEntity,
  ProfileFieldEntity,
  PushSubscriptionEntity,
  RegistrationEntity,
  RegistrationFieldEntity,
  AttachmentEntity,
  ConversationEntity,
  ConversationMemberEntity,
  MessageEntity,
  TranslationOverrideEntity,
  UserProfileEntity,
  UserSessionEntity,
];
