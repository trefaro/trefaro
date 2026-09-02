import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { SETUP_TOKEN_HEADER } from '@trefaro/shared-models';
import { AllowAnonymous } from '../common/allow-anonymous';
import {
  CompleteSetupDto,
  SetupResultDto,
  SetupStateDto,
} from './dto/setup.dto';
import { SetupGuard } from './setup.guard';
import { SetupService } from './setup.service';

/**
 * The way into a fresh instance (FR 1.1, E28).
 *
 * Deliberately **not** under `admin/`: the administrative guard hangs on that
 * prefix (E16) and would require the session this route exists to make possible.
 * It is not public either — {@link SetupGuard} gates both handlers on the setup
 * token and, once an administrator exists, removes them from the API altogether.
 *
 * Two endpoints and no more. Everything else the wizard shows — the fonts, the
 * logo, the modules — has a page in the organizer client already, and a second
 * unauthenticated way to write it would be a second thing to defend.
 *
 * `@AllowAnonymous()` is the third use of a decorator that had exactly two, and
 * it is here for a mechanical reason rather than a conceptual one (F69): the
 * administrative guard reads each *declared* path on its own, and `@Post('admin')`
 * under `@Controller('setup')` looks like an administrative route to it even
 * though the URL is `/api/setup/admin`. Without this the endpoint would answer
 * 401 — the guard over-approximates on purpose, because erring the other way
 * means an open endpoint. What actually protects these two handlers is
 * {@link SetupGuard}, which is stricter than a session: it demands a secret the
 * process printed *and* an `admin_user` table that is still empty.
 */
@ApiTags('administration')
@ApiHeader({
  name: SETUP_TOKEN_HEADER,
  required: true,
  description:
    'The setup token from the server log. Required by both handlers while the ' +
    'instance has no administrator; both answer 404 once it has one.',
})
@AllowAnonymous()
@UseGuards(SetupGuard)
@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('state')
  @ApiOperation({
    summary:
      'What the first-run setup form needs, and what this deployment is missing',
    description:
      'The status code carries the availability: 401 means the instance is ' +
      'unclaimed and the token was missing or wrong, 404 means an administrator ' +
      'exists and the setup is over. The organizer client uses that difference ' +
      'to decide which screen to show before anybody has typed a token.',
  })
  @ApiOkResponse({ type: SetupStateDto })
  @ApiUnauthorizedResponse({ description: 'Missing or wrong setup token.' })
  @ApiNotFoundResponse({
    description: 'This instance already has an administrator.',
  })
  state(): Promise<SetupStateDto> {
    return this.setup.state() as Promise<SetupStateDto>;
  }

  @Post('admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create the first administrator and the instance identity',
    description:
      'One request for the account, the name, the language and the two brand ' +
      'colours. Answers 404 from then on — including to a second submission — ' +
      'and does not hand out a session: the operator signs in on the login ' +
      'form, which is where a deployment without TLS shows itself (E2).',
  })
  @ApiCreatedResponse({ type: SetupResultDto })
  @ApiBadRequestResponse({
    description:
      'A colour that is not hexadecimal, a language this instance cannot send ' +
      'mail in, an empty name, or a password shorter than the policy allows.',
  })
  @ApiUnauthorizedResponse({ description: 'Missing or wrong setup token.' })
  @ApiNotFoundResponse({
    description: 'This instance already has an administrator.',
  })
  complete(@Body() body: CompleteSetupDto): Promise<SetupResultDto> {
    return this.setup.complete(body) as Promise<SetupResultDto>;
  }
}
