import { AdminSessionEntity } from './admin-session.entity';
import { AdminUserEntity } from './admin-user.entity';
import { AppConfigEntity } from './app-config.entity';
import { AttachmentEntity } from './attachment.entity';
import { EventSeriesEntity } from './event-series.entity';
import { EventEntity } from './event.entity';
import { InvitationRecipientEntity } from './invitation-recipient.entity';
import { InvitationEntity } from './invitation.entity';
import { MediaLinkEntity } from './media-link.entity';
import { ModuleConfigEntity } from './module-config.entity';
import { ProgramItemSignupEntity } from './program-item-signup.entity';
import { ProgramItemEntity } from './program-item.entity';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { RegistrationFieldEntity } from './registration-field.entity';
import { RegistrationEntity } from './registration.entity';

export { AdminSessionEntity } from './admin-session.entity';
export { AdminUserEntity } from './admin-user.entity';
export { APP_CONFIG_SINGLETON_ID, AppConfigEntity } from './app-config.entity';
export { AttachmentEntity } from './attachment.entity';
export { EventSeriesEntity } from './event-series.entity';
export { EventEntity } from './event.entity';
export {
  InvitationRecipientEntity,
  type InvitationRecipientStatus,
} from './invitation-recipient.entity';
export { InvitationEntity } from './invitation.entity';
export { MediaLinkEntity } from './media-link.entity';
export { ModuleConfigEntity } from './module-config.entity';
export { ProgramItemSignupEntity } from './program-item-signup.entity';
export { ProgramItemEntity } from './program-item.entity';
export { PushSubscriptionEntity } from './push-subscription.entity';
export { RegistrationFieldEntity } from './registration-field.entity';
export { RegistrationEntity } from './registration.entity';

/**
 * Core entities. Plug-in entities are added separately by the plug-in data
 * access manager and are never listed here — a plug-in owns its own tables.
 */
export const CORE_ENTITIES = [
  AdminUserEntity,
  AdminSessionEntity,
  AppConfigEntity,
  EventSeriesEntity,
  EventEntity,
  InvitationEntity,
  InvitationRecipientEntity,
  MediaLinkEntity,
  ModuleConfigEntity,
  ProgramItemEntity,
  ProgramItemSignupEntity,
  PushSubscriptionEntity,
  RegistrationEntity,
  RegistrationFieldEntity,
  AttachmentEntity,
];
