import {
  PLUGIN_API_VERSION,
  type ServerPlugin,
} from '../../app/business/plugin-api';
import { RoomEntity } from './data-access/entities/room.entity';
import { CreateRoomPlanningSchema1787702500000 } from './data-access/migrations/1787702500000-CreateRoomPlanningSchema';
import { RoomPlanningModule } from './room-planning.module';
import { ROOM_PLANNING_PLUGIN_KEY } from './room-planning.plugin-key';

/**
 * Descriptor of the room planning plug-in (FR 3.11, P2).
 *
 * The one place the plug-in declares all three of its parts to the host: the
 * module carrying its API and business logic, and the entities and migrations
 * making up its data access contribution.
 */
export const roomPlanningPlugin: ServerPlugin = {
  key: ROOM_PLANNING_PLUGIN_KEY,
  version: '0.1.0',
  apiVersion: PLUGIN_API_VERSION,
  titleKey: 'plugins.roomPlanning.title',
  module: RoomPlanningModule,
  persistence: {
    entities: [RoomEntity],
    migrations: [CreateRoomPlanningSchema1787702500000],
  },
  client: {
    elementName: 'trefaro-plugin-room-planning',
    bundleUrl: '/plugins/room-planning/bundle.js',
    // Rooms are something a participant looks up while at the event, so the
    // tile belongs on the event detail view rather than in the main navigation.
    mountPoints: ['event-detail'],
    labelKey: 'plugins.roomPlanning.label',
    icon: 'meeting_room',
  },
  // A room plan only makes sense for on-site events, so an organization opts in.
  enabledByDefault: false,
};
