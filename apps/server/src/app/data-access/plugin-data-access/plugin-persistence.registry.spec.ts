import { collectPluginPersistence } from './plugin-persistence.registry';

class RoomEntity {}
class ForumThreadEntity {}
class CreateRooms {}
class CreateForum {}

describe('collectPluginPersistence', () => {
  it('returns empty lists when no plug-in contributes persistence', () => {
    expect(collectPluginPersistence([])).toEqual({
      entities: [],
      migrations: [],
    });
  });

  it('flattens the contributions of every mounted plug-in', () => {
    const collected = collectPluginPersistence([
      { entities: [RoomEntity], migrations: [CreateRooms] },
      { entities: [ForumThreadEntity], migrations: [CreateForum] },
    ]);

    expect(collected.entities).toEqual([RoomEntity, ForumThreadEntity]);
    expect(collected.migrations).toEqual([CreateRooms, CreateForum]);
  });

  it('tolerates a plug-in that only adds behaviour', () => {
    const collected = collectPluginPersistence([
      { entities: [], migrations: [] },
      { entities: [RoomEntity], migrations: [CreateRooms] },
    ]);

    expect(collected.entities).toEqual([RoomEntity]);
  });
});
