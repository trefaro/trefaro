import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { NEWSLETTER_MODULE_KEY } from '@trefaro/shared-models';
import { RateLimit } from '../../core/throttling/rate-limit.decorator';
import { ThrottleByRecipient } from '../../core/throttling/recipient-throttle.interceptor';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import {
  ConfirmNewsletterDto,
  NewsletterConfirmationDto,
  NewsletterSignupAcknowledgementDto,
  NewsletterSignupDto,
} from './dto/newsletter.dto';
import { NewsletterService } from './newsletter.service';

/**
 * Signing up for the newsletter, and confirming it (FR 4.8, E45).
 *
 * Under `/api/user`, like the account routes and for the same reason: at this
 * point there is nobody to authenticate, and the prefix carries the guard
 * (E33). No session is read at all — not even optionally, as the push endpoint
 * does (E43). A newsletter address is an address, and a person who happens to
 * be logged in has not said anything different by signing up.
 *
 * Both routes answer 404 while `newsletter-opt-in` is off (F53), which is the
 * default: an instance that has no way of sending news should not offer to
 * collect addresses for it.
 */
@ApiTags('newsletter')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(NEWSLETTER_MODULE_KEY)
@Controller('user/newsletter')
@RateLimit('newsletter-signup')
export class PublicNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  // The sign-up mails whoever is named in the body, so it counts twice: once
  // against the caller, once against the inbox.
  @ThrottleByRecipient()
  @ApiOperation({
    summary: 'Sign an address up for the newsletter (FR 4.8)',
    description:
      'Answers the same way whether the address is new, waiting for its ' +
      'confirmation, or already on the list (E45, E32) — and the same way ' +
      'again when the mail could not be sent, because an answer that varied ' +
      'with the mail server would tell a stranger which addresses this ' +
      'instance knows. 200 rather than 201: the caller learns that a mail may ' +
      'be on its way, never whether a row was written.',
  })
  @ApiOkResponse({ type: NewsletterSignupAcknowledgementDto })
  @ApiBadRequestResponse({ description: 'That is not an e-mail address.' })
  @ApiNotFoundResponse({
    description:
      'No published series at that slug. About a series, not about an ' +
      'address — series are public.',
  })
  signUp(
    @Body() body: NewsletterSignupDto,
  ): Promise<NewsletterSignupAcknowledgementDto> {
    return this.newsletter.subscribe(
      body,
    ) as Promise<NewsletterSignupAcknowledgementDto>;
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a sign-up with the token from the mailed link',
    description:
      'A POST although the person arrives by clicking a link: the link opens ' +
      'a page and the page posts here (E5b), so a mail scanner that prefetches ' +
      'links confirms nothing. Idempotent — a second click reports ' +
      '`already-confirmed` rather than failing.',
  })
  @ApiOkResponse({ type: NewsletterConfirmationDto })
  @ApiBadRequestResponse({
    description:
      'The token is malformed, forged, expired, or names a sign-up that is ' +
      'gone — said the same way for all four.',
  })
  confirm(
    @Body() body: ConfirmNewsletterDto,
  ): Promise<NewsletterConfirmationDto> {
    return this.newsletter.confirm(
      body.token,
    ) as Promise<NewsletterConfirmationDto>;
  }
}
