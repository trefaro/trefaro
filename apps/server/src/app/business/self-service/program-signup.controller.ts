import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle, minutes } from '@nestjs/throttler';
import { MyRegistrationDto } from './dto/my-registration.dto';
import { SelfServiceTokenDto } from './dto/self-service-token.dto';
import { SELF_SERVICE_CALLS_PER_WINDOW } from './self-service.limits';
import { SelfServiceService } from './self-service.service';

/**
 * Claiming and giving up a seat in one session (FR 3.10, E11).
 *
 * `PUT` and `DELETE` rather than two POSTs: having a seat is a state, and both
 * calls are idempotent — pressing a button twice is not two seats, and giving up
 * a seat one does not hold is not an error.
 *
 * Both carry the token in the body. A `DELETE` with a body is the unusual half
 * of that, and deliberate: the alternative puts a credential in the query string
 * of every access log line, and the read endpoint is the only one where the link
 * itself already does that.
 *
 * Both answer with the whole self-service view. A seat can be taken between
 * rendering the page and pressing the button, so the answer has to be able to
 * say what is left rather than only what was asked for.
 */
@ApiTags('program')
@Controller('user/program-items/:id/signup')
@Throttle({
  default: { limit: SELF_SERVICE_CALLS_PER_WINDOW, ttl: minutes(5) },
})
export class ProgramSignupController {
  constructor(private readonly selfService: SelfServiceService) {}

  @Put()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign up for a programme item (FR 3.10)',
    description:
      'Refused for a session that does not ask for sign-up, one that has ' +
      'already taken place, and one whose seats are gone — the last of those ' +
      'decided when the seat is written, not when the page was rendered.',
  })
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  @ApiConflictResponse({
    description: 'The session takes no sign-up, is over, or is full.',
  })
  @ApiNotFoundResponse({
    description:
      'No such session in this participant’s own event. Said the same way for ' +
      'an unknown id and for a session of another event — the difference is ' +
      'not the holder of a link’s to learn.',
  })
  signUp(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SelfServiceTokenDto,
  ): Promise<MyRegistrationDto> {
    return this.selfService.signUp(
      id,
      body.token,
    ) as Promise<MyRegistrationDto>;
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Give up a seat (FR 3.10)',
    description:
      'Always allowed, even in a session whose sign-up an organizer has since ' +
      'switched off and even after it has started: somebody who cannot come ' +
      'says so, and a rule that traps people in a list makes the list wrong.',
  })
  @ApiOkResponse({ type: MyRegistrationDto })
  @ApiBadRequestResponse({ description: 'Missing, forged or expired token.' })
  @ApiNotFoundResponse({ description: 'No such session in their own event.' })
  signOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SelfServiceTokenDto,
  ): Promise<MyRegistrationDto> {
    return this.selfService.signOff(
      id,
      body.token,
    ) as Promise<MyRegistrationDto>;
  }
}
