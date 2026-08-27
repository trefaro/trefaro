import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import {
  ApiAcceptedResponse,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiNotFoundResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import type { RegistrationInput } from '@trefaro/shared-models';
import {
  MAX_FILE_FIELDS,
  MAX_UPLOAD_BYTES,
  REGISTRATION_PAYLOAD_PART,
} from '@trefaro/shared-models';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { RegistrationAcknowledgementDto } from './dto/registration.dto';
import {
  RegistrationSubmissionPipe,
  toUploadedFiles,
  type MultipartFile,
} from './registration-submission.pipe';
import { RegistrationService } from './registration.service';

/**
 * Attempts allowed per client address per five minutes.
 *
 * Every accepted registration sends a mail, so this endpoint is a way to send
 * mail to someone else's inbox — the reason it is throttled more tightly than
 * the default. Deliberately without a block period, unlike the login: a
 * participant who mistypes their address a few times has to be able to fix it.
 *
 * Raised from 30 in AP 7. Two reasons, and the second one is the honest trigger:
 * an office or a school shares one public address, so twenty colleagues signing
 * up for the same event within a few minutes are one client here — and the API
 * contract suite, which now exercises this endpoint from three files, ran into
 * the old number. Twelve attempts a minute is still a tight bound on the way
 * this endpoint could be abused.
 *
 * What it does *not* bound is attempts per e-mail address; that needs a second
 * counter and is noted for the hardening of phase 5.
 */
export const REGISTRATIONS_PER_WINDOW = 60;

/**
 * What the multipart parser accepts, and how it reads a file name.
 *
 * The limits are the bound on what one request of a public, unauthenticated
 * endpoint may cost: nothing is written until every check has passed, so the
 * file size is also the most this can make the server hold in memory.
 *
 * `defParamCharset` is multer's own option, which Nest's option type does not
 * declare — which is also why these options are a named constant rather than a
 * literal at the call site. It has to be set: browsers send a file name as
 * UTF-8, multer decodes it as latin1 by default, and "Grüße.pdf" would reach
 * this application as mojibake before anything here could notice. Found by the
 * contract test that downloads a file again under its own name.
 */
const UPLOAD_OPTIONS = {
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: MAX_FILE_FIELDS,
    // One text part: the JSON payload. Everything else is a file.
    fields: 1,
  },
  defParamCharset: 'utf8',
};

/**
 * Registering for an event, as a participant (UC 07, FR 3.5).
 *
 * No login: phase 1 has no participant accounts, and the thesis asks for the
 * lowest possible entry threshold. The address is verified by the double opt-in
 * mail instead of by an account.
 *
 * The path follows the event's public address, which is unique per series rather
 * than per instance (E7) — so `/series/:series/events/:event/registrations`,
 * not the flat `/events/:slug/registrations` the plan sketched.
 *
 * Two content types, one endpoint (E9): a form without a file field sends JSON,
 * a form with one sends `multipart/form-data`. What bounds the multipart case is
 * declared right here rather than in a module-wide default — this is the only
 * unauthenticated endpoint of the instance that accepts files at all, and how
 * much a stranger may send it should be readable in the same file that accepts
 * it.
 */
@ApiTags('registrations')
@Controller('user/series/:seriesSlug/events/:eventSlug/registrations')
export class PublicRegistrationsController {
  constructor(private readonly registrations: RegistrationService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: { limit: REGISTRATIONS_PER_WINDOW, ttl: minutes(5) },
  })
  @UseInterceptors(AnyFilesInterceptor(UPLOAD_OPTIONS))
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiBody({ type: CreateRegistrationDto })
  @ApiOperation({
    summary: 'Register for a published event',
    description:
      'Answers 202 in every case in which the request was well formed — a ' +
      'known address, an unknown one and an already confirmed one are ' +
      'indistinguishable from the outside (E10). Nothing is registered until ' +
      'the mailed link is confirmed.\n\n' +
      'A form with a file field is submitted as `multipart/form-data`: the ' +
      `body above travels in the \`${REGISTRATION_PAYLOAD_PART}\` part as JSON, and ` +
      'each file in a part named after its field key. Everything else sends ' +
      'plain JSON.',
  })
  @ApiAcceptedResponse({ type: RegistrationAcknowledgementDto })
  @ApiPayloadTooLargeResponse({
    description: `A file above ${MAX_UPLOAD_BYTES} bytes, which no field can raise.`,
  })
  @ApiNotFoundResponse({
    description: 'No published event at that address.',
  })
  @ApiConflictResponse({ description: 'The event has already taken place.' })
  @ApiServiceUnavailableResponse({
    description:
      'The confirmation mail could not be sent. The attempt can be repeated; ' +
      'it will not create a second registration.',
  })
  register(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
    // Typed as the interface, not as the DTO: the metatype of a class parameter
    // would send the *raw* body through the global pipe, which for a multipart
    // request is a flat map of strings and fails every rule at once. The pipe
    // below unwraps it and then applies exactly those rules.
    @Body(RegistrationSubmissionPipe) body: RegistrationInput,
    @UploadedFiles() files: MultipartFile[] | undefined,
  ): Promise<RegistrationAcknowledgementDto> {
    return this.registrations.register(
      seriesSlug,
      eventSlug,
      body,
      toUploadedFiles(files),
    ) as Promise<RegistrationAcknowledgementDto>;
  }
}
