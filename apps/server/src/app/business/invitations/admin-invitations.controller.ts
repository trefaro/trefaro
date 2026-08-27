import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { InvitationDto } from './dto/invitation.dto';
import { InvitationsService } from './invitations.service';

/**
 * One invitation by id — what the organizer's page watches while it is sent.
 *
 * Addressed by its own id rather than nested under the series, like every other
 * single-resource endpoint in this application: the id is unique, and the
 * client that just received it from the `POST` has nothing else to add.
 */
@ApiTags('invitations')
@Controller('admin/invitations')
export class AdminInvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get(':id')
  @ApiOperation({
    summary: 'One invitation and how far its sending has got',
    description:
      'The three counts are read from the recipient rows on every call, so a ' +
      'page that polls this sees the send progress (F56). `state` follows from ' +
      'them: `sending`, then `sent` or `partial`.',
  })
  @ApiOkResponse({ type: InvitationDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No invitation with that id.' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<InvitationDto> {
    return this.invitations.get(id) as Promise<InvitationDto>;
  }
}
