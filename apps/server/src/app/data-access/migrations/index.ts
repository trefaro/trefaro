import { InitialCoreSchema1787702400000 } from './1787702400000-InitialCoreSchema';
import { AdminIdentity1787788800000 } from './1787788800000-AdminIdentity';
import { EventSeries1787788900000 } from './1787788900000-EventSeries';
import { Events1787789000000 } from './1787789000000-Events';
import { Registrations1787789100000 } from './1787789100000-Registrations';
import { ParticipantOverview1787789200000 } from './1787789200000-ParticipantOverview';
import { RegistrationFields1787789300000 } from './1787789300000-RegistrationFields';
import { Attachments1787789400000 } from './1787789400000-Attachments';
import { FileRegistrationFields1787789500000 } from './1787789500000-FileRegistrationFields';
import { ProgramItems1787789600000 } from './1787789600000-ProgramItems';
import { ProgramItemSignups1787789700000 } from './1787789700000-ProgramItemSignups';
import { MediaLinksAndFollowUp1787789800000 } from './1787789800000-MediaLinksAndFollowUp';
import { Invitations1787789900000 } from './1787789900000-Invitations';

/**
 * Core migrations, in the order they must run.
 *
 * Listed explicitly rather than discovered by glob: a bundled server has no
 * source tree to scan, and an explicit list makes the order reviewable.
 */
export const CORE_MIGRATIONS = [
  InitialCoreSchema1787702400000,
  AdminIdentity1787788800000,
  EventSeries1787788900000,
  Events1787789000000,
  Registrations1787789100000,
  ParticipantOverview1787789200000,
  RegistrationFields1787789300000,
  Attachments1787789400000,
  FileRegistrationFields1787789500000,
  ProgramItems1787789600000,
  ProgramItemSignups1787789700000,
  MediaLinksAndFollowUp1787789800000,
  Invitations1787789900000,
];
