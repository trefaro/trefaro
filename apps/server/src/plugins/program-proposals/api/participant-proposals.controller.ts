import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginParticipant,
  PluginController,
  PluginEnabledGuard,
  type PluginParticipant,
} from '../../../app/business/plugin-api';
import { ProgramProposalsService } from '../business/program-proposals.service';
import { PROGRAM_PROPOSALS_PLUGIN_KEY } from '../program-proposals.plugin-key';
import {
  NewProgramProposalDto,
  ProgramProposalDto,
  ProposalPageDto,
  ProposalQueryDto,
} from './proposal.dto';

/**
 * What a participant does with proposals (FR 3.13).
 *
 * Under `participant/`, not `user/` (E58): a proposal carries the name of a
 * person, and this application is built for organizations whose participants
 * are activists — so reading and writing them both need a session. The element
 * on the event page is still mounted for everybody and shows an invitation to
 * log in; a tile that appeared only to those already logged in would be a
 * feature nobody hears about.
 *
 * Three things hang on the path and the decorators rather than on code below:
 *
 * 1. **The session is the credential.** Everything under `participant/` is
 *    behind the host's participant guard by virtue of its declared path (E33),
 *    and a plug-in has no way to declare or withdraw one (E57).
 * 2. **The plug-in switch answers before the handler.** While the organization
 *    has the plug-in off, every line here is a 404 and `/api/config` does not
 *    mention it — a disabled plug-in looks absent rather than forbidden.
 * 3. **No throttle of its own.** The rule of `/api/participant/**`: behind a
 *    session the global limit applies, and the per-route budgets exist for
 *    routes a stranger can reach (E4).
 */
@ApiTags('plugin: programme proposals')
@ApiNotFoundResponse({
  description:
    'The programme proposals plug-in is not enabled on this instance.',
})
@PluginController(PROGRAM_PROPOSALS_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('participant/plugins/program-proposals')
export class ParticipantProposalsController {
  constructor(private readonly proposals: ProgramProposalsService) {}

  @Get('events/:eventId/proposals')
  @ApiOperation({
    summary: "Approved proposals of this event, plus one's own (FR 3.13)",
    description:
      'The visibility rule of E51 is part of the query: every approved ' +
      'proposal, and every proposal of the reader’s own whatever its status — ' +
      'which is how FR 3.14 keeps the status visible to whoever submitted it. ' +
      'A stranger’s pending or rejected proposal cannot be asked for. ' +
      'Filtered, sorted and paginated in SQL, newest first with the id last.',
  })
  @ApiOkResponse({ type: ProposalPageDto })
  @ApiBadRequestResponse({ description: 'A page or a size that is not one.' })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  list(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: ProposalQueryDto,
  ): Promise<ProposalPageDto> {
    return this.proposals.listForParticipant(
      eventId,
      me.id,
      query,
    ) as Promise<ProposalPageDto>;
  }

  @Post('events/:eventId/proposals')
  @ApiOperation({
    summary: 'Propose a programme item (FR 3.13)',
    description:
      'Created as `pending`, and visible to nobody but its author and the ' +
      'organization until somebody decides (E51). Approving it does **not** ' +
      'create a programme item (E52) — a plug-in owns its own tables and ' +
      'changes no core data; taking a proposal into the programme stays the ' +
      'organizer’s own action in the editor.',
  })
  @ApiCreatedResponse({ type: ProgramProposalDto })
  @ApiBadRequestResponse({
    description:
      'A title or description that is missing, too long, or only whitespace.',
  })
  @ApiNotFoundResponse({
    description:
      'No such event — the database says so (F21), and an unknown event is ' +
      'answered as absent rather than as a failed constraint.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  submit(
    @CurrentPluginParticipant() me: PluginParticipant,
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() body: NewProgramProposalDto,
  ): Promise<ProgramProposalDto> {
    return this.proposals.submit(
      eventId,
      me.id,
      body,
    ) as Promise<ProgramProposalDto>;
  }
}
