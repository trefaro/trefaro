import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PROFILE_SEARCH_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CurrentParticipant } from '../profiles';
import type { AuthenticatedParticipant } from '../profiles';
import {
  ProfileSearchPageDto,
  PublicProfileDto,
  SearchProfilesDto,
} from './dto/profile-search.dto';
import { ProfileSearchService } from './profile-search.service';

/**
 * Finding other participants (FR 4.4, UC 12).
 *
 * One controller for one screen (F49): the search page reads the list, a name
 * on it opens the profile. Nothing here writes, so nothing here is a `POST` —
 * and the two reads are the only endpoints of this module.
 *
 * Three things hang on the path and the decorators rather than on code in the
 * methods:
 *
 * 1. **The session is the credential.** Everything below `participant/` is
 *    behind `ParticipantGuard` by virtue of its declared path (E33), so there
 *    is no anonymous participant search — a community directory readable
 *    without an account would be a directory of activists.
 * 2. **The module switch answers before the handler** (F53). The key is
 *    `profile-search`, not `profiles`: an organization may keep accounts and
 *    still not run a directory. Checking only this one is enough because the
 *    prerequisite is enforced where it is switched (E42) — `profile-search`
 *    cannot be on while `profiles` is off.
 * 3. **No throttle of its own.** The rule of `/api/participant/**`: behind a
 *    session the global limit applies, and the per-route budgets exist for
 *    routes a stranger can reach (E4).
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILE_SEARCH_MODULE_KEY)
@Controller('participant/profiles')
export class ParticipantProfilesController {
  constructor(private readonly search: ProfileSearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Search the participants who opted in (FR 4.4)',
    description:
      'Filtered, sorted and paginated in SQL, by last name and then first ' +
      'name with the id as the last criterion. Only profiles whose owner ' +
      'switched `searchable` on appear (E37, F13), and the reader is never in ' +
      'their own results. Both boxes may be empty — then this is the ' +
      'directory being browsed.',
  })
  @ApiOkResponse({ type: ProfileSearchPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Query() query: SearchProfilesDto,
  ): Promise<ProfileSearchPageDto> {
    return this.search.search(
      current.profile.id,
      query,
    ) as Promise<ProfileSearchPageDto>;
  }

  @Get(':id')
  @ApiOperation({
    summary: 'One profile, as far as it shows itself',
    description:
      'The row plus the answers to this instance’s profile questions (E35). ' +
      'Reachable only for a profile that is in the search — including one’s ' +
      'own, which is no special case: the rule is about the profile, not ' +
      'about who is reading.',
  })
  @ApiParam({ name: 'id', format: 'uuid' })
  @ApiOkResponse({ type: PublicProfileDto })
  @ApiNotFoundResponse({
    description:
      'No profile of that id is in the search. Said the same way for an ' +
      'unknown id, an unconfirmed account and a profile that did not opt in — ' +
      'whoever holds an id holds the picture with it (F124), so which ids ' +
      'exist is not this reader’s to learn.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  view(@Param('id', ParseUUIDPipe) id: string): Promise<PublicProfileDto> {
    return this.search.get(id) as Promise<PublicProfileDto>;
  }
}
