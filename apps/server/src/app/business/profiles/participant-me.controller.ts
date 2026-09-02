import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  BRANDING_IMAGE_PART,
  MAX_BRANDING_BYTES,
  PROFILES_MODULE_KEY,
  brandingTypeSummary,
} from '@trefaro/shared-models';
import {
  IMAGE_UPLOAD_OPTIONS,
  type ImageMultipartFile,
} from '../common/image-upload';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { CurrentParticipant } from './current-participant.decorator';
import {
  AvatarImageDto,
  ParticipantAccountDto,
  ParticipantSessionInfoDto,
  toParticipantAccountDto,
} from './dto/participant.dto';
import {
  AvatarUploadDto,
  ChangePasswordDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import { ProfilesService } from './profiles.service';

/**
 * The participant's own account and profile (FR 4.2, FR 4.3).
 *
 * One controller for one screen (F49): the profile page reads `GET`, saves with
 * `PATCH`, and has two side doors of its own — the password and the picture.
 * Those are separate routes rather than fields of the form, and each for its own
 * reason: a password change needs the old password and must not ride along with
 * a name correction, and bytes are written the moment they are uploaded (F116).
 *
 * Everything below `participant/` is behind the session by virtue of its path
 * (E33), and behind the `profiles` module switch (F53).
 */
@ApiTags('profiles')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(PROFILES_MODULE_KEY)
@Controller('participant/me')
export class ParticipantMeController {
  constructor(private readonly profiles: ProfilesService) {}

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

  @Patch()
  @ApiOperation({
    summary: 'Change the profile',
    description:
      'Name, language, field of activity, the answers to this instance’s ' +
      'profile questions, and whether this profile may be found. An absent ' +
      'property is one that does not change; `customFields`, when it is ' +
      'there, is the complete set of answers and is checked against the ' +
      'definitions rather than against this DTO (E35). The address is not ' +
      'changeable at all (E31), and the picture has its own route.',
  })
  @ApiOkResponse({ type: ParticipantAccountDto })
  @ApiBadRequestResponse({
    description:
      'An unknown profile question, an answer of the wrong type, a required ' +
      'question left blank, or an emptied name.',
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  async update(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Body() body: UpdateProfileDto,
  ): Promise<ParticipantAccountDto> {
    return toParticipantAccountDto(
      await this.profiles.updateProfile(current.profile.id, body),
    );
  }

  @Put('password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Change the password',
    description:
      'With the current one, which is what makes this a change and not a ' +
      'reset: whoever is holding this session may have found the screen ' +
      'unlocked. Every **other** session of this account ends afterwards — ' +
      'somebody who changes their password because a device is not theirs any ' +
      'more has said something about that device too.',
  })
  @ApiNoContentResponse({ description: 'Changed; other sessions ended.' })
  @ApiBadRequestResponse({
    description:
      'The new password is shorter or longer than the policy allows.',
  })
  @ApiUnauthorizedResponse({
    description: 'No valid session, or the current password is not right.',
  })
  async changePassword(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    await this.profiles.changePassword(current, body);
  }

  @Put('avatar')
  @UseInterceptors(FileInterceptor(BRANDING_IMAGE_PART, IMAGE_UPLOAD_OPTIONS))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: AvatarUploadDto })
  @ApiOperation({
    summary: 'Replace the profile picture',
    description:
      `Accepts ${brandingTypeSummary()} up to ${MAX_BRANDING_BYTES} bytes; ` +
      "the type is checked against the file's own first bytes (F38). Written " +
      'immediately — it is not part of the profile form and not covered by ' +
      'cancelling it. The picture is then served under a route that carries no ' +
      'stored path (F124).',
  })
  @ApiOkResponse({ type: AvatarImageDto })
  @ApiBadRequestResponse({
    description:
      'No file, an empty one, a type that is not accepted, or bytes that do ' +
      'not match the declared type.',
  })
  @ApiPayloadTooLargeResponse({
    description: `An image above ${MAX_BRANDING_BYTES} bytes.`,
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  async putAvatar(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @UploadedFile() file: ImageMultipartFile | undefined,
  ): Promise<AvatarImageDto> {
    if (!file) {
      throw new BadRequestException(
        `Send the image in a multipart part called "${BRANDING_IMAGE_PART}".`,
      );
    }

    return {
      avatarUrl: await this.profiles.setAvatar(current.profile.id, {
        mimeType: file.mimetype,
        bytes: file.buffer,
      }),
    };
  }

  @Delete('avatar')
  @ApiOperation({
    summary: 'Remove the profile picture',
    description:
      'The profile then shows the initials the clients draw from the name. ' +
      'The file is removed from the upload volume.',
  })
  @ApiOkResponse({ type: AvatarImageDto })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  async removeAvatar(
    @CurrentParticipant() current: AuthenticatedParticipant,
  ): Promise<AvatarImageDto> {
    return { avatarUrl: await this.profiles.removeAvatar(current.profile.id) };
  }
}
