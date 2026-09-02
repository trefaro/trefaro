import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CurrentParticipant } from './current-participant.decorator';
import {
  ParticipantSessionInfoDto,
  toParticipantAccountDto,
} from './dto/participant.dto';
import type { AuthenticatedParticipant } from './ports/user-session.repository';

/**
 * The participant's own account (FR 4.2, FR 4.3).
 *
 * `GET` is the whole of it for now: the answer the participant client needs on
 * startup to decide between the login form and the app. Editing the profile —
 * name, picture, language, field of activity, configurable answers — arrives in
 * the next work package on the same controller, because it is one screen and
 * one endpoint (F49).
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('participant/me')
export class ParticipantMeController {
  @Get()
  @ApiOperation({
    summary: 'Who is logged in, and until when',
    description:
      'The participant client calls this on startup. It costs no query: the ' +
      'guard resolved the session on the way in, and the profile came with it.',
  })
  @ApiOkResponse({ type: ParticipantSessionInfoDto })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  me(
    @CurrentParticipant() current: AuthenticatedParticipant,
  ): ParticipantSessionInfoDto {
    return {
      participant: toParticipantAccountDto(current.profile),
      expiresAt: current.expiresAt.toISOString(),
    };
  }
}
