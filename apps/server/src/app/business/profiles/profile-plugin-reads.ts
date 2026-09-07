import { Inject, Injectable } from '@nestjs/common';
import type {
  PluginAuthor,
  PluginParticipantReads,
} from '../plugin-api/participant-reads';
import { avatarUrl } from './avatar-url';
import {
  PROFILE_NAME_REPOSITORY,
  type ProfileNameRepository,
} from './ports/profile-name.repository';

/**
 * The core's side of the plug-in participant port (E58, F55).
 *
 * An adapter and nothing more, the same cut `ProgramPluginReads` makes: it
 * turns rows into the three fields the contract promises and is the only place
 * that knows both shapes. A plug-in never reaches `user_profile`; it asks here,
 * through a token, and the accounts stay the profiles module's business (F21,
 * E33).
 *
 * The picture is a URL rather than a path, built by the same function the
 * profile endpoints use — so a plug-in cannot learn where a file is stored and
 * a new picture is a new address for it as well (F124).
 *
 * Provided by the plug-in host module rather than by `ProfilesModule`: the host
 * module is the seam where core capabilities are published, and this adapter has
 * no other consumer.
 */
@Injectable()
export class ProfilePluginReads implements PluginParticipantReads {
  constructor(
    @Inject(PROFILE_NAME_REPOSITORY)
    private readonly profiles: ProfileNameRepository,
  ) {}

  async findAuthors(
    participantIds: readonly string[],
  ): Promise<ReadonlyMap<string, PluginAuthor>> {
    const rows = await this.profiles.findNames(participantIds);
    const authors = new Map<string, PluginAuthor>();
    for (const [id, row] of rows) {
      authors.set(id, {
        id,
        // The same spelling the chat uses for a counterpart: one string,
        // because a plug-in shows a name and does not sort by surname.
        name: `${row.firstName} ${row.lastName}`.trim(),
        avatarUrl: avatarUrl(id, row.avatarPath, row.updatedAt),
      });
    }
    return authors;
  }
}
