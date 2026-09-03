import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import {
  ContactRequestAcknowledgementDto,
  CreateContactRequestDto,
} from './dto/contact-request.dto';
import { OrganizerContactService } from './organizer-contact.service';

/**
 * Attempts allowed per client address per five minutes.
 *
 * Tighter than the registration form's sixty, and for a different reason: an
 * accepted request writes a conversation into the organization's overview and
 * sends it a mail, so this endpoint is a way to fill somebody's inbox. Nobody
 * legitimately asks thirty questions about one event in five minutes, and an
 * office behind one public address — the case that raised the registration
 * limit — does not apply here either.
 *
 * Deliberately without a block period, like the registration form: somebody
 * who mistyped their own address has to be able to write again.
 */
export const CONTACT_REQUESTS_PER_WINDOW = 30;

/**
 * The contact form of an event landing page (FR 3.4, UC 14, F11).
 *
 * Four things hang on the path and the decorators rather than on code in the
 * handler:
 *
 * 1. **No login, and none possible.** `/api/user` is the anonymous prefix
 *    (E33), which is the whole point: whoever reads a landing page can ask a
 *    question without an account, and the answer reaches them by mail (F11).
 * 2. **No module switch.** The other controllers of this module carry
 *    `@CoreModuleController(CHAT_MODULE_KEY)`; this one must not. FR 3.4 is a
 *    P1 requirement, the chat is an optional P2 module, and `chat` requires
 *    `profiles` (E42) — so an instance that runs no participant accounts would
 *    otherwise have no contact form. The switch says whether the people in an
 *    instance may write to each other, not whether the organization can be
 *    reached.
 * 3. **Its own throttle**, because `/api/user/**` is what a stranger can
 *    reach (E4).
 * 4. **202, always.** The request is stored and the organization is told, and
 *    both of those are things this caller cannot observe — so the answer says
 *    "accepted" and repeats the address, the same shape the registration form
 *    answers with and for the same reason (E10).
 *
 * The path follows the event's public address like every other public route
 * (E7, F28), and it is the address of a *page*: the form is on the landing
 * page, so a request that could not be traced to an event would be a question
 * without a subject.
 */
@ApiTags('chat')
@Controller('user/series/:seriesSlug/events/:eventSlug/contact')
export class PublicContactController {
  constructor(private readonly contacts: OrganizerContactService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({
    default: { limit: CONTACT_REQUESTS_PER_WINDOW, ttl: minutes(5) },
  })
  @ApiOperation({
    summary: 'Write to the organizers without an account',
    description:
      'Answers 202 for every well-formed request. A known address, an ' +
      'unknown one and one that already has an account are indistinguishable ' +
      'from the outside, and so is a mail server that is down: the question ' +
      'is stored either way, and the organizers see it in their message ' +
      'overview (E10, F11).\n\n' +
      'Text only — this is the one endpoint of the chat that accepts no ' +
      'picture, because nobody has an account behind it.',
  })
  @ApiAcceptedResponse({ type: ContactRequestAcknowledgementDto })
  @ApiBadRequestResponse({
    description: 'A field is missing, too long, or only whitespace.',
  })
  @ApiNotFoundResponse({ description: 'No published event at that address.' })
  submit(
    @Param('seriesSlug') seriesSlug: string,
    @Param('eventSlug') eventSlug: string,
    @Body() body: CreateContactRequestDto,
  ): Promise<ContactRequestAcknowledgementDto> {
    return this.contacts.submit(seriesSlug, eventSlug, body);
  }
}
