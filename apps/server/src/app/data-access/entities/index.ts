import { AdminSessionEntity } from './admin-session.entity';
import { AdminUserEntity } from './admin-user.entity';
import { AppConfigEntity } from './app-config.entity';
import { AttachmentEntity } from './attachment.entity';
import { EventSeriesEntity } from './event-series.entity';
import { EventEntity } from './event.entity';
import { ModuleConfigEntity } from './module-config.entity';
import { PushSubscriptionEntity } from './push-subscription.entity';
import { RegistrationFieldEntity } from './registration-field.entity';
import { RegistrationEntity } from './registration.entity';

export { AdminSessionEntity } from './admin-session.entity';
export { AdminUserEntity } from './admin-user.entity';
export { APP_CONFIG_SINGLETON_ID, AppConfigEntity } from './app-config.entity';
export { AttachmentEntity } from './attachment.entity';
export { EventSeriesEntity } from './event-series.entity';
export { EventEntity } from './event.entity';
export { ModuleConfigEntity } from './module-config.entity';
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
  ModuleConfigEntity,
  PushSubscriptionEntity,
  RegistrationEntity,
  RegistrationFieldEntity,
  AttachmentEntity,
];
