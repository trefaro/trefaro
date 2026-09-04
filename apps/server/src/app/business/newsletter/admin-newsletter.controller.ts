import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { NEWSLETTER_MODULE_KEY } from '@trefaro/shared-models';
import { ApiLocaleQuery, LocaleQueryPipe } from '../common/locale-query.pipe';
import { CoreModuleController, CoreModuleEnabledGuard } from '../config';
import {
  ListNewsletterDto,
  NewsletterAudiencePageDto,
} from './dto/newsletter-audience.dto';
import { NewsletterService } from './newsletter.service';

/**
 * The opt-in administration an organizer reads (FR 4.8, E45).
 *
 * Two routes, and the shorter list is the point: there is no route that sends
 * anything, and there is no route that adds an address. An organizer cannot put
 * somebody on this list — a consent is given by the person behind the address
 * and by nobody else, which is the same rule that stops an organizer confirming
 * a registration (F31).
 *
 * Behind `newsletter-opt-in` like the public half (F53): a switched-off module
 * has no overview, and switching it off deletes no consent (E14).
 */
@ApiTags('newsletter')
@UseGuards(CoreModuleEnabledGuard)
@CoreModuleController(NEWSLETTER_MODULE_KEY)
@Controller('admin/newsletter')
export class AdminNewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Get()
  @ApiOperation({
    summary: 'The addresses this instance may write to, and where each is from',
    description:
      'One row per consent, over both sources: the checkbox in a registration ' +
      'form and the sign-up in the app (E45). Unconfirmed sign-ups are absent ' +
      'from both — a request is not a consent — and so is any address that ' +
      'objected to being written to (F24). The counts say how the rows split ' +
      'between the sources and how many distinct addresses they are.',
  })
  @ApiLocaleQuery()
  @ApiOkResponse({ type: NewsletterAudiencePageDto })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  list(
    @Query() query: ListNewsletterDto,
    @Query('locale', LocaleQueryPipe) locale?: string,
  ): Promise<NewsletterAudiencePageDto> {
    return this.newsletter.audience(
      query,
      locale,
    ) as Promise<NewsletterAudiencePageDto>;
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Take one sign-up back (E45)',
    description:
      'How an organization honours a withdrawal: the row goes, because ' +
      'keeping the record of a consent that no longer exists is the opposite ' +
      'of what the person asked for — the exception E14 leaves room for. Only ' +
      'a sign-up made in the app has an id here; a checkbox in a registration ' +
      'form is part of that registration. Idempotent, so a second click is ' +
      'not an error.',
  })
  @ApiNoContentResponse({ description: 'Gone, or was already.' })
  @ApiUnauthorizedResponse({ description: 'No administrative session.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.newsletter.remove(id);
  }
}
