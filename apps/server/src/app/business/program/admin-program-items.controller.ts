import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UpdateProgramItemDto } from './dto/create-program-item.dto';
import { ProgramItemDto } from './dto/program-item.dto';
import { ProgramService } from './program.service';

/**
 * One programme item (FR 3.7).
 *
 * Addressed by id rather than nested under its event: an item does not move
 * between events, and the programme the organizer is looking at already holds
 * the id.
 *
 * Behind the administrative guard by virtue of its path (E16).
 */
@ApiTags('program')
@Controller('admin/program-items')
export class AdminProgramItemsController {
  constructor(private readonly program: ProgramService) {}

  @Patch(':id')
  @ApiOperation({
    summary: 'Change a session — title, abstract, speaker or time',
    description:
      'The period is only re-checked when it is part of the change: shifting an ' +
      'event leaves its programme behind outside the new period, and an item ' +
      'that can no longer be edited could no longer be moved back in either.',
  })
  @ApiOkResponse({ type: ProgramItemDto })
  @ApiBadRequestResponse({
    description: 'A new period outside the event, or ending before it starts.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No programme item with that id.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProgramItemDto,
  ): Promise<ProgramItemDto> {
    return this.program.update(id, body) as Promise<ProgramItemDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a session from the programme',
    description:
      'No archiving and no confirmed-registration rule of its own (unlike an ' +
      'event, E14): a programme item is a plan. From AP 9 its sign-ups go with ' +
      'it through the database cascade.',
  })
  @ApiNoContentResponse({ description: 'Removed.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No programme item with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.program.delete(id);
  }
}
