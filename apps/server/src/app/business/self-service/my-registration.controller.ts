import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
import { MyRegistrationDto } from './dto/my-registration.dto';
import { SelfServiceTokenDto } from './dto/self-service-token.dto';
import { SELF_SERVICE_CALLS_PER_WINDOW } from './self-service.limits';
import { SelfServiceService } from './self-service.service';

/**
 * "My registration" (E11) — the participant's own view, with no account.
 *
 * Under `/api/user/**`, so it is outside the administrative guard (E16) and
 * authorized by the signed token instead. The read takes it in the query,
 * because that is what the link in the mail carries; everything that changes
 * something takes it in the body, so a link previewer cannot cancel a
 * registration by fetching a URL (the reasoning of E5b, applied again).
 */
@ApiTags('registrations')
@Controller('user/registrations/me')
@Throttle({
  default: { limit: SELF_SERVICE_CALLS_PER_WINDOW, ttl: minutes(5) },
})
export class MyRegistrationController {
  constructor(private readonly selfService: SelfServiceService) {}

  @Get()
  @ApiOperation({
    summary: 'The participant’s own registration and their sign-ups (E11)',
    description:
      'Answers for a registration whose event has since gone back to being a ' +
      'draft as well: the link was granted before that, and an organizer ' +
      'unpublishing an event must not turn it into an error.',
  })
  @ApiQuery({
    name: 'token',
    description: 'From the personal link in the mail.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  @ApiConflictResponse({
    description: 'The registration was cancelled, or is not confirmed yet.',
  })
  view(
    @Query('token') token?: string,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.view(
      required(token),
      locale,
    ) as Promise<MyRegistrationDto>;
  }

  @Post('cancellation')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel one’s own registration (E11)',
    description:
      'Cancelled, not erased: the row is the record of the opt-in this ' +
      'organization can show (F23), and the seat is free without it ' +
      'disappearing. The seats in individual sessions go with it — somebody who ' +
      'is not coming is not coming to the workshop either.',
  })
  // The language is in the query even here, where the token is in the body
  // (F44): a rendering preference is not a secret, and every one of these
  // answers is the whole self-service page. A page that fell back to English the
  // moment somebody used it would change language when it is used.
  @ApiLocaleQuery()
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  cancel(
    @Body() body: SelfServiceTokenDto,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<MyRegistrationDto> {
    return this.selfService.cancel(
      body.token,
      locale,
    ) as Promise<MyRegistrationDto>;
  }
}

/**
 * A query parameter arrives as `undefined` when it is not in the URL.
 *
 * Said as its own message rather than as "invalid": a mail client that broke the
 * link across two lines is the usual cause, and the participant can act on that.
 */
function required(token: string | undefined): string {
  if (!token) {
    throw new BadRequestException(
      'This address is missing its token. Please open the whole link from your ' +
        'e-mail, including everything after the question mark.',
    );
  }
  return token;
}
