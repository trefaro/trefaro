import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SETUP_TOKEN_HEADER } from '@trefaro/shared-models';
import type { Request } from 'express';
import { SetupService } from './setup.service';

/**
 * Guards the first-run setup: gone once it is done, locked while it is not
 * (E28).
 *
 * Two answers, and the difference between them is deliberately the only thing
 * this endpoint tells an anonymous caller:
 *
 * - **404** — an administrator exists. The setup is not "forbidden", it does not
 *   exist any more, the same answer a switched-off module gives (F53). Nothing
 *   an operator can do brings it back; the way in is the login form.
 * - **401** — the instance is still unclaimed and the token is missing or wrong.
 *
 * That distinction is what lets the organizer client decide which screen to show
 * before anybody has typed anything, without the state's body ever being handed
 * out. It reveals only "this instance has no administrator yet", which the same
 * caller could observe from the `POST` regardless — and which stops being true
 * the moment somebody sets it up.
 *
 * No rate limit tighter than the global one, unlike the login: a password is
 * chosen by a person and can be guessed, a 256-bit random token cannot. A limit
 * that protects nothing would still have to be survived by the tests, and a
 * limit that gets relaxed for tests stops being a limit (E4).
 */
@Injectable()
export class SetupGuard implements CanActivate {
  constructor(private readonly setup: SetupService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!(await this.setup.isPending())) {
      throw new NotFoundException();
    }

    const request = context.switchToHttp().getRequest<Request>();
    if (!this.setup.acceptsToken(request.headers[SETUP_TOKEN_HEADER])) {
      throw new UnauthorizedException(
        'The setup token is missing or wrong. It is printed in the server log on ' +
          'startup while this instance has no administrator.',
      );
    }

    return true;
  }
}
