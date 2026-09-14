import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { ContactOptOutResultDto } from './dto/invitation.dto';
import { InvitationOptOutDto } from './dto/opt-out.dto';
import { OPT_OUT_CALLS_PER_WINDOW } from './invitations.limits';
import {
  INVITATION_OPT_OUT_ROUTE,
  ONE_CLICK_FIELD,
  ONE_CLICK_SEGMENT,
  ONE_CLICK_VALUE,
} from './invitations.routes';
import { InvitationsService } from './invitations.service';

/**
 * "Do not invite me again" (FR 2.4, E15).
 *
 * The one public endpoint of this module, and the only reason writing to former
 * participants is legitimate at all: every invitation carries a link here, the
 * link needs no account, and one click ends it — for this address, everywhere
 * in this instance (F57).
 *
 * Under `/api/user/**`, so outside the administrative guard (E16) and
 * authorized by the signed token instead. A `POST` rather than a `GET` for the
 * reason of E5b: a link previewer must not decide this on the reader's behalf.
 */
@ApiTags('invitations')
@Controller(INVITATION_OPT_OUT_ROUTE)
@Throttle({ default: { limit: OPT_OUT_CALLS_PER_WINDOW, ttl: minutes(5) } })
export class PublicInvitationOptOutController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post()
  // 200, not 201: nothing is created — a flag is set on rows that already
  // exist. The same choice as confirming a registration and as the self-service
  // operations, all of which are POSTs that change something.
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Object to being invited again (E15)',
    description:
      'Sets `contact_opt_out` on every registration of this address, across ' +
      'the whole instance — the objection belongs to the person, not to the row ' +
      'the link happened to be signed for (F57). Afterwards the address is in ' +
      'no contact list any more. Idempotent: a second click answers ' +
      '`already-opted-out`. Transactional mail — a confirmation, a cancellation ' +
      'notice — is unaffected (F59): somebody who does not want invitations ' +
      'still has to learn that their registration was cancelled.',
  })
  @ApiOkResponse({ type: ContactOptOutResultDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  @ApiNotFoundResponse({
    description: 'The registration the link speaks for no longer exists.',
  })
  optOut(@Body() body: InvitationOptOutDto): Promise<ContactOptOutResultDto> {
    return this.invitations.optOut(
      body.token,
    ) as Promise<ContactOptOutResultDto>;
  }

  /**
   * The same objection, made by the reader's mail client (RFC 8058).
   *
   * Every invitation carries `List-Unsubscribe` and `List-Unsubscribe-Post`,
   * which is what puts an unsubscribe button in the mail client's own chrome —
   * and what keeps Gmail and Outlook from treating a bulk message as more
   * likely to be spam for lacking one. An invitation that lands in spam has an
   * objection link nobody ever sees, so this header is part of E15 working
   * rather than a courtesy next to it.
   *
   * **Why this may be a one-click POST when the page above may not** (E5b).
   * The rule E5b protects against is a *link previewer*: something that follows
   * every URL in a message to build a thumbnail, deciding on the reader's
   * behalf. Three things make this request a different thing:
   *
   * 1. It is not a link. It is in a header, not in the body, and nothing
   *    renders it — the only software that acts on it is one that implements
   *    RFC 8058 on purpose.
   * 2. It is a `POST` with a body that says so. A previewer that follows URLs
   *    sends a `GET`, and a `GET` here is not a route at all; the required
   *    `{@link ONE_CLICK_FIELD}={@link ONE_CLICK_VALUE}` field is the marker
   *    only a client that means it sends.
   * 3. It can only ever take something away, and only from the person who
   *    received the letter (F58). If it were triggered by mistake, what
   *    happened is that somebody stopped being invited — reversible by
   *    registering for the next event, and the error in the harmless
   *    direction. The confirmation link E5b was written for is the opposite:
   *    it *creates* a registration, and a wrongly-confirmed opt-in is a
   *    consent nobody gave.
   *
   * Answers `204` and nothing else: no page, no body, nobody reading it.
   */
  @Post(ONE_CLICK_SEGMENT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'One-click objection from a mail client (RFC 8058)',
    description:
      'The endpoint named in the `List-Unsubscribe` header of every ' +
      'invitation. Does exactly what the page above does — sets ' +
      '`contact_opt_out` on every registration of this address (F57) — and ' +
      'differs only in who calls it: a mail client, on the reader pressing ' +
      'its unsubscribe button, never a browser. The token is in the query ' +
      'because a header has no page to put it on, and the body must carry ' +
      `\`${ONE_CLICK_FIELD}=${ONE_CLICK_VALUE}\` exactly as RFC 8058 ` +
      'prescribes: it is what tells this request apart from a link previewer ' +
      'opening a URL it found (E5b). Idempotent — a second one changes ' +
      'nothing and still answers 204.',
  })
  @ApiQuery({ name: 'token', description: 'The signed objection token (F58).' })
  @ApiNoContentResponse({ description: 'The objection is recorded.' })
  @ApiBadRequestResponse({
    description:
      'Missing, forged or expired token — or a body that is not the ' +
      'one-click form of RFC 8058.',
  })
  @ApiNotFoundResponse({
    description: 'The registration the link speaks for no longer exists.',
  })
  async oneClick(
    @Query('token') token: string | undefined,
    @Body() body: unknown,
  ): Promise<void> {
    if (!oneClickRequest(body)) {
      throw new BadRequestException(
        `This endpoint answers the one-click unsubscribe of RFC 8058 only: ` +
          `the request body has to be \`${ONE_CLICK_FIELD}=${ONE_CLICK_VALUE}\`. ` +
          'A person objecting reads the link in the invitation instead.',
      );
    }
    await this.invitations.optOut(token ?? '');
  }
}

/**
 * Whether this is the request RFC 8058 describes, rather than something that
 * found the URL.
 *
 * Case-insensitive on the value because the RFC's own spelling is `One-Click`
 * and implementations vary; the field name is compared as written, which is
 * how it arrives from every client that sends it.
 */
function oneClickRequest(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false;
  const marker = (body as Record<string, unknown>)[ONE_CLICK_FIELD];
  return (
    typeof marker === 'string' &&
    marker.toLowerCase() === ONE_CLICK_VALUE.toLowerCase()
  );
}
