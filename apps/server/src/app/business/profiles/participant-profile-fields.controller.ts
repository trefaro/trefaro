import { Controller, Get, UseGuards } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { ProfileFieldPublicDto } from './dto/profile-field.dto';
import { ProfileFieldsService } from './profile-fields.service';

/**
 * The questions the profile form has to render (FR 4.3 — E35).
 *
 * A route of its own rather than a field of `GET /api/participant/me`, and the
 * reason is what that endpoint promises: it costs no query, because the guard
 * already resolved the session and the profile came with it. The client calls it
 * on every startup to decide between the login form and the app; adding the
 * definitions would put a second query on that path for the benefit of one
 * screen.
 *
 * Behind the participant session, not public: nobody fills in a profile without
 * an account, and what an organization asks its own community is not something a
 * stranger needs to read. That is the difference from the registration form's
 * public field route — that form is filled in by people who have no account yet.
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('participant/profile-fields')
export class ParticipantProfileFieldsController {
  constructor(private readonly fields: ProfileFieldsService) {}

  @Get()
  @ApiOperation({
    summary: 'The profile questions of this instance, in form order',
    description:
      'The keys these answer under are what `customFields` of the profile is ' +
      'keyed by. A question that is no longer asked is simply missing here, ' +
      'while the answers already given stay where they are (F34).',
  })
  @ApiOkResponse({ type: [ProfileFieldPublicDto] })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(): Promise<ProfileFieldPublicDto[]> {
    return this.fields.listForParticipant() as Promise<ProfileFieldPublicDto[]>;
  }
}
