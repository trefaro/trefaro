import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  NotFoundException,
  Patch,
  Put,
  Res,
  StreamableFile,
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
  ApiNotFoundResponse,
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
import type { Response } from 'express';
import type { TrefaroEnv } from '../../core/config/env';
import { ENV } from '../../core/config/env.module';
import { contentDisposition } from '../attachments/file-name';
import {
  IMAGE_UPLOAD_OPTIONS,
  type ImageMultipartFile,
} from '../common/image-upload';
import { refuse } from '../common/problem';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import { PrivacyService } from '../privacy';
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
  DeleteAccountDto,
  UpdateProfileDto,
} from './dto/update-profile.dto';
import type { AuthenticatedParticipant } from './ports/user-session.repository';
import { ProfilesService } from './profiles.service';
import {
  USER_SESSION_COOKIE,
  userSessionCookieOptions,
} from './user-session-cookie';

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
  constructor(
    private readonly profiles: ProfilesService,
    // The archive is built here rather than in the accounts module: what it
    // holds reaches across registrations, conversations and consents (E65).
    private readonly privacy: PrivacyService,
    // For the cookie's flags, which have to match the ones it was set with.
    @Inject(ENV) private readonly env: TrefaroEnv,
  ) {}

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
      throw refuse('problem.branding.imagePartMissing', {
        part: BRANDING_IMAGE_PART,
      });
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

  @Get('export')
  // The archive holds a passport scan as readily as a name; nothing about it
  // belongs in a shared cache, and nothing in it may be sniffed into a type.
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  @ApiOperation({
    summary: 'Download everything this instance stores about me',
    description:
      'One request, one archive (E65). `export.json` holds the data — the ' +
      'account, every registration made with this address, the programme ' +
      'sign-ups, the newsletter consents, the conversations and the sessions ' +
      '— and beside it lie the files that were uploaded, under the names they ' +
      'were uploaded with. `README.txt` says what is in it and what is not, ' +
      "in this account's language. Credentials are left out on purpose: a " +
      'session token and the keys of a push subscription are what a device ' +
      'authenticates with, not something a person needs a copy of.',
  })
  @ApiOkResponse({
    description: 'The archive.',
    content: {
      'application/zip': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiUnauthorizedResponse({ description: 'No valid session.' })
  @ApiNotFoundResponse({ description: 'The account is gone.' })
  async exportData(
    @CurrentParticipant() current: AuthenticatedParticipant,
  ): Promise<StreamableFile> {
    const archive = await this.privacy.exportFor(current.profile.id);
    // A session can outlive its profile by the width of a request — a second
    // tab that deleted the account. That is a 404, not a failure.
    if (!archive) throw new NotFoundException('This account no longer exists.');

    return new StreamableFile(archive.bytes, {
      type: 'application/zip',
      disposition: contentDisposition(archive.fileName),
      length: archive.bytes.length,
    });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete this account',
    description:
      'With the current password, for the reason the password change asks ' +
      'for it: of everything a session can do, this is the one that cannot be ' +
      'taken back. What happens is three things and they are different from ' +
      'one another (E65) — the account, its sessions, its subscriptions, its ' +
      'consents and the files it uploaded **go**; the conversations it took ' +
      'part in and the forum threads it opened **stay**, because somebody ' +
      'else wrote in them; and its registrations **stop naming anybody**, so ' +
      'that an event that happened still says how many people were at it. ' +
      'Somebody who wants to withdraw from an event ahead of them cancels it ' +
      'first: an erasure says nothing about whether they are coming.',
  })
  @ApiNoContentResponse({ description: 'Gone. The session cookie is cleared.' })
  @ApiUnauthorizedResponse({
    description: 'No valid session, or the password is not right.',
  })
  async deleteAccount(
    @CurrentParticipant() current: AuthenticatedParticipant,
    @Body() body: DeleteAccountDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.profiles.deleteAccount(current, body);
    // The session rows went with the account; this is the browser's copy.
    response.clearCookie(
      USER_SESSION_COOKIE,
      userSessionCookieOptions(this.env),
    );
  }
}
