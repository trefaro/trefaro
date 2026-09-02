import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PROFILES_MODULE_KEY } from '@trefaro/shared-models';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import {
  CreateProfileFieldDto,
  ProfileFieldDto,
  ReorderProfileFieldsDto,
  UpdateProfileFieldDto,
} from './dto/profile-field.dto';
import { ProfileFieldsService } from './profile-fields.service';

/**
 * The profile form, as the organizer builds it (FR 4.3 — E35).
 *
 * One flat collection and no parent in the path, which is the whole of E35: the
 * questions are instance-wide, because a profile belongs to the person and not
 * to an event. The registration kit's routes are nested under their event for
 * exactly the opposite reason.
 *
 * Behind the administrative session by virtue of its path (E16), and behind the
 * `profiles` module switch: an organization that keeps no accounts has no
 * profile form to configure (F53).
 */
@ApiTags('profile fields')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('admin/profile-fields')
export class AdminProfileFieldsController {
  constructor(private readonly fields: ProfileFieldsService) {}

  @Get()
  @ApiOperation({ summary: 'The profile questions, in form order' })
  @ApiOkResponse({ type: [ProfileFieldDto] })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  list(): Promise<ProfileFieldDto[]> {
    return this.fields.listForOrganizer() as Promise<ProfileFieldDto[]>;
  }

  @Post()
  @ApiOperation({
    summary: 'Add a question to the profile form',
    description:
      'Appended to the end of the form. The key an answer is stored under is ' +
      'derived from the label unless one is given, and is fixed from then on ' +
      '(F35). Existing profiles are untouched: a new question is unanswered, ' +
      'not invalid.',
  })
  @ApiCreatedResponse({ type: ProfileFieldDto })
  @ApiBadRequestResponse({
    description:
      'A selection question without choices, or another type with them.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiConflictResponse({
    description: 'The form is full, or the key is one the profile owns.',
  })
  create(@Body() body: CreateProfileFieldDto): Promise<ProfileFieldDto> {
    return this.fields.create(body) as Promise<ProfileFieldDto>;
  }

  @Put('order')
  @ApiOperation({
    summary: 'Reorder the whole form',
    description:
      'Takes every question id exactly once. A partial list is refused: it ' +
      'would renumber some questions and leave the others at positions that ' +
      'no longer mean anything.',
  })
  @ApiOkResponse({ type: [ProfileFieldDto] })
  @ApiBadRequestResponse({
    description: 'The list is not exactly the questions there are.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  reorder(@Body() body: ReorderProfileFieldsDto): Promise<ProfileFieldDto[]> {
    return this.fields.reorder(body.ids) as Promise<ProfileFieldDto[]>;
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Reword a question, or change whether it is required',
    description:
      'Neither the type nor the key can be changed: both are what the answers ' +
      'already given depend on. The label can — correcting the wording of a ' +
      'question is the most ordinary change there is, and the key does not ' +
      'follow it.',
  })
  @ApiOkResponse({ type: ProfileFieldDto })
  @ApiBadRequestResponse({
    description: 'Choices offered for a question that is not a selection.',
  })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No question with that id.' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateProfileFieldDto,
  ): Promise<ProfileFieldDto> {
    return this.fields.update(id, body) as Promise<ProfileFieldDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a question from the profile form',
    description:
      'Allowed whatever has already been answered, and the answers **stay** ' +
      '(F34). What somebody wrote about themselves is theirs; the definition ' +
      'was only the question. Nothing renders the leftover answers any more, ' +
      'which is the point of removing the question — and if the same key is ' +
      'ever defined again, they are still there and still mean what they meant.',
  })
  @ApiNoContentResponse({ description: 'Removed; the answers stay.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  @ApiNotFoundResponse({ description: 'No question with that id.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.fields.delete(id);
  }
}
