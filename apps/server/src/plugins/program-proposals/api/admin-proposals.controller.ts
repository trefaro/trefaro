import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  CurrentPluginOrganizer,
  PluginController,
  PluginEnabledGuard,
  type PluginOrganizer,
} from '../../../app/business/plugin-api';
import { ProgramProposalsService } from '../business/program-proposals.service';
import { PROGRAM_PROPOSALS_PLUGIN_KEY } from '../program-proposals.plugin-key';
import {
  ProgramProposalDto,
  ProposalPageDto,
  ProposalQueryDto,
} from './proposal.dto';

/**
 * Moderating proposals (FR 3.14).
 *
 * Behind the administrative session by virtue of its path (E16, E57): a plug-in
 * gets its access level from the address it declares and has no way to
 * authenticate anything itself.
 *
 * **A decision is a route, not a field** (E51). `POST …/approval` and
 * `POST …/rejection` rather than a `PATCH` carrying a status: the two things an
 * organizer does are two things, they are the whole of the moderation effort
 * the survey asked to keep minimal, and neither is a state machine with a
 * comment thread. A `PATCH` would also have been a shape in which somebody
 * eventually sets `pending` back — which is not a decision.
 *
 * Both answer 200 with the row as it now is, rather than 204: the organizer's
 * list is the screen this is called from, and the answer is what it redraws.
 */
@ApiTags('plugin: programme proposals')
@ApiNotFoundResponse({
  description:
    'The programme proposals plug-in is not enabled on this instance.',
})
@PluginController(PROGRAM_PROPOSALS_PLUGIN_KEY)
@UseGuards(PluginEnabledGuard)
@Controller('admin/plugins/program-proposals')
export class AdminProposalsController {
  constructor(private readonly proposals: ProgramProposalsService) {}

  @Get('events/:eventId/proposals')
  @ApiOperation({
    summary: 'The moderation list of one event (FR 3.14)',
    description:
      'Every proposal of this event, optionally narrowed to one status — the ' +
      'queue is `?status=pending`, and the whole list without it. Filtered, ' +
      'sorted and paginated in SQL, newest first with the id as the last ' +
      'criterion.',
  })
  @ApiOkResponse({ type: ProposalPageDto })
  @ApiBadRequestResponse({
    description: 'A status that is not one, or a page that is not a page.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  list(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Query() query: ProposalQueryDto,
  ): Promise<ProposalPageDto> {
    return this.proposals.listForEvent(
      eventId,
      query,
    ) as Promise<ProposalPageDto>;
  }

  @Post('proposals/:proposalId/approval')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a proposal (FR 3.14)',
    description:
      'Publishes it to everybody reading this event’s list. It does **not** ' +
      'become a programme item (E52): the proposal stands beside the editor ' +
      'with its title and description, and creating the session stays a core ' +
      'action. Approving an already decided proposal is a correction and moves ' +
      'the instant — a decision may be revised, and refusing that would need a ' +
      'reason FR 3.14 does not give.',
  })
  @ApiOkResponse({ type: ProgramProposalDto })
  @ApiNotFoundResponse({ description: 'No proposal with that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  approve(
    @CurrentPluginOrganizer() organizer: PluginOrganizer,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
  ): Promise<ProgramProposalDto> {
    return this.proposals.approve(
      proposalId,
      organizer.id,
    ) as Promise<ProgramProposalDto>;
  }

  @Post('proposals/:proposalId/rejection')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a proposal (FR 3.14)',
    description:
      'The row stays (E14) and keeps showing its status to the person who ' +
      'submitted it — deleting it would make a refusal indistinguishable from ' +
      'a submission that never arrived. Two parties see a rejected proposal: ' +
      'its author and the organization.',
  })
  @ApiOkResponse({ type: ProgramProposalDto })
  @ApiNotFoundResponse({ description: 'No proposal with that id.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  reject(
    @CurrentPluginOrganizer() organizer: PluginOrganizer,
    @Param('proposalId', ParseUUIDPipe) proposalId: string,
  ): Promise<ProgramProposalDto> {
    return this.proposals.reject(
      proposalId,
      organizer.id,
    ) as Promise<ProgramProposalDto>;
  }
}
